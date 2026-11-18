"""사용자별 공통 기록. 세션은 당시 공간을 보존하는 출처로 사용합니다."""
import time
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from .db import Db, Conversation, Message, ChatLock, UserChatLock, uid


def message_query(user):
    return select(Message).join(Conversation, Message.session_id == Conversation.id).where(Conversation.user_id == user)


def places_by_session(db, user):
    return dict(db.execute(select(Conversation.id, Conversation.place_id).where(Conversation.user_id == user)).all())


def context_items(rows, origins):
    # 출처는 참고 표시입니다. JSON 예시를 반복해 답변 형식까지 바뀌는 것을 방지합니다.
    return [{'role':row.role,
             'content':f'[참고용 발화 출처: 공간={origins[row.session_id]}, 역할={row.role}]\n{row.text}'}
            for row in rows]


def acquire_turn(user, seconds):
    owner = uid()
    now = time.time()
    with Db() as db:
        # 전환 직전 버전에서 실행 중이던 대화도 만료될 때까지 존중합니다.
        legacy = db.scalar(select(ChatLock).join(Conversation, ChatLock.session_id == Conversation.id).where(
            Conversation.user_id == user, ChatLock.expires > now))
        if legacy:
            return None
        db.execute(delete(UserChatLock).where(UserChatLock.user_id == user, UserChatLock.expires <= now))
        db.add(UserChatLock(user_id=user, owner=owner, expires=now + seconds))
        try:
            db.commit()
        except IntegrityError:
            return None
    return owner


def release_turn(user, owner):
    with Db() as db:
        db.execute(delete(UserChatLock).where(UserChatLock.user_id == user, UserChatLock.owner == owner))
        db.commit()
