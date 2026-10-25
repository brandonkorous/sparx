import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HEARTBEAT_MS, keepSseAlive } from '../src/sse-heartbeat.js';

// WW-11: idle `GET /mcp` streams were cut at ~6 min. A comment every 30 s keeps them open.

function fakeResponse(contentType: string) {
  const write = vi.fn(() => true);
  const res = Object.assign(new EventEmitter(), {
    headersSent: true,
    writableEnded: false,
    destroyed: false,
    getHeader: () => contentType,
    write,
  });
  return { res: res as typeof res & ServerResponse, write };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('keepSseAlive', () => {
  it('writes a comment line every 30 s while the stream is open', () => {
    const { res, write } = fakeResponse('text/event-stream');
    keepSseAlive(res);
    vi.advanceTimersByTime(HEARTBEAT_MS * 3);
    expect(write).toHaveBeenCalledTimes(3);
    expect(write).toHaveBeenCalledWith(': keepalive\n\n');
  });

  it('stops when the stream closes', () => {
    const { res, write } = fakeResponse('text/event-stream');
    keepSseAlive(res);
    vi.advanceTimersByTime(HEARTBEAT_MS);
    res.emit('close');
    vi.advanceTimersByTime(HEARTBEAT_MS * 5);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('leaves a JSON answer alone', () => {
    const { res, write } = fakeResponse('application/json');
    keepSseAlive(res);
    vi.advanceTimersByTime(HEARTBEAT_MS * 2);
    expect(write).not.toHaveBeenCalled();
  });
});
