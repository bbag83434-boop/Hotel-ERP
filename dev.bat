@echo off
title Hotel ERP Local Dev
echo Starting Backend and Frontend concurrently...

cd /d "%~dp0"
npx -y concurrently -k -p "[{name}]" -n "Backend,Frontend" -c "cyan,magenta" ^
  "cd backend && call .venv\Scripts\activate.bat && set PORT=8000 && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" ^
  "cd frontend && npm run dev"
