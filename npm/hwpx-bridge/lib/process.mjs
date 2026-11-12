// From HWPX Bridge 0.2.x server/process.mjs (unchanged).
import { spawn } from 'node:child_process';
import path from 'node:path';

export async function runProcess(command, args, { env, signal, timeout = 900_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    let stdout = ''; let stderr = ''; let stopped;
    const stop = reason => {
      if (stopped) return;
      stopped = reason;
      if (process.platform === 'win32' && child.pid) {
        // Filee may own Tesseract children; stop this owned process tree together.
        const killer = spawn(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, shell: false, stdio: 'ignore' });
        killer.on('error', () => child.kill());
        killer.on('close', code => { if (code !== 0) child.kill(); });
      } else child.kill();
    };
    const abort = () => stop('Operation cancelled.');
    const timer = setTimeout(() => stop(`Operation exceeded ${timeout / 1000} seconds.`), timeout);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on('data', bytes => {
      stdout += bytes.toString('utf8');
      if (stdout.length > 8_000_000) stop('Engine output exceeded the 8 MB limit.');
    });
    child.stderr.on('data', bytes => { stderr = (stderr + bytes.toString('utf8')).slice(-32_000); });
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    child.on('error', error => { finish(); reject(error); });
    child.on('close', code => {
      finish();
      if (stopped) reject(new Error(stopped));
      else resolve({ code, stdout, stderr });
    });
  });
}
