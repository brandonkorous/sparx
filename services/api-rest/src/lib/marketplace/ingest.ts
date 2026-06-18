// Marketplace ingest (docs/85 §5) — turn a `marketplace-templates`-shaped bundle
// into (a) a compiled declarative artifact written to object storage and (b) a
// THIN catalog row. This is the first-party (dogfood) path: we author bundles in
// the repo and ingest them; the Phase-2 self-service pipeline reuses the same
// validate → guard → writeArtifact → upsert steps behind an upload + review queue.
//
// The load-bearing rule (docs/85 §3): the payload is authored in TS for ergonomics
// but only its COMPILED DATA is stored. For first-party bundles we trust our own
// code, so "compile" = dynamic-import the payload module and read its default
// export; the untrusted-code sandbox is Phase 2/4 and out of scope here.
//
// NOTHING is written to a payload column — `tokens` / `tree` / `definition` stay
// NULL. The runtime resolves the artifact from storage by (category, slug, version)
// (see ./resolve.ts, ./adapters.ts, ../../routes/v1/blueprints).

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

import { Prisma, withSystem } from '@sparx/db';
import type { TxClient } from '@sparx/db';
import { DataThemePreset, type MarketplaceCategory } from '@sparx/marketplace-schemas';
import { BuilderNodeSchema, PropSpecListSchema } from '@sparx/builder-schemas';
import { safeParseBlueprint, type Blueprint } from '@sparx/blueprints';

import { artifactExists, writeArtifact } from './artifacts.js';
import { getStorage, marketplaceMediaKey, marketplaceMediaUrl } from '../storage.js';

// ── Manifest (sparx.json) ─────────────────────────────────────────────────────

const SemVer = z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be a plain semver (e.g. 1.0.0)');

const SLUG = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug must be kebab-case [a-z0-9-]');

/** The metadata manifest shared by every category (docs/85 §4). Category-specific
 *  shape lives in `facets`/`requires`, validated per category below. */
const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  category: z.enum(['theme', 'component', 'blueprint', 'integration']),
  slug: SLUG,
  name: z.string().min(1).max(160),
  version: SemVer,
  tagline: z.string().max(255).default(''),
  description: z.string().max(4000).default(''),
  payload: z.string().min(1).max(120),
  facets: z.record(z.string(), z.unknown()).default({}),
  pricing: z
    .object({
      model: z.enum(['free', 'one_time', 'subscription']).default('free'),
      priceCents: z.number().int().min(0).default(0),
    })
    .default({ model: 'free', priceCents: 0 }),
  media: z
    .array(z.object({ file: z.string(), kind: z.string().optional(), alt: z.string().optional() }))
    .default([]),
  author: z.object({ displayName: z.string().max(160), website: z.string().url().optional() }),
  requires: z.object({ modules: z.array(z.string()).default([]) }).default({ modules: [] }),
  // Row metadata the catalog card uses; optional in the bundle.
  accent: z.string().max(9).optional(),
  icon: z.string().max(64).optional(),
  sortWeight: z.number().int().optional(),
});
export type Manifest = z.infer<typeof ManifestSchema>;

const SINGULAR_TO_PLURAL: Record<Manifest['category'], MarketplaceCategory> = {
  theme: 'themes',
  component: 'components',
  blueprint: 'blueprints',
  integration: 'integrations',
};

// ── Errors + result ───────────────────────────────────────────────────────────

/** A deny-with-reason from any pipeline stage (docs/85 §5). Carries the bundle dir
 *  so the caller can report the offending path. */
export class IngestError extends Error {
  constructor(
    message: string,
    readonly dir: string
  ) {
    super(message);
    this.name = 'IngestError';
  }
}

export interface IngestResult {
  category: MarketplaceCategory;
  slug: string;
  version: string;
  /** False when the (slug, version) artifact already existed and was left intact
   *  (idempotent re-run); true when a new artifact + row were written. */
  written: boolean;
}

// ── Version helpers (docs/85 §10 ingest guard) ────────────────────────────────

function parseSemver(v: string): [number, number, number] {
  const p = v.split('.').map((n) => Number.parseInt(n, 10));
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
}

/** -1 | 0 | 1 — is `a` older than, equal to, or newer than `b`. */
function compareSemver(a: string, b: string): number {
  const [a0, a1, a2] = parseSemver(a);
  const [b0, b1, b2] = parseSemver(b);
  if (a0 !== b0) return a0 < b0 ? -1 : 1;
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  return 0;
}

// ── Payload compile + per-category validation ─────────────────────────────────

