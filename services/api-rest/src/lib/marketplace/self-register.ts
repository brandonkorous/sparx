// sparx publishes its OWN catalog — at runtime, through the same rows every other
// publisher writes to.
//
// THE STRATEGY THIS IMPLEMENTS. Themes, components and blueprints are all going to
// accept uploads from licensed collaborators, so all of them must share ONE process,
// and that process must not be a build or release step. A publisher publishes; the
// catalog is rows. sparx is a publisher like any other — the only thing special
// about it is that its source ships inside the image, so it can publish itself
// without anyone uploading anything.
//
// ALL FOUR CATEGORIES ARE HERE, including integrations, which have no upload story
// yet. That is the point rather than an oversight: this is the only thing that writes
// a first-party listing, so there is no second mechanism for the next person to find,
// copy, or wonder about. A category left behind on a seed loop would read as "this one
// is different" precisely when someone is deciding how uploads should work.
//
// WHY THIS IS NOT THE OLD INGEST WEARING A NEW NAME. The ingest failed in four
// specific ways, and each one is answered here:
//
//   · it was a RELEASE STAGE — a deploy-time copy step someone had to remember, and
//     which was wired to one cloud. Move to Azure and the shelf was empty. This runs
//     at BOOT, on whatever cluster the image is on, so an environment cannot be
//     behind.
//   · it was a SECOND CODE PATH — bundles on disk, validated and stored by machinery
//     no upload would ever use. This writes the same rows an upload writes.
//   · it could only ADD. `marketplace_components` carried 10 rows for bundles deleted
//     from the repo months earlier, because upsert has no opinion about absence.
//     `prune` below is the missing half: what sparx no longer ships, sparx no longer
//     lists.
//   · it duplicated the source. A theme bundle was a COPY of `SPARX_THEMES`, kept
//     true by re-running a script. Here the typed catalog IS the source; there is
//     nothing to keep in sync with it.
//
// IDEMPOTENT BY CONSTRUCTION, so it is safe on every boot: upsert by slug, delete by
// absence, and nothing is written that is not derived from the shipped source.
//
// THE ONE WAY THE CATEGORIES DIFFER: where the payload lives.
//
//   themes, components   pure code, small enough to live IN the row — one upsert.
//   integrations         discovery metadata only; the real provider is resolved by
//                        `providerSlug` at connect time — one upsert.
//   blueprints           a bundle: a manifest far too big for a column plus binary
//                        card imagery, so its bytes go to OBJECT STORAGE and the row
//                        is a thin index pointing at them.
//
// That is a difference in payload, NOT in process. All four end as rows in the same
// tables under the same publisher, and a blueprint's bytes land in the same storage a
// collaborator will upload to, read back by a resolver that cannot tell the publishers
// apart. They arrived here from four different mechanisms — code, a release-stage
// ingest, a seed loop, and an in-code registry that was empty — and are now on one.

import { Prisma, withSystem, type TxClient } from '@sparx/db';
import {
  FIRST_PARTY_COMPONENTS,
  FIRST_PARTY_THEMES,
  type FirstPartyComponent,
  type FirstPartyTheme,
} from '@sparx/silica-catalog';
import { colorToHex } from '@sparx/site-themes/color';

import { artifactExists, writeArtifact } from './artifacts.js';
import {
  blueprintContents,
  loadFirstPartyBlueprints,
  type FirstPartyBlueprint,
} from './blueprint-bundles.js';
import { firstPartyIntegrations, type FirstPartyIntegration } from './first-party-integrations.js';
import { getStorage, marketplaceMediaKey, marketplaceMediaUrl } from '../storage.js';

/** What one pass changed, per category — returned rather than only logged so a
 *  caller (a health probe, a test, an ops readout) can assert the shelf. */
export interface SelfRegisterReport {
  themes: { published: number; pruned: string[] };
  components: { published: number; pruned: string[] };
  blueprints: { published: number; pruned: string[]; objectsWritten: number };
  integrations: { published: number; pruned: string[] };
}

const ACCENT_FALLBACK = '#6b7280';

