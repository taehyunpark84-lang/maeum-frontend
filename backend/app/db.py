"""SQLite와 MySQL에서 같은 ORM을 사용합니다. 운영 스키마는 Alembic으로 관리합니다."""
import time
import uuid
from sqlalchemy import create_engine, event, String, Text, Integer, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from .config import DATABASE_URL

def uid():
    return str(uuid.uuid4())

engine = create_engine(DATABASE_URL, pool_pre_ping=True,
    connect_args={'check_same_thread': False, 'timeout': 30} if DATABASE_URL.startswith('sqlite') else {})
if DATABASE_URL.startswith('sqlite'):
    @event.listens_for(engine, 'connect')
    def sqlite_pragmas(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
        connection.execute('PRAGMA journal_mode=WAL')

Db = sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = 'users'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    username: Mapped[str] = mapped_column(String(40), unique=True)
    nickname: Mapped[str] = mapped_column(String(40))
    password_hash: Mapped[str] = mapped_column(String(256))

class Login(Base):
    __tablename__ = 'logins'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    expires: Mapped[float] = mapped_column(Float)

class Conversation(Base):
    __tablename__ = 'conversations'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    place_id: Mapped[str] = mapped_column(String(20))
    summary: Mapped[str] = mapped_column(Text, default='')
    summary_through: Mapped[int] = mapped_column(Integer, default=0)
    created: Mapped[float] = mapped_column(Float(53), default=time.time)

class Message(Base):
    __tablename__ = 'messages'
    __table_args__ = (UniqueConstraint('session_id', 'request_id', 'role'),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey('conversations.id'), index=True)
    request_id: Mapped[str] = mapped_column(String(36))
    role: Mapped[str] = mapped_column(String(16))
    text: Mapped[str] = mapped_column(Text)
    created: Mapped[float] = mapped_column(Float(53), default=time.time)

class ChatLock(Base):
    __tablename__ = 'chat_locks'
    session_id: Mapped[str] = mapped_column(ForeignKey('conversations.id'), primary_key=True)
    owner: Mapped[str] = mapped_column(String(36))
    expires: Mapped[float] = mapped_column(Float)

class UserMemory(Base):
    """모든 공간에서 공유하는 요약. 기존 공간별 원문과 요약은 보존합니다."""
    __tablename__ = 'user_memories'
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), primary_key=True)
    summary: Mapped[str] = mapped_column(Text, default='')
    summary_through: Mapped[int] = mapped_column(Integer, default=0)

class UserChatLock(Base):
    """실제로 실행 중인 턴만 잠급니다. 미응답 메시지 자체는 잠금이 아닙니다."""
    __tablename__ = 'user_chat_locks'
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), primary_key=True)
    owner: Mapped[str] = mapped_column(String(36))
    expires: Mapped[float] = mapped_column(Float(53))

class Job(Base):
    __tablename__ = 'jobs'
    __table_args__ = (UniqueConstraint('user_id', 'request_id'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    session_id: Mapped[str] = mapped_column(ForeignKey('conversations.id'))
    request_id: Mapped[str] = mapped_column(String(36))
    approved_summary: Mapped[str] = mapped_column(Text)
    source_through: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default='queued')
    stage: Mapped[str] = mapped_column(String(30), default='queued')
    plan: Mapped[str] = mapped_column(Text, default='')
    error: Mapped[str] = mapped_column(Text, default='')
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    lease_owner: Mapped[str | None] = mapped_column(String(36), nullable=True)
    lease_until: Mapped[float] = mapped_column(Float(53), default=0)
    created: Mapped[float] = mapped_column(Float(53), default=time.time)
    updated: Mapped[float] = mapped_column(Float(53), default=time.time)

class ArtPreview(Base):
    """확인 화면을 열었던 시점의 범위. 이후 채팅은 다음 작품에 남깁니다."""
    __tablename__ = 'art_previews'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    session_id: Mapped[str] = mapped_column(ForeignKey('conversations.id'))
    source_through: Mapped[int] = mapped_column(Integer)
    story: Mapped[str] = mapped_column(Text)
    created: Mapped[float] = mapped_column(Float(53), default=time.time)

class ActiveJob(Base):
    # PK 제약으로 여러 API 프로세스에서도 사용자당 1개만 접수됩니다.
    __tablename__ = 'active_jobs'
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), primary_key=True)
    job_id: Mapped[str] = mapped_column(ForeignKey('jobs.id'), unique=True)

class Diary(Base):
    __tablename__ = 'diaries'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    job_id: Mapped[str] = mapped_column(ForeignKey('jobs.id'), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    poem: Mapped[str] = mapped_column(Text)
    interpretation: Mapped[str] = mapped_column(Text)
    image_file: Mapped[str] = mapped_column(String(150))
    created: Mapped[float] = mapped_column(Float(53), default=time.time)

class Metric(Base):
    __tablename__ = 'metrics'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    model: Mapped[str] = mapped_column(String(80))
    settings: Mapped[str] = mapped_column(Text)
    seconds: Mapped[float] = mapped_column(Float)
    first_token_seconds: Mapped[float | None] = mapped_column(Float(53), nullable=True)
    usage: Mapped[str] = mapped_column(Text, default='{}')
    created: Mapped[float] = mapped_column(Float(53), default=time.time)

class RateBucket(Base):
    """여러 API 프로세스가 공유하는 간단한 고정 시간창 요청 제한."""
    __tablename__ = 'rate_buckets'
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
    expires: Mapped[float] = mapped_column(Float(53))

