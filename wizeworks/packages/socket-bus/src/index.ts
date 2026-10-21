// The socket bus — socket.io broadcasts shared between processes, over NATS.
//
// WHY THIS EXISTS. A socket.io server only knows the sockets connected to its
// own process. With one api-rest replica that is every socket, and the default
// in-memory adapter is correct. With two, a chat message saved on replica A is
// broadcast to A's sockets only, and the staff inbox connected to replica B
// never hears it. Something has to carry the broadcast across.
//
// That something used to be Redis (`@socket.io/redis-adapter`), with a note in
// the Azure overlay saying "add Redis back the day api-rest goes to 2
// replicas". By the time that day came, the event broker had moved to a NATS
// server that runs in every cluster. NATS does plain publish/subscribe as well
// as streams, so this package uses the server that is already there instead of
// adding a second one to run, watch and pay for.
//
// HOW. socket.io-adapter ships `ClusterAdapterWithHeartbeat`, the base class its
// own Redis-streams and Postgres adapters are built on. A subclass supplies two
// ways to publish and calls back on two ways to receive; the base class owns
// rooms, acknowledgements, `fetchSockets`, and noticing that a replica has gone.
// So this file is the transport and nothing else.
//
// PLAIN PUBLISH/SUBSCRIBE, NOT JETSTREAM. A socket broadcast is only worth
// delivering to sockets that are connected now. Storing it would replay stale
// chat to a replica that restarts, which is worse than not delivering it. This
// matches what the Redis adapter did (Redis PUBLISH keeps nothing either).
//
// WIRE CONTRACT. Two processes that must agree: api-rest runs the adapter, and
// api-mcp runs the emitter with no sockets of its own. Both import the subject
// naming and the encoding from here, which is the reason this is a package and
// not two copies kept in step by a comment.

import { connect, Events, type NatsConnection } from 'nats';
import {
  ClusterAdapterWithHeartbeat,
  MessageType,
  type ClusterAdapterOptions,
  type ClusterMessage,
  type ClusterResponse,
  type Offset,
  type ServerId,
} from 'socket.io-adapter';

/**
 * The two NATS calls this package makes, declared structurally so the tests can
 * run the adapter over an in-memory bus. `connectSocketBus` returns the real one,
 * and assigning the NATS client to it is where TypeScript checks the fit.
 */
export interface BusConnection {
  publish(subject: string, data: Uint8Array): void;
  subscribe(
    subject: string,
    opts: { callback: (err: Error | null, msg: { data: Uint8Array }) => void }
  ): { unsubscribe(): void };
}

/** Where a failure is reported. The base class reports its own at `debug` only. */
export type BusErrorHandler = (err: unknown, what: string) => void;

// --- Subjects ---------------------------------------------------------------

/**
 * A namespace name as one NATS subject token. Namespaces start with `/`, and a
 * token may not hold `.`, `*`, `>` or whitespace, so it is base64url-encoded.
 * The root namespace `/` becomes `Lw`.
 */
function namespaceToken(nsp: string): string {
  return Buffer.from(nsp, 'utf8').toString('base64url');
}

/**
 * The subject every server of one socket.io server family listens on.
 *
 * `key` separates two socket.io servers that share a NATS server. api-rest runs
 * two (chat and the builder), and each must hear only its own traffic. It is
 * also how api-mcp aims at the builder's rooms and not chat's.
 */
export function broadcastSubject(key: string, nsp: string): string {
  return `sio.${key}.${namespaceToken(nsp)}`;
}

/** The subject one server listens on for replies addressed to it alone. */
function responseSubject(key: string, nsp: string, uid: ServerId): string {
  return `${broadcastSubject(key, nsp)}.reply.${uid}`;
}

// --- Encoding ---------------------------------------------------------------

