@echo off
echo Stopping...
taskkill /F /IM python.exe > nul 2>&1
taskkill /F /IM pythonw.exe > nul 2>&1
echo Stopped.
pause
