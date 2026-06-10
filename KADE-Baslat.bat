@echo off
chcp 65001 >nul
title KADE AutoEdit AI - Baslatici
cd /d "%~dp0"

echo ============================================
echo  KADE AutoEdit AI baslatiliyor...
echo ============================================
echo.

REM --- 1. Backend sunucusunu baslat (zaten calismiyorsa) ---
echo [1/3] Backend sunucu kontrol ediliyor...
curl -s http://localhost:8472/health >nul 2>&1
if %errorlevel% equ 0 (
    echo       Sunucu zaten calisiyor.
) else (
    echo       Sunucu baslatiliyor...
    if exist "dist\kade-backend\kade-backend.exe" (
        start "" "dist\kade-backend\kade-backend.exe"
    ) else if exist "backend\.venv\Scripts\python.exe" (
        start "" /min "backend\.venv\Scripts\python.exe" "backend\main.py"
    ) else (
        start "" /min cmd /c "cd backend && python main.py"
    )
)

REM --- 2. Sunucunun hazir olmasini bekle ---
echo [2/3] Sunucu hazir bekleniyor...
set /a tries=0
:waitloop
curl -s http://localhost:8472/health >nul 2>&1
if %errorlevel% equ 0 goto ready
set /a tries+=1
if %tries% geq 30 goto timeout
timeout /t 1 /nobreak >nul
goto waitloop
:ready
echo       Sunucu HAZIR (http://localhost:8472)
goto udt
:timeout
echo       UYARI: Sunucu yanit vermedi, yine de devam ediliyor.

REM --- 3. UXP Developer Tool'u ac (panel yuklemek icin) ---
:udt
echo [3/3] UXP Developer Tool aciliyor...
set "UDT=C:\Program Files\Adobe\Adobe UXP Developer Tools\Adobe UXP Developer Tools.exe"
if exist "%UDT%" (
    start "" "%UDT%"
    echo.
    echo  UDT acildi. Panel listede gorunuyorsa:
    echo    - 'Load' butonuna basin
    echo    - Premiere'de: Window ^> UXP Plugins ^> KADE AutoEdit
    echo.
    echo  Panel listede yoksa: 'Add Plugin' ^> panel\manifest.json
) else (
    echo  UYARI: UXP Developer Tool bulunamadi.
    echo  Creative Cloud'dan kurun.
)

echo.
echo ============================================
echo  Hazir! Bu pencereyi kapatabilirsiniz.
echo  (Sunucu arka planda calismaya devam eder)
echo ============================================
timeout /t 8
