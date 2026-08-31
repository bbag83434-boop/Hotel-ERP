// APEX ERP — Python/FastAPI Backend Wrapper for Render & Local Environments
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const backendDir = fs.existsSync(path.join(process.cwd(), 'app', 'main.py'))
  ? process.cwd()
  : path.join(process.cwd(), 'backend');

const venvLinux = path.join(backendDir, '.venv', 'bin', 'python');
const venvWin = path.join(backendDir, '.venv', 'Scripts', 'python.exe');

// Check candidates in priority order
const candidates = [
  venvLinux,
  venvWin,
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Python', 'bin', 'python.exe') : null,
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python314', 'python.exe') : null,
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python311', 'python.exe') : null,
  '/usr/local/bin/python3',
  '/usr/bin/python3',
  '/usr/bin/python',
  'python3',
  'python'
].filter(Boolean);

let pythonCmd = 'python3';
for (const cand of candidates) {
  if (path.isAbsolute(cand) && fs.existsSync(cand)) {
    pythonCmd = cand;
    break;
  }
}

const port = process.env.PORT || '10000';

console.log(`[APEX ERP] Starting Python FastAPI backend on port ${port} using ${pythonCmd}...`);

const proc = spawn(pythonCmd, ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', port], {
  cwd: backendDir,
  stdio: 'inherit',
  env: process.env,
});

proc.on('exit', (code) => {
  process.exit(code || 0);
});

process.on('SIGTERM', () => proc.kill('SIGTERM'));
process.on('SIGINT', () => proc.kill('SIGINT'));
