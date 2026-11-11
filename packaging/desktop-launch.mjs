// This dependency-free shim uses the Node runtime supplied by Claude Desktop.
// The document engine itself always uses our separately verified portable Node.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('HWPX Bridge requires native Windows x64.');
const root = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
  ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/launch.ps1')],
  { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
child.stdin.on('error', error => { if (error.code !== 'EPIPE') process.stderr.write(`${error.message}\n`); });
child.on('error', error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
child.on('close', code => { process.exitCode = code ?? 1; process.stdin.destroy(); });
process.on('SIGTERM', () => { child.stdin.end(); });
process.on('SIGINT', () => { child.stdin.end(); });
