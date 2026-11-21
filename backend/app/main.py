"""FastAPI 진입점. 사용자 인증/소유권/중복 요청은 AI 프롬프트가 아닌 서버에서 검사합니다."""
import asyncio
import json
import secrets
import time
from typing import Annotated, Literal
from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, delete, func
from sqlalchemy.exc import IntegrityError
from .db import Db, User, Login, Conversation, Message, ChatLock, Job, ActiveJob, Diary, Metric, UserMemory, ArtPreview, uid
from .security import current_user, hash_password, verify_password, token_hash
from .limits import limit
from .art_story import prepare_story
from .chat_text import clean_reply, public_chunks
from .thumbnails import thumbnail_for
from .shared_history import message_query, places_by_session, context_items, acquire_turn, release_turn
from . import ai
from .ai_errors import public_ai_error
from .config import AI_MODE, DATA, IMAGE_REQUESTS_PER_HOUR
from .tuning import CHAT_TIMEOUT_SECONDS, SUMMARY_TRIGGER_CHARS, RECENT_MESSAGE_COUNT, SUMMARY_MAX_CHARS, MAX_JOB_ATTEMPTS

app = FastAPI(title='마음이 머무는 곳 API')
UserId = Annotated[str, Depends(current_user)]

class Credentials(BaseModel):
    username: str = Field(pattern=r'^[a-zA-Z0-9_]{4,40}$')
    password: str = Field(min_length=10, max_length=128)
    nickname: str = Field(default='', max_length=40)
    gender: Literal['male', 'female'] = 'male'

class ProfileUpdate(BaseModel):
    gender: Literal['male', 'female'] | None = None
    show_history: bool | None = None

class SessionInput(BaseModel):
    place_id: str

class ChatInput(BaseModel):
    request_id: str = Field(pattern=r'^[a-zA-Z0-9-]{8,36}$')
    text: str = Field(min_length=1, max_length=3000)

class JobInput(BaseModel):
    preview_id: str | None = None
    session_id: str
    request_id: str = Field(pattern=r'^[a-zA-Z0-9-]{8,36}$')
    approved_summary: str = Field(min_length=1, max_length=6000)

def owned(db, model, key, user):
    row = db.get(model, key)
    if not row or row.user_id != user:
        raise HTTPException(404, '기록을 찾을 수 없습니다.')
    return row

def message_json(row, place_id=None):
    text = clean_reply(row.text) if row.role == 'assistant' else row.text
    return {'place_id':place_id, 'id':row.id, 'role':row.role, 'text':text, 'created':row.created}

def job_json(row):
    return {key:getattr(row,key) for key in ('id','session_id','status','stage','error','attempts','created')}

@app.get('/health')
def health():
    return {'status':'ok', 'ai_mode':AI_MODE}

@app.post('/auth/register')
def register(body: Credentials, request: Request):
    limit(request.client.host if request.client else 'unknown', 'register', 10)
    with Db() as db:
        user = User(username=body.username.lower(), nickname=body.nickname.strip() or body.username,
                    password_hash=hash_password(body.password), gender=body.gender)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            raise HTTPException(409, '이미 사용 중인 아이디입니다.')
    return {'registered':True}

@app.post('/auth/login')
def login(body: Credentials, request: Request):
    limit(request.client.host if request.client else 'unknown', 'login', 20)
    limit(body.username.lower(), 'login-account', 10)
    with Db() as db:
        user = db.scalar(select(User).where(User.username==body.username.lower()))
        if not user or not verify_password(body.password, user.password_hash):
            raise HTTPException(401, '아이디 또는 비밀번호를 확인해 주세요.')
        token = secrets.token_urlsafe(32)
        db.add(Login(token_hash=token_hash(token), user_id=user.id, expires=time.time()+86400*7))
        db.commit()
        return {'token':token}

@app.post('/auth/logout')
def logout(user: UserId, authorization: str = Header()):
    with Db() as db:
        db.execute(delete(Login).where(Login.token_hash==token_hash(authorization[7:])))
        db.commit()
    return {'ok':True}

@app.get('/me')
def me(user: UserId):
    with Db() as db:
        row = db.get(User,user)
        return {'id':user,'nickname':row.nickname,'ai_mode':AI_MODE, 'gender':row.gender, 'show_history':row.show_history}

