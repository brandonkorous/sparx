// themeVersionService — one look's own history.
//
// Its own table, and that is the whole design decision. Every other builder
// document rides the site-wide snapshots in `builder_draft_versions`, whose
// manifest names one artifact per tree — but those snapshots are PROPERTY-scoped
// and a look is TENANT-wide. A business with a shop and a blog wears one look on
// both, so a history keyed by property could only ever say when one of the sites
// happened to be saved, never when the look itself changed.
//
// Append-only, like every other history here. `restore` writes the old tokens
// FORWARD as a new version rather than rewinding, so restoring is itself undoable
// and the state someone restored away from is never lost.

import { withTenant, type Prisma, type TxClient } from '@wizeworks/db';
import type { Theme as SilicaTheme } from '@wizeworks/silicaui-html';

import { BuilderNotFoundError, type ServiceContext } from '../errors';
import { hashTree } from './artifact-service';

/** What produced a version, for the history to label. */
export type ThemeVersionSource = 'save' | 'publish' | 'restore';

/**
 * Retention: always keep the newest {@link KEEP_MIN}, PLUS everything inside
 * {@link KEEP_DAYS}. A look nobody has touched for a year keeps real undo depth,
 * and one under heavy editing keeps a full recent window without growing forever.
 */
const KEEP_MIN = 30;
const KEEP_DAYS = 90;

/** One version, as the history list shows it. */
export interface ThemeVersionSummary {
  id: string;
  hash: string;
  source: string;
  actorId: string | null;
  createdAt: string;
  /** The newest — what the look is right now. */
  current: boolean;
}

/**
 * Seal the look's current tokens as a version, inside the caller's transaction.
 *
 * Returns null when nothing changed: a save that produced identical tokens shares
 * a hash with the newest version and gets no row, so the history tracks real
 * changes rather than Save presses.
 */
export async function captureThemeVersionTx(
  tx: TxClient,
  ctx: ServiceContext,
  themeId: string,
  tokens: unknown,
  source: ThemeVersionSource,
  now: Date = new Date()
): Promise<{ id: string; hash: string } | null> {
  const hash = hashTree(tokens);

  const latest = await tx.builderThemeVersion.findFirst({
    where: { tenantId: ctx.tenantId, themeId },
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  });
  if (latest?.hash === hash) return null;

  const row = await tx.builderThemeVersion.create({
    data: {
      tenantId: ctx.tenantId,
      themeId,
      tokens: tokens as Prisma.InputJsonValue,
      hash,
      source,
      actorId: ctx.userId ?? null,
    },
    select: { id: true, hash: true },
  });

  await pruneTx(tx, ctx, themeId, now);
  return row;
}

/** Drop versions past the window, keeping a recent floor so undo depth survives a
 *  dormant stretch. */
async function pruneTx(
  tx: TxClient,
  ctx: ServiceContext,
  themeId: string,
  now: Date
): Promise<void> {
  const floor = await tx.builderThemeVersion.findMany({
    where: { tenantId: ctx.tenantId, themeId },
    orderBy: { createdAt: 'desc' },
    take: KEEP_MIN,
    select: { id: true },
  });
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  await tx.builderThemeVersion.deleteMany({
    where: {
      tenantId: ctx.tenantId,
      themeId,
      createdAt: { lt: cutoff },
      // `floor` always holds the row just inserted, so this is never an empty
      // `notIn` (which Prisma reads as "matches nothing").
      id: { notIn: floor.map((row) => row.id) },
    },
  });
}

/** One look's history, newest first. */
export function listThemeVersions(
  ctx: ServiceContext,
  themeId: string,
  limit = 100
): Promise<ThemeVersionSummary[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderThemeVersion.findMany({
      where: { tenantId: ctx.tenantId, themeId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: { id: true, hash: true, source: true, actorId: true, createdAt: true },
    });
    return rows.map((row, index) => ({
      id: row.id,
      hash: row.hash,
      source: row.source,
      actorId: row.actorId,
      createdAt: row.createdAt.toISOString(),
      current: index === 0,
    }));
  });
}

export interface ThemeRestoreResult {
  /** The new version the restore sealed. Null when the draft already matched it. */
  versionId: string | null;
  /** The look as it now stands, for the pane holding it. */
  theme: SilicaTheme;
}

/**
 * Put a look's DRAFT back to an earlier version.
 *
 * The draft only. What visitors see moves when the look is published and each site
 * publishes — so this changes nothing anyone outside the console can see, which is
 * what makes it a safe, private, reversible act rather than a live rollback.
 */
export function restoreThemeVersion(
  ctx: ServiceContext,
  themeId: string,
  versionId: string
): Promise<ThemeRestoreResult> {
  return withTenant(ctx, async (tx) => {
    const version = await tx.builderThemeVersion.findFirst({
      where: { id: versionId, themeId, tenantId: ctx.tenantId },
      select: { tokens: true },
    });
    if (!version) throw new BuilderNotFoundError('BuilderThemeVersion', versionId);

    const updated = await tx.builderTheme.updateMany({
      where: { id: themeId, tenantId: ctx.tenantId },
      data: { draftTokens: version.tokens as Prisma.InputJsonValue },
    });
    if (updated.count === 0) throw new BuilderNotFoundError('Theme', themeId);

    const created = await captureThemeVersionTx(tx, ctx, themeId, version.tokens, 'restore');
    return {
      versionId: created?.id ?? null,
      theme: version.tokens as unknown as SilicaTheme,
    };
  });
}
