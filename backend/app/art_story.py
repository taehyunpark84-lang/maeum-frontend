"""채팅의 공통 기억과 별도로, 이번 작품에 담을 최근 이야기를 준비합니다."""
from sqlalchemy import select, func
from .db import Db, Job, Diary, Message, UserMemory
from .shared_history import message_query, places_by_session, context_items
from . import ai


def recent_items(rows, origins, max_chars=24000):
    selected = []
    size = 0
    for row in rows:  # DB에서 최신순으로 가져온 기록
        if selected and size + len(row.text) > max_chars:
            break
        selected.append(row)
        size += len(row.text)
    return context_items(list(reversed(selected)), origins)


async def prepare_story(user):
    with Db() as db:
        completed = select(Job).join(Diary, Diary.job_id == Job.id).where(
            Job.user_id == user, Diary.user_id == user, Job.status == 'completed')
        last = db.scalar(completed.order_by(Job.created.desc(), Job.id.desc()).limit(1))
        # 오래된 실패 작업을 나중에 재시도해도 체크포인트가 뒤로 가지 않습니다.
        through = db.scalar(select(func.max(Job.source_through)).join(Diary, Diary.job_id == Job.id).where(
            Job.user_id == user, Diary.user_id == user, Job.status == 'completed')) or 0
        # 생성 작품의 설명/시는 새 대화 소재로 다시 투입하지 않습니다.
        query = message_query(user).where(~Message.request_id.in_(select(Job.id).where(Job.user_id == user)))
        latest_user = db.scalar(query.where(Message.role == 'user').order_by(Message.id.desc()).limit(1))
        snapshot = latest_user.id if latest_user else through
        previous_story = last.approved_summary if last else ''
        new_rows = list(db.scalars(query.where(Message.id > through, Message.id <= snapshot)
            .order_by(Message.id.desc()).limit(60)))
        if not any(row.role == 'user' for row in new_rows):
            return previous_story, snapshot
        background = list(db.scalars(query.where(Message.id <= through).order_by(Message.id.desc()).limit(12)))
        origins = places_by_session(db, user)
        memory = db.get(UserMemory, user)
        reference = memory.summary if memory else ''
    decision = await ai.select_art_story(user, recent_items(new_rows, origins),
        recent_items(background, origins, 8000), reference, previous_story)
    if not decision.has_new_material and previous_story:
        return previous_story, snapshot
    return decision.story.strip(), snapshot
