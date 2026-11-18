"""서버 설정. API 키는 backend/.env에서만 읽습니다. 앱에는 전달하지 않습니다."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
# 이 프로젝트는 backend/.env를 설정의 기준으로 사용합니다.
# 터미널/IDE에 남아 있는 다른 OPENAI_API_KEY가 새 키를 가리지 않게 합니다.
# 운영에서 환경변수만 주입하려면 .env 파일을 배포하지 않습니다.
load_dotenv(ROOT / '.env', override=True)
DATA = Path(os.getenv('DATA_DIR', str(ROOT / 'storage'))).resolve()
DATA.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.getenv('DATABASE_URL', f'sqlite:///{DATA / "maeum.db"}')
AI_MODE = os.getenv('AI_MODE', 'mock')  # openai로 바꾸면 실제 과금 호출
API_KEY = os.getenv('OPENAI_API_KEY', '')
# 사용자별 시간당 접수 한도. 운영 기본값은 10, 개발 시 .env에서 조절합니다.
IMAGE_REQUESTS_PER_HOUR = max(1, int(os.getenv('IMAGE_REQUESTS_PER_HOUR', '10')))

