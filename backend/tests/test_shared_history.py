"""기존 테스트가 설정한 격리 DB에서 공간 통합과 중단 복구를 검증합니다."""
import asyncio
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
import pytest
from sqlalchemy import select
from test_flow import client
from app.main import app
from app.security import current_user
from app.db import Db, User, Conversation, Message, Job, Diary, UserMemory, UserChatLock, uid
from app.shared_history import acquire_turn, release_turn


@pytest.fixture
def person():
    with Db() as db:
        user = User(username=uid(), nickname='검증', password_hash='unused')
        db.add(user)
        db.commit()
    app.dependency_overrides[current_user] = lambda: user.id
    yield user.id
    app.dependency_overrides.clear()


def enter(place):
    result = client.post('/sessions', json={'place_id':place})
    assert result.status_code == 200
    return result.json()['id']


def add_message(sid, text, role='user', request=None):
    with Db() as db:
        row = Message(session_id=sid, request_id=request or uid(), role=role, text=text)
        db.add(row)
        db.commit()
        return row.id


def completed_work(user, sid):
    with Db() as db:
        job = Job(user_id=user, session_id=sid, request_id=uid(), approved_summary='검증', status='completed')
        db.add(job)
        db.flush()
        diary = Diary(user_id=user, job_id=job.id, title='작품', poem='보존할 시',
            interpretation='원래 캐릭터의 설명', image_file='fixture.png')
        db.add(diary)
        db.commit()
        return diary.id


def test_all_spaces_share_history_and_preserve_origin(person, monkeypatch):
    import app.main as main
    forest = enter('forest')
    original = add_message(forest, '강아지 두부와 산책했어')
    add_message(forest, '토리의 답변', 'assistant')
    calls = []
    async def chat(user, place, history):
        calls.append((user, place, history))
        yield f'{place}의 답변'
    monkeypatch.setattr(main.ai, 'stream_chat', chat)
    for place in main.ai.PLACES:
        sid = enter(place)
        response = client.post(f'/sessions/{sid}/chat', json={'request_id':uid(), 'text':'이어서 이야기하자'})
        assert json.loads(response.text.splitlines()[-1])['type'] == 'done'
        assert calls[-1][1] == place
        assert '두부' in json.dumps(calls[-1][2], ensure_ascii=False)
        rows = client.get(f'/sessions/{sid}/messages').json()
        assert next(row for row in rows if row['id'] == original)['place_id'] == 'forest'
        assert rows[-1]['place_id'] == place


def test_interrupted_turn_does_not_block_work_and_delivery_is_idempotent(person):
    forest, temple = enter('forest'), enter('temple')
    add_message(forest, '연결이 끊겨 답변이 없는 과거 발화')
    diary = completed_work(person, forest)
    # 프로세스 장애 후 남은 잠금도 만료되면 회복됩니다.
    with Db() as db:
        db.add(UserChatLock(user_id=person, owner='expired', expires=time.time()-1))
        db.commit()
    endpoint = f'/sessions/{temple}/artworks/deliver'
    with ThreadPoolExecutor(max_workers=3) as pool:
        responses = list(pool.map(lambda _:client.post(endpoint), range(3)))
    assert all(result.status_code == 200 for result in responses)
    assert not client.post(endpoint).json()['waiting']
    rows = client.get(f'/sessions/{temple}/messages').json()
    works = [row for row in rows if row['artwork']]
    assert len(works) == 1
    assert works[0]['artwork']['id'] == diary
    assert works[0]['artwork']['poem'] == '보존할 시'
    assert works[0]['place_id'] == 'forest'


def test_actual_stream_blocks_other_space_and_work_until_finished(person, monkeypatch):
    import app.main as main
    forest, temple = enter('forest'), enter('temple')
    completed_work(person, forest)
    started = threading.Event()
    finish = threading.Event()
    async def slow_chat(*args):
        started.set()
        while not finish.is_set():
            await asyncio.sleep(0.01)
        yield '완료된 답변'
    monkeypatch.setattr(main.ai, 'stream_chat', slow_chat)
    payload = {'request_id':uid(), 'text':'진행 중인 이야기'}
    with ThreadPoolExecutor(max_workers=1) as pool:
        running = pool.submit(client.post, f'/sessions/{forest}/chat', json=payload)
        try:
            assert started.wait(5)
            assert client.post(f'/sessions/{temple}/chat', json={'request_id':uid(), 'text':'동시 요청'}).status_code == 409
            assert client.post(f'/sessions/{temple}/artworks/deliver').json()['waiting']
        finally:
            finish.set()
        assert running.result().status_code == 200
    assert not client.post(f'/sessions/{temple}/artworks/deliver').json()['waiting']
    rows = client.get(f'/sessions/{temple}/messages').json()
    assert rows[-2]['text'] == '완료된 답변'
    assert rows[-1]['artwork']
    # 같은 요청 재전송으로 사용자/답변이 중복되지 않습니다.
    assert client.post(f'/sessions/{forest}/chat', json=payload).status_code == 200
    assert len(client.get(f'/sessions/{temple}/messages').json()) == len(rows)