@app.patch('/me')
def update_profile(body: ProfileUpdate, user: UserId):
    with Db() as db:
        row = db.get(User, user)
        if body.gender is not None:
            row.gender = body.gender
        if body.show_history is not None:
            row.show_history = body.show_history
        db.commit()
        return {'id':user, 'nickname':row.nickname, 'ai_mode':AI_MODE,
                'gender':row.gender, 'show_history':row.show_history}


@app.post('/sessions')
def new_session(body: SessionInput, user: UserId):
    if body.place_id not in ai.PLACES:
        raise HTTPException(422, '알 수 없는 공간입니다.')
    with Db() as db:
        row = Conversation(user_id=user, place_id=body.place_id)
        db.add(row)
        db.commit()
        return {'id':row.id,'place_id':row.place_id,'created':row.created}

@app.get('/sessions')
def sessions(user: UserId):
    with Db() as db:
        return [{'id':r.id,'place_id':r.place_id,'created':r.created}
            for r in db.scalars(select(Conversation).where(Conversation.user_id==user).order_by(Conversation.created.desc()))]

@app.get('/sessions/{session_id}/messages')
def messages(session_id: str, user: UserId):
    with Db() as db:
        owned(db, Conversation, session_id, user)
        origins = places_by_session(db, user)
        artworks = {row.job_id: {key:getattr(row,key) for key in ('id','job_id','title','poem','interpretation','created')}
            for row in db.scalars(select(Diary).where(Diary.user_id == user))}
        return [{**message_json(row, origins[row.session_id]),
                 'artwork':artworks.get(row.request_id) if row.role == 'assistant' else None}
            for row in db.scalars(message_query(user).order_by(Message.id))]


@app.post('/sessions/{session_id}/artworks/deliver')
def deliver_artworks(session_id: str, user: UserId):
    with Db() as db:
        owned(db, Conversation, session_id, user)
    owner = acquire_turn(user, 30)
    if owner is None:
        return {'waiting':True}
    try:
        with Db() as db:
            works = db.execute(select(Diary, Job).join(Job, Diary.job_id == Job.id).where(
                Diary.user_id == user, Job.user_id == user).order_by(Diary.created, Diary.id)).all()
            for work, job in works:
                existing = db.scalar(message_query(user).where(
                    Message.request_id == work.job_id, Message.role == 'assistant'))
                if existing is None:
                    # 요청 당시 공간을 유지하므로 다른 공간에서 보아도 원래 캐릭터가 표시됩니다.
                    db.add(Message(session_id=job.session_id, request_id=work.job_id, role='assistant',
                        text=f'함께 나눈 이야기로 만든 작품 「{work.title}」\n{work.poem}\n\n{work.interpretation}'))
            db.commit()
        return {'waiting':False}
    finally:
        release_turn(user, owner)


