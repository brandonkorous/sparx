// The first-party blueprint bundles — sparx's own shelf stock, read from the
// authored tree that ships in the image.
//
// SOURCE vs SERVED BYTES, which is the distinction this whole module rests on.
// A blueprint has two halves and they belong in different places:
//
//   · the SOURCE — `marketplace-catalog/blueprints/<slug>/` — is authored, lives in
//     git, and ships inside the image. That is what lets sparx publish itself with
//     no release stage: the source is already wherever the container is.
//   · the SERVED BYTES — the compiled manifest artifact and the card imagery — go
//     to OBJECT STORAGE, written by self-registration at boot. Nothing reads a
//     blueprint out of the container.
//
// The second half is the point. A licensed collaborator will never have anything in
// our image, so if first-party media were served from the filesystem, sparx and a
// partner would resolve through two different code paths and only one of them would
// get exercised day to day. Everything downstream of this module — the media route,
// `resolveBlueprintManifest`, the installer — reads from storage and cannot tell the
// two publishers apart.
//
// WHY THIS IS NOT THE INGEST. The steps resemble it because the steps were never the
// problem; WHERE they ran was. The ingest was a release-stage Job that mounted the
// media volume separately from the service, so a missing mount let it write every
// object to its own container filesystem, exit 0, and leave catalog rows pointing at
// keys that resolved to nothing — a failure that only surfaced when someone tried to
// install. Here the writer IS the reader: if api-rest cannot write the media, it is
// the same process that cannot serve it, and the error lands in the service log
// rather than a Job nobody watches.

import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

import { safeParseBlueprint, type Blueprint } from '@wizeworks/blueprints';

const here = dirname(fileURLToPath(import.meta.url));
// wizeworks/services/api-rest/src/lib/marketplace → the repo root is five levels up. In the
// image that is /app, where Dockerfile.base copies `marketplace-catalog`.
const REPO_ROOT = resolve(here, '../../../../../..');

/** The authored bundle tree. `MARKETPLACE_CATALOG_DIR` overrides it for a test or a
 *  local run from an unusual working directory. */
export function blueprintCatalogDir(): string {
  const root = process.env.MARKETPLACE_CATALOG_DIR ?? resolve(REPO_ROOT, 'marketplace-catalog');
  return join(root, 'blueprints');
}

// ── The bundle manifest (sparx.json) ──────────────────────────────────────────

const SemVer = z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be a plain semver (e.g. 1.0.0)');

const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  category: z.literal('blueprint'),
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug must be kebab-case [a-z0-9-]'),
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
  accent: z.string().max(9).optional(),
  icon: z.string().max(64).optional(),
  sortWeight: z.number().int().optional(),
  /**
   * Which platform brands may see this listing. OMITTED means EVERY brand, and
   * that default is the important half: the catalog is shared platform content,
   * and a template that has to name its brands to be visible would quietly fork
   * the library the first time somebody forgot.
   *
   * Set it only on a listing that a single brand's marketplace should own — today
   * that is the ~21 showcase bundles built from the golden, one per first-party
   * theme. It is a catalog-split decision, NOT a safety one: no bundle names a
   * brand in its content any more, so nothing leaks if one crosses. See
   * `brand-scope.ts` for why that distinction is worth keeping straight.
   *
   * NOT a browse facet. `facets` is what a person filters by; this decides
   * whether the row exists for them at all.
   */
  brands: z.array(z.string().min(1).max(20)).nonempty().optional(),
});

export type BlueprintManifest = z.infer<typeof ManifestSchema>;

/** A bundle that failed to read or validate. Carries the directory so the log names
 *  the offending bundle rather than the pass. */
export class BundleError extends Error {
  constructor(
    message: string,
    readonly slug: string
  ) {
    super(`blueprint bundle ${slug}: ${message}`);
    this.name = 'BundleError';
  }
}

// ── Media ─────────────────────────────────────────────────────────────────────

const MEDIA_EXT_RE = /\.(png|jpe?g|webp|svg)$/i;
const MEDIA_CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

/** The two card images every blueprint ships. */
const REQUIRED_MEDIA = ['icon.png', 'preview.png'] as const;

export interface BundleMedia {
  filename: string;
  contentType: string;
  kind: string;
  alt: string;
  bytes: Buffer;
}

/** Read the bundle's `media/` dir, preview first — the card and the detail hero both
 *  take `media[0]`, so the order is load-bearing, not cosmetic. */
