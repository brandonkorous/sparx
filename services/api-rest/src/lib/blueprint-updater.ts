// Blueprint updater (docs/55 §6, §8) — the non-destructive apply of a newer
// blueprint version onto an installed tenant. It loads the per-artifact BASELINE
// (the ancestor), extracts the tenant's LIVE content in the same canonical shape,
// runs the pure three-way merge (@sparx/blueprints), and writes the result back
// through the existing service layer — so a tenant edit is never overwritten
// automatically (docs/55 U1).
//
// `planUpdate` computes the changeset without writing (preview). `applyUpdate`
// executes it, re-publishes a live install, then advances the baselines + the
// install version so the NEXT update measures drift from here.
//
// Structured like the installer (services do their own withTenant) so it lifts
// into the async worker later. Artifact KINDS are handled by a registry; this
// slice ships `theme` + `brand` (the layered theme is the named must-have, docs/55
// §7.1). Trees and commerce/content register their handlers in later slices.

import type { FastifyBaseLogger } from 'fastify';

import { withTenant, type Prisma } from '@sparx/db';
import { savedThemeService, publishService } from '@sparx/sitebuilder';
import { componentService, emailService, layoutService, pageService } from '@sparx/builder';
import type { BuilderNode } from '@sparx/builder-schemas';
import {
  mergeTree,
  mergeValue,
  resolverFrom,
  type Blueprint,
  type ConflictSide,
  type FieldChange,
  type MergeResult,
} from '@sparx/blueprints';

import {
  captureBaselines,
  loadBaselines,
  resolveBlueprintArtifacts,
  type ArtifactKind,
  type ResolvedArtifact,
} from './blueprint-baseline.js';
import { mimeFromUrl, type InstallResult } from './blueprint-installer.js';

export interface UpdateContext {
  tenantId: string;
  userId: string | null;
  propertyId: string;
  logger: FastifyBaseLogger;
}

interface InstallRowLite {
  id: string;
  blueprintKey: string;
  blueprintVersion: string;
  status: string;
  propertyId: string;
  result: unknown;
}

/** The per-artifact outcome surfaced in a preview + recorded on apply. */
export interface ArtifactDiff {
  kind: ArtifactKind;
  naturalKey: string;
  refId: string | null;
  /** unchanged — nothing to do; updated — only auto fast-forwards; conflict — at
   *  least one field both sides changed; new — upstream added it; removed —
   *  upstream dropped it (kept as an orphan); detached — tenant opted out;
   *  tenant_deleted — the tenant deleted the live row (not recreated). */
  status: 'unchanged' | 'updated' | 'conflict' | 'new' | 'removed' | 'detached' | 'tenant_deleted';
  /** Auto fast-forwards + conflicts, each globally addressable as
   *  `${kind}:${naturalKey}#${path}` for the apply resolution map. */
  changes: (FieldChange & { id: string })[];
}

export interface UpdatePlan {
  installId: string;
  blueprintKey: string;
  fromVersion: string;
  toVersion: string;
  updatable: boolean;
  artifacts: ArtifactDiff[];
  summary: { updated: number; conflicts: number; auto: number; new: number; removed: number };
}

export interface ApplyResult {
  installId: string;
  fromVersion: string;
  toVersion: string;
  applied: number;
  conflicts: number;
  artifacts: ArtifactDiff[];
}

type Json = Record<string, unknown>;

interface Env {
  tenantId: string;
  ctx: { tenantId: string; userId?: string };
  propCtx: { tenantId: string; userId?: string; propertyId: string };
  isPrimary: boolean;
  /** True during apply (assets are find-or-CREATEd); false during preview (find-only). */
  write: boolean;
}

/** A per-kind merge handler: read the tenant's live content in canonical shape,
 *  and (on apply) write the merged content back through the service layer. */
interface KindHandler {
  kind: ArtifactKind;
  /** Read the live row → canonical content matching the baseline shape, or null
   *  if the tenant deleted it. */
  extractCurrent(env: Env, artifact: ResolvedArtifact): Promise<Json | null>;
  /** Persist the merged content. */
  writeMerged(env: Env, artifact: ResolvedArtifact, merged: Json): Promise<void>;
  /** Optional custom merge (tree kinds node-merge their `tree` field). Defaults to
   *  the generic field merge. */
  merge?(base: Json | undefined, current: Json, incoming: Json, resolve: Resolver): MergeResult;
}