/** "Compile" the payload: import the authored TS/JS module and take its default
 *  (or `payload`) export as the raw data object. First-party only — third-party
 *  code runs in the §9 sandbox, not here.
 *
 *  MULTI-FILE PAYLOADS are supported: `payload` names a single ENTRY module, but
 *  that entry may relative-import sibling data files in the bundle (e.g. a thin
 *  blueprint.ts that imports ./parts/pages/home.ts). The dynamic import resolves the
 *  whole relative graph, so a large blueprint ships as a folder of scoped, hand-
 *  editable files instead of one wall — keep the graph self-contained (relative
 *  imports + pure data, no `@sparx/*`). Sandboxing that graph is the §9/Phase-2 job. */
async function loadPayload(dir: string, payloadFile: string): Promise<unknown> {
  const abs = join(dir, payloadFile);
  try {
    await fs.access(abs);
  } catch {
    throw new IngestError(`payload not found: ${payloadFile}`, dir);
  }
  const mod = (await import(pathToFileURL(abs).href)) as Record<string, unknown>;
  const data = mod.default ?? mod.payload;
  if (data == null) {
    throw new IngestError(`payload ${payloadFile} must default-export its data`, dir);
  }
  return data;
}

const ComponentPayloadSchema = z.object({
  tree: BuilderNodeSchema,
  propSpec: PropSpecListSchema.default([]),
});

/** Validate + normalize the payload for its category into the artifact that gets
 *  stored. Throws IngestError on any schema/integrity failure. */
function compileArtifact(manifest: Manifest, payload: unknown, dir: string): unknown {
  switch (manifest.category) {
    case 'theme': {
      const parsed = DataThemePreset.safeParse(payload);
      if (!parsed.success) {
        throw new IngestError(`invalid theme payload: ${parsed.error.message}`, dir);
      }
      return parsed.data;
    }
    case 'component': {
      const parsed = ComponentPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new IngestError(`invalid component payload: ${parsed.error.message}`, dir);
      }
      return parsed.data;
    }
    case 'blueprint': {
      const parsed = safeParseBlueprint(payload);
      if (!parsed.success) {
        const detail = parsed.issues.map((i) => `${i.path}: ${i.message}`).join('; ');
        throw new IngestError(`invalid blueprint payload: ${detail}`, dir);
      }
      return parsed.data;
    }
    case 'integration':
      // The declarative connector schema is Phase 2 (docs/85 §9); a first-party
      // integration listing is metadata-only today (the "Connect" CTA resolves a
      // real provider by slug), so there is no artifact to store.
      return null;
  }
}

// ── Media (docs/85 §4/§6) ─────────────────────────────────────────────────────

const MEDIA_EXT_RE = /\.(png|jpe?g|webp|svg)$/i;
const MEDIA_CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

/** The two card images every bundle must ship (docs/85 §4). */
const REQUIRED_MEDIA = ['icon.png', 'preview.png'] as const;

export interface MediaEntry {
  url: string;
  kind: string;
  alt: string;
}

/** Fail fast if a required image is missing — checked in validateBundle so a bad
 *  bundle never reaches storage. */
async function assertRequiredMedia(dir: string): Promise<void> {
  for (const req of REQUIRED_MEDIA) {
    try {
      await fs.access(join(dir, 'media', req));
    } catch {
      throw new IngestError(`missing required media/${req}`, dir);
    }
  }
}

/** Copy every image in the bundle's media/ dir to public storage and return the
 *  catalog row's media[] — preview first (the card/detail use media[0] as the
 *  hero), then icon, then any extras. */