/** The card's accent chip, resolved from the theme's own palette. */
function themeAccent(theme: FirstPartyTheme): string {
  const role = theme.meta.accentRole ?? 'primary';
  const tokens = theme.theme.tokens;
  const pick = (r: string): string | null => colorToHex(tokens[`--color-${r}`] ?? null);
  return pick(role) ?? pick('primary') ?? ACCENT_FALLBACK;
}

/** The fields every catalog row shares. `status` is `published` because this IS the
 *  platform publishing its own work — a collaborator's upload lands as
 *  `pending_review` through the same columns and is promoted by a reviewer. */
function spine(
  publisherId: string,
  opts: {
    name: string;
    tagline: string;
    description: string;
    /** Themes and components are versionless: their source is code, so the shipped
     *  image IS the version. A blueprint carries a real semver because its artifact
     *  is keyed by it and an installed tenant diffs against it for an Update. */
    version?: string;
    /** Card imagery. Empty for a live-preview category (docs/118): a theme and a
     *  component render from their own payload, so neither bakes an image. */
    media?: unknown[];
    priceCents?: number;
    pricingModel?: string;
  }
) {
  return {
    name: opts.name,
    tagline: opts.tagline.slice(0, 255),
    description: opts.description,
    version: opts.version ?? '1.0.0',
    media: (opts.media ?? []) as unknown as Prisma.InputJsonValue,
    status: 'published',
    visibility: 'public',
    priceCents: opts.priceCents ?? 0,
    pricingModel: opts.pricingModel ?? 'free',
    publisherId,
  };
}

/** sparx's publisher row, created if absent so a fresh database needs no seed
 *  ordering — this module is self-sufficient. */
async function sparxPublisherId(tx: TxClient): Promise<string> {
  const pub = await tx.marketplacePublisher.upsert({
    where: { slug: 'sparx' },
    update: { type: 'sparx', displayName: 'sparx', verified: true },
    create: { slug: 'sparx', type: 'sparx', displayName: 'sparx', verified: true },
    select: { id: true },
  });
  return pub.id;
}

async function publishTheme(tx: TxClient, publisherId: string, t: FirstPartyTheme): Promise<void> {
  const data = {
    ...spine(publisherId, {
      name: t.theme.name,
      tagline: t.meta.tagline,
      description: t.meta.description,
    }),
    accent: themeAccent(t),
    // The token bag lives IN the row: it is small (~60 tokens) and the card renders
    // it live, so browse and detail both need it without a per-card storage read.
    tokens: { tokens: t.theme.tokens, dark: t.theme.dark ?? null } as Prisma.InputJsonValue,
    mood: t.meta.mood,
    colorFamily: t.meta.colorFamily,
    density: t.meta.density,
    industry: t.meta.industry,
    // sparx's business-named shelf leads silica's look-named presets.
    sortWeight: t.shelf === 'sparx' ? 100 : 50,
  };
  await tx.marketplaceTheme.upsert({
    where: { slug: t.slug },
    update: data,
    create: { slug: t.slug, publishedAt: new Date(), ...data },
  });
}

async function publishComponent(
  tx: TxClient,
  publisherId: string,
  c: FirstPartyComponent
): Promise<void> {
  const data = {
    ...spine(publisherId, { name: c.name, tagline: c.tagline, description: '' }),
    accent: null,
    // The node tree lives IN the row, for the same reason the token bag does.
    tree: c.tree as unknown as Prisma.InputJsonValue,
    propSpec: [] as unknown as Prisma.InputJsonValue,
    group: c.group,
    kind: c.kind,
    surfaces: c.surfaces,
    sortWeight: c.sortWeight,
  };
  await tx.marketplaceComponent.upsert({
    where: { slug: c.slug },
    update: data,
    create: { slug: c.slug, publishedAt: new Date(), ...data },
  });
}

/** An integration listing is DISCOVERY only — the "Connect" CTA hands off to the real
 *  provider by `providerSlug`, so `configSchema` stays NULL and there is no artifact,
 *  no media and no version to speak of. */
