// Builder collaboration — /ws/builder handlers + auth (docs/126 Phase 4).
//
// A single kind of socket: a STAFF editor, authenticated on the handshake by the same
// internal JWT the REST API trusts, plus the `propertyId` of the site it's editing. The
// socket joins that site's room and does three things:
//   • receives other authors' ops (relayed from the HTTP write path) — the socket never
//     carries WRITES, only their echoes; persistence stays on the sync PUT so there is
//     one durable path, not two;
//   • reports + reads PRESENCE — who else is here and where;
//   • catches up on connect — "my document is at seq N, what did I miss?" — closing the
//     gap between an HTTP load and the socket joining the room.

import { jwtVerify } from 'jose';
import type { FastifyBaseLogger } from 'fastify';
import type { Server, Socket } from 'socket.io';
import { prisma, withTenant } from '@sparx/db';
import { isModuleEnabled } from '@sparx/auth';
import { opLogService } from '@sparx/builder';

import { env } from '../env.js';
import {
  propertyRoom,
  sanitizeNodeIds,
  type BuilderPresence,
  type BuilderSocketData,
  type ClientToServerEvents,
  type InterServerEvents,
  type RelayOp,
  type ServerToClientEvents,
} from './builder-protocol.js';

type BuilderServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  BuilderSocketData
>;
type BuilderSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  BuilderSocketData
>;

const jwtSecret = new TextEncoder().encode(env.SPARX_INTERNAL_JWT_SECRET);

/** Verify the staff JWT and pull the tenant + user. Mirrors the chat namespace's check —
 *  the same token, the same claims (`tid`, `sub`). */
async function verifyStaff(token: string): Promise<{ tenantId: string; userId: string }> {
  const { payload } = await jwtVerify(token, jwtSecret, { algorithms: ['HS256'] });
  const tid = typeof payload.tid === 'string' ? payload.tid : null;
  const sub = typeof payload.sub === 'string' ? payload.sub : null;
  if (!tid || !sub) throw new Error('token missing claims');
  return { tenantId: tid, userId: sub };
}

/** The editor's display name for presence — best-effort, defaults to "Editor" so a
 *  missing name never breaks the join. */
async function resolveName(tenantId: string, userId: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { name: true, email: true },
  });
  // `||`-style fallthrough on EMPTY string, not just null — a whitespace-only name
  // should defer to the email, so `??` would be wrong here. Written explicitly.
  const named = user?.name?.trim();
  if (named) return named;
  const emailLocal = user?.email?.split('@')[0]?.trim();
  if (emailLocal) return emailLocal;
  return 'Editor';
}

/** Confirm the property exists and belongs to the tenant — the socket's authority to
 *  join that site's room. tenant_id is the RLS boundary; a mismatch means a forged or
 *  stale propertyId, and the socket is rejected. */
async function assertPropertyOwned(tenantId: string, propertyId: string): Promise<void> {
  const row = await prisma.property.findFirst({
    where: { id: propertyId, tenantId },
    select: { id: true },
  });
  if (!row) throw new Error('unknown property');
}

async function authenticate(socket: BuilderSocket): Promise<void> {
  const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;
  if (typeof auth.token !== 'string' || !auth.token) throw new Error('unauthorized');
  if (typeof auth.propertyId !== 'string' || !auth.propertyId)
    throw new Error('propertyId required');

  const { tenantId, userId } = await verifyStaff(auth.token);
  if (!(await isModuleEnabled(tenantId, 'builder'))) throw new Error('builder module disabled');
  await assertPropertyOwned(tenantId, auth.propertyId);
  const name = await resolveName(tenantId, userId);
  socket.data = { tenantId, userId, name, propertyId: auth.propertyId };
}

/** Everyone currently in a site's room, as presence. `fetchSockets` is adapter-aware, so
 *  this is correct across replicas under the Redis adapter, not just in-process. */
