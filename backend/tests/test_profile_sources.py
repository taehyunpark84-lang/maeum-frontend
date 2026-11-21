from test_shared_history import person, enter, add_message, completed_work
from test_flow import client
from app.db import Db, User, Job, Diary, ActiveJob, uid
from app import ai


def finish_job(job_id, user):
    with Db() as db:
        job = db.get(Job, job_id)
        job.status = 'completed'
        diary = Diary(user_id=user, job_id=job_id, title='검증', poem='시', interpretation='설명', image_file='test.png')
        db.add(diary)
        db.delete(db.get(ActiveJob, user))
        db.commit()
        return diary.id


def queue(sid):
    preview = client.post(f'/sessions/{sid}/preview')
    assert preview.status_code == 200
    data = preview.json()
    result = client.post('/jobs', json={'session_id':sid, 'request_id':uid(),
        'preview_id':data['preview_id'], 'approved_summary':data['summary']})
    assert result.status_code == 202
    return result.json()['id']


def test_profile_persists_and_does_not_change_queued_gender(person):
    sid = enter('forest')
    add_message(sid, '오늘은 좋은 날')
    assert client.get('/me').json()['gender'] == 'male'
    assert client.get('/me').json()['show_history'] is False
    job_id = queue(sid)
    assert client.patch('/me', json={'gender':'female', 'show_history':True}).status_code == 200
    profile = client.get('/me').json()
    assert profile['gender'] == 'female' and profile['show_history'] is True
    assert '여성' in ai.user_gender_instruction(person)
    assert client.patch('/me', json={'gender':'invalid'}).status_code == 422
    with Db() as db:
        assert db.get(Job, job_id).gender_snapshot == 'male'
    finish_job(job_id, person)
    with Db() as db:
        assert db.get(Job, queue(sid)).gender_snapshot == 'female'


def test_artwork_range_includes_reply_excludes_later_and_reuses_source(person, monkeypatch):
    sid = enter('forest')
    first = add_message(sid, '두부가 퇴원했어')
    reply = add_message(sid, '안심했겠구나', 'assistant')
    job_id = queue(sid)
    later = add_message(sid, '응 고마워')
    diary = finish_job(job_id, person)
    response = client.get(f'/diaries/{diary}/messages').json()
    assert response['available']
    assert [m['id'] for m in response['messages']] == [first, reply]
    async def no_new(*args):
        return ai.StoryDecision(has_new_material=False, story='')
    monkeypatch.setattr(ai, 'select_art_story', no_new)
    reused = finish_job(queue(sid), person)
    assert client.get(f'/diaries/{reused}/messages').json() == response
    async def new_story(*args):
        return ai.StoryDecision(has_new_material=True, story='바다 여행')
    monkeypatch.setattr(ai, 'select_art_story', new_story)
    ocean = enter('ocean')
    newest = add_message(ocean, '바다를 보니 설레')
    newest_reply = add_message(ocean, '기분 좋은 여행이네', 'assistant')
    new_diary = finish_job(queue(ocean), person)
    rows = client.get(f'/diaries/{new_diary}/messages').json()['messages']
    assert [m['id'] for m in rows] == [newest, newest_reply]
    assert all(m['place_id'] == 'ocean' for m in rows)
    assert later not in [m['id'] for m in rows]


def test_legacy_unknown_and_foreign_artwork_rejected(person):
    sid = enter('cafe')
    diary = completed_work(person, sid)
    assert client.get(f'/diaries/{diary}/messages').json() == {'available':False, 'messages':[]}
    with Db() as db:
        other = User(username=uid(), nickname='other', password_hash='unused')
        db.add(other); db.commit()
        db.get(Diary, diary).user_id = other.id
        db.commit()
    assert client.get(f'/diaries/{diary}/messages').status_code == 404


def test_new_registration_gender_and_profile_auth():
    name = 'gender_' + uid().replace('-', '')[:20]
    credentials = {'username':name, 'password':'test-password-123', 'gender':'female'}
    assert client.patch('/me', json={'gender':'male'}).status_code == 401
    assert client.post('/auth/register', json=credentials).status_code == 200
    token = client.post('/auth/login', json=credentials).json()['token']
    headers = {'Authorization':'Bearer '+token}
    assert client.get('/me', headers=headers).json()['gender'] == 'female'
    assert client.patch('/me', headers=headers, json={'show_history':True}).json()['gender'] == 'female'


def test_art_gender_reaches_planning_and_image_prompt(person, monkeypatch):
    import asyncio
    from types import SimpleNamespace
    captured = {}
    async def parse(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(status='completed', usage=None, output_parsed=ai.ArtPlan(
            title='작품', poem='시', interpretation='설명', image_prompt='공원의 두 사람'))
    monkeypatch.setattr(ai, 'AI_MODE', 'openai')
    monkeypatch.setattr(ai, 'client', lambda: SimpleNamespace(responses=SimpleNamespace(parse=parse)))
    plan = asyncio.run(ai.plan_art(person, '친구와 산책', 'female'))
    assert '현재 사용자 설정 성별은 여성' in captured['instructions']
    assert '현재 사용자 설정 성별은 여성' in plan.image_prompt
    assert '다른 등장인물의 성별은 대화 맥락' in plan.image_prompt
    assert ai.gender_instruction(None) == ''