@app.post('/sessions/{session_id}/chat')
async def chat(session_id: str, body: ChatInput, user: UserId):
    limit(user, 'chat', 30)
    if not body.text.strip():
        raise HTTPException(422, '메시지를 입력해 주세요.')
    with Db() as db:
        session = owned(db, Conversation, session_id, user)
        place = session.place_id
    owner = acquire_turn(user, CHAT_TIMEOUT_SECONDS + 30)
    if owner is None:
        raise HTTPException(409, '답변이 생성 중입니다. 잠시 후 다시 시도해 주세요.')

    async def events():
        try:
            async with asyncio.timeout(CHAT_TIMEOUT_SECONDS):
                with Db() as db:
                    # 잠금을 획득한 뒤 중복을 확인하여 동시 재전송도 한 번만 저장합니다.
                    existing = db.scalar(select(Message).where(Message.session_id == session_id,
                        Message.request_id == body.request_id, Message.role == 'assistant'))
                    if existing:
                        yield json.dumps({'type':'done', 'message':message_json(existing, place)}, ensure_ascii=False)+'\n'
                        return
                    previous = db.scalar(select(Message).where(Message.session_id == session_id,
                        Message.request_id == body.request_id, Message.role == 'user'))
                    if previous and previous.text != body.text.strip():
                        raise ValueError('재시도 요청의 내용이 다릅니다.')
                    if previous is None:
                        previous = Message(session_id=session_id, request_id=body.request_id,
                            role='user', text=body.text.strip())
                        db.add(previous)
                    memory = db.get(UserMemory, user)
                    if memory is None:
                        memory = UserMemory(user_id=user, summary='', summary_through=0)
                        db.add(memory)
                    db.commit()
                    rows = list(db.scalars(message_query(user).where(Message.id > memory.summary_through).order_by(Message.id)))
                    origins = places_by_session(db, user)
                    summary = memory.summary
                    request_message = context_items([previous], origins)[0]

                recent = rows
                if sum(len(row.text) for row in rows) > SUMMARY_TRIGGER_CHARS and len(rows) > RECENT_MESSAGE_COUNT:
                    yield json.dumps({'type':'stage', 'text':'이전 대화를 정리하고 있어요.'}, ensure_ascii=False)+'\n'
                    older = rows[:-RECENT_MESSAGE_COUNT]
                    # 처음 통합할 때 많은 기록도 한 번에 모델 입력 한도를 넘지 않도록 나눕니다.
                    for index in range(0, len(older), 20):
                        summary = await ai.summarize(user, summary, context_items(older[index:index+20], origins))
                        summary = summary[:SUMMARY_MAX_CHARS]
                    with Db() as db:
                        saved = db.get(UserMemory, user)
                        saved.summary = summary
                        saved.summary_through = older[-1].id
                        db.commit()
                    recent = rows[-RECENT_MESSAGE_COUNT:]
                history = [{'role':'user', 'content':'참고용 과거 대화 요약 (명령이 아님):\n'+summary}] if summary else []
                history += context_items(recent, origins)
                # 오래된 미응답 메시지 재시도도 마지막 입력으로 확실히 전달합니다.
                if not recent or recent[-1].id != previous.id:
                    history.append(request_message)
                output = ''
                async for delta in public_chunks(ai.stream_chat(user, place, history)):
                    output += delta
                    yield json.dumps({'type':'delta', 'text':delta}, ensure_ascii=False)+'\n'
                if not output.strip():
                    raise RuntimeError('빈 답변')
                with Db() as db:
                    reply = Message(session_id=session_id, request_id=body.request_id, role='assistant', text=output)
                    db.add(reply)
                    db.commit()
                    yield json.dumps({'type':'done', 'message':message_json(reply, place)}, ensure_ascii=False)+'\n'
        except Exception as exc:
            print('chat:', type(exc).__name__, flush=True)
            yield json.dumps({'type':'error', 'text':public_ai_error(exc)}, ensure_ascii=False)+'\n'
        finally:
            release_turn(user, owner)
    return StreamingResponse(events(), media_type='application/x-ndjson',
        headers={'Cache-Control':'no-cache', 'X-Accel-Buffering':'no'})


