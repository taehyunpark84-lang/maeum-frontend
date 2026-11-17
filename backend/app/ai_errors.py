"""키나 요청 내용을 노출하지 않고 외부 오류를 고정된 안내로 바꿉니다."""
from openai import APIStatusError, APIConnectionError, APITimeoutError


def public_ai_error(error: Exception) -> str:
    if isinstance(error, APIStatusError):
        if error.code == 'expired_secret_key':
            return '서버에서 사용하는 API 키가 만료되었습니다. backend/.env의 키를 확인하고 서버와 작업자를 재시작해 주세요.'
        if error.status_code == 401:
            return 'OpenAI API 키 인증에 실패했습니다. 서버의 키 설정을 확인해 주세요.'
        if error.code == 'insufficient_quota':
            return 'OpenAI API 사용 한도가 부족합니다. 결제 설정과 사용 한도를 확인해 주세요.'
        if error.status_code == 429:
            return 'AI 요청이 일시적으로 많습니다. 잠시 후 다시 시도해 주세요.'
        if error.status_code in (403, 404):
            return '설정된 AI 모델에 접근할 수 없습니다. 모델 이름과 프로젝트 권한을 확인해 주세요.'
        if error.status_code == 400:
            return 'AI 요청 설정을 처리할 수 없습니다. 서버의 모델과 지원 인자를 확인해 주세요.'
    if isinstance(error, (APITimeoutError, TimeoutError)):
        return 'AI 응답 대기 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
    if isinstance(error, APIConnectionError):
        return '서버에서 OpenAI에 연결하지 못했습니다. 서버의 인터넷 연결을 확인해 주세요.'
    return '생성에 실패했습니다. 잠시 후 같은 요청으로 재시도해 주세요.'
