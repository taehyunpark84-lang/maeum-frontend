"""테스트가 로컬 실서비스 .env/키/DB를 읽지 못하게 합니다."""
import os

os.environ['PYTHON_DOTENV_DISABLED'] = '1'
