Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

ScriptPath = FSO.GetParentFolderName(WScript.ScriptFullName)
Port = "5201"

' ── Step 1: Free the port ──
' Kill by port (more reliable than by image name)
WshShell.Run "cmd /c ""cd /d " & ScriptPath & "\backend && python kill_port.py " & Port & " > nul 2>&1""", 0, True

' Kill all remaining Python as fallback
WshShell.Run "cmd /c ""taskkill /F /IM python.exe > nul 2>&1 & taskkill /F /IM pythonw.exe > nul 2>&1""", 0, True

' Give OS time to release the port
WScript.Sleep 2000

' ── Step 2: Start server (no --reload to avoid zombie child processes) ──
WshShell.Run "cmd /c ""cd /d " & ScriptPath & "\backend && python -m uvicorn app.main:app --host 127.0.0.1 --port " & Port & " > " & ScriptPath & "\server.log 2>&1""", 0, False

' ── Step 3: Wait for server to be ready, then open browser ──
WScript.Sleep 3000
WshShell.Run "http://127.0.0.1:" & Port
