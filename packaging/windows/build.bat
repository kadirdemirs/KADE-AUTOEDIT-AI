@echo off
REM KADE AutoEdit AI - Windows installer build (uctan uca)
REM Gereksinim: Python venv aktif (backend deps + pyinstaller), Inno Setup (ISCC).
setlocal
set ROOT=%~dp0..\..
cd /d "%ROOT%"

echo ============================================
echo  KADE AutoEdit - Windows Installer Build
echo ============================================

echo [1/4] FFmpeg binary'leri indiriliyor...
python packaging\fetch_ffmpeg.py
if %errorlevel% neq 0 ( echo HATA: ffmpeg indirilemedi & exit /b 1 )

echo.
echo [2/4] Backend PyInstaller ile donduruluyor...
pyinstaller packaging\kade-backend.spec --noconfirm --distpath dist --workpath build\pyi
if %errorlevel% neq 0 ( echo HATA: PyInstaller basarisiz & exit /b 1 )

echo.
echo [3/4] Panel .ccx olusturuluyor...
call packaging\build_ccx.bat
if not exist "dist\KADE-AutoEdit.ccx" echo   (uyari: .ccx uretilemedi, installer onsuz devam eder)

echo.
echo [4/4] Inno Setup ile .exe paketleniyor...
set ISCC=ISCC
where ISCC >nul 2>&1 || set ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe
if not exist "%ISCC%" if "%ISCC%"=="ISCC" goto :noiscc
"%ISCC%" packaging\windows\installer.iss
if %errorlevel% neq 0 ( echo HATA: Inno Setup basarisiz & exit /b 1 )
goto :done
:noiscc
echo HATA: ISCC bulunamadi. Inno Setup kurun: winget install JRSoftware.InnoSetup
exit /b 1
:done

echo.
echo ============================================
echo  TAMAM! Installer: dist\installer\KADE-AutoEdit-Setup.exe
echo ============================================
endlocal
