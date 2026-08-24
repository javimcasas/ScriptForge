@echo off
cd /d "%~dp0"
start "" pythonw.exe server.py
timeout /t 2 /nobreak >nul
start "" "http://localhost:5500/scriptforge.html"
exit