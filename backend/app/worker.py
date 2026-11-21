"""실행: python -m app.worker

DB가 지속성 작업 큐 역할을 합니다. Redis 없이 로컬 실행 가능하며 API와 프로세스가 분리됩니다.
조건부 UPDATE로 작업을 가져오고 lease로 재시작을 복구합니다. 운영에서는 DB/파일 저장소를 공유하세요.
외부 API 호출의 exactly-once는 보장할 수 없습니다. 응답 직후 장애 시 중복 과금 가능성이 있습니다.
"""
import asyncio
from .ai_errors import public_ai_error
import time
from sqlalchemy import select, update, delete, or_, and_
from .db import Db, Job, ActiveJob, Diary, Conversation, uid
from .config import DATA
from .tuning import JOB_LEASE_SECONDS, MAX_JOB_ATTEMPTS
from .ai import plan_art, draw, describe_art, ArtPlan

def claim_job():
    now = time.time()
    eligible = or_(Job.status == 'queued', and_(Job.status == 'running', Job.lease_until < now))
    with Db() as db:
        candidate = db.scalar(select(Job.id).where(eligible).order_by(Job.created).limit(1))
        if not candidate:
            return None
        owner = uid()
        claimed = db.execute(update(Job).where(Job.id==candidate, eligible).values(
            status='running', lease_owner=owner, lease_until=now+JOB_LEASE_SECONDS,
            attempts=Job.attempts+1, updated=now))
        db.commit()
        return (candidate, owner) if claimed.rowcount else None

def patch_job(job_id, owner, **fields):
    with Db() as db:
        result = db.execute(update(Job).where(Job.id==job_id, Job.lease_owner==owner,
            Job.status=='running').values(**fields, updated=time.time()))
        db.commit()
        if not result.rowcount:
            raise RuntimeError('작업 소유권이 변경되었습니다.')

async def heartbeat(job_id, owner):
    while True:
        await asyncio.sleep(30)
        patch_job(job_id, owner, lease_until=time.time()+JOB_LEASE_SECONDS)

async def process(job_id, owner):
    beat = asyncio.create_task(heartbeat(job_id, owner))
    try:
        with Db() as db:
            job = db.get(Job, job_id)
        if job.attempts > MAX_JOB_ATTEMPTS:
            raise RuntimeError('자동 복구 횟수 초과')
        if job.plan:
            plan = ArtPlan.model_validate_json(job.plan)
        else:
            patch_job(job_id, owner, stage='writing')
            plan = await plan_art(job.user_id, job.approved_summary, job.gender_snapshot)
            patch_job(job_id, owner, plan=plan.model_dump_json())
        patch_job(job_id, owner, stage='drawing')
        image_dir = DATA/'images'
        image_dir.mkdir(exist_ok=True)
        target = image_dir/f'{job_id}.png'
        if not target.exists():
            content = await draw(job.user_id, plan.image_prompt)
            temporary = image_dir/f'{job_id}.{owner}.tmp'
            temporary.write_bytes(content)
            temporary.replace(target)
        patch_job(job_id, owner, stage='explaining')
        with Db() as db:
            place = db.get(Conversation, job.session_id).place_id
        explanation = await describe_art(job.user_id, place, plan, target.read_bytes())
        patch_job(job_id, owner, stage='saving')
        with Db() as db:
            # 완료 표시, 일기 생성, 사용자 잠금 해제를 한 트랜잭션으로 묶습니다.
            result = db.execute(update(Job).where(Job.id==job_id, Job.lease_owner==owner,
                Job.status=='running').values(status='completed', stage='completed', updated=time.time()))
            if result.rowcount:
                if not db.scalar(select(Diary).where(Diary.job_id==job_id)):
                    db.add(Diary(user_id=job.user_id, job_id=job_id, title=plan.title, poem=plan.poem,
                        interpretation=explanation, image_file=target.name))
                db.execute(delete(ActiveJob).where(ActiveJob.job_id==job_id))
                db.commit()
    except Exception as exc:
        # 외부 오류 본문/대화/키는 사용자나 로그에 노출하지 않습니다.
        print(f'job {job_id}: {type(exc).__name__}', flush=True)
        with Db() as db:
            result = db.execute(update(Job).where(Job.id==job_id, Job.lease_owner==owner,
                Job.status=='running').values(status='failed', stage='failed',
                    error=public_ai_error(exc), updated=time.time()))
            if result.rowcount:
                db.execute(delete(ActiveJob).where(ActiveJob.job_id==job_id))
                db.commit()
    finally:
        beat.cancel()
        try:
            await beat
        except asyncio.CancelledError:
            pass

async def run():
    print('그림일기 작업자 시작', flush=True)
    while True:
        claimed = claim_job()
        if claimed:
            await process(*claimed)
        else:
            await asyncio.sleep(1)

if __name__ == '__main__':
    asyncio.run(run())
