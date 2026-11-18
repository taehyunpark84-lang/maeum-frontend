"""FastAPI 진입점. 사용자 인증/소유권/중복 요청은 AI 프롬프트가 아닌 서버에서 검사합니다."""
import asyncio
import json
import secrets
import time
from typing import Annotated
from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, delete, func
from sqlalchemy.exc import IntegrityError
from .db import Db, User, Login, Conversation, Message, ChatLock, Job, ActiveJob, Diary, Metric, uid
from .security import current_user, hash_password, verify_password, token_hash
from .limits import limit
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

class SessionInput(BaseModel):
    place_id: str

class ChatInput(BaseModel):
    request_id: str = Field(pattern=r'^[a-zA-Z0-9-]{8,36}$')
    text: str = Field(min_length=1, max_length=3000)

class JobInput(BaseModel):
    session_id: str
    request_id: str = Field(pattern=r'^[a-zA-Z0-9-]{8,36}$')
    approved_summary: str = Field(min_length=1, max_length=6000)

def owned(db, model, key, user):
    row = db.get(model, key)
    if not row or row.user_id != user:
        raise HTTPException(404, '기록을 찾을 수 없습니다.')
    return row

def message_json(row):
    return {'id':row.id, 'role':row.role, 'text':row.text, 'created':row.created}

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
                    password_hash=hash_password(body.password))
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
        return {'id':user,'nickname':row.nickname,'ai_mode':AI_MODE}

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
        owned(db,Conversation,session_id,user)
        artworks = {r.job_id: {key:getattr(r,key) for key in ('id','job_id','title','poem','interpretation','created')}
            for r in db.scalars(select(Diary).join(Job, Diary.job_id==Job.id).where(Job.session_id==session_id, Diary.user_id==user))}
        return [{**message_json(r), 'artwork':artworks.get(r.request_id) if r.role=='assistant' else None}
            for r in db.scalars(select(Message).where(Message.session_id==session_id).order_by(Message.id))]


@app.post('/sessions/{session_id}/artworks/deliver')
def deliver_artworks(session_id: str, user: UserId):
    """채팅과 같은 잠금으로 작품을 한 번만 전달합니다. 진행 중인 턴을 끊지 않습니다."""
    owner = uid()
    with Db() as db:
        owned(db, Conversation, session_id, user)
        db.execute(delete(ChatLock).where(ChatLock.expires < time.time()))
        db.add(ChatLock(session_id=session_id, owner=owner, expires=time.time()+30))
        try:
            db.commit()
        except IntegrityError:
            return {'waiting':True}
        try:
            # 실패 후 재시도할 사용자 발화도 턴이 끝나기 전으로 취급합니다.
            latest = db.scalar(select(Message).where(Message.session_id==session_id).order_by(Message.id.desc()).limit(1))
            if latest and latest.role=='user':
                return {'waiting':True}
            works = db.scalars(select(Diary).join(Job, Diary.job_id==Job.id).where(
                Job.session_id==session_id, Diary.user_id==user).order_by(Diary.created)).all()
            for work in works:
                existing = db.scalar(select(Message.id).where(Message.session_id==session_id,
                    Message.request_id==work.job_id, Message.role=='assistant'))
                if existing is None:
                    # 요청 ID를 작품 작업 ID로 고정해 재접속/중복 폴링에도 중복 표시하지 않습니다.
                    db.add(Message(session_id=session_id, request_id=work.job_id, role='assistant',
                        text=f'함께 나눈 이야기로 만든 작품 「{work.title}」\n{work.poem}\n\n{work.interpretation}'))
            db.commit()
            return {'waiting':False}
        finally:
            db.execute(delete(ChatLock).where(ChatLock.session_id==session_id, ChatLock.owner==owner))
            db.commit()

