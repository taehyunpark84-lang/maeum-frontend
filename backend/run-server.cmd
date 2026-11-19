@echo off
setlocal
cd /d "%~dp0"
".venv\Scripts\python.exe" -I -c "import sys; assert 'WindowsApps' not in sys.base_prefix, 'Use a standalone Python runtime'; import uvicorn, fastapi, sqlalchemy"
if errorlevel 1 (
  echo Backend Python environment is unavailable. See backend/README.md: Python recovery.
  exit /b 1
)
echo Starting API on port 8000. Keep this terminal open.
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
exit /b %errorlevel%
