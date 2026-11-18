import asyncio
import json
from sqlalchemy import select
from test_shared_history import person, enter, add_message, completed_work
from test_flow import client
from app import ai
from app.db import Db, Job, Diary, ArtPreview, ActiveJob, uid
from app.art_story import prepare_story


def finish(user, sid, through, story):
    diary_id = completed_work(user, sid)
    with Db() as db:
        job = db.get(Job, db.get(Diary, diary_id).job_id)
        job.source_through = through
        job.approved_summary = story
        db.commit()


def test_short_meaningful_update_uses_new_material_and_failed_job_does_not_consume(person, monkeypatch):
    sid = enter('forest')
    old = add_message(sid, '과거 취업 이야기')
    finish(person, sid, old, '지난 취업 이야기')
    new = add_message(sid, '오늘 두부가 퇴원해서 정말 안심했어')
    with Db() as db:
        db.add(Job(user_id=person, session_id=sid, request_id=uid(), approved_summary='실패', status='failed', source_through=new))
        db.commit()
    async def decide(user, messages, preceding, reference, previous):
        assert '퇴원' in json.dumps(messages, ensure_ascii=False)
        assert '과거 취업' not in json.dumps(messages, ensure_ascii=False)
        assert previous == '지난 취업 이야기'
        return ai.StoryDecision(has_new_material=True, story='두부의 퇴원에 안도한 마음')
    monkeypatch.setattr(ai, 'select_art_story', decide)
    story, through = asyncio.run(prepare_story(person))
    assert story == '두부의 퇴원에 안도한 마음' and through == new


def test_no_new_user_message_reuses_story_without_model_call(person, monkeypatch):
    sid = enter('forest')
    through = add_message(sid, '두부와 산책')
    finish(person, sid, through, '직접 고친 산책 이야기')
    add_message(sid, 'AI가 남긴 인사', role='assistant')
    async def forbidden(*args):
        raise AssertionError('새 사용자 발화가 없으면 의미 분석 호출 불필요')
    monkeypatch.setattr(ai, 'select_art_story', forbidden)
    assert asyncio.run(prepare_story(person)) == ('직접 고친 산책 이야기', through)


def test_acknowledgment_reuses_previous_story_by_semantic_decision(person, monkeypatch):
    sid = enter('temple')
    old = add_message(sid, '조금 덜 외로운 마음')
    finish(person, sid, old, '덜 외로운 저녁')
    new = add_message(sid, '응 고마워')
    async def decide(*args):
        return ai.StoryDecision(has_new_material=False, story='사용하지 않을 문장')
    monkeypatch.setattr(ai, 'select_art_story', decide)
    assert asyncio.run(prepare_story(person)) == ('덜 외로운 저녁', new)


def test_preview_snapshot_keeps_later_messages_and_user_edits(person, monkeypatch):
    sid = enter('cafe')
    first = add_message(sid, '두부와 산책')
    async def decide(*args):
        return ai.StoryDecision(has_new_material=True, story='산책 이야기')
    monkeypatch.setattr(ai, 'select_art_story', decide)
    preview = client.post(f'/sessions/{sid}/preview').json()
    later = add_message(sid, '새롭게 들려줄 바다 이야기')
    payload = {'session_id':sid, 'request_id':uid(), 'preview_id':preview['preview_id'], 'approved_summary':'사용자가 고친 산책'}
    response = client.post('/jobs', json=payload)
    assert response.status_code == 202
    job_id = response.json()['id']
    assert client.post('/jobs', json=payload).json()['id'] == job_id
    with Db() as db:
        job = db.get(Job, job_id)
        assert job.source_through == first and job.approved_summary == '사용자가 고친 산책'
        job.status = 'completed'
        db.add(Diary(user_id=person, job_id=job.id, title='작품', poem='시', interpretation='설명', image_file='fixture.png'))
        db.delete(db.get(ActiveJob, person))
        db.commit()
    async def next_decision(user, messages, *args):
        assert '바다' in json.dumps(messages, ensure_ascii=False)
        assert '두부와 산책' not in json.dumps(messages, ensure_ascii=False)
        return ai.StoryDecision(has_new_material=True, story='바다 이야기')
    monkeypatch.setattr(ai, 'select_art_story', next_decision)
    assert asyncio.run(prepare_story(person)) == ('바다 이야기', later)


def test_foreign_preview_cannot_set_checkpoint(person):
    from app.db import User, Conversation
    sid = enter('forest')
    with Db() as db:
        other = User(username=uid(), nickname='다른 사용자', password_hash='unused')
        db.add(other); db.flush()
        room = Conversation(user_id=other.id, place_id='forest')
        db.add(room); db.flush()
        preview = ArtPreview(user_id=other.id, session_id=room.id, source_through=999, story='비공개')
        db.add(preview); db.commit()
    response = client.post('/jobs', json={'session_id':sid, 'request_id':uid(), 'preview_id':preview.id, 'approved_summary':'작품'})
    assert response.status_code == 404


def test_legacy_work_without_checkpoint_and_newest_topic(person, monkeypatch):
    sid = enter('forest')
    add_message(sid, '오래된 이야기')
    finish(person, sid, None, '기존 작품')
    latest = add_message(sid, '오늘 꽃을 선물받아서 기뻐')
    async def decide(user, messages, preceding, reference, previous):
        assert previous == '기존 작품'
        assert '꽃' in messages[-1]['content']
        return ai.StoryDecision(has_new_material=True, story='꽃을 선물받은 기쁨')
    monkeypatch.setattr(ai, 'select_art_story', decide)
    assert asyncio.run(prepare_story(person)) == ('꽃을 선물받은 기쁨', latest)