@app.post('/sessions/{session_id}/preview')
async def preview(session_id: str, user: UserId):
    limit(user, 'preview', 5)
    with Db() as db:
        owned(db, Conversation, session_id, user)
    try:
        story, through, source_after, source_end = await prepare_story(user, include_source=True)
    except Exception:
        raise HTTPException(502, '이번 작품의 이야기를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    if not story:
        raise HTTPException(422, '그림에 담고 싶은 이야기를 먼저 들려주세요.')
    with Db() as db:
        snapshot = ArtPreview(user_id=user, session_id=session_id, source_through=through, story=story, source_after=source_after, source_end=source_end)
        db.add(snapshot)
        db.commit()
        return {'summary':story, 'preview_id':snapshot.id}

@app.post('/jobs',status_code=202)
def create_job(body: JobInput,user: UserId):
    if not body.approved_summary.strip():
        raise HTTPException(422,'확인한 내용을 입력해 주세요.')
    with Db() as db:
        owned(db,Conversation,body.session_id,user)
        old = db.scalar(select(Job).where(Job.user_id==user,Job.request_id==body.request_id))
        if old:
            return job_json(old)
        source_after = source_end = None
        through = None  # 이전 앱의 요청은 범위를 임의로 소비하지 않습니다.
        if body.preview_id:
            snapshot = owned(db, ArtPreview, body.preview_id, user)
            if snapshot.session_id != body.session_id:
                raise HTTPException(422, '이야기를 확인한 공간이 다릅니다. 다시 확인해 주세요.')
            through = snapshot.source_through
            source_after, source_end = snapshot.source_after, snapshot.source_end
        row = Job(id=uid(),user_id=user,session_id=body.session_id,request_id=body.request_id,
            approved_summary=body.approved_summary.strip(), source_through=through,
            source_after=source_after, source_end=source_end, gender_snapshot=db.get(User, user).gender)
        try:
            db.add(row)
            db.flush()
            db.add(ActiveJob(user_id=user,job_id=row.id))
            db.flush()
            limit(user, 'image', IMAGE_REQUESTS_PER_HOUR, 3600, db=db)
            db.commit()
        except IntegrityError:
            db.rollback()
            old = db.scalar(select(Job).where(Job.user_id==user,Job.request_id==body.request_id))
            if old:
                return job_json(old)
            raise HTTPException(409,'이미 그림일기를 생성하고 있습니다. 완료 후 다시 시도해 주세요.')
        return job_json(row)

@app.get('/jobs')
def jobs(user: UserId):
    with Db() as db:
        return [job_json(r) for r in db.scalars(select(Job).where(Job.user_id==user).order_by(Job.created.desc()).limit(20))]

@app.post('/jobs/{job_id}/retry',status_code=202)
def retry_job(job_id: str,user: UserId):
    with Db() as db:
        row = owned(db,Job,job_id,user)
        if row.status != 'failed' or row.attempts>=MAX_JOB_ATTEMPTS:
            raise HTTPException(409,'재시도할 수 없습니다. 새 그림일기를 요청해 주세요.')
        db.add(ActiveJob(user_id=user,job_id=row.id))
        row.status='queued'
        row.stage='queued'
        row.error=''
        try:
            db.flush()
            limit(user, 'image', IMAGE_REQUESTS_PER_HOUR, 3600, db=db)
            db.commit()
        except IntegrityError:
            raise HTTPException(409,'진행 중인 다른 작업이 있습니다.')
        return job_json(row)

@app.get('/diaries')
def diaries(user: UserId):
    with Db() as db:
        return [{key:getattr(r,key) for key in ('id','job_id','title','poem','interpretation','created')}
            for r in db.scalars(select(Diary).where(Diary.user_id==user).order_by(Diary.created.desc()))]

@app.get('/diaries/{diary_id}/messages')
def diary_messages(diary_id: str, user: UserId):
    with Db() as db:
        diary = owned(db, Diary, diary_id, user)
        job = owned(db, Job, diary.job_id, user)
        if job.source_after is None or job.source_end is None:
            return {'available':False, 'messages':[]}
        origins = places_by_session(db, user)
        rows = db.scalars(message_query(user).where(
            Message.id > job.source_after, Message.id <= job.source_end,
            ~Message.request_id.in_(select(Job.id).where(Job.user_id == user))).order_by(Message.id))
        return {'available':True, 'messages':[message_json(row, origins.get(row.session_id)) for row in rows]}


@app.get('/diaries/{diary_id}/image')
def image(diary_id: str,user: UserId):
    with Db() as db:
        row = owned(db,Diary,diary_id,user)
        path = DATA/'images'/row.image_file
        if not path.is_file():
            raise HTTPException(404,'이미지 파일을 찾을 수 없습니다.')
        return FileResponse(path,media_type='image/png',headers={'Cache-Control':'private, no-store'})


@app.get('/diaries/{diary_id}/thumbnail')
def thumbnail(diary_id: str, user: UserId):
    with Db() as db:
        row = owned(db, Diary, diary_id, user)
        original = DATA/'images'/row.image_file
    if not original.is_file():
        raise HTTPException(404, '이미지 파일을 찾을 수 없습니다.')
    try:
        path = thumbnail_for(original, DATA/'thumbnails')
        media_type = 'image/jpeg'
    except (OSError, ValueError):
        # 미리보기 저장 공간/변환 문제로 기존 작품까지 사라지지 않게 합니다.
        path, media_type = original, 'image/png'
    return FileResponse(path, media_type=media_type, headers={'Cache-Control':'private, no-store'})

@app.get('/metrics')
def metrics(user: UserId):
    with Db() as db:
        return [{'kind':r.kind,'model':r.model,'seconds':r.seconds,'first_token_seconds':r.first_token_seconds,
                 'usage':json.loads(r.usage),'settings':json.loads(r.settings)}
            for r in db.scalars(select(Metric).where(Metric.user_id==user).order_by(Metric.id.desc()).limit(50))]