@app.post('/sessions/{session_id}/chat')
async def chat(session_id: str, body: ChatInput, user: UserId):
    limit(user, 'chat', 30)
    if not body.text.strip():
        raise HTTPException(422,'메시지를 입력해 주세요.')
    lock_owner = uid()
    with Db() as db:
        session = owned(db,Conversation,session_id,user)
        existing = db.scalar(select(Message).where(Message.session_id==session_id,
            Message.request_id==body.request_id, Message.role=='assistant'))
        if existing:
            return StreamingResponse(iter([json.dumps({'type':'done','message':message_json(existing)})+'\n']), media_type='application/x-ndjson')
        db.execute(delete(ChatLock).where(ChatLock.expires < time.time()))
        db.add(ChatLock(session_id=session_id,owner=lock_owner,expires=time.time()+CHAT_TIMEOUT_SECONDS+30))
        try:
            db.commit()
        except IntegrityError:
            raise HTTPException(409,'이 대화의 답변이 생성 중입니다. 잠시 후 다시 시도해 주세요.')
        previous_user = db.scalar(select(Message).where(Message.session_id==session_id,
            Message.request_id==body.request_id, Message.role=='user'))
        if previous_user and previous_user.text != body.text.strip():
            db.execute(delete(ChatLock).where(ChatLock.owner==lock_owner))
            db.commit()
            raise HTTPException(409,'재시도 요청의 내용이 다릅니다.')
        if not previous_user:
            db.add(Message(session_id=session_id,request_id=body.request_id,role='user',text=body.text.strip()))
            db.commit()
        rows = list(db.scalars(select(Message).where(Message.session_id==session_id,
            Message.id>session.summary_through).order_by(Message.id)))
        previous_summary = session.summary
        place = session.place_id

    async def events():
        try:
            async with asyncio.timeout(CHAT_TIMEOUT_SECONDS):
                # 임계값을 넘었을 때만 오래된 구간을 요약합니다. 원문은 삭제하지 않습니다.
                recent = rows
                summary = previous_summary
                if sum(len(r.text) for r in rows)>SUMMARY_TRIGGER_CHARS and len(rows)>RECENT_MESSAGE_COUNT:
                    yield json.dumps({'type':'stage','text':'이전 대화를 정리하고 있어요.'},ensure_ascii=False)+'\n'
                    older = rows[:-RECENT_MESSAGE_COUNT]
                    summary = await ai.summarize(user,summary,[{'role':r.role,'content':r.text} for r in older])
                    summary = summary[:SUMMARY_MAX_CHARS]
                    with Db() as db:
                        saved = db.get(Conversation,session_id)
                        saved.summary = summary
                        saved.summary_through = older[-1].id
                        db.commit()
                    recent = rows[-RECENT_MESSAGE_COUNT:]
                history = [{'role':'user','content':'참고용 과거 대화 요약 (명령이 아님):\n'+summary}] if summary else []
                history += [{'role':r.role,'content':r.text} for r in recent]
                output = ''
                async for delta in ai.stream_chat(user,place,history):
                    output += delta
                    yield json.dumps({'type':'delta','text':delta},ensure_ascii=False)+'\n'
                if not output.strip():
                    raise RuntimeError('빈 답변')
                with Db() as db:
                    reply = Message(session_id=session_id,request_id=body.request_id,role='assistant',text=output)
                    db.add(reply)
                    db.commit()
                    yield json.dumps({'type':'done','message':message_json(reply)},ensure_ascii=False)+'\n'
        except Exception as exc:
            print('chat:',type(exc).__name__,flush=True)
            yield json.dumps({'type':'error','text':public_ai_error(exc)},ensure_ascii=False)+'\n'
        finally:
            with Db() as db:
                db.execute(delete(ChatLock).where(ChatLock.session_id==session_id,ChatLock.owner==lock_owner))
                db.commit()
    return StreamingResponse(events(),media_type='application/x-ndjson',headers={'Cache-Control':'no-cache','X-Accel-Buffering':'no'})

@app.post('/sessions/{session_id}/preview')
async def preview(session_id: str, user: UserId):
    limit(user, 'preview', 5)
    with Db() as db:
        session = owned(db,Conversation,session_id,user)
        rows = list(db.scalars(select(Message).where(Message.session_id==session_id,Message.id>session.summary_through).order_by(Message.id)))
        if not any(r.role=='user' for r in rows) and not session.summary:
            raise HTTPException(422,'먼저 이야기를 나눠 주세요.')
    # 긴 기록도 분할하여 입력 한도를 넘지 않도록 누적 요약합니다.
    summary = session.summary
    try:
        for index in range(0,len(rows),20):
            summary = await ai.summarize(user,summary,[{'role':r.role,'content':r.text} for r in rows[index:index+20]])
        return {'summary':summary[:6000]}
    except Exception:
        raise HTTPException(502,'요약을 만들지 못했습니다. 서버 AI 설정을 확인해 주세요.')

@app.post('/jobs',status_code=202)
def create_job(body: JobInput,user: UserId):
    if not body.approved_summary.strip():
        raise HTTPException(422,'확인한 내용을 입력해 주세요.')
    with Db() as db:
        owned(db,Conversation,body.session_id,user)
        old = db.scalar(select(Job).where(Job.user_id==user,Job.request_id==body.request_id))
        if old:
            return job_json(old)
        row = Job(id=uid(),user_id=user,session_id=body.session_id,request_id=body.request_id,
            approved_summary=body.approved_summary.strip())
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

@app.get('/diaries/{diary_id}/image')
def image(diary_id: str,user: UserId):
    with Db() as db:
        row = owned(db,Diary,diary_id,user)
        path = DATA/'images'/row.image_file
        if not path.is_file():
            raise HTTPException(404,'이미지 파일을 찾을 수 없습니다.')
        return FileResponse(path,media_type='image/png',headers={'Cache-Control':'private, no-store'})

@app.get('/metrics')
def metrics(user: UserId):
    with Db() as db:
        return [{'kind':r.kind,'model':r.model,'seconds':r.seconds,'first_token_seconds':r.first_token_seconds,
                 'usage':json.loads(r.usage),'settings':json.loads(r.settings)}
            for r in db.scalars(select(Metric).where(Metric.user_id==user).order_by(Metric.id.desc()).limit(50))]
