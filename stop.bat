@echo off
echo Deteniendo ScriptForge...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5500 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo Servidor detenido.
timeout /t 2 >nul