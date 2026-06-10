@echo off
REM KADE AutoEdit AI - Kurulum (Windows)
echo ============================================
echo  KADE AutoEdit AI - Kurulum
echo ============================================
echo.

REM --- Python bul (PATH'teki py launcher veya python) ---
set PYTHON=
where py >nul 2>&1 && set PYTHON=py
if "%PYTHON%"=="" where python >nul 2>&1 && set PYTHON=python
if "%PYTHON%"=="" (
    echo HATA: Python bulunamadi! Python 3.10+ indirin:
    echo   https://www.python.org/downloads/
    pause
    exit /b 1
)
echo Python: %PYTHON%
%PYTHON% --version

echo.
echo [1/3] FFmpeg kontrol ediliyor...
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo   UYARI: FFmpeg bulunamadi! https://ffmpeg.org/download.html
    echo          PATH'e eklendiginden emin olun.
) else (
    echo   FFmpeg mevcut.
)

echo.
echo [2/3] Sanal ortam ve bagimliliklar...
cd /d "%~dp0backend"
if not exist ".venv" %PYTHON% -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo HATA: pip install basarisiz oldu.
    pause
    exit /b 1
)

echo.
echo [3/3] Panel bagimliliklari (npm)...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo   UYARI: npm bulunamadi. Node.js kurun: https://nodejs.org
) else (
    cd /d "%~dp0panel"
    call npm install
    call npm run build
)

echo.
echo ============================================
echo  Kurulum tamamlandi!
echo  Sunucuyu baslatmak icin: start_server.bat
echo ============================================
pause
