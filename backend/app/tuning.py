"""실험할 값은 이 파일에서 변경합니다. 변경 후 API와 작업자를 모두 재시작하세요.
모델/프롬프트 버전과 시간/토큰은 metrics 테이블에 저장합니다. 대화 원문은 로그에 넣지 않습니다.
temperature/top_p는 모델별 지원이 달라 기본적으로 보내지 않습니다.
"""
import os

TEXT_MODEL = os.getenv('TEXT_MODEL', 'gpt-6.1-terra')
IMAGE_MODEL = os.getenv('IMAGE_MODEL', 'gpt-image-2.6-flare')
PROMPT_VERSION = 'pdf-2026-11-16-v1'
TEXT_PROFILES = {
    # max_output_tokens에는 추론 토큰도 포함되므로 너무 낮게 지정하지 마세요.
    'chat': {'model': TEXT_MODEL, 'reasoning': {'effort': 'low'}, 'text': {'verbosity': 'low'}, 'max_output_tokens': 2200},
    'summary': {'model': TEXT_MODEL, 'reasoning': {'effort': 'low'}, 'max_output_tokens': 2600},
    'art': {'model': TEXT_MODEL, 'reasoning': {'effort': 'low'}, 'max_output_tokens': 4000},
}
# 토큰 추정은 한국어까지 보수적으로 문자 수로 잡습니다. 정확한 토크나이저로 교체 가능.
SUMMARY_TRIGGER_CHARS = 14000
RECENT_MESSAGE_COUNT = 16
SUMMARY_MAX_CHARS = 4000
IMAGE_OPTIONS = {
    'model': IMAGE_MODEL,
    'size': '1024x1536',  # 2:3 세로형. 앱에서는 비율 유지, 시는 이미지 아래 별도 표시.
    'quality': 'medium',  # low/medium/high 비교: 생성 시간·세부 표현·비용 기록
    'n': 1,
    'output_format': 'png',
}
# 다양성 실험: 지원 모델/추론 조합을 확인한 뒤 각 프로필에 temperature 또는 top_p를 추가하세요.
# 둘을 동시에 바꾸면 어떤 설정이 영향을 줬는지 비교하기 어렵습니다.
CHAT_TIMEOUT_SECONDS = 120
JOB_LEASE_SECONDS = 900
MAX_JOB_ATTEMPTS = 3

