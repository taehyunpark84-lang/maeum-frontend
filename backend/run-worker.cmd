@echo off
setlocal
cd /d "%~dp0"
".venv\Scripts\python.exe" -I -c "import sys; assert 'WindowsApps' not in sys.base_prefix, 'Use a standalone Python runtime'; import openai, sqlalchemy, PIL"
if errorlevel 1 (
  echo Backend Python environment is unavailable. See backend/README.md: Python recovery.
  exit /b 1
)
echo Starting image worker. Keep this terminal open.
".venv\Scripts\python.exe" -m app.worker
exit /b %errorlevel%
