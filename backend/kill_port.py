"""Kill the process occupying a given port (Windows only)."""
import sys
import subprocess
import os

def kill_port(port: int) -> bool:
    """Kill the process listening on the given port. Returns True if any killed."""
    try:
        output = subprocess.check_output(
            f'netstat -ano | findstr :{port}',
            shell=True, text=True
        )
        pids = set()
        for line in output.strip().split('\n'):
            parts = line.strip().split()
            if len(parts) >= 5 and parts[1].endswith(f':{port}'):
                pid = parts[-1]
                if pid != '0':
                    pids.add(pid)
        for pid in pids:
            os.system(f'taskkill /F /PID {pid} > nul 2>&1')
        return len(pids) > 0
    except subprocess.CalledProcessError:
        return False  # Nothing listening

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5200
    killed = kill_port(port)
    print(f'Port {port}: {"killed" if killed else "free"}')
