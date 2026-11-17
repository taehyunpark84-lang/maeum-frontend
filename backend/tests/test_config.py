import os
import subprocess
import sys
from pathlib import Path


def test_env_file_overrides_inherited_key_without_reading_real_secrets(tmp_path):
    # 실제 .env를 읽지 않고 config.py만 임시 프로젝트로 복사해 우선순위를 검증합니다.
    app = tmp_path / 'app'
    app.mkdir()
    source = Path(__file__).resolve().parents[1] / 'app' / 'config.py'
    (app / 'config.py').write_text(source.read_text(encoding='utf-8'), encoding='utf-8')
    (tmp_path / '.env').write_text('OPENAI_API_KEY=new-test-key\nAI_MODE=mock\n', encoding='utf-8')
    env = {**os.environ, 'OPENAI_API_KEY': 'old-test-key', 'PYTHON_DOTENV_DISABLED': '0', 'DATA_DIR': str(tmp_path / 'storage')}
    result = subprocess.run([sys.executable, '-c', 'from app.config import API_KEY; assert API_KEY == "new-test-key"'],
                            cwd=tmp_path, env=env, capture_output=True, timeout=15)
    assert result.returncode == 0
