@echo off
REM Panel'i .ccx olarak paketle (Windows)
setlocal
set ROOT=%~dp0..
cd /d "%ROOT%\panel"
call npm install
call npm run build
cd /d "%ROOT%"
python packaging\build_ccx.py
endlocal