async function readMedia(dir: string, manifest: BlueprintManifest): Promise<BundleMedia[]> {
  const mediaDir = join(dir, 'media');
  const files = (await fs.readdir(mediaDir).catch(() => [] as string[])).filter((f) =>
    MEDIA_EXT_RE.test(f)
  );
  for (const required of REQUIRED_MEDIA) {
    if (!files.includes(required))
      throw new BundleError(`missing media/${required}`, manifest.slug);
  }
  const rank = (f: string): number => (f === 'preview.png' ? 0 : f === 'icon.png' ? 1 : 2);
  files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  const altByFile = new Map(
    manifest.media.map((m) => [m.file.replace(/^media\//, ''), m.alt ?? null] as const)
  );
  return Promise.all(
    files.map(async (filename) => {
      const ext = filename.split('.').pop()!.toLowerCase();
      return {
        filename,
        contentType: MEDIA_CONTENT_TYPES[ext] ?? 'application/octet-stream',
        kind: filename === 'icon.png' ? 'icon' : filename === 'preview.png' ? 'preview' : 'image',
        alt: altByFile.get(filename) ?? manifest.name,
        bytes: await fs.readFile(join(mediaDir, filename)),
      };
    })
  );
}

// ── Contents projection ───────────────────────────────────────────────────────

/**
 * The "what this creates" breakdown on a blueprint card.
 *
 * THIS IS THE ONLY COPY. It used to exist three times — the ingest, the platform
 * seed, and the blueprints route — each with a comment begging the others to stay
 * byte-identical, because three copies that disagreed would put a different blob in
 * the row depending on which path happened to write it. The other two writers are
 * gone, so the projection has one home and the warning is obsolete.
 */
export function blueprintContents(bp: Blueprint): Record<string, number | string | boolean> {
  const c = bp.commerce;
  return {
    products: c?.products.length ?? 0,
    categories: c?.categories.length ?? 0,
    collections: c?.collections.length ?? 0,
    content: bp.content.length,
    // `site` is optional — a commerce- or content-only blueprint hosts no site — so
    // this reads through it rather than assuming one exists.
    pages: bp.site?.pages.length ?? 0,
    emails: bp.emails.length,
    // What the design puts in the diary (issue 098). This was absent, so the
    // biggest set of example rows a booking blueprint installs — a premises, its
    // staff, and its whole menu of treatments — was the one thing the card never
    // mentioned. Somebody deciding whether to take the examples has to be able to
    // see them first.
    schedulingLocations: bp.scheduling?.locations?.length ?? 0,
    schedulingResources: bp.scheduling?.resources.length ?? 0,
    schedulingServices: bp.scheduling?.services.length ?? 0,
    theme: bp.theme.name,
    hasFrame: Boolean(bp.site?.frame),
  };
}

// ── Loading ───────────────────────────────────────────────────────────────────

export interface FirstPartyBlueprint {
  slug: string;
  dir: string;
  manifest: BlueprintManifest;
  blueprint: Blueprint;
  media: BundleMedia[];
}

/**
 * Load and validate one bundle: manifest → payload → media.
 *
 * The payload is authored in TS for ergonomics but is PURE DATA — it may relative-
 * import sibling JSON in its own directory and nothing else, never a `@sparx/*`
 * workspace package. That constraint is deliberate and worth keeping: it is what
 * lets an uploaded bundle eventually run through the same loader behind a sandbox,
 * instead of needing a second pipeline. First-party code is trusted, so the import
 * is direct here; sandboxing untrusted payloads is the upload flow's job.
 */
export async function loadBlueprintBundle(slug: string): Promise<FirstPartyBlueprint> {
  const dir = join(blueprintCatalogDir(), slug);

  let raw: string;
  try {
    raw = await fs.readFile(join(dir, 'sparx.json'), 'utf8');
  } catch {
    throw new BundleError('missing sparx.json', slug);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new BundleError(`sparx.json is not valid JSON: ${(err as Error).message}`, slug);
  }
  const parsedManifest = ManifestSchema.safeParse(json);
  if (!parsedManifest.success) {
    throw new BundleError(`invalid sparx.json: ${parsedManifest.error.message}`, slug);
  }
  const manifest = parsedManifest.data;
  if (manifest.slug !== slug) {
    throw new BundleError(`sparx.json declares slug "${manifest.slug}"`, slug);
  }

  const payloadPath = join(dir, manifest.payload);
  try {
    await fs.access(payloadPath);
  } catch {
    throw new BundleError(`payload not found: ${manifest.payload}`, slug);
  }
  const mod = (await import(pathToFileURL(payloadPath).href)) as Record<string, unknown>;
  const payload = mod.default ?? mod.payload;
  if (payload == null) {
    throw new BundleError(`payload ${manifest.payload} must default-export its data`, slug);
  }

  const parsed = safeParseBlueprint(payload);
  if (!parsed.success) {
    const detail = parsed.issues.map((i) => `${i.path}: ${i.message}`).join('; ');
    throw new BundleError(`invalid blueprint payload: ${detail}`, slug);
  }
  if (parsed.data.version !== manifest.version) {
    // The version is the artifact's storage key AND what an installed tenant diffs
    // against for an Update. Two spellings of it is a silent mismatch between the
    // row and the artifact it points at.
    throw new BundleError(
      `payload version ${parsed.data.version} disagrees with sparx.json ${manifest.version}`,
      slug
    );
  }

  return { slug, dir, manifest, blueprint: parsed.data, media: await readMedia(dir, manifest) };
}

/**
 * Every first-party bundle, loaded and validated.
 *
 * ALL-OR-NOTHING BY DESIGN. A partial load composes badly with retract-by-absence:
 * a bundle that failed to read looks exactly like a bundle sparx no longer ships, so
 * a tolerant pass would quietly delete the listing for a blueprint that is merely
 * broken. Throwing leaves the previous rows intact and serving.
 */
export async function loadFirstPartyBlueprints(): Promise<FirstPartyBlueprint[]> {
  const dir = blueprintCatalogDir();
  let slugs: string[];
  try {
    slugs = (await fs.readdir(dir, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => d.name)
      .sort();
  } catch {
    // No bundle tree at all (a stripped image, an odd test root). Distinct from a
    // tree that failed to parse: nothing to publish, and nothing to retract either.
    return [];
  }
  const loaded: FirstPartyBlueprint[] = [];
  for (const slug of slugs) loaded.push(await loadBlueprintBundle(slug));
  return loaded;
}
