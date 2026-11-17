import hashlib
import time
from fastapi import HTTPException
from sqlalchemy import update, delete
from sqlalchemy.exc import IntegrityError
from .db import Db, RateBucket

def limit(identity: str, action: str, maximum: int, seconds: int = 60):
    window = int(time.time()) // seconds
    key = hashlib.sha256(f'{action}:{identity}:{window}'.encode()).hexdigest()
    with Db() as db:
        db.execute(delete(RateBucket).where(RateBucket.expires < time.time()))
        db.commit()
        if db.get(RateBucket, key) is None:
            try:
                db.add(RateBucket(key=key, count=0, expires=(window+1)*seconds))
                db.commit()
            except IntegrityError:
                db.rollback()
        result = db.execute(update(RateBucket).where(RateBucket.key==key, RateBucket.count<maximum)
                            .values(count=RateBucket.count+1))
        db.commit()
        if not result.rowcount:
            raise HTTPException(429, '요청이 많습니다. 잠시 후 다시 시도해 주세요.', headers={'Retry-After':str(seconds)})
