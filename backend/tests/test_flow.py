"""외부 과금 없는 통합 테스트: 실제 DB/API/작업자를 함께 검증합니다."""
import os
import tempfile
import asyncio
import json
import time
from concurrent.futures import ThreadPoolExecutor

TEST_DIR = tempfile.mkdtemp(prefix='maeum-test-')
os.environ['DATA_DIR'] = TEST_DIR
os.environ['DATABASE_URL'] = 'sqlite:///' + TEST_DIR.replace('\\','/') + '/test.db'
os.environ['AI_MODE'] = 'mock'

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from app.main import app
from app.db import Base, engine, Db, Job, Message, ChatLock, ActiveJob
from app.worker import claim_job, process

Base.metadata.create_all(engine)
client = TestClient(app)

def account(name):
    body = {'username':name,'password':'test-password-123','nickname':name}
    assert client.post('/auth/register',json=body).status_code==200
    token = client.post('/auth/login',json=body).json()['token']
    return {'Authorization':'Bearer '+token}

def session(headers):
    return client.post('/sessions',json={'place_id':'forest'},headers=headers).json()['id']

def test_isolation_stream_idempotency_and_gallery():
    a,b = account('user_a'),account('user_b')
    sid = session(a)
    assert client.get(f'/sessions/{sid}/messages',headers=b).status_code==404
    assert client.get('/sessions').status_code==401
    body={'request_id':'request-chat-001','text':'면접이 끝나서 마음이 가벼워졌어.'}
    response = client.post(f'/sessions/{sid}/chat',json=body,headers=a)
    events = [json.loads(line) for line in response.text.splitlines()]
    assert events[-1]['type']=='done'
    assert any(e['type']=='delta' for e in events)
    assert client.post(f'/sessions/{sid}/chat',json=body,headers=a).status_code==200
    messages=client.get(f'/sessions/{sid}/messages',headers=a).json()
    assert len(messages)==2
    preview=client.post(f'/sessions/{sid}/preview',headers=a).json()['summary']
    job_body={'session_id':sid,'request_id':'request-art-001','approved_summary':preview}
    job=client.post('/jobs',json=job_body,headers=a).json()
    assert client.post('/jobs',json=job_body,headers=a).json()['id']==job['id']
    assert client.post('/jobs',json={**job_body,'request_id':'request-art-002'},headers=a).status_code==409
    # 작품 생성 중에도 채팅 요청 가능.
    assert client.post(f'/sessions/{sid}/chat',json={'request_id':'request-chat-002','text':'지금은 친구를 기다려.'},headers=a).status_code==200
    claimed=claim_job()
    assert claimed[0]==job['id']
    assert claim_job() is None
    asyncio.run(process(*claimed))
    assert client.get('/jobs',headers=a).json()[0]['status']=='completed'
    gallery=client.get('/diaries',headers=a).json()
    assert len(gallery)==1 and gallery[0]['poem']
    image=f"/diaries/{gallery[0]['id']}/image"
    assert client.get(image,headers=a).headers['content-type']=='image/png'
    assert client.get(image,headers=b).status_code==404
    assert client.get('/diaries',headers=b).json()==[]
    assert client.get('/jobs',headers=b).json()==[]
    assert client.post('/auth/logout',headers=a).status_code==200
    assert client.get('/me',headers=a).status_code==401

def test_simultaneous_job_submission_and_crash_recovery():
    a=account('race_user'); sid=session(a)
    def submit(number):
        return client.post('/jobs',headers=a,json={'session_id':sid,'request_id':f'concurrent-{number:08}', 'approved_summary':'승인한 마음'}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses=list(pool.map(submit,[1,2]))
    assert sorted(statuses)==[202,409]
    first=claim_job()
    with Db() as db:
        db.execute(update(Job).where(Job.id==first[0]).values(lease_until=time.time()-1))
        db.commit()
    second=claim_job()
    assert first[0]==second[0] and first[1]!=second[1]
    asyncio.run(process(*second))
    with Db() as db:
        assert db.get(Job,first[0]).status=='completed'
        assert db.scalar(select(ActiveJob).where(ActiveJob.job_id==first[0])) is None

def test_failure_retry_and_chat_lock(monkeypatch):
    a=account('failure_user'); sid=session(a)
    with Db() as db:
        db.add(ChatLock(session_id=sid,owner='other',expires=time.time()+100))
        db.commit()
    result=client.post(f'/sessions/{sid}/chat',headers=a,json={'request_id':'locked-chat-0001','text':'안녕'})
    assert result.status_code==409
    body={'session_id':sid,'request_id':'failure-art-001','approved_summary':'오늘의 마음'}
    job=client.post('/jobs',headers=a,json=body).json()
    async def fail(*args):
        raise RuntimeError('private-secret-not-for-users')
    import app.worker as worker
    with monkeypatch.context() as patch:
        patch.setattr(worker,'draw',fail)
        asyncio.run(process(*claim_job()))
    row=client.get('/jobs',headers=a).json()[0]
    assert row['status']=='failed'
    assert 'private-secret' not in row['error']
    assert client.post(f"/jobs/{job['id']}/retry",headers=a).status_code==202
    asyncio.run(process(*claim_job()))
    assert len(client.get('/diaries',headers=a).json())==1

def test_prompts_preserve_pdf_examples():
    from app.ai import PLACES,chat_instructions
    for place in PLACES:
        prompt=chat_instructions(place)
        assert '예시 A' in prompt and '예시 B' in prompt
        assert '질문은 필요한 경우에만' in prompt

def test_rate_limit_and_password_storage():
    import pytest
    from fastapi import HTTPException
    from app.limits import limit
    from app.security import hash_password, verify_password
    stored=hash_password('a-safe-password')
    assert stored != 'a-safe-password'
    assert verify_password('a-safe-password',stored)
    assert not verify_password('wrong-password',stored)
    limit('test-limit-user','test',1)
    with pytest.raises(HTTPException) as error:
        limit('test-limit-user','test',1)
    assert error.value.status_code==429

def test_summary_checkpoint_keeps_original_messages(monkeypatch):
    import app.main as main
    from app.db import Conversation
    a=account('summary_user'); sid=session(a)
    with Db() as db:
        for number in range(20):
            db.add(Message(session_id=sid, request_id=f'prior-{number}', role='user' if number%2==0 else 'assistant', text='원문 기록 '+str(number)))
        db.commit()
    monkeypatch.setattr(main,'SUMMARY_TRIGGER_CHARS',10)
    monkeypatch.setattr(main,'RECENT_MESSAGE_COUNT',4)
    result=client.post(f'/sessions/{sid}/chat',headers=a,json={'request_id':'summary-chat-001','text':'이어갈 이야기'})
    assert json.loads(result.text.splitlines()[-1])['type']=='done'
    with Db() as db:
        saved=db.get(Conversation,sid)
        assert saved.summary and saved.summary_through>0
        assert len(list(db.scalars(select(Message).where(Message.session_id==sid))))==22
