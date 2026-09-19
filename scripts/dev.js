#!/usr/bin/env node
// Runs the API and the Vite dev server together with prefixed output.
// Zero dependencies — `npm run dev` works straight after `npm install`.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);

const paint = (label, color) => (line) => {
  if (!line.trim()) return;
  process.stdout.write(`\x1b[${color}m${label.padEnd(6)}\x1b[0m ${line}\n`);
};

function run(name, command, args, color) {
  const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } });
  const emit = paint(name, color);
  child.stdout.on('data', (d) => String(d).split('\n').forEach(emit));
  child.stderr.on('data', (d) => String(d).split('\n').forEach(emit));
  child.on('exit', (code) => {
    emit(`exited with code ${code}`);
    shutdown();
  });
  return child;
}

const children = [];
function shutdown() {
  for (const c of children) {
    if (!c.killed) c.kill('SIGTERM');
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`\n  ⛰  HRMate dev — API on :${PORT}, web on :5173 (proxied)\n`);
children.push(run('api', process.execPath, ['server/index.js'], '36'));
children.push(run('web', process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js')], '35'));
