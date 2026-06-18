// Minimal structured logger — the bridge ships as a standalone agent, so it stays
// dependency-light (no pino). One JSON line per event to stdout/stderr, which any
// host log collector (journald, Windows Event Log shim, Docker) can scoop up.

type Ctx = Record<string, unknown>;

function emit(stream: 'log' | 'error', level: string, msg: string, ctx?: Ctx): void {
  const line = JSON.stringify({ level, msg, ...ctx, t: new Date().toISOString() });

  console[stream](line);
}

export const log = {
  info: (msg: string, ctx?: Ctx) => emit('log', 'info', msg, ctx),
  warn: (msg: string, ctx?: Ctx) => emit('error', 'warn', msg, ctx),
  error: (msg: string, ctx?: Ctx) => emit('error', 'error', msg, ctx),
};