def test_failure_releases_lock_and_retry_after_space_switch(person, monkeypatch):
    import app.main as main
    forest, temple = enter('forest'), enter('temple')
    completed_work(person, forest)
    async def broken(*args):
        raise RuntimeError('검증 실패 응답')
        yield ''
    payload = {'request_id':uid(), 'text':'재시도할 내용'}
    with monkeypatch.context() as patch:
        patch.setattr(main.ai, 'stream_chat', broken)
        response = client.post(f'/sessions/{forest}/chat', json=payload)
    assert json.loads(response.text.splitlines()[-1])['type'] == 'error'
    assert not client.post(f'/sessions/{temple}/artworks/deliver').json()['waiting']
    response = client.post(f'/sessions/{forest}/chat', json=payload)
    assert json.loads(response.text.splitlines()[-1])['type'] == 'done'
    with Db() as db:
        assert len(list(db.scalars(select(Message).where(Message.request_id == payload['request_id'])))) == 2
        assert db.get(UserChatLock, person) is None


def test_common_summary_keeps_old_session_summary_and_preview(person, monkeypatch):
    import app.main as main
    forest, temple = enter('forest'), enter('temple')
    with Db() as db:
        db.get(Conversation, forest).summary = '기존 공간 요약 보존'
        db.commit()
    for index in range(8):
        add_message(forest, f'숲의 원문 {index}')
    monkeypatch.setattr(main, 'SUMMARY_TRIGGER_CHARS', 1)
    monkeypatch.setattr(main, 'RECENT_MESSAGE_COUNT', 2)
    captured = []
    async def summarize(user, previous, messages):
        captured.extend(messages)
        return '사용자 공통 요약'
    monkeypatch.setattr(main.ai, 'summarize', summarize)
    response = client.post(f'/sessions/{temple}/chat', json={'request_id':uid(), 'text':'산사의 이야기'})
    assert json.loads(response.text.splitlines()[-1])['type'] == 'done'
    assert '숲의 원문' in json.dumps(captured, ensure_ascii=False)
    with Db() as db:
        assert db.get(UserMemory, person).summary == '사용자 공통 요약'
        assert db.get(Conversation, forest).summary == '기존 공간 요약 보존'
    async def select_story(user, new, preceding, reference, previous):
        assert reference == '사용자 공통 요약'
        return main.ai.StoryDecision(has_new_material=True, story='최근 이야기로 만든 작품')
    monkeypatch.setattr(main.ai, 'select_art_story', select_story)
    assert client.post(f'/sessions/{temple}/preview').json()['summary'] == '최근 이야기로 만든 작품'
    assert len(client.get(f'/sessions/{temple}/messages').json()) == 10


def test_other_user_cannot_read_or_deliver_shared_history(person):
    forest = enter('forest')
    add_message(forest, '비공개 원문')
    completed_work(person, forest)
    with Db() as db:
        other = User(username=uid(), nickname='다른 사용자', password_hash='unused')
        db.add(other)
        db.commit()
    app.dependency_overrides[current_user] = lambda:other.id
    temple = enter('temple')
    assert client.get(f'/sessions/{forest}/messages').status_code == 404
    assert client.post(f'/sessions/{forest}/artworks/deliver').status_code == 404
    assert client.get(f'/sessions/{temple}/messages').json() == []
    assert not client.post(f'/sessions/{temple}/artworks/deliver').json()['waiting']
    assert client.get('/diaries').json() == []


def test_old_owner_cannot_release_replacement_lock(person):
    owner = acquire_turn(person, 30)
    assert owner
    with Db() as db:
        db.get(UserChatLock, person).expires = time.time()-1
        db.commit()
    replacement = acquire_turn(person, 30)
    release_turn(person, owner)
    assert acquire_turn(person, 30) is None
    release_turn(person, replacement)


def test_stream_disconnect_releases_lock_and_allows_artwork(person, monkeypatch):
    import app.main as main
    forest, temple = enter('forest'), enter('temple')
    completed_work(person, forest)
    async def partial(*args):
        yield '아직 작성 중'
        await asyncio.sleep(30)
    monkeypatch.setattr(main.ai, 'stream_chat', partial)
    async def disconnect():
        response = await main.chat(forest, main.ChatInput(request_id=uid(), text='연결 중단 검증'), person)
        iterator = response.body_iterator
        first = await anext(iterator)
        assert json.loads(first)['type'] == 'delta'
        await iterator.aclose()
    asyncio.run(disconnect())
    with Db() as db:
        assert db.get(UserChatLock, person) is None
    assert not client.post(f'/sessions/{temple}/artworks/deliver').json()['waiting']
    assert any(row['artwork'] for row in client.get(f'/sessions/{temple}/messages').json())


def test_worker_keeps_request_character_after_space_change(person, monkeypatch):
    import app.worker as worker
    forest = enter('forest')
    with Db() as db:
        job = Job(user_id=person, session_id=forest, request_id=uid(), approved_summary='승인',
            status='running', attempts=1, lease_owner='test-worker', lease_until=time.time()+100)
        db.add(job)
        db.commit()
        job_id = job.id
    temple = enter('temple')
    seen = []
    async def draw(*args):
        return b'test-image'
    async def describe(user, place, plan, content):
        seen.append(place)
        return '토리의 작품 설명'
    monkeypatch.setattr(worker, 'draw', draw)
    monkeypatch.setattr(worker, 'describe_art', describe)
    asyncio.run(worker.process(job_id, 'test-worker'))
    assert seen == ['forest']
    assert not client.post(f'/sessions/{temple}/artworks/deliver').json()['waiting']
    work = next(row for row in client.get(f'/sessions/{temple}/messages').json() if row['artwork'])
    assert work['place_id'] == 'forest'
    assert work['artwork']['interpretation'] == '토리의 작품 설명'
