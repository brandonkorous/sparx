// Keeps an idle MCP SSE stream open: the ingress cut `GET /mcp` streams at ~6 min (WW-11).
// An SSE comment line (`: …`) is ignored by every client, so it carries no meaning.

import type { ServerResponse } from 'node:http';

export const HEARTBEAT_MS = 30_000;

function isOpenEventStream(res: ServerResponse): boolean {
  if (!res.headersSent || res.writableEnded || res.destroyed) return false;
  return String(res.getHeader('content-type') ?? '').includes('text/event-stream');
}

/** Writes a comment line every `intervalMs` until the stream closes; a no-op on anything else. */
export function keepSseAlive(res: ServerResponse, intervalMs = HEARTBEAT_MS): void {
  if (!isOpenEventStream(res)) return;
  const timer = setInterval(() => {
    if (res.writableEnded || res.destroyed) clearInterval(timer);
    else res.write(': keepalive\n\n');
  }, intervalMs);
  timer.unref();
  res.once('close', () => clearInterval(timer));
}
