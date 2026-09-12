/**
 * OCR service manager — the SINGLE owner of the local PaddleOCR service.
 *
 * Used two ways:
 *   1. Vite plugin (imported by vite.config.js): whatever way the dev server
 *      starts — `npm run dev`, `npx vite`, an IDE run button — the OCR
 *      service comes up with it and dies with it. This is what permanently
 *      eliminates the "service not reachable on :8100" failure: there is no
 *      longer a separate launch step to forget.
 *   2. Standalone CLI (`npm run ocr` / `node scripts/ocrService.mjs`):
 *      service only, stays alive until Ctrl+C.
 *
 * Behaviour:
 *   - Already-running service (another terminal, previous session) is
 *     detected via /health and REUSED — never double-started.
 *   - A port occupied by something that is NOT the OCR service is reported
 *     and left alone.
 *   - Watchdog: if the service dies mid-session it is restarted automatically
 *     (max once per 8 s) instead of staying dead.
 *   - First run bootstraps ocr-service/.venv automatically.
 *   - No local VITE_OCR_ENDPOINT → app intentionally runs the tesseract-browser
 *     fallback; this module does nothing.
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ocrDir = path.join(root, 'ocr-service');
const venvUvicorn = path.join(ocrDir, '.venv', 'bin', 'uvicorn');

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const warn = (s) => `\x1b[33m${s}\x1b[0m`;

const HEALTH_WAIT_MS = 30_000;
const WATCHDOG_INTERVAL_MS = 5_000;
const WATCHDOG_MIN_GAP_MS = 8_000;

/** Parse VITE_OCR_ENDPOINT from .env files; return the local port, or null when the app should use the tesseract-browser fallback. */
export function localOcrPort() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^VITE_OCR_ENDPOINT\s*=\s*(.+)$/m);
    if (!m) continue;
    const url = m[1].trim().replace(/^["']|["']$/g, '');
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url)) return null;
    return Number(new URL(url).port) || 80;
  }
  return null;
}

/**
 * Always 127.0.0.1 — never `localhost`. uvicorn binds IPv4 only, and Node may
 * resolve `localhost` to ::1 (IPv6) depending on the OS resolver, which would
 * make the manager unable to see its own service (no reuse detection, no
 * health confirmation, no watchdog). The IP is deterministic; DNS is not.
 */
const isHealthy = (port) =>
  fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) })
    .then((r) => r.ok)
    .catch(() => false);

/** True when something (anything) is listening on the port. */
const isOccupied = (port) =>
  new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' });
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts++;
    if (await isHealthy(port)) {
      console.log(dim(`[ocr] health confirmed after ${attempts} attempt(s)`));
      return true;
    }
    await sleep(400);
  }
  return false;
}

function bootstrapVenv() {
  if (existsSync(venvUvicorn)) return;
  console.log(dim('[ocr] First run: setting up ocr-service virtualenv (a few minutes, once)...'));
  execSync('python3 -m venv .venv', { cwd: ocrDir, stdio: 'inherit' });
  execSync('./.venv/bin/pip install --quiet -r requirements.txt', { cwd: ocrDir, stdio: 'inherit' });
  console.log(ok('[ocr] Dependencies installed.'));
}

/**
 * Live service handle. One per process; the Vite plugin and CLI each own one.
 */
export function createOcrService() {
  let child = null;
  let watchdog = null;
  let stopped = false;
  let lastSpawn = 0;
  const port = localOcrPort();

  const spawnService = () => {
    if (stopped || !port || child) return;
    child = spawn(venvUvicorn, ['app:app', '--port', String(port)], {
      cwd: ocrDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    lastSpawn = Date.now();
    const tag = (line) => process.stdout.write(dim('[ocr] ') + line + '\n');
    child.stdout.on('data', (d) => d.toString().split('\n').filter(Boolean).forEach(tag));
    child.stderr.on('data', (d) => d.toString().split('\n').filter(Boolean).forEach(tag));
    child.on('exit', (code, sig) => { console.log(dim(`[ocr] child pid exited code=${code} sig=${sig}`)); child = null; });
  };

  const start = async () => {
    if (!port) return false;
    if (await isHealthy(port)) {
      console.log(ok(`[ocr] Service already running on :${port} — reusing it.`));
      startWatchdog();
      return true;
    }
    if (await isOccupied(port)) {
      console.warn(warn(`[ocr] Port :${port} is occupied by another process (not the OCR service). Not touching it — set VITE_OCR_ENDPOINT to another port if needed.`));
      return false;
    }
    bootstrapVenv();
    console.log(dim(`[ocr] Starting PaddleOCR service on :${port} (first analysis loads models, ~10–20 s)...`));
    spawnService();
    // ARM THE WATCHDOG IMMEDIATELY — not after the health wait. If the service
    // is killed or crashes mid-boot, the wait loop below would otherwise sit
    // polling a dead child for its full timeout with nobody restarting it.
    startWatchdog();
    const ready = await waitForHealth(port, HEALTH_WAIT_MS);
    if (ready) {
      console.log(ok(`[ocr] Service ready on :${port}`));
    } else {
      console.warn(warn('[ocr] Service did not confirm health yet — watchdog stays armed and will start it as soon as the port frees up.'));
    }
    return ready;
  };

  const startWatchdog = () => {
    if (watchdog || !port) return;
    watchdog = setInterval(async () => {
      if (stopped || child) return;
      if (await isHealthy(port)) return; // served by an external instance
      if (await isOccupied(port)) return; // foreign process owns the port
      if (Date.now() - lastSpawn < WATCHDOG_MIN_GAP_MS) return;
      console.warn(warn('[ocr] Service is down — restarting it automatically...'));
      spawnService();
    }, WATCHDOG_INTERVAL_MS);
    watchdog.unref?.();
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (watchdog) clearInterval(watchdog);
    if (child && !child.killed) child.kill('SIGTERM');
  };

  return { port, start, stop };
}

/**
 * Vite plugin: brings the OCR service up with the dev server and tears it
 * down with it. Register BEFORE the react plugin so startup runs first.
 */
export function ocrServicePlugin() {
  const svc = createOcrService();
  return {
    name: 'local-ocr-service',
    configureServer(server) {
      const boot = () => {
        svc.start().catch((e) => console.warn(warn(`[ocr] startup error: ${e?.message || e}`)));
      };
      if (server.httpServer) {
        server.httpServer.once('listening', boot);
        server.httpServer.once('close', svc.stop);
      } else {
        boot(); // middleware-only mode
      }
      const onSig = () => svc.stop();
      process.once('SIGINT', onSig);
      process.once('SIGTERM', onSig);
      server.httpServer?.once('close', () => {
        process.removeListener('SIGINT', onSig);
        process.removeListener('SIGTERM', onSig);
      });
    },
  };
}

// ---- CLI entry: `npm run ocr` / `node scripts/ocrService.mjs` ----
if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const svc = createOcrService();
  if (!svc.port) {
    console.warn(warn('[ocr] No local VITE_OCR_ENDPOINT configured — nothing to run.'));
    process.exit(1);
  }
  await svc.start();
  if (svc.port) console.log(ok('[ocr] Running — press Ctrl+C to stop.'));
  const shutdown = () => { svc.stop(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  setInterval(() => {}, 1 << 30); // hold the event loop open
}
