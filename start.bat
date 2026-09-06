@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title Academic Joan of Arc - Local Launcher
echo Starting Academic Joan of Arc (embedded frontend + backend on :8000)...
python launcher.py
if errorlevel 1 (
  echo.
  echo [ERROR] Launcher exited with code %errorlevel%.
  echo Press any key to close...
  pause >nul
)
endlocal
