// TWO REPLICAS, ONE CONVERSATION. Each case runs real socket.io servers and a
// real client; only the NATS server is replaced, by an in-memory bus that still
// sends bytes, so the encoding is exercised too. The question every case asks is
// the one production asks: a socket on replica B, a broadcast made somewhere
// else, does it arrive?

import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connectClient, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';

import {
  broadcastSubject,
  createSocketBusAdapter,
  createSocketBusEmitter,
  type BusConnection,
} from './index.js';

/** NATS core publish/subscribe in one process: by subject, asynchronous, bytes. */
function memoryBus(): BusConnection {
  const subs = new Map<string, Set<(err: Error | null, msg: { data: Uint8Array }) => void>>();
  return {
    publish(subject, data) {
      const copy = data.slice();
      for (const cb of subs.get(subject) ?? []) setImmediate(() => cb(null, { data: copy }));
    },
    subscribe(subject, { callback }) {
      const set = subs.get(subject) ?? new Set();
      set.add(callback);
      subs.set(subject, set);
      return { unsubscribe: () => set.delete(callback) };
    },
  };
}

const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});

/** One api-rest replica: a socket.io server that puts every socket in `room`. */
async function replica(bus: BusConnection, key: string): Promise<{ io: Server; url: string }> {
  const http: HttpServer = createServer();
  const io = new Server(http, { adapter: createSocketBusAdapter(bus, { key }) });
  io.on('connection', (socket) => {
    void socket.join('room');
    socket.emit('joined');
  });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise<void>((resolve) => void io.close(() => resolve())));
  const { port } = http.address() as AddressInfo;
  return { io, url: `http://127.0.0.1:${port}` };
}

/** A browser tab connected to one replica, already in `room`. */
async function tab(url: string): Promise<Socket> {
  const socket = connectClient(url, { transports: ['websocket'], forceNew: true });
  cleanup.push(() => void socket.close());
  await new Promise<void>((resolve) => socket.once('joined', () => resolve()));
  return socket;
}

/** The next `event` this tab hears, or `undefined` if none arrives in time. */
function next(socket: Socket, event: string, ms = 1_000): Promise<unknown> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    socket.once(event, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('a broadcast reaches every replica', () => {
  it('a message saved on replica A reaches a tab connected to replica B', async () => {
    // The chat failure this package exists for: the visitor's message is
    // written through A, and the staff inbox is open on B.
    const bus = memoryBus();
    const a = await replica(bus, 'chat');
    const b = await replica(bus, 'chat');
    const onB = await tab(b.url);

    const heard = next(onB, 'message:new');
    a.io.to('room').emit('message:new', { id: 'm1', body: 'hello' });

    expect(await heard).toEqual({ id: 'm1', body: 'hello' });
  });

  it('a tab on the same replica still hears it once, not twice', async () => {
    // The broadcast is delivered locally AND published; the publisher must
    // ignore its own copy coming back off the bus.
    const bus = memoryBus();
    const a = await replica(bus, 'chat');
    await replica(bus, 'chat');
    const onA = await tab(a.url);

    let count = 0;
    onA.on('message:new', () => count++);
    a.io.to('room').emit('message:new', { id: 'm2' });
    await new Promise((r) => setTimeout(r, 200));

    expect(count).toBe(1);
  });

  it('fetchSockets sees the sockets on the other replica', async () => {
    // The base class answers this over the reply subject, which is the half of
    // the transport a broadcast never touches.
    const bus = memoryBus();
    const a = await replica(bus, 'chat');
    const b = await replica(bus, 'chat');
    await tab(b.url);

    const sockets = await a.io.in('room').fetchSockets();
    expect(sockets).toHaveLength(1);
  });
});

describe('the emitter, for a process with no sockets of its own', () => {
  it('an AI edit relayed by api-mcp reaches an editor open on any replica', async () => {
    const bus = memoryBus();
    await replica(bus, 'sio-builder');
    const b = await replica(bus, 'sio-builder');
    const editor = await tab(b.url);

    const heard = next(editor, 'builder:agentActivity');
    createSocketBusEmitter(bus, { key: 'sio-builder' })
      .to('room')
      .emit('builder:agentActivity', { actor: { name: 'An AI assistant' } });

    expect(await heard).toEqual({ actor: { name: 'An AI assistant' } });
  });

  it('does not reach a server family with a different key', async () => {
    // api-rest runs chat and the builder side by side on one NATS server. An
    // edit aimed at the builder must never land in a chat window.
    const bus = memoryBus();
    const chat = await replica(bus, 'chat');
    const inChat = await tab(chat.url);

    const heard = next(inChat, 'builder:agentActivity', 300);
    createSocketBusEmitter(bus, { key: 'sio-builder' })
      .to('room')
      .emit('builder:agentActivity', {});

    expect(await heard).toBeUndefined();
  });
});

describe('subjects', () => {
  it('are valid NATS subjects for the root namespace and a nested one', () => {
    // A `.` inside a token would split it, and `*`/`>` are wildcards: the
    // namespace is encoded so neither can appear.
    for (const nsp of ['/', '/admin.panel', '/a b*>']) {
      const subject = broadcastSubject('chat', nsp);
      expect(subject.split('.')).toHaveLength(3);
      expect(subject).not.toMatch(/[\s*>]/);
    }
  });
});