// JSON, which is what the sockets themselves carry: every event in the chat and
// builder protocols is plain data. A Buffer in a payload would arrive as
// `{type:'Buffer',data:[…]}`, so a binary event would need a binary codec here
// first. None exists today.
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encode(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function decode<T>(data: Uint8Array): T {
  return JSON.parse(decoder.decode(data)) as T;
}

// --- The adapter ------------------------------------------------------------

export interface SocketBusAdapterOptions extends ClusterAdapterOptions {
  /** Separates this socket.io server's traffic. See `broadcastSubject`. */
  key: string;
  onError?: BusErrorHandler;
}

/** The one thing read off socket.io's Namespace here. The base class types it `any`. */
interface NamespaceLike {
  name: string;
}

class SocketBusAdapter extends ClusterAdapterWithHeartbeat {
  private readonly subscriptions: { unsubscribe(): void }[];
  private readonly namespaceName: string;

  constructor(
    nsp: NamespaceLike,
    private readonly bus: BusConnection,
    private readonly key: string,
    private readonly onError: BusErrorHandler,
    opts: ClusterAdapterOptions
  ) {
    super(nsp, opts);
    const name = nsp.name;
    this.namespaceName = name;
    this.subscriptions = [
      bus.subscribe(broadcastSubject(key, name), {
        callback: (err, msg) => {
          if (err) return this.onError(err, 'subscription');
          try {
            this.onMessage(decode<ClusterMessage>(msg.data));
          } catch (e) {
            this.onError(e, 'message');
          }
        },
      }),
      bus.subscribe(responseSubject(key, name, this.uid), {
        callback: (err, msg) => {
          if (err) return this.onError(err, 'reply subscription');
          try {
            this.onResponse(decode<ClusterResponse>(msg.data));
          } catch (e) {
            this.onError(e, 'reply');
          }
        },
      }),
    ];
  }

  protected doPublish(message: ClusterMessage): Promise<Offset> {
    // An offset is only used by connection-state recovery, which needs a stored
    // stream. Plain publish/subscribe has none to give.
    return this.send(broadcastSubject(this.key, this.namespaceName), message, 'publish').then(
      () => ''
    );
  }

  protected doPublishResponse(requesterUid: ServerId, response: ClusterResponse): Promise<void> {
    return this.send(
      responseSubject(this.key, this.namespaceName, requesterUid),
      response,
      'reply publish'
    );
  }

  /**
   * Publish, with every failure as a REJECTION, never a throw. NATS throws
   * synchronously when the connection is closed or a message is over the
   * server's size limit, and the base class calls the publishers from heartbeat
   * timers, where a synchronous throw is an uncaught exception that ends the
   * process. As a rejection, the base class catches it, and the sockets on this
   * replica still get the broadcast.
   */
  private send(subject: string, value: unknown, what: string): Promise<void> {
    try {
      this.bus.publish(subject, encode(value));
      return Promise.resolve();
    } catch (err) {
      this.onError(err, what);
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }

  override close(): void {
    // The base class publishes ADAPTER_CLOSE first, so the other replicas stop
    // counting this one before it stops listening.
    super.close();
    for (const sub of this.subscriptions) sub.unsubscribe();
  }
}

/**
 * The socket.io adapter, for `io.adapter(...)`. Every replica constructed with
 * the same bus and key shares broadcasts, rooms and `fetchSockets`.
 */
/** The default when a caller passes no handler: the failure still rejects. */
const ignoreErrors: BusErrorHandler = () => undefined;

export function createSocketBusAdapter(bus: BusConnection, options: SocketBusAdapterOptions) {
  const { key, onError = ignoreErrors, ...opts } = options;
  // A `function`, not an arrow: socket.io calls this with `new`, and an arrow
  // cannot be constructed. Returning an object from it is what `new` then yields.
  return function (nsp: NamespaceLike) {
    return new SocketBusAdapter(nsp, bus, key, onError, opts);
  };
}

// --- The emitter ------------------------------------------------------------

/**
 * socket.io's packet type for an event (socket.io-parser `PacketType.EVENT`).
 * Written out rather than imported so the emitter needs no parser dependency;
 * the end-to-end test fails if it is ever wrong, because nothing arrives.
 */
const EVENT_PACKET = 2;

/** The uid the base class reserves for a sender that is not a server. */
const EMITTER_UID = 'emitter';

export interface SocketBusEmitter {
  to(room: string): { emit(event: string, ...args: unknown[]): void };
}

/**
 * Emit into a socket.io server family's rooms from a process that has no
 * sockets of its own (api-mcp relaying an AI edit to open editors).
 *
 * Sends the same BROADCAST message a replica sends, under the reserved
 * `emitter` uid, so every replica delivers it to its own sockets in the room and
 * none of them counts the sender as a replica. Throws when the bus cannot take
 * the message; a caller that must not fail catches it.
 */
export function createSocketBusEmitter(
  bus: BusConnection,
  options: { key: string; nsp?: string }
): SocketBusEmitter {
  const nsp = options.nsp ?? '/';
  const subject = broadcastSubject(options.key, nsp);
  return {
    to(room) {
      return {
        emit(event, ...args) {
          const message: ClusterMessage = {
            uid: EMITTER_UID,
            nsp,
            type: MessageType.BROADCAST,
            data: {
              opts: { rooms: [room], except: [], flags: {} },
              packet: { type: EVENT_PACKET, data: [event, ...args], nsp },
            },
          };
          bus.publish(subject, encode(message));
        },
      };
    },
  };
}

// --- The connection ---------------------------------------------------------

/** How many publishes are held while the first connection is still being made. */
const HELD_LIMIT = 256;

export interface SocketBus extends BusConnection {
  /** Flush what is queued, then disconnect. */
  close(): Promise<void>;
}

/**
 * A bus over the NATS server at `url`, returned at once.
 *
 * It does NOT wait for the first connection. A replica that could not boot
 * while NATS was unreachable would turn a broken socket fan-out into a whole
 * REST API down. So the connection is made in the background and retried
 * forever. A subscription made early is attached when it lands, and a publish
 * made early is held and sent then, so api-mcp's first relay after a restart is
 * not lost. This replica's own sockets are served the whole time.
 */
export function connectSocketBus(url: string, name: string, onError: BusErrorHandler): SocketBus {
  let conn: NatsConnection | null = null;
  let closed = false;
  const waiting: ((c: NatsConnection) => void)[] = [];
  // Held publishes, bounded: if NATS never answers, heartbeats alone would grow
  // this forever. Past the bound the oldest goes, and that is reported once.
  const held: [subject: string, data: Uint8Array][] = [];
  let droppedReported = false;

  void connect({
    servers: url,
    name,
    // Keep retrying the FIRST connection too, not just later ones.
    waitOnFirstConnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 2_000,
  }).then(
    (c) => {
      conn = c;
      if (closed) return c.close();
      // Listen first, then send what was held, so a reply to it has a listener.
      for (const attach of waiting.splice(0)) attach(c);
      for (const [subject, data] of held.splice(0)) c.publish(subject, data);
      void (async () => {
        for await (const status of c.status()) {
          if (status.type === Events.Disconnect || status.type === Events.Error) {
            const detail =
              typeof status.data === 'string' ? status.data : JSON.stringify(status.data);
            onError(new Error(`${status.type}: ${detail}`), 'connection');
          }
        }
      })();
    },
    (err: unknown) => onError(err, 'connect')
  );

  const bus: BusConnection = {
    publish(subject, data) {
      if (conn) return conn.publish(subject, data);
      if (held.length >= HELD_LIMIT) {
        held.shift();
        if (!droppedReported) {
          droppedReported = true;
          onError(new Error(`not connected; holding only the last ${HELD_LIMIT}`), 'publish');
        }
      }
      held.push([subject, data]);
    },
    subscribe(subject, opts) {
      let sub: { unsubscribe(): void } | null = null;
      let cancelled = false;
      const attach = (c: NatsConnection) => {
        if (!cancelled) sub = c.subscribe(subject, opts);
      };
      if (conn) attach(conn);
      else waiting.push(attach);
      return {
        unsubscribe() {
          cancelled = true;
          sub?.unsubscribe();
        },
      };
    },
  };

  return {
    ...bus,
    async close() {
      closed = true;
      // A connect still retrying is not waited on, or shutdown would wait for a
      // server that may never answer. It closes itself when it lands (`closed`).
      if (conn && !conn.isClosed()) await conn.drain();
    },
  };
}