async function publishIntegration(
  tx: TxClient,
  publisherId: string,
  it: FirstPartyIntegration
): Promise<void> {
  const data = {
    ...spine(publisherId, { name: it.name, tagline: it.tagline, description: it.description }),
    accent: it.accent,
    configSchema: Prisma.DbNull,
    providerSlug: it.providerSlug,
    kind: it.kind,
    scopes: it.scopes,
    sortWeight: it.sortWeight,
  };
  await tx.marketplaceIntegration.upsert({
    where: { slug: it.slug },
    update: data,
    create: { slug: it.slug, publishedAt: new Date(), ...data },
  });
}

// ── Blueprints ────────────────────────────────────────────────────────────────

/** The stored byte length of `key`, or null when the object does not exist. The
 *  body is a stream in both backends, so it is destroyed rather than read. */
async function storedSize(key: string): Promise<number | null> {
  try {
    const obj = await getStorage().readObject(key);
    obj.body.destroy();
    return obj.size;
  } catch {
    return null;
  }
}

/**
 * Put a blueprint's served bytes in object storage and return the row's `media[]`.
 *
 * Runs OUTSIDE the transaction — 21 payload imports and up to 42 object writes would
 * otherwise hold a database transaction open for seconds. Storage first, rows after,
 * for the same reason the ingest did it in that order: a failed write leaves a
 * harmless orphan object, whereas a row written first would point at nothing.
 *
 * Idempotent, and quiet on a steady state. The artifact is immutable per version, so
 * it is written once and skipped forever after. Media is compared by byte length and
 * rewritten only when it differs — which keeps a corrected preview.png propagating
 * without a version bump (the ingest's behaviour) while a pod restart, a crashloop or
 * a scale-up costs a few metadata reads instead of re-uploading 7 MB every time.
 */
async function stageBlueprint(bp: FirstPartyBlueprint): Promise<{
  media: { url: string; kind: string; alt: string }[];
  objectsWritten: number;
}> {
  const { slug, manifest } = bp;
  let objectsWritten = 0;

  if (!(await artifactExists('blueprints', slug, manifest.version))) {
    await writeArtifact('blueprints', slug, manifest.version, bp.blueprint);
    objectsWritten += 1;
  }

  const media: { url: string; kind: string; alt: string }[] = [];
  for (const m of bp.media) {
    const key = marketplaceMediaKey('blueprints', slug, m.filename);
    if ((await storedSize(key)) !== m.bytes.byteLength) {
      await getStorage().writeObject(key, m.contentType, m.bytes);
      objectsWritten += 1;
    }
    media.push({
      url: marketplaceMediaUrl('blueprints', slug, m.filename),
      kind: m.kind,
      alt: m.alt,
    });
  }

  return { media, objectsWritten };
}