type Resolver = (path: string) => ConflictSide;

/** Drop only `undefined` (an unset optional == absent); an explicit `null` is a
 *  real value (a slugless home page's `slug`, a theme's absent `brand`) and is
 *  preserved so it matches the baseline. */
function compact(obj: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

/** Tree-bearing artifacts: node-merge the `tree` field (docs/55 §7.2) and
 *  field-merge every other (scalar) field, then recombine. */
function mergeTreeArtifact(
  base: Json | undefined,
  current: Json,
  incoming: Json,
  resolve: Resolver
): MergeResult {
  const split = (
    c: Json | undefined
  ): { rest: Json | undefined; tree: BuilderNode | undefined } => {
    if (!c) return { rest: undefined, tree: undefined };
    const { tree, ...rest } = c;
    return { rest, tree: tree as BuilderNode | undefined };
  };
  const b = split(base);
  const cu = split(current);
  const inc = split(incoming);
  const restRes = mergeValue(b.rest, cu.rest, inc.rest, { resolve });
  const treeRes = mergeTree(b.tree, cu.tree, inc.tree, { resolve }, 'tree');
  const merged: Json = { ...(restRes.merged as Json) };
  if (treeRes.merged !== undefined) merged.tree = treeRes.merged;
  return {
    merged,
    changes: [...restRes.changes, ...treeRes.changes],
    changed: restRes.changed || treeRes.changed,
  };
}

/** Pass only the defined fields of a partial update through. */
function definedOnly(obj: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

// ── asset resolution (shared shape with the installer; find-or-create) ──────────

/** Resolve a blueprint version's assets to MediaAsset ids by URL key. On apply
 *  (`create`) a missing asset is created (hot-link row, mirrors the installer);
 *  on preview it is find-only, so an unseen asset simply resolves to absent. */
async function resolveAssetMap(
  env: Env,
  assets: Blueprint['assets'],
  create: boolean
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (assets.length === 0) return map;
  await withTenant(env.ctx, async (tx) => {
    for (const a of assets) {
      const existing = await tx.mediaAsset.findFirst({
        where: { tenantId: env.tenantId, key: a.url },
        select: { id: true },
      });
      if (existing) {
        map.set(a.id, existing.id);
        continue;
      }
      if (!create) continue;
      const row = await tx.mediaAsset.create({
        data: {
          tenantId: env.tenantId,
          key: a.url,
          originalFilename: `${a.id}.${mimeFromUrl(a.url).split('/')[1] ?? 'jpg'}`,
          mimeType: a.mimeType ?? mimeFromUrl(a.url),
          byteSize: BigInt(0),
          status: 'ready',
          ...(a.width !== undefined ? { width: a.width } : {}),
          ...(a.height !== undefined ? { height: a.height } : {}),
          ...(a.alt !== undefined ? { altText: a.alt } : {}),
        },
        select: { id: true },
      });
      map.set(a.id, row.id);
    }
  });
  return map;
}

// ── theme handler (docs/55 §7.1) ───────────────────────────────────────────────

const themeHandler: KindHandler = {
  kind: 'theme',
  async extractCurrent(env, artifact) {
    if (!artifact.refId) return null;
    const row = await withTenant(env.ctx, (tx) =>
      tx.siteTheme.findUnique({
        where: { id: artifact.refId! },
        select: { name: true, basePresetKey: true, presentation: true, brand: true },
      })
    );
    if (!row) return null;
    return {
      name: row.name,
      basePresetKey: row.basePresetKey,
      presentation: row.presentation ?? {},
      brand: (row.brand ?? null) as Json | null,
    };
  },
  async writeMerged(env, artifact, merged) {
    const id = artifact.refId!;
    await savedThemeService.update(env.ctx, id, {
      name: merged.name,
      presentation: merged.presentation ?? {},
      ...(merged.brand && typeof merged.brand === 'object' ? { brand: merged.brand } : {}),
    });
    // basePresetKey isn't a savedThemeService.update field — write it directly so a
    // changed base preset takes effect (the merge already decided the value).
    if (typeof merged.basePresetKey === 'string') {
      await withTenant(env.ctx, (tx) =>
        tx.siteTheme.update({
          where: { id },
          data: { basePresetKey: merged.basePresetKey as string },
        })
      );
    }
    // Re-apply into the working draft (themeKey + presentation). The site theme is
    // published in the live-republish step (applyUpdate), mirroring go-live.
    await savedThemeService.apply(env.propCtx, id);
  },
};

// ── brand handler (TenantBrand on primary / brand_override on a secondary) ──────

const BRAND_COLORS: [keyof Json, string][] = [
  ['primary', 'colorPrimary'],
  ['primaryForeground', 'colorPrimaryForeground'],
  ['accent', 'colorAccent'],
  ['accentForeground', 'colorAccentForeground'],
  ['secondary', 'colorSecondary'],
  ['secondaryForeground', 'colorSecondaryForeground'],
];

const brandHandler: KindHandler = {
  kind: 'brand',
  async extractCurrent(env, _artifact) {
    if (env.isPrimary) {
      const row = await withTenant(env.ctx, (tx) =>
        tx.tenantBrand.findUnique({ where: { tenantId: env.tenantId } })
      );
      if (!row) return null;
      const colors: Json = {};
      for (const [k, col] of BRAND_COLORS) {
        const v = (row as unknown as Json)[col];
        if (v != null) colors[k] = v;
      }
      return compact({
        businessName: row.businessName,
        tagline: row.tagline ?? undefined,
        colors,
        fonts: { heading: row.fontHeading, body: row.fontBody },
        logoLight: row.logoLightMediaId ?? undefined,
        logoDark: row.logoDarkMediaId ?? undefined,
        favicon: row.faviconMediaId ?? undefined,
      });
    }
    // Secondary: the per-site override carries only the subset the installer writes.
    const prop = await withTenant(env.ctx, (tx) =>
      tx.property.findUnique({
        where: { id: env.propCtx.propertyId },
        select: { brandOverride: true },
      })
    );
    const ov = (prop?.brandOverride ?? {}) as Json;
    const colors: Json = {};
    if (ov.colorPrimary != null) colors.primary = ov.colorPrimary;
    if (ov.colorPrimaryForeground != null) colors.primaryForeground = ov.colorPrimaryForeground;
    if (ov.colorAccent != null) colors.accent = ov.colorAccent;
    return compact({
      businessName: ov.businessName,
      colors,
      logoLight: ov.logoMediaId ?? undefined,
    });
  },
  async writeMerged(env, _artifact, merged) {
    const colors = (merged.colors ?? {}) as Json;
    const fonts = (merged.fonts ?? {}) as Json;
    if (env.isPrimary) {
      const data: Prisma.TenantBrandUncheckedUpdateInput = {};
      if (typeof merged.businessName === 'string') data.businessName = merged.businessName;
      if (merged.tagline !== undefined) data.tagline = merged.tagline;
      for (const [k, col] of BRAND_COLORS) {
        if (colors[k] != null) (data as Json)[col] = colors[k];
      }
      if (typeof fonts.heading === 'string') data.fontHeading = fonts.heading;
      if (typeof fonts.body === 'string') data.fontBody = fonts.body;
      if (merged.logoLight != null) data.logoLightMediaId = merged.logoLight;
      if (merged.logoDark != null) data.logoDarkMediaId = merged.logoDark;
      if (merged.favicon != null) data.faviconMediaId = merged.favicon;
      if (Object.keys(data).length === 0) return;
      await withTenant(env.ctx, (tx) =>
        tx.tenantBrand.update({ where: { tenantId: env.tenantId }, data })
      );
      return;
    }
    const override: Json = {};
    if (typeof merged.businessName === 'string') override.businessName = merged.businessName;
    if (colors.primary != null) override.colorPrimary = colors.primary;
    if (colors.primaryForeground != null)
      override.colorPrimaryForeground = colors.primaryForeground;
    if (colors.accent != null) override.colorAccent = colors.accent;
    if (merged.logoLight != null) override.logoMediaId = merged.logoLight;
    if (Object.keys(override).length === 0) return;
    await withTenant(env.ctx, async (tx) => {
      const prop = await tx.property.findUnique({
        where: { id: env.propCtx.propertyId },
        select: { brandOverride: true },
      });
      const current = (prop?.brandOverride ?? {}) as Json;
      await tx.property.update({
        where: { id: env.propCtx.propertyId },
        data: { brandOverride: { ...current, ...override } as Prisma.InputJsonValue },
      });
    });
  },
};

// ── tree handlers: layout · page · email · component (docs/55 §7.2) ─────────────

const layoutHandler: KindHandler = {
  kind: 'layout',
  merge: mergeTreeArtifact,
  async extractCurrent(env, artifact) {
    if (!artifact.refId) return null;
    const dto = await layoutService.get(env.propCtx, artifact.refId).catch(() => null);
    if (!dto) return null;
    return compact({ name: dto.name, tree: dto.tree });
  },
  async writeMerged(env, artifact, merged) {
    if (!artifact.refId) return;
    await layoutService.update(
      env.propCtx,
      artifact.refId,
      definedOnly({ name: merged.name, tree: merged.tree })
    );
  },
};

const pageHandler: KindHandler = {
  kind: 'page',
  merge: mergeTreeArtifact,
  async extractCurrent(env, artifact) {
    if (!artifact.refId) return null;
    const dto = await pageService.get(env.propCtx, artifact.refId).catch(() => null);
    if (!dto) return null;
    return compact({
      name: dto.name,
      kind: dto.kind,
      recordType: dto.recordType,
      slug: dto.slug,
      tree: dto.tree,
      seoTitle: dto.seoTitle ?? undefined,
      seoDescription: dto.seoDescription ?? undefined,
      canonical: dto.canonical ?? undefined,
      ogImage: dto.ogImage ?? undefined,
      noindex: dto.noindex ?? undefined,
    });
  },
  async writeMerged(env, artifact, merged) {
    if (!artifact.refId) return;
    // kind/recordType/slug are page identity — never merge-written; only content + SEO.
    await pageService.update(
      env.propCtx,
      artifact.refId,
      definedOnly({
        name: merged.name,
        tree: merged.tree,
        seoTitle: merged.seoTitle,
        seoDescription: merged.seoDescription,
        canonical: merged.canonical,
        ogImage: merged.ogImage,
        noindex: merged.noindex,
      })
    );
  },
};

const emailHandler: KindHandler = {
  kind: 'email',
  merge: mergeTreeArtifact,
  async extractCurrent(env, artifact) {
    if (!artifact.refId) return null;
    const dto = await emailService.get(env.ctx, artifact.refId).catch(() => null);
    if (!dto) return null;
    return compact({
      name: dto.name,
      subject: dto.subject ?? undefined,
      preheader: dto.preheader ?? undefined,
      tree: dto.tree,
    });
  },
  async writeMerged(env, artifact, merged) {
    if (!artifact.refId) return;
    await emailService.update(
      env.ctx,
      artifact.refId,
      definedOnly({
        name: merged.name,
        subject: merged.subject,
        preheader: merged.preheader,
        tree: merged.tree,
      })
    );
  },
};

const componentHandler: KindHandler = {
  kind: 'component',
  merge: mergeTreeArtifact,
  async extractCurrent(env, artifact) {
    // Components correlate by KEY (the naturalKey); the service reads the LATEST version.
    const dto = await componentService.get(env.ctx, artifact.naturalKey).catch(() => null);
    if (!dto) return null;
    return compact({
      key: artifact.naturalKey,
      name: dto.name,
      group: dto.group,
      icon: dto.icon,
      description: dto.description ?? undefined,
      surfaces: dto.surfaces,
      tree: dto.tree,
      propSpec: dto.propSpec,
    });
  },
  async writeMerged(env, artifact, merged) {
    // A tree/propSpec change creates a NEW component version (docs/53); placements
    // stay pinned until the tenant re-pins via the component UI — we never auto-re-pin
    // (docs/55 U2).
    await componentService.update(
      env.ctx,
      artifact.naturalKey,
      definedOnly({
        name: merged.name,
        group: merged.group,
        icon: merged.icon,
        description: merged.description,
        surfaces: merged.surfaces,
        tree: merged.tree,
        propSpec: merged.propSpec,
      })
    );
  },
};

/** Handler registry — kinds grow per slice (docs/55 §12). */
const HANDLERS: KindHandler[] = [
  themeHandler,
  brandHandler,
  layoutHandler,
  pageHandler,
  emailHandler,
  componentHandler,
];
const HANDLED_KINDS = new Set<ArtifactKind>(HANDLERS.map((h) => h.kind));

// ── shared diff/merge pass ──────────────────────────────────────────────────────

interface Processed {
  diffs: ArtifactDiff[];
  pending: { handler: KindHandler; artifact: ResolvedArtifact; merged: Json }[];
  incomingHandled: ResolvedArtifact[];
}

async function processUpdate(
  env: Env,
  install: InstallRowLite,
  incoming: Blueprint,
  takeTheirs: Set<string>
): Promise<Processed> {
  const result = (install.result ?? {}) as InstallResult;
  const assetMap = await resolveAssetMap(env, incoming.assets, env.write);
  const incomingArtifacts = resolveBlueprintArtifacts(incoming, result, assetMap);
  const baselines = await loadBaselines(env.ctx, install.id);

  const diffs: ArtifactDiff[] = [];
  const pending: Processed['pending'] = [];
  const incomingHandled: ResolvedArtifact[] = [];
  const seen = new Set<string>();

  for (const handler of HANDLERS) {
    for (const a of incomingArtifacts) {
      if (a.kind !== handler.kind) continue;
      const key = `${a.kind}:${a.naturalKey}`;
      seen.add(key);
      const base = baselines.get(key);

      if (base?.detached) {
        diffs.push({
          kind: a.kind,
          naturalKey: a.naturalKey,
          refId: base.refId,
          status: 'detached',
          changes: [],
        });
        continue;
      }
      if (!base) {
        // New upstream artifact. Creation is handled per-kind in later slices; for
        // the always-present theme/brand this never fires. Surface it regardless.
        diffs.push({
          kind: a.kind,
          naturalKey: a.naturalKey,
          refId: null,
          status: 'new',
          changes: [],
        });
        continue;
      }

      const current = await handler.extractCurrent(env, { ...a, refId: base.refId });
      if (current == null) {
        diffs.push({
          kind: a.kind,
          naturalKey: a.naturalKey,
          refId: base.refId,
          status: 'tenant_deleted',
          changes: [],
        });
        continue;
      }

      const localTake = new Set<string>();
      for (const id of takeTheirs) {
        if (id.startsWith(`${key}#`)) localTake.add(id.slice(key.length + 1));
      }
      const resolve = resolverFrom(localTake);
      const r = handler.merge
        ? handler.merge(base.baseline, current, a.content, resolve)
        : mergeValue(base.baseline, current, a.content, { resolve });
      const changes = r.changes.map((c) => ({ ...c, id: `${key}#${c.path}` }));
      const status: ArtifactDiff['status'] =
        changes.length === 0
          ? 'unchanged'
          : changes.some((c) => c.type === 'conflict')
            ? 'conflict'
            : 'updated';
      diffs.push({ kind: a.kind, naturalKey: a.naturalKey, refId: base.refId, status, changes });
      incomingHandled.push({ ...a, refId: base.refId });
      if (r.changed)
        pending.push({ handler, artifact: { ...a, refId: base.refId }, merged: r.merged as Json });
    }
  }

  // Orphans: a managed baseline of a handled kind that the new version dropped.
  for (const [key, base] of baselines) {
    if (!HANDLED_KINDS.has(base.kind) || seen.has(key) || base.detached || !base.managed) continue;
    diffs.push({
      kind: base.kind,
      naturalKey: base.naturalKey,
      refId: base.refId,
      status: 'removed',
      changes: [],
    });
  }

  return { diffs, pending, incomingHandled };
}

function summarize(diffs: ArtifactDiff[]): UpdatePlan['summary'] {
  let updated = 0;
  let conflicts = 0;
  let auto = 0;
  let neu = 0;
  let removed = 0;
  for (const d of diffs) {
    if (d.status === 'new') neu += 1;
    if (d.status === 'removed') removed += 1;
    if (d.status === 'updated' || d.status === 'conflict') updated += 1;
    for (const c of d.changes) {
      if (c.type === 'conflict') conflicts += 1;
      else auto += 1;
    }
  }
  return { updated, conflicts, auto, new: neu, removed };
}

async function buildEnv(uctx: UpdateContext, write: boolean): Promise<Env> {
  const ctx = { tenantId: uctx.tenantId, userId: uctx.userId ?? undefined };
  const prop = await withTenant(ctx, (tx) =>
    tx.property.findUnique({ where: { id: uctx.propertyId }, select: { isPrimary: true } })
  );
  return {
    tenantId: uctx.tenantId,
    ctx,
    propCtx: {
      tenantId: uctx.tenantId,
      userId: uctx.userId ?? undefined,
      propertyId: uctx.propertyId,
    },
    isPrimary: prop?.isPrimary ?? true,
    write,
  };
}

// ── public API ──────────────────────────────────────────────────────────────────

/** Preview: build the changeset for the catalog's current version without writing. */
export async function planUpdate(
  uctx: UpdateContext,
  install: InstallRowLite,
  incoming: Blueprint
): Promise<UpdatePlan> {
  const env = await buildEnv(uctx, false);
  const { diffs } = await processUpdate(env, install, incoming, new Set());
  return {
    installId: install.id,
    blueprintKey: install.blueprintKey,
    fromVersion: install.blueprintVersion,
    toVersion: incoming.version,
    updatable: incoming.version !== install.blueprintVersion,
    artifacts: diffs,
    summary: summarize(diffs),
  };
}

/** Apply: merge + write through the service layer, re-publish a live install, then
 *  advance the handled baselines + the install version (docs/55 §6). */
export async function applyUpdate(
  uctx: UpdateContext,
  install: InstallRowLite,
  incoming: Blueprint,
  takeTheirs: string[]
): Promise<ApplyResult> {
  const env = await buildEnv(uctx, true);
  const { diffs, pending, incomingHandled } = await processUpdate(
    env,
    install,
    incoming,
    new Set(takeTheirs)
  );

  let applied = 0;
  for (const p of pending) {
    try {
      await p.handler.writeMerged(env, p.artifact, p.merged);
      applied += 1;
    } catch (err) {
      uctx.logger.warn(
        { err, kind: p.artifact.kind, key: p.artifact.naturalKey },
        'blueprint update: artifact write failed'
      );
    }
  }

  // Re-publish a LIVE install so the merged theme reaches the storefront (brand is
  // read live and needs no publish). A draft install stays draft for the tenant to
  // publish on their own schedule (docs/55 §6).
  if (install.status === 'live' && applied > 0) {
    await publishService
      .publishNow(env.propCtx, { note: `Blueprint update ${incoming.version} (${install.id})` })
      .catch((err) => uctx.logger.warn({ err, installId: install.id }, 'update republish failed'));
  }

  // Advance the handled baselines to the new version (the new ancestor) so the next
  // update measures drift from here, and bump the install's recorded version.
  await captureBaselines(env.ctx, install.id, incoming.version, incomingHandled);
  await withTenant(env.ctx, (tx) =>
    tx.tenantBlueprintInstall.update({
      where: { id: install.id },
      data: { blueprintVersion: incoming.version },
    })
  );

  uctx.logger.info(
    { installId: install.id, from: install.blueprintVersion, to: incoming.version, applied },
    'blueprint update applied'
  );

  const conflicts = diffs.reduce(
    (n, d) => n + d.changes.filter((c) => c.type === 'conflict').length,
    0
  );
  return {
    installId: install.id,
    fromVersion: install.blueprintVersion,
    toVersion: incoming.version,
    applied,
    conflicts,
    artifacts: diffs,
  };
}
