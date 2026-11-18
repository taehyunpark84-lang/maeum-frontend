import hashlib
import time
import math
from fastapi import HTTPException
from sqlalchemy import update, delete
from sqlalchemy.exc import IntegrityError
from .db import Db, RateBucket

def limit(identity: str, action: str, maximum: int, seconds: int = 60, *, db=None):
    # 작업 접수와 같은 트랜잭션을 사용하면 접수 실패 시 횟수도 되돌아갑니다.
    if db is None:
        with Db() as session:
            with session.begin():
                limit(identity, action, maximum, seconds, db=session)
        return
    now = time.time()
    window = int(now) // seconds
    key = hashlib.sha256(f'{action}:{identity}:{window}'.encode()).hexdigest()
    db.execute(delete(RateBucket).where(RateBucket.expires < now))
    if db.get(RateBucket, key) is None:
        try:
            with db.begin_nested():
                db.add(RateBucket(key=key, count=0, expires=(window+1)*seconds))
                db.flush()
        except IntegrityError:
            pass
    result = db.execute(update(RateBucket).where(RateBucket.key==key, RateBucket.count<maximum)
                        .values(count=RateBucket.count+1))
    if not result.rowcount:
        remaining = max(1, math.ceil((window+1)*seconds-now))
        wait = f'{math.ceil(remaining/60)}분' if remaining >= 60 else f'{remaining}초'
        message = (f'그림 생성 접수 한도(사용자당 시간당 {maximum}회)에 도달했습니다. 약 {wait} 후 다시 시도해 주세요.'
                   if action == 'image' else f'요청이 많습니다. 약 {wait} 후 다시 시도해 주세요.')
        raise HTTPException(429, message, headers={'Retry-After':str(remaining)})
