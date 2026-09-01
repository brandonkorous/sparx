// Frees the local Sparx dev ports. Turbo runs the stack as a deep
// process tree (`pnpm dev` → `turbo run dev` → per-package `next dev` /
// `tsx watch` → their own children), and no OS reliably cascades a kill all
// the way down — especially Windows, which has no POSIX process groups. So a
// stopped/closed `pnpm dev` can leave `next`/`tsx` children alive holding their
// ports, and the next `pnpm dev` then dies with EADDRINUSE.
//
// Run `pnpm dev:kill` to clear them. Standalone by design — deliberately NOT
// wired as `predev`, so a second intentional dev session is never killed out
// from under you.
//
// Ports mirror the `--port` flags in the apps' dev scripts and PORT in each
// service's .env; keep this list in sync if you add a long-running dev task.

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Keeping this list by hand has now gone stale twice — 3010/3011 were missing until
// 2026-07-18, and on 2026-07-24 it was missing 3002 (admin), 3300 (mcp-site) and
// 8084-8091 (eight workers). A missed port is not a no-op: the orphan survives, the
// next `pnpm dev` dies with EADDRINUSE, and because turbo fails the whole run on one
// task, the ENTIRE stack refuses to start over one stale child.
//
// So the list is DERIVED from the workspace and only falls back to the literals:
//   - apps/*      → the `--port N` flag in the package's dev script
//   - services/*  → `PORT=N` in the service's .env (or .env.example)
// Adding a service with a distinct port now needs no edit here.
const FALLBACK_PORTS = [
  3000, 3001, 3002, 3003, 3004, 3010, 3011, 3100, 3200, 3300, 8080, 8081, 8082, 8083, 8084, 8085,
  8086, 8087, 8088, 8089, 8090, 8091, 8092,
];

function discoverPorts() {
  const found = new Set(FALLBACK_PORTS);
  // Every tree's apps and services. This read `['apps', 'services']` until the
  // A4 move — and the readdir below swallows a missing root, so it would have
  // discovered NOTHING and quietly fallen back to the hard-coded port list.
  const roots = ['wizeworks/apps', 'wizeworks/services', 'sparx/apps', 'piggles/apps'];
  for (const root of roots) {
    let entries = [];
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue; // root missing — nothing to discover
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = join(root, entry.name);
      // An app declares its port on the dev script; a service reads PORT from env.
      const pkg = readIfPresent(join(dir, 'package.json'));
      const devScript = pkg ? (safeJson(pkg)?.scripts?.dev ?? '') : '';
      const flag = devScript.match(/--port[= ](\d+)/);
      if (flag) found.add(Number(flag[1]));
      for (const envName of ['.env', '.env.example']) {
        const env = readIfPresent(join(dir, envName));
        const port = env?.match(/^PORT=(\d+)/m);
        if (port) found.add(Number(port[1]));
      }
    }
  }
  return [...found].sort((a, b) => a - b);
}

function readIfPresent(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const PORTS = discoverPorts();
const isWindows = process.platform === 'win32';

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    // No matching listener / nothing to kill — treat as a clean no-op.
    return '';
  }
}

// Map each known dev port to the set of PIDs currently listening on it.
function listenersByPort() {
  const map = new Map(PORTS.map((p) => [p, new Set()]));
  if (isWindows) {
    // netstat rows: "TCP  <local>:<port>  <foreign>  LISTENING  <pid>"
    // (covers IPv4 0.0.0.0/127.0.0.1 and IPv6 [::] listeners alike).
    for (const line of run('netstat -ano -p tcp').split(/\r?\n/)) {
      const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/);
      if (!m) continue;
      const port = Number(m[1]);
      if (map.has(port)) map.get(port).add(m[2]);
    }
  } else {
    for (const port of PORTS) {
      for (const pid of run(`lsof -ti tcp:${port} -sTCP:LISTEN`).split(/\s+/)) {
        if (pid) map.get(port).add(pid);
      }
    }
  }
  return map;
}

function kill(pid) {
  // /T tree-kills any surviving children of the listener too. The result is
  // deliberately ignored here: a kill that "fails" because the process already
  // exited is a success, and a kill that fails for any other reason shows up in
  // the re-scan below. The PORT being free is the only fact worth reporting.
  run(isWindows ? `taskkill /F /T /PID ${pid}` : `kill -9 ${pid}`);
}

// ── Kill, then CHECK ─────────────────────────────────────────────────────────
//
// This used to print `port 3022 → killed PID 41288` for every listener it found
// and count it, without ever looking again. `run()` swallows a failed kill, so a
// PID that could not be killed — held by another user, protected, or replaced by
// a supervisor a millisecond later — was reported as freed, and the script
// finished with a confident "freed 6 process(es)" over ports that were still
// occupied. The next `pnpm dev` then died with EADDRINUSE against a script that
// had just said it was clear, which is the one thing this script exists to stop.
//
// So it kills, re-scans, and reports what is TRUE: freed, or still held and by
// what. A port it could not free is the whole reason to run this, so it is the
// loudest line and it sets the exit code.

const before = listenersByPort();
// One PID can hold several ports (a service listening on two, or a supervisor
// re-parented onto both). Kill it ONCE — killing per port double-counted it and
// then reported a second "kill" of a pid that was already gone.
const pids = new Map();
for (const [port, set] of before) {
  for (const pid of set) {
    if (!pids.has(pid)) pids.set(pid, []);
    pids.get(pid).push(port);
  }
}

for (const [pid, ports] of pids) {
  console.log(`  killing PID ${pid} (port${ports.length > 1 ? 's' : ''} ${ports.join(', ')})`);
  kill(pid);
}

if (pids.size === 0) {
  console.log(`dev:kill — all ${PORTS.length} dev ports already clear.`);
  process.exit(0);
}

// A tree-kill is not instant on Windows: the handle can outlive the process by a
// beat, so an immediate re-scan reports a port as held that is about to be free.
// Poll briefly rather than sleeping a flat second.
const deadline = Date.now() + 3000;
let stillHeld = new Map();
do {
  stillHeld = new Map([...listenersByPort()].filter(([, set]) => set.size > 0));
  if (stillHeld.size === 0) break;
} while (Date.now() < deadline);

const wanted = new Set([...before].filter(([, set]) => set.size > 0).map(([port]) => port));
const freed = [...wanted].filter((port) => !stillHeld.has(port));

if (freed.length > 0) {
  console.log(
    `dev:kill — freed ${freed.length} port(s): ${freed.sort((a, b) => a - b).join(', ')}`
  );
}

if (stillHeld.size === 0) process.exit(0);

// Still occupied. Say so plainly and name what is holding it, because the next
// thing that happens is `pnpm dev` failing, and this is the only message that
// can explain why.
console.error(`
dev:kill — ${stillHeld.size} port(s) COULD NOT be freed:`);
for (const [port, set] of [...stillHeld].sort((a, b) => a[0] - b[0])) {
  console.error(`  port ${port} — still held by PID ${[...set].join(', ')}`);
}
console.error(
  isWindows
    ? '  Another user or an elevated process may own it. Check Task Manager, or run this terminal as administrator.'
    : '  Another user may own it. Try `sudo lsof -i :<port>`.'
);
process.exit(1);
