// savedEmailBlockService — a tenant's account-level SAVED EMAIL BLOCKS library
// (docs/impl transactional-email Slice 9), the server-backed list that silicaui's
// `<EmailBuilder savedBlocks={…} onSavedBlocksChange={…}>` controlled prop renders.
//
// silica's default keeps saved blocks in a fixed browser-`localStorage` key: the
// library is trapped in one browser, lost on a device or user change, and
// unshareable. Making the host own the list turns it into an account-level library
// that follows the whole team across devices and is shared tenant-wide.
//
// A block is a named, self-contained silica `EmailNode` snapshot (a section / card /
// CTA the author stamped "Save as block"). The builder deep-clones + re-stamps ids
// on every insert, so the stored copy is a TEMPLATE, never a live master — it is
// written once on save (and its name on rename) and otherwise never mutated.
//
// The service maps 1:1 onto silica's `SavedBlockChange` intent-out union
// (save / rename / delete) so the REST layer persists one row per author action
// rather than diffing two arrays. Reads/writes ride `withTenant` → RLS is the
// backstop; the tenant scope here is belt-and-suspenders.

import { withTenant, type Prisma } from '@wizeworks/db';
import {
  CreateSavedEmailBlockInput,
  RenameSavedEmailBlockInput,
  type SilicaEmailNode,
} from '@wizeworks/builder-schemas';

import type { ServiceContext } from '../errors';

/** One saved block as the builder's `savedBlocks` prop consumes it. Shapes to
 *  silica's `SavedBlock` ({ id, name, node, savedAt }) — `savedAt` is the row's
 *  createdAt epoch-ms, so the palette can order the library by recency. */
export interface SavedEmailBlock {
  id: string;
  name: string;
  node: SilicaEmailNode;
  /** Epoch milliseconds, from the row's createdAt — silica's `SavedBlock.savedAt`. */
  savedAt: number;
}

const NAME_MAX = 255;

/** Trim + clamp an author-given block name; empty falls back to a stable label so a
 *  blank never reaches the palette. */
function normalizeName(name: string): string {
  const trimmed = name.trim();
  return (trimmed.length > 0 ? trimmed : 'Saved block').slice(0, NAME_MAX);
}

/** The tenant's whole saved-block library, newest first — silica renders it verbatim
 *  as the `savedBlocks` prop. */
export function listSavedEmailBlocks(ctx: ServiceContext): Promise<SavedEmailBlock[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderEmailBlock.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, node: true, createdAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      node: r.node as unknown as SilicaEmailNode,
      savedAt: r.createdAt.getTime(),
    }));
  });
}

/** Persist a new block (silica `SavedBlockChange { type: 'save' }`). Returns the
 *  created row so the host reseeds its list with the SERVER-ASSIGNED id — the whole
 *  point of controlled mode over fire-and-forget writes. `actorId` is `ctx.userId`. */
export function createSavedEmailBlock(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<SavedEmailBlock> {
  const input = CreateSavedEmailBlockInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderEmailBlock.create({
      data: {
        tenantId: ctx.tenantId,
        name: normalizeName(input.name),
        node: input.node as unknown as Prisma.InputJsonValue,
        actorId: ctx.userId ?? null,
      },
      select: { id: true, name: true, node: true, createdAt: true },
    });
    return {
      id: row.id,
      name: row.name,
      node: row.node as unknown as SilicaEmailNode,
      savedAt: row.createdAt.getTime(),
    };
  });
}

/** Rename a block (silica `SavedBlockChange { type: 'rename' }`). `updateMany` +
 *  the RLS-scoped tenant filter means a wrong-tenant id updates zero rows; returns
 *  whether a row was actually renamed so the REST layer can 404 a stale id. */
export function renameSavedEmailBlock(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<boolean> {
  const { name } = RenameSavedEmailBlockInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const { count } = await tx.builderEmailBlock.updateMany({
      where: { id },
      data: { name: normalizeName(name) },
    });
    return count > 0;
  });
}

/** Delete a block (silica `SavedBlockChange { type: 'delete' }`). Returns whether a
 *  row was removed so a stale id 404s rather than silently succeeding. */
export function deleteSavedEmailBlock(ctx: ServiceContext, id: string): Promise<boolean> {
  return withTenant(ctx, async (tx) => {
    const { count } = await tx.builderEmailBlock.deleteMany({ where: { id } });
    return count > 0;
  });
}
