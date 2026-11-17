"""비밀번호는 scrypt, 로그인 토큰은 SHA-256 해시만 DB에 저장합니다."""
import hashlib
import hmac
import secrets
import time
from fastapi import Header, HTTPException
from .db import Db, Login

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return salt + ':' + digest

def verify_password(password: str, saved: str) -> bool:
    salt, expected = saved.split(':')
    actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return hmac.compare_digest(actual, expected)

def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def current_user(authorization: str = Header(default='')) -> str:
    if not authorization.startswith('Bearer '):
        raise HTTPException(401, '로그인이 필요합니다.')
    with Db() as db:
        login = db.get(Login, token_hash(authorization[7:]))
        if not login or login.expires < time.time():
            raise HTTPException(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.')
        return login.user_id
