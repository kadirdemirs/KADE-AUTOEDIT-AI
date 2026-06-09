@echo off
title KADE AutoEdit AI - Backend Server

REM Python 3.14 yolu (PATH'e eklenmemis olabilir)
set PYTHON=%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe

REM Yoksa PATH'teki python'u dene
if not exist "%PYTHON%" set PYTHON=python

echo ============================================
echo  KADE AutoEdit AI Backend
echo  http://localhost:8472
echo  Durdurmak icin: Ctrl+C
echo ============================================
cd /d "%~dp0backend"
"%PYTHON%" main.py
pause