async function processMedia(
  dir: string,
  category: MarketplaceCategory,
  slug: string,
  manifest: Manifest
): Promise<MediaEntry[]> {
  const mediaDir = join(dir, 'media');
  const files = (await fs.readdir(mediaDir)).filter((f) => MEDIA_EXT_RE.test(f));
  const rank = (f: string): number => (f === 'preview.png' ? 0 : f === 'icon.png' ? 1 : 2);
  files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  const altByFile = new Map(
    manifest.media.map((m) => [m.file.replace(/^media\//, ''), m.alt ?? null] as const)
  );
  const entries: MediaEntry[] = [];
  for (const file of files) {
    const ext = file.split('.').pop()!.toLowerCase();
    const bytes = await fs.readFile(join(mediaDir, file));
    await getStorage().writeObject(
      marketplaceMediaKey(category, slug, file),
      MEDIA_CONTENT_TYPES[ext] ?? 'application/octet-stream',
      bytes
    );
    entries.push({
      url: marketplaceMediaUrl(category, slug, file),
      kind: file === 'icon.png' ? 'icon' : file === 'preview.png' ? 'preview' : 'image',
      alt: altByFile.get(file) ?? manifest.name,
    });
  }
  return entries;
}

// ── Catalog row upsert (thin — NO payload column) ─────────────────────────────

async function resolveSparxPublisherId(tx: TxClient): Promise<string> {
  const pub = await tx.marketplacePublisher.findFirst({
    where: { type: 'sparx' },
    select: { id: true },
  });
  if (!pub) {
    throw new Error('sparx publisher not found — run the catalog seed before ingesting.');
  }
  return pub.id;
}

/** "What this creates" counts for a blueprint card (mirrors the blueprints route's
 *  summarizeContents) so the list never loads the heavy manifest. */
function blueprintContents(bp: Blueprint): Prisma.InputJsonValue {
  const c = bp.commerce;
  return {
    products: c?.products.length ?? 0,
    categories: c?.categories.length ?? 0,
    collections: c?.collections.length ?? 0,
    content: bp.content.length,
    pages: bp.pages.length,
    emails: bp.emails.length,
    components: bp.components.length,
    theme: bp.theme.name,
    hasLayout: Boolean(bp.layout),
  };
}

function facetString(facets: Record<string, unknown>, key: string): string | null {
  const v = facets[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function facetStringArray(facets: Record<string, unknown>, key: string): string[] {
  const v = facets[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Upsert the THIN catalog row for the bundle (spine + category facets). The
 *  payload column stays NULL — the artifact lives in storage. */
async function upsertRow(
  tx: TxClient,
  manifest: Manifest,
  artifact: unknown,
  publisherId: string,
  media: MediaEntry[]
): Promise<void> {
  const spine = {
    name: manifest.name,
    tagline: manifest.tagline.slice(0, 255),
    description: manifest.description,
    accent: manifest.accent ?? null,
    icon: manifest.icon ?? null,
    version: manifest.version,
    media: media as unknown as Prisma.InputJsonValue,
    status: 'published',
    visibility: 'public',
    priceCents: manifest.pricing.priceCents,
    pricingModel: manifest.pricing.model,
    sortWeight: manifest.sortWeight ?? 0,
    publisherId,
  } as const;

  switch (manifest.category) {
    case 'theme': {
      const data = {
        ...spine,
        // Null the payload column: the DataThemePreset lives in storage, never here
        // (docs/85 §6). Explicit so re-ingesting a legacy SQL-inline row clears it.
        tokens: Prisma.DbNull,
        mood: facetString(manifest.facets, 'mood'),
        colorFamily: facetString(manifest.facets, 'colorFamily'),
        density: facetString(manifest.facets, 'density'),
        industry: facetString(manifest.facets, 'industry'),
      };
      await tx.marketplaceTheme.upsert({
        where: { slug: manifest.slug },
        update: data,
        create: { slug: manifest.slug, publishedAt: new Date(), ...data },
      });
      return;
    }
    case 'component': {
      const data = {
        ...spine,
        // Null the payload columns: the node tree + propSpec live in storage.
        tree: Prisma.DbNull,
        propSpec: [] as unknown as Prisma.InputJsonValue,
        group: facetString(manifest.facets, 'group') ?? 'content',
        kind: facetString(manifest.facets, 'kind'),
        surfaces: facetStringArray(manifest.facets, 'surfaces'),
      };
      await tx.marketplaceComponent.upsert({
        where: { slug: manifest.slug },
        update: data,
        create: { slug: manifest.slug, publishedAt: new Date(), ...data },
      });
      return;
    }
    case 'blueprint': {
      const bp = artifact as Blueprint;
      const data = {
        ...spine,
        // Null the payload column: the manifest lives in storage.
        definition: Prisma.DbNull,
        vertical: facetString(manifest.facets, 'vertical') ?? bp.vertical,
        requiredModules: facetStringArray(manifest.facets, 'requiredModules'),
        contents: blueprintContents(bp),
      };
      await tx.marketplaceBlueprint.upsert({
        where: { slug: manifest.slug },
        update: data,
        create: { slug: manifest.slug, publishedAt: new Date(), ...data },
      });
      return;
    }
    case 'integration': {
      const data = {
        ...spine,
        // Null the payload column: a connector artifact (Phase 2) lives in storage.
        configSchema: Prisma.DbNull,
        providerSlug: facetString(manifest.facets, 'providerSlug') ?? manifest.slug,
        kind: facetString(manifest.facets, 'kind') ?? 'other',
        scopes: facetStringArray(manifest.facets, 'scopes'),
      };
      await tx.marketplaceIntegration.upsert({
        where: { slug: manifest.slug },
        update: data,
        create: { slug: manifest.slug, publishedAt: new Date(), ...data },
      });
      return;
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Validate a bundle and return its manifest + compiled artifact WITHOUT touching
 *  storage or the DB. Pure enough to unit-test; the full ingest builds on it. */
export async function validateBundle(
  dir: string
): Promise<{ manifest: Manifest; category: MarketplaceCategory; artifact: unknown }> {
  let raw: string;
  try {
    raw = await fs.readFile(join(dir, 'sparx.json'), 'utf8');
  } catch {
    throw new IngestError('missing sparx.json', dir);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new IngestError(`sparx.json is not valid JSON: ${(err as Error).message}`, dir);
  }
  const parsed = ManifestSchema.safeParse(json);
  if (!parsed.success) {
    throw new IngestError(`invalid sparx.json: ${parsed.error.message}`, dir);
  }
  const manifest = parsed.data;
  await assertRequiredMedia(dir);
  const payload = await loadPayload(dir, manifest.payload);
  const artifact = compileArtifact(manifest, payload, dir);
  return { manifest, category: SINGULAR_TO_PLURAL[manifest.category], artifact };
}

/**
 * Ingest one bundle directory: validate → version guard → writeArtifact → upsert
 * the thin row. Idempotent: re-ingesting the SAME (slug, version) is a no-op write
 * (the immutable artifact already exists); bumping to a newer version writes the
 * new artifact and flips the row. Throws IngestError on any guard/validation
 * failure, leaving storage and the catalog untouched.
 */
export async function ingestBundle(dir: string): Promise<IngestResult> {
  const { manifest, category, artifact } = await validateBundle(dir);
  const { slug, version } = manifest;

  // Version guard (docs/85 §10): monotonic bump + never clobber a published
  // version's object. Compare against the current catalog row, if any.
  const existing = await withSystem((tx) => readRowVersion(tx, category, slug));
  if (existing && compareSemver(version, existing) < 0) {
    throw new IngestError(
      `version ${version} is older than the published ${existing} (versions must increase)`,
      dir
    );
  }

  // Copy the card imagery to public storage (idempotent) + build the row media[].
  // Done on every run so metadata/media can refresh without a version bump.
  const media = await processMedia(dir, category, slug, manifest);

  // No-clobber: an already-stored artifact at this exact version is left intact.
  if (await artifactExists(category, slug, version)) {
    // Still re-upsert the row so catalog metadata (facets/copy/media) can be
    // corrected without a version bump, but the immutable artifact is never rewritten.
    await withSystem(async (tx) => {
      const publisherId = await resolveSparxPublisherId(tx);
      await upsertRow(tx, manifest, artifact, publisherId, media);
    });
    return { category, slug, version, written: false };
  }

  // Write the artifact FIRST (immutable; a failure here leaves no dangling row),
  // then upsert the row that points the runtime at it (by derived key).
  if (artifact !== null) {
    await writeArtifact(category, slug, version, artifact);
  }
  await withSystem(async (tx) => {
    const publisherId = await resolveSparxPublisherId(tx);
    await upsertRow(tx, manifest, artifact, publisherId, media);
  });
  return { category, slug, version, written: true };
}

/** The current published `version` of a catalog row, or null if none exists. */
async function readRowVersion(
  tx: TxClient,
  category: MarketplaceCategory,
  slug: string
): Promise<string | null> {
  const where = { slug };
  const select = { version: true } as const;
  const row =
    category === 'themes'
      ? await tx.marketplaceTheme.findFirst({ where, select })
      : category === 'components'
        ? await tx.marketplaceComponent.findFirst({ where, select })
        : category === 'blueprints'
          ? await tx.marketplaceBlueprint.findFirst({ where, select })
          : await tx.marketplaceIntegration.findFirst({ where, select });
  return row?.version ?? null;
}

/**
 * Ingest every bundle under `root` (a `marketplace-catalog/<category>/<slug>/`
 * tree). Returns a per-bundle result; a single bad bundle throws (deny-with-reason)
 * rather than partially publishing the batch. Missing root → empty (no items yet).
 */
export async function ingestCatalog(root: string): Promise<IngestResult[]> {
  let categories: string[];
  try {
    categories = (await fs.readdir(root, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => d.name);
  } catch {
    return [];
  }
  const results: IngestResult[] = [];
  for (const category of categories) {
    const categoryDir = join(root, category);
    const slugs = (await fs.readdir(categoryDir, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => d.name);
    for (const slug of slugs) {
      results.push(await ingestBundle(join(categoryDir, slug)));
    }
  }
  return results;
}