async function publishBlueprint(
  tx: TxClient,
  publisherId: string,
  bp: FirstPartyBlueprint,
  media: { url: string; kind: string; alt: string }[]
): Promise<void> {
  const { manifest } = bp;
  const facet = (key: string): string | null => {
    const v = manifest.facets[key];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  const data = {
    ...spine(publisherId, {
      name: manifest.name,
      tagline: manifest.tagline,
      description: manifest.description,
      version: manifest.version,
      media,
      priceCents: manifest.pricing.priceCents,
      pricingModel: manifest.pricing.model,
    }),
    accent: manifest.accent ?? null,
    icon: manifest.icon ?? null,
    sortWeight: manifest.sortWeight ?? 0,
    // The manifest is far too big for a column and is keyed by version in storage —
    // the row stays a thin index that points at it.
    definition: Prisma.DbNull,
    vertical: facet('vertical') ?? bp.blueprint.vertical,
    requiredModules: bp.blueprint.requiresModules,
    contents: blueprintContents(bp.blueprint) as Prisma.InputJsonValue,
  };
  await tx.marketplaceBlueprint.upsert({
    where: { slug: manifest.slug },
    update: data,
    create: { slug: manifest.slug, publishedAt: new Date(), ...data },
  });
}

/**
 * Publish sparx's own catalog and retract what it no longer ships.
 *
 * The prune is scoped to rows THIS publisher owns (`type: 'sparx'`), so a
 * collaborator's listing is never touched by a platform boot — the two coexist in
 * one table precisely because the marketplace is one shelf with many publishers.
 */
export async function selfRegisterFirstPartyCatalog(): Promise<SelfRegisterReport> {
  // Read + validate every bundle BEFORE anything is written. A bundle that fails to
  // load is indistinguishable from a bundle sparx no longer ships, so loading first
  // is what stops a broken payload from being retracted as if it were withdrawn.
  const blueprints = await loadFirstPartyBlueprints();

  // Storage next, still outside the transaction (see stageBlueprint).
  let objectsWritten = 0;
  const stagedMedia = new Map<string, { url: string; kind: string; alt: string }[]>();
  for (const bp of blueprints) {
    const staged = await stageBlueprint(bp);
    stagedMedia.set(bp.slug, staged.media);
    objectsWritten += staged.objectsWritten;
  }

  // Read the plane ONCE, here, rather than at module scope: the registry is filled by
  // `bootstrapIntegrations()` during boot, so an import-time constant would capture it
  // empty and publish nothing.
  const integrations = firstPartyIntegrations();

  return withSystem(async (tx) => {
    const publisherId = await sparxPublisherId(tx);

    for (const t of FIRST_PARTY_THEMES) await publishTheme(tx, publisherId, t);
    for (const c of FIRST_PARTY_COMPONENTS) await publishComponent(tx, publisherId, c);
    for (const i of integrations) await publishIntegration(tx, publisherId, i);
    for (const bp of blueprints) {
      await publishBlueprint(tx, publisherId, bp, stagedMedia.get(bp.slug) ?? []);
    }

    const themeSlugs = FIRST_PARTY_THEMES.map((t) => t.slug);
    const componentSlugs = FIRST_PARTY_COMPONENTS.map((c) => c.slug);
    const integrationSlugs = integrations.map((i) => i.slug);
    const blueprintSlugs = blueprints.map((b) => b.slug);

    // Retract by ABSENCE. This is the half the ingest never had: production carried
    // 15 retired palette pointers and 10 orphans of long-deleted bundles because
    // nothing ever asked "is this still ours?".
    const staleThemes = await tx.marketplaceTheme.findMany({
      where: { publisherId, slug: { notIn: themeSlugs } },
      select: { slug: true },
    });
    const staleComponents = await tx.marketplaceComponent.findMany({
      where: { publisherId, slug: { notIn: componentSlugs } },
      select: { slug: true },
    });
    // A blueprint listing could ONLY be retracted by a destructive ops workflow
    // someone had to remember to run — `marketplace-purge-blueprints`, gated behind a
    // typed confirmation. It is deleted, and this is what replaces it: removing the
    // bundle from the repo is the retraction.
    const staleBlueprints = await tx.marketplaceBlueprint.findMany({
      where: { publisherId, slug: { notIn: blueprintSlugs } },
      select: { slug: true },
    });
    const staleIntegrations = await tx.marketplaceIntegration.findMany({
      where: { publisherId, slug: { notIn: integrationSlugs } },
      select: { slug: true },
    });
    if (staleThemes.length) {
      await tx.marketplaceTheme.deleteMany({ where: { publisherId, slug: { notIn: themeSlugs } } });
    }
    if (staleComponents.length) {
      await tx.marketplaceComponent.deleteMany({
        where: { publisherId, slug: { notIn: componentSlugs } },
      });
    }
    if (staleBlueprints.length) {
      await tx.marketplaceBlueprint.deleteMany({
        where: { publisherId, slug: { notIn: blueprintSlugs } },
      });
    }
    if (staleIntegrations.length) {
      await tx.marketplaceIntegration.deleteMany({
        where: { publisherId, slug: { notIn: integrationSlugs } },
      });
    }

    return {
      themes: { published: FIRST_PARTY_THEMES.length, pruned: staleThemes.map((r) => r.slug) },
      components: {
        published: FIRST_PARTY_COMPONENTS.length,
        pruned: staleComponents.map((r) => r.slug),
      },
      blueprints: {
        published: blueprints.length,
        pruned: staleBlueprints.map((r) => r.slug),
        objectsWritten,
      },
      integrations: {
        published: integrations.length,
        pruned: staleIntegrations.map((r) => r.slug),
      },
    };
  });
}