async function presenceFor(io: BuilderServer, propertyId: string): Promise<BuilderPresence[]> {
  const sockets = await io.in(propertyRoom(propertyId)).fetchSockets();
  return sockets.map((s) => ({
    socketId: s.id,
    userId: s.data.userId,
    name: s.data.name,
    activePage: s.data.activePage,
    // Omitted entirely when empty rather than sent as `[]`. The roster is broadcast to
    // everyone on every change, and an editor who has selected nothing is the common
    // case — so this is the difference between a payload that grows with the room and
    // one that grows with what people are actually doing.
    ...(s.data.selection?.length ? { selection: s.data.selection } : {}),
    ...(s.data.claim?.length ? { claim: s.data.claim } : {}),
  }));
}

async function emitPresence(io: BuilderServer, propertyId: string): Promise<void> {
  const list = await presenceFor(io, propertyId);
  io.to(propertyRoom(propertyId)).emit('presence:list', list);
}

export function registerBuilderHandlers(io: BuilderServer, logger: FastifyBaseLogger): void {
  io.use((socket, next) => {
    void authenticate(socket)
      .then(() => next())
      .catch((err: unknown) => next(err instanceof Error ? err : new Error('unauthorized')));
  });

  io.on('connection', (socket) => {
    const data = socket.data;
    void socket.join(propertyRoom(data.propertyId));
    // Announce arrival to everyone (including this socket, so it gets the initial roster).
    void emitPresence(io, data.propertyId).catch((err: unknown) =>
      logger.error({ err }, 'builder presence emit failed')
    );

    socket.on('presence:active', (activePage) => {
      socket.data.activePage = activePage ?? undefined;
      void emitPresence(io, data.propertyId).catch(() => undefined);
    });

    // Where this editor is looking, and what they are holding (docs/silicaui/01 §16).
    //
    // Both are pure RELAY: the server stores the latest value on the socket and
    // rebroadcasts the roster, and has no opinion about either. That is deliberate for
    // the claim in particular — it is advisory, enforced by the receiving engine against
    // its own local edits, and never consulted on the write path. A claim can therefore
    // not reject anyone's op, drop a relayed batch, or leave the document in a state one
    // author can see and another cannot. Persistence stays exactly where it was.
    //
    // Neither survives a disconnect: the socket goes, its data goes with it, and the
    // next roster simply lacks that editor. That is what makes a claim self-healing
    // without a TTL on this side — a tab that dies mid-edit releases what it held as
    // soon as socket.io notices, rather than holding a subtree until someone restarts.
    socket.on('presence:selection', (nodeIds) => {
      socket.data.selection = sanitizeNodeIds(nodeIds);
      void emitPresence(io, data.propertyId).catch(() => undefined);
    });

    socket.on('presence:claim', (nodeIds) => {
      socket.data.claim = sanitizeNodeIds(nodeIds);
      void emitPresence(io, data.propertyId).catch(() => undefined);
    });

    socket.on('catchup', (baseSeq, ack) => {
      void catchUp(data, baseSeq)
        .then(ack)
        .catch((err: unknown) => {
          logger.error({ err }, 'builder catchup failed');
          // An empty catch-up degrades to "you're current" rather than erroring the
          // socket; the next full load reconciles if the client actually drifted.
          ack({ seq: baseSeq, ops: [] });
        });
    });

    socket.on('disconnect', () => {
      // The socket has left the room by now; recompute for the rest.
      void emitPresence(io, data.propertyId).catch(() => undefined);
    });
  });
}

/** The ops a reconnecting client missed, plus the sequence to ack after applying them. */
async function catchUp(
  data: BuilderSocketData,
  baseSeq: number
): Promise<{ seq: number; ops: RelayOp[] }> {
  const ctx = { tenantId: data.tenantId, propertyId: data.propertyId };
  const entries = await withTenant(ctx, (tx) => opLogService.opsSince(tx, ctx, baseSeq));
  if (entries.length === 0) return { seq: baseSeq, ops: [] };
  return {
    seq: entries[entries.length - 1]!.seq,
    ops: entries.map((e) => e.op as RelayOp),
  };
}
