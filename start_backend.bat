@echo off
title APEX ERP Local Backend
echo ========================================================
echo Starting APEX ERP Local Development Backend
echo ========================================================
echo.

:: Ensure we are in the root directory of the project
cd /d "%~dp0"

:: Check if the backend virtual environment exists
if not exist "backend\.venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found in backend\.venv
    echo Please ensure you have run the build step to create the virtual environment.
    pause
    exit /b 1
)

:: Activate the virtual environment
call "backend\.venv\Scripts\activate.bat"

:: Start Uvicorn on 127.0.0.1:8000
echo.
echo Launching FastAPI on http://127.0.0.1:8000 ...
cd backend

:: Ensure the PORT is set to 8000 specifically so we don't accidentally start on 4000
set PORT=8000

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

echo.
echo [WARNING] Uvicorn process has exited unexpectedly!
echo Make sure port 8000 is not already in use by another application.
pause
