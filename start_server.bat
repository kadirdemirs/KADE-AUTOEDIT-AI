@echo off
title KADE AutoEdit AI - Backend Server
echo ============================================
echo  KADE AutoEdit AI Backend
echo  http://localhost:8472
echo  Durdurmak icin: Ctrl+C
echo ============================================
cd /d "%~dp0backend"

REM venv varsa kullan, yoksa setup'a yonlendir
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    python main.py
) else (
    echo UYARI: .venv yok. Once setup.bat calistirin.
    where py >nul 2>&1 && ( py main.py & goto :eof )
    where python >nul 2>&1 && ( python main.py & goto :eof )
    echo HATA: Python bulunamadi.
)
pause
