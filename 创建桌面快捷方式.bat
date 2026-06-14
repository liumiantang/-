@echo off
powershell -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell;$sc=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\题库抽题系统.lnk');$sc.TargetPath='C:\tiku\启动题库系统.vbs';$sc.WorkingDirectory='C:\tiku';$sc.Save();Write-Host 'Done'"
echo Desktop shortcut created!
pause
