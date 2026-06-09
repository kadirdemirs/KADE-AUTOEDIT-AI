@echo off
echo ============================================
echo  KADE AutoEdit AI - Kurulum
echo ============================================
echo.

REM Python 3.14 yolu
set PYTHON=%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe
if not exist "%PYTHON%" set PYTHON=python

"%PYTHON%" --version >nul 2>&1
if %errorlevel% neq 0 (
    echo HATA: Python bulunamadi!
    echo Python 3.10+ indirin: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/3] Python bagimliliklari yukleniyor...
cd /d "%~dp0backend"
"%PYTHON%" -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo HATA: pip install basarisiz oldu.
    pause
    exit /b 1
)

echo.
echo [2/3] FFmpeg kontrol ediliyor...
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo UYARI: FFmpeg bulunamadi! Lutfen yukleyin: https://ffmpeg.org/download.html
    echo       PATH'e eklendiginden emin olun.
) else (
    echo FFmpeg mevcut.
)

echo.
echo [3/3] Sunucu test ediliyor...
start /b "%PYTHON%" main.py
timeout /t 3 /nobreak >nul
curl -s http://localhost:8472/health
taskkill /f /im python.exe >nul 2>&1

echo.
echo ============================================
echo  Kurulum tamamlandi!
echo  Sunucuyu baslatmak icin: start_server.bat
echo  Panel:  cd panel ve npm install ve npm run build
echo ============================================
pause
