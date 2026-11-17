import httpx
from openai import AuthenticationError, RateLimitError
from app.ai_errors import public_ai_error


def test_expired_key_guidance_does_not_leak_provider_message():
    response = httpx.Response(401, request=httpx.Request('POST', 'https://api.openai.com/v1/responses'))
    error = AuthenticationError('secret-provider-body', response=response,
                                body={'code': 'expired_secret_key'})
    message = public_ai_error(error)
    assert '만료' in message and '재시작' in message
    assert 'secret-provider-body' not in message


def test_quota_and_rate_limit_have_different_guidance():
    response = httpx.Response(429, request=httpx.Request('POST', 'https://api.openai.com/v1/responses'))
    quota = RateLimitError('private', response=response, body={'code': 'insufficient_quota'})
    temporary = RateLimitError('private', response=response, body={'code': 'rate_limit_exceeded'})
    assert '결제' in public_ai_error(quota)
    assert '잠시 후' in public_ai_error(temporary)
    assert 'private' not in public_ai_error(RuntimeError('private'))
