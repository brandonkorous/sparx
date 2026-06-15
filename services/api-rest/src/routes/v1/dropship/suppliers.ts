// Dropship suppliers — connect, configure, sync, catalog browse, import.
//
//   GET    /v1/dropship/suppliers                              → list
//   POST   /v1/dropship/suppliers                              → connect
//   GET    /v1/dropship/suppliers/:id                          → get one
//   PATCH  /v1/dropship/suppliers/:id                          → update
//   DELETE /v1/dropship/suppliers/:id                          → disconnect
//   POST   /v1/dropship/suppliers/:id/sync                     → trigger catalog sync
//   GET    /v1/dropship/suppliers/:id/catalog                  → browse raw catalog
//   POST   /v1/dropship/suppliers/:id/catalog/:productId/import → import to commerce

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound, badRequest, conflict } from '@sparx/api-core/errors';
import { slugify, uniqueSlug } from '@sparx/api-core/slug';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { createAdapter, VENDOR_CATALOG } from '@sparx/dropship';
import type { PricingRule, SupplierAdapter, SupplierType } from '@sparx/dropship';
import { applyPricingRule } from '@sparx/dropship';
import { requireDropshipModule, toDropshipContext } from '../../../lib/dropship-context.js';
import { env } from '../../../env.js';

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });

const PathId = z.object({ id: z.string().uuid() });
const PathIdProduct = z.object({ id: z.string().uuid(), productId: z.string().uuid() });

// Best-effort MIME from a hot-linked image URL extension (mirrors the blueprint
// installer). Defaults to jpeg — only used for the MediaAsset metadata, never
// for actual decoding, so an occasional mismatch is harmless.
function mimeFromImageUrl(url: string): string {
  const ext = url.split('?')[0]?.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'avif':
      return 'image/avif';
    default:
      return 'image/jpeg';
  }
}

const ListQuery = z.object({
  status: z.enum(['connecting', 'active', 'error', 'disconnected']).optional(),
  // When set, returns only connections enabled on this site — i.e. those scoped
  // to it OR scoped to no site at all (all-sites connections).
  propertyId: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const CatalogQuery = z.object({
  q: z.string().max(255).optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const PricingRuleSchema = z.object({
  type: z.enum(['percentage_markup', 'multiplier', 'flat_markup', 'fixed_margin']),
  value: z.number().positive(),
  roundTo: z.enum(['cent', 'dollar', 'five_dollar']).optional(),
  maxMsrp: z.literal('use_supplier_msrp').optional(),
});

// `siteScope` is the list of property (site) IDs this tenant-wide connection is
// enabled on. Omitted or empty array = enabled on ALL of the tenant's sites
// (the default; mirrors the commerce_product_properties "empty = all" rule).
const SiteScope = z.array(z.string().uuid()).max(200);

const SupplierBody = z.object({
  name: z.string().min(1).max(255),
  // Only vendors with a real, self-serve adapter (docs/14 §3). Suppliers without
  // a usable public API are not offered.
  type: z.enum(['csv', 'dsers', 'spocket', 'printify', 'printful']),
  credentials: z.record(z.string(), z.string()),
  pricingRule: PricingRuleSchema.nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  siteScope: SiteScope.optional(),
});

const SupplierPatchBody = z.object({
  name: z.string().min(1).max(255).optional(),
  credentials: z.record(z.string(), z.string()).optional(),
  pricingRule: PricingRuleSchema.nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  siteScope: SiteScope.optional(),
});

const ImportBody = z.object({
  pricingRuleOverride: PricingRuleSchema.optional(),
});

// Vendor catalog keyed by slug — lets the supplier view attach the credential
// field spec for its type without the dashboard re-fetching or re-deriving it.
const VENDOR_BY_TYPE = new Map(VENDOR_CATALOG.map((v) => [v.slug, v]));

// Are this connection's credentials actually on file? Secrets are write-only
// (never returned to the browser), so the dashboard can't tell on its own
// whether a token is stored — it relies on this flag to decide between the
// "Credentials saved ✓ / Replace" state and the "needs credentials" recovery
// state. True iff every required credential key has a non-empty stored value
// (or, for vendors with no required fields, any value is present).
function credentialsArePresent(vendorSlug: string, credentials: unknown): boolean {
  const bag = (credentials as Record<string, string> | null) ?? {};
  const required = (VENDOR_BY_TYPE.get(vendorSlug as SupplierType)?.credentialFields ?? []).filter(
    (f) => f.required
  );
  if (required.length === 0) {
    return Object.values(bag).some((v) => typeof v === 'string' && v.trim().length > 0);
  }
  return required.every((f) => {
    const v = bag[f.key];
    return typeof v === 'string' && v.trim().length > 0;
  });
}

function toSupplierView(s: {
  id: string;
  name: string;
  type: string;
  status: string;
  credentials: unknown;
  lastSyncAt: Date | null;
  pricingRule: unknown;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  siteScopes?: { propertyId: string }[];
}) {
  const vendor = VENDOR_BY_TYPE.get(s.type as SupplierType);
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    status: s.status,
    lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
    pricingRule: (s.pricingRule as PricingRule | null) ?? null,
    notes: s.notes,
    // The credential field spec for this vendor type, so the edit form can
    // render the right inputs without depending on a separate vendors fetch.
    // NEVER the secret values themselves — only the field *shape*.
    credentialFields: vendor?.credentialFields ?? [],
    // Whether a usable token is on file (see credentialsArePresent). The edit
    // form uses this to avoid ever forcing a re-entry just to change other fields.
    credentialsSet: credentialsArePresent(s.type, s.credentials),
    vendorLabel: vendor?.label ?? s.type,
    // Empty = enabled on every site (the default). A non-empty list restricts
    // the connection to those properties.
    siteScope: s.siteScopes?.map((x) => x.propertyId) ?? [],
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// Per-image cap — a many-angle catalog (Printify ships ~7 mockups per colour)
// can't create an unbounded media fan-out at either the product or variant level.
const DROPSHIP_IMAGE_CAP = 12;

// Attach a dropship product's imagery to a commerce product as hot-linked media
// (MediaAsset.key = the supplier's absolute URL; mediaPublicUrl() passes it
// through — the blueprint-install pattern, docs/54 §6 — so there's no download/
// re-upload). Two layers:
//   • PRODUCT-LEVEL (`rawImages`) — the hero (isPrimary, surfaced on PLP cards +
//     the search index) and the gallery baseline shown until a variant resolves;
//   • PER-VARIANT (`variantImages`) — faithful to the supplier: each mockup is
//     pinned to the exact variant(s) the supplier listed it for, so the PDP
//     gallery swaps to a SKU's own shots when it's selected. Printify shares one
//     colour mockup across every size, so the same URL recurs across a colour's
//     variants — we dedupe the MediaAsset by URL, so one asset backs every row.
// Returns the total number of VariantImage rows attached.
async function attachDropshipImages(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  tenantId: string,
  productId: string,
  rawImages: unknown,
  variantImages: { variantId: string; imageUrls: string[] }[] = []
): Promise<number> {
  const isHttpUrl = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//i.test(u);

  // One MediaAsset per distinct supplier URL, reused across every VariantImage
  // that references it (a colour mockup shared by all its sizes → one asset).
  const assetIdByUrl = new Map<string, string>();
  const ensureAsset = async (url: string): Promise<string> => {
    const cached = assetIdByUrl.get(url);
    if (cached) return cached;
    const rawName = url.split('/').pop()?.split('?')[0];
    const fileName = rawName && rawName.length > 0 ? rawName : 'dropship-image.jpg';
    const asset = await tx.mediaAsset.create({
      data: {
        tenantId,
        key: url,
        originalFilename: fileName,
        mimeType: mimeFromImageUrl(url),
        byteSize: BigInt(0),
        status: 'ready',
      },
      select: { id: true },
    });
    assetIdByUrl.set(url, asset.id);
    return asset.id;
  };

  let attached = 0;

  // Product-level (the hero + fallback gallery).
  const productUrls = ((rawImages as string[] | null) ?? [])
    .filter(isHttpUrl)
    .slice(0, DROPSHIP_IMAGE_CAP);
  for (const [imgIdx, url] of productUrls.entries()) {
    await tx.variantImage.create({
      data: {
        tenantId,
        productId,
        mediaAssetId: await ensureAsset(url),
        position: imgIdx,
        isPrimary: imgIdx === 0,
      },
    });
    attached += 1;
  }

  // Per-variant (pinned to the SKU; never the hero).
  for (const { variantId, imageUrls } of variantImages) {
    const urls = imageUrls.filter(isHttpUrl).slice(0, DROPSHIP_IMAGE_CAP);
    for (const [imgIdx, url] of urls.entries()) {
      await tx.variantImage.create({
        data: {
          tenantId,
          productId,
          variantId,
          mediaAssetId: await ensureAsset(url),
          position: imgIdx,
          isPrimary: false,
        },
      });
      attached += 1;
    }
  }

  return attached;
}

// Materialize a product's option lattice (ProductOption + ProductOptionValue)
// from a set of normalized dropship variants, and return a map from each
// variant's supplierSku to the option-value ids it should be pinned to.
//
// Dropship variants carry their options inline (`{ Size: '3"x3"', Color: 'Black' }`),
// but the storefront's variant picker renders from ProductOption rows and resolves
// the chosen variant via the ProductVariantOptionValue lattice — so without these
// rows an imported multi-variant product shows NO size/colour picker and silently
// strands the buyer on the default variant. We rebuild the lattice in first-seen
// order (so sizes/colours render in the sequence the supplier listed them) and
// hand back the per-SKU value ids so the caller can pin each variant.
//
// Returns an empty map when no variant carries options (single-SKU products) —
// the caller then skips variant↔option-value joins entirely.
async function materializeDropshipOptions(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  tenantId: string,
  productId: string,
  variants: { supplierSku: string; options: Record<string, string> }[]
): Promise<Map<string, string[]>> {
  // First-seen order for both option names and their values.
  const optionNames: string[] = [];
  const valuesByOption = new Map<string, string[]>();
  for (const v of variants) {
    for (const [name, value] of Object.entries(v.options ?? {})) {
      if (!name || !value) continue;
      if (!valuesByOption.has(name)) {
        optionNames.push(name);
        valuesByOption.set(name, []);
      }
      const vals = valuesByOption.get(name)!;
      if (!vals.includes(value)) vals.push(value);
    }
  }

  if (optionNames.length === 0) return new Map();

  // optionName → (value → optionValueId)
  const valueId = new Map<string, Map<string, string>>();
  for (const [i, name] of optionNames.entries()) {
    const option = await tx.productOption.create({
      data: {
        tenantId,
        productId,
        name: name.slice(0, 63),
        // No hex from suppliers, so colour options render as labelled chips
        // until a merchant adds swatches — 'swatch' just primes that later.
        displayType: /colou?r/i.test(name) ? 'swatch' : 'dropdown',
        position: i,
      },
    });
    const lookup = new Map<string, string>();
    for (const [j, value] of valuesByOption.get(name)!.entries()) {
      const row = await tx.productOptionValue.create({
        data: { tenantId, optionId: option.id, value: value.slice(0, 127), position: j },
        select: { id: true },
      });
      lookup.set(value, row.id);
    }
    valueId.set(name, lookup);
  }

  const bySku = new Map<string, string[]>();
  for (const v of variants) {
    const ids: string[] = [];
    for (const [name, value] of Object.entries(v.options ?? {})) {
      const id = valueId.get(name)?.get(value);
      if (id) ids.push(id);
    }
    bySku.set(v.supplierSku, ids);
  }
  return bySku;
}

// Validate that every property id in a requested site scope belongs to the
// tenant. Returns the (de-duplicated) id list. An empty input means "all sites"
// and writes no rows.
async function resolveSiteScope(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  tenantId: string,
  ids: string[]
): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const found = await tx.property.findMany({
    where: { tenantId, id: { in: unique } },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw badRequest('One or more sites in siteScope do not belong to this tenant', 'INVALID_SITE');
  }
  return unique;
}

function toDropshipProductView(dp: {
  id: string;
  supplierProductId: string;
  title: string;
  description: string | null;
  images: unknown;
  variants: unknown;
  costPriceCents: number;
  msrpCents: number | null;
  importedAt: Date;
  updatedAt: Date;
  links?: {
    id: string;
    productId: string;
    status: string;
    product?: { status: string } | null;
  }[];
}) {
  const primaryLink = dp.links?.[0];
  return {
    id: dp.id,
    supplierProductId: dp.supplierProductId,
    title: dp.title,
    description: dp.description,
    images: (dp.images as string[]) ?? [],
    variants: dp.variants,
    costPriceCents: dp.costPriceCents,
    msrpCents: dp.msrpCents,
    importedAt: dp.importedAt.toISOString(),
    updatedAt: dp.updatedAt.toISOString(),
    isImported: (dp.links?.length ?? 0) > 0,
    // The commerce publish state of the imported product — the thing that
    // actually decides whether it shows on the site. Null when not yet imported.
    productStatus: primaryLink?.product?.status ?? null,
    links: dp.links?.map((l) => ({ id: l.id, productId: l.productId, status: l.status })) ?? [],
  };
}

// The normalized supplier variant both the import route and the publish reconcile
// feed in — its inline options plus the per-variant mockups the adapter resolved.
interface DropshipVariantData {
  supplierSku: string;
  title: string;
  options: Record<string, string>;
  costPriceCents: number;
  msrpCents: number | null;
  weight: number | null;
  imageUrls?: string[];
}

interface DropshipImportData {
  tenantId: string;
  supplierId: string;
  dropshipProductId: string;
  title: string;
  description: string | null;
  productImages: string[];
  variants: DropshipVariantData[];
  pricingRule: PricingRule | null;
  /** Resolved property ids the product is scoped to; empty = all sites. */
  siteScopeIds: string[];
}

// Create a commerce product — options lattice, variants, per-variant imagery, and
// the dropship link — from a normalized supplier product, in one transaction.
// Shared by the manual import route and the publish reconcile so both produce an
// identical catalog shape. Imports as `draft` (the merchant reviews pricing before
// it goes live); returns the new product id + handle.
async function createCommerceProductFromDropship(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  data: DropshipImportData
): Promise<{ productId: string; handle: string; linkId: string; variantCount: number }> {
  const { tenantId, supplierId, dropshipProductId, variants, pricingRule } = data;

  const baseHandle = slugify(data.title || 'product');
  const handle = await uniqueSlug(baseHandle, async (candidate) => {
    const existing = await tx.product.findFirst({
      where: { tenantId, handle: candidate, deletedAt: null },
    });
    return existing !== null;
  });

  // `inStock: true` because dropship items are supplier-fulfilled (made-to-order
  // for POD) — we don't track their stock locally, so the storefront must never
  // show them as sold out (the default `false` is what made imports read so).
  const product = await tx.product.create({
    data: {
      tenantId,
      title: data.title,
      handle,
      description: data.description ?? null,
      status: 'draft',
      fulfillmentType: 'physical',
      inStock: true,
      metadata: { dropshipSupplierId: supplierId, dropshipProductId },
    },
  });

  // Build the option lattice first so each variant can be pinned to its option-
  // value set — otherwise the storefront renders no size/colour picker.
  const optionValueIdsBySku = await materializeDropshipOptions(tx, tenantId, product.id, variants);

  const createdVariants = await Promise.all(
    variants.map((v, idx) => {
      const retailPrice = pricingRule
        ? applyPricingRule(v.costPriceCents, pricingRule)
        : (v.msrpCents ?? v.costPriceCents);
      const compareAt = pricingRule ? (v.msrpCents ?? null) : null;
      return tx.productVariant.create({
        data: {
          tenantId,
          productId: product.id,
          sku: v.supplierSku,
          title: v.title || undefined,
          priceCents: retailPrice,
          compareAtPriceCents: compareAt,
          costCents: v.costPriceCents,
          currency: 'USD',
          weightGrams: v.weight ?? undefined,
          // `continue` = orderable without tracked stock (supplier holds it).
          inventoryPolicy: 'continue',
          isDefault: idx === 0,
          position: idx,
          dropshipSourceId: supplierId,
        },
      });
    })
  );

  // Pin each variant onto its option-value lattice point (index-aligned).
  const variantJoins = createdVariants.flatMap((cv, idx) => {
    const supplierSku = variants[idx]?.supplierSku;
    const ids = supplierSku ? (optionValueIdsBySku.get(supplierSku) ?? []) : [];
    return ids.map((optionValueId) => ({ variantId: cv.id, optionValueId }));
  });
  if (variantJoins.length > 0) {
    await tx.productVariantOptionValue.createMany({ data: variantJoins, skipDuplicates: true });
  }

  // Imagery: product-level hero/baseline + each variant's own mockups (see
  // attachDropshipImages). createdVariants is index-aligned with `variants`.
  const perVariantImages = createdVariants.map((cv, idx) => ({
    variantId: cv.id,
    imageUrls: variants[idx]?.imageUrls ?? [],
  }));
  await attachDropshipImages(tx, tenantId, product.id, data.productImages, perVariantImages);

  const link = await tx.dropshipProductLink.create({
    data: {
      tenantId,
      productId: product.id,
      dropshipProductId,
      supplierSku: variants[0]?.supplierSku ?? '',
      status: 'active',
    },
  });

  // Inherit the supplier's site scope (empty = all sites, writes no rows).
  if (data.siteScopeIds.length > 0) {
    await tx.productProperty.createMany({
      data: data.siteScopeIds.map((propertyId) => ({ productId: product.id, propertyId })),
    });
  }

  return { productId: product.id, handle, linkId: link.id, variantCount: createdVariants.length };
}

interface ReconcileDeps {
  tenantId: string;
  supplierId: string;
  pricingRule: PricingRule | null;
  siteScopeIds: string[];
}

interface ReconcileSummary {
  pending: number;
  imported: number;
  confirmed: number;
  failed: number;
}

// Close the publish handshake for a supplier (docs/14): custom-integration
// channels (Printify/Printful) LOCK a product in a "publishing" state when the
// merchant clicks Publish and wait for us to call back. Until we do, the product
// is stuck. For each locked product we (a) ensure it's imported into the catalog,
// then (b) confirm the publish — which unlocks it on the supplier side and lets
// its UI deep-link to our listing. On any per-product error we report a publish
// FAILURE instead, so a product is never left stuck on our account.
//
// Adapter is injected (not built here) so the orchestration is unit-testable with
// a fake supplier. Returns nothing for adapters without the handshake.
export async function reconcileSupplierPublishes(
  adapter: SupplierAdapter,
  deps: ReconcileDeps,
  onImported: (productId: string) => Promise<void>
): Promise<ReconcileSummary> {
  if (!adapter.listPendingPublish || !adapter.confirmPublish) {
    return { pending: 0, imported: 0, confirmed: 0, failed: 0 };
  }

  const pending = await adapter.listPendingPublish();
  let imported = 0;
  let confirmed = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const { productId, handle, didImport } = await withTenant(
        { tenantId: deps.tenantId },
        async (tx) => {
          // Reuse an existing dropship row + commerce link if the product was
          // already imported (publish after a manual import, or a re-run).
          const existing = await tx.dropshipProduct.findFirst({
            where: {
              tenantId: deps.tenantId,
              supplierId: deps.supplierId,
              supplierProductId: item.supplierProductId,
            },
            include: { links: { where: { status: 'active' }, select: { productId: true } } },
          });

          const linkedProductId = existing?.links[0]?.productId;
          if (linkedProductId) {
            const prod = await tx.product.findUnique({
              where: { id: linkedProductId },
              select: { handle: true },
            });
            return { productId: linkedProductId, handle: prod?.handle ?? '', didImport: false };
          }

          // Ensure a dropship_products row exists to link against.
          const dropshipProductId =
            existing?.id ??
            (
              await tx.dropshipProduct.create({
                data: {
                  tenantId: deps.tenantId,
                  supplierId: deps.supplierId,
                  supplierProductId: item.supplierProductId,
                  title: item.product.title,
                  description: item.product.description,
                  images: item.product.imageUrls,
                  variants: item.product.variants as unknown as Prisma.InputJsonValue,
                  costPriceCents: item.product.variants[0]?.costPriceCents ?? 0,
                  msrpCents: item.product.variants[0]?.msrpCents ?? null,
                },
                select: { id: true },
              })
            ).id;

          const res = await createCommerceProductFromDropship(tx, {
            tenantId: deps.tenantId,
            supplierId: deps.supplierId,
            dropshipProductId,
            title: item.product.title,
            description: item.product.description,
            productImages: item.product.imageUrls,
            variants: item.product.variants,
            pricingRule: deps.pricingRule,
            siteScopeIds: deps.siteScopeIds,
          });
          return { productId: res.productId, handle: res.handle, didImport: true };
        }
      );

      if (didImport) {
        imported += 1;
        await onImported(productId);
      }

      // Unlock the product on the supplier side, pointing it at our listing.
      await adapter.confirmPublish(item.supplierProductId, { id: productId, handle });
      confirmed += 1;
    } catch (err) {
      failed += 1;
      // Never leave it stuck: report the failure so the supplier unlocks it.
      if (adapter.failPublish) {
        try {
          await adapter.failPublish(
            item.supplierProductId,
            err instanceof Error ? err.message : 'Publish import failed'
          );
        } catch {
          // best-effort — the next reconcile will retry
        }
      }
    }
  }

  return { pending: pending.length, imported, confirmed, failed };
}

// Build the adapter from a supplier row and run the publish reconcile, emitting a
// search-index event for each newly imported product. Shared by the Sync action
// and the standalone reconcile endpoint.
function runPublishReconcile(
  supplier: {
    id: string;
    type: string;
    credentials: unknown;
    pricingRule: unknown;
    siteScopes: { propertyId: string }[];
  },
  tenantId: string,
  userId: string | null
): Promise<ReconcileSummary> {
  const adapter = createAdapter(
    supplier.type as SupplierType,
    supplier.credentials as Record<string, string>
  );
  return reconcileSupplierPublishes(
    adapter,
    {
      tenantId,
      supplierId: supplier.id,
      pricingRule: (supplier.pricingRule as PricingRule | null) ?? null,
      siteScopeIds: supplier.siteScopes.map((s) => s.propertyId),
    },
    (productId) =>
      publishEvent(
        publisher,
        'search.entity.changed',
        tenantId,
        userId,
        { entityType: 'product', recordId: productId, op: 'upsert' },
        pubLogger
      )
  );
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const dropshipSupplierRoutes: FastifyPluginAsync = async (app) => {
  // ── Vendor catalog (the connectable suppliers + their credential field spec) ──

  app.get('/v1/dropship/vendors', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'editor');
    return reply.send(ok(VENDOR_CATALOG));
  });

  // ── List suppliers ───────────────────────────────────────────────────────────

  app.get('/v1/dropship/suppliers', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toDropshipContext(request);
    const query = ListQuery.parse(request.query);

    const [suppliers, total] = await withTenant({ tenantId }, async (tx) => {
      const where: Prisma.DropshipSupplierWhereInput = { tenantId, deletedAt: null };
      if (query.status) where.status = query.status;
      // A site sees connections scoped to it OR scoped to no site (all-sites).
      if (query.propertyId) {
        where.OR = [
          { siteScopes: { none: {} } },
          { siteScopes: { some: { propertyId: query.propertyId } } },
        ];
      }
      return Promise.all([
        tx.dropshipSupplier.findMany({
          where,
          include: { siteScopes: { select: { propertyId: true } } },
          orderBy: { createdAt: 'desc' },
          take: query.take,
          skip: query.skip,
        }),
        tx.dropshipSupplier.count({ where }),
      ]);
    });

    return reply.send(
      paged(suppliers.map(toSupplierView), { total, skip: query.skip, take: query.take })
    );
  });

  // ── Connect a supplier ───────────────────────────────────────────────────────

  app.post('/v1/dropship/suppliers', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId, userId } = toDropshipContext(request);
    const body = SupplierBody.parse(request.body);

    // Validate connection inline (fails fast with 400 rather than waiting for worker).
    let connectionOk = false;
    try {
      const adapter = createAdapter(body.type, body.credentials);
      connectionOk = await adapter.authenticate(body.credentials);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Adapter authentication failed';
      throw badRequest(msg, 'CONNECTION_FAILED');
    }

    const supplier = await withTenant({ tenantId }, async (tx) => {
      const created = await tx.dropshipSupplier.create({
        data: {
          tenantId,
          name: body.name,
          type: body.type,
          credentials: body.credentials,
          status: connectionOk ? 'active' : 'error',
          pricingRule: body.pricingRule ?? Prisma.JsonNull,
          notes: body.notes ?? null,
        },
      });
      const scope = await resolveSiteScope(tx, tenantId, body.siteScope ?? []);
      if (scope.length > 0) {
        await tx.dropshipSupplierProperty.createMany({
          data: scope.map((propertyId) => ({ supplierId: created.id, propertyId })),
        });
      }
      return tx.dropshipSupplier.findUniqueOrThrow({
        where: { id: created.id },
        include: { siteScopes: { select: { propertyId: true } } },
      });
    });

    await publishEvent(
      publisher,
      'dropship.supplier.connected',
      tenantId,
      userId,
      { supplierId: supplier.id, type: body.type, connectionOk },
      pubLogger
    );

    return reply.status(201).send(ok(toSupplierView(supplier)));
  });

  // ── Get one supplier ─────────────────────────────────────────────────────────

  app.get('/v1/dropship/suppliers/:id', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);

    const supplier = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { siteScopes: { select: { propertyId: true } } },
      });
    });
    if (!supplier) throw notFound('Supplier not found');

    return reply.send(ok(toSupplierView(supplier)));
  });

  // ── Update supplier ──────────────────────────────────────────────────────────

  app.patch('/v1/dropship/suppliers/:id', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);
    const body = SupplierPatchBody.parse(request.body);

    const existing = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.findFirst({ where: { id, tenantId, deletedAt: null } });
    });
    if (!existing) throw notFound('Supplier not found');

    // Credentials are write-only — the dashboard never receives stored secrets,
    // so an edit only carries the fields the user actually (re-)entered. MERGE
    // those over the stored bag so blank/omitted keys keep their value rather
    // than wiping the connection. An edit that touches no credential field leaves
    // both the secrets and the status untouched.
    const incoming = body.credentials ?? {};
    const mergedCreds =
      Object.keys(incoming).length > 0
        ? { ...((existing.credentials as Record<string, string>) ?? {}), ...incoming }
        : null;

    let newStatus: string | undefined;
    if (mergedCreds) {
      try {
        const adapter = createAdapter(existing.type, mergedCreds);
        const ok2 = await adapter.authenticate(mergedCreds);
        newStatus = ok2 ? 'active' : 'error';
      } catch {
        newStatus = 'error';
      }
    }

    const updated = await withTenant({ tenantId }, async (tx) => {
      await tx.dropshipSupplier.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(mergedCreds && { credentials: mergedCreds }),
          ...(body.pricingRule !== undefined && {
            pricingRule: body.pricingRule ?? Prisma.JsonNull,
          }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(newStatus !== undefined && { status: newStatus }),
        },
      });
      // Replace the site-scope set when provided. An explicit empty array clears
      // all rows → the connection reverts to serving every site.
      if (body.siteScope !== undefined) {
        const scope = await resolveSiteScope(tx, tenantId, body.siteScope);
        await tx.dropshipSupplierProperty.deleteMany({ where: { supplierId: id } });
        if (scope.length > 0) {
          await tx.dropshipSupplierProperty.createMany({
            data: scope.map((propertyId) => ({ supplierId: id, propertyId })),
          });
        }
      }
      return tx.dropshipSupplier.findUniqueOrThrow({
        where: { id },
        include: { siteScopes: { select: { propertyId: true } } },
      });
    });

    return reply.send(ok(toSupplierView(updated)));
  });

  // ── Disconnect supplier ──────────────────────────────────────────────────────

  app.delete('/v1/dropship/suppliers/:id', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);

    const existing = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.findFirst({ where: { id, tenantId, deletedAt: null } });
    });
    if (!existing) throw notFound('Supplier not found');

    await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'disconnected' },
      });
    });

    return reply.status(204).send();
  });

  // ── Trigger catalog sync ─────────────────────────────────────────────────────

  app.post('/v1/dropship/suppliers/:id/sync', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId, userId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);

    const supplier = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { siteScopes: { select: { propertyId: true } } },
      });
    });
    if (!supplier) throw notFound('Supplier not found');
    if (supplier.status === 'error') {
      throw badRequest('Cannot sync a supplier in error state', 'SUPPLIER_ERROR');
    }

    await publishEvent(
      publisher,
      'dropship.supplier.sync_started',
      tenantId,
      userId,
      { supplierId: id, type: supplier.type },
      pubLogger
    );

    // Close any pending publish handshake (e.g. Printify's "publishing" lock) as
    // part of the same Sync action. Resilient: a failure here never blocks the
    // catalog sync that was just queued.
    let publishesConfirmed = 0;
    try {
      const summary = await runPublishReconcile(supplier, tenantId, userId);
      publishesConfirmed = summary.confirmed;
    } catch (err) {
      request.log.warn({ err, supplierId: id }, 'dropship publish reconcile failed during sync');
    }

    return reply.send(ok({ supplierId: id, status: 'sync_queued', publishesConfirmed }));
  });

  // ── Reconcile pending publishes (unlock the supplier "publishing" state) ─────
  //
  // The publish handshake on its own — for a scheduler (poll-based) or a manual
  // "unstick publishing" action. Imports each product the supplier locked for
  // publish, then confirms it back so the supplier unlocks it and deep-links to
  // our listing. Surfaces per-product errors as a publish FAILURE to the supplier
  // so nothing stays stuck.
  app.post('/v1/dropship/suppliers/:id/reconcile-publishes', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId, userId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);

    const supplier = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { siteScopes: { select: { propertyId: true } } },
      });
    });
    if (!supplier) throw notFound('Supplier not found');
    if (supplier.status === 'error') {
      throw badRequest('Cannot reconcile a supplier in error state', 'SUPPLIER_ERROR');
    }

    const summary = await runPublishReconcile(supplier, tenantId, userId);
    return reply.send(ok({ supplierId: id, ...summary }));
  });

  // ── Browse supplier catalog (raw dropship_products) ──────────────────────────

  app.get('/v1/dropship/suppliers/:id/catalog', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);
    const query = CatalogQuery.parse(request.query);

    const supplier = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.findFirst({ where: { id, tenantId, deletedAt: null } });
    });
    if (!supplier) throw notFound('Supplier not found');

    const [products, total] = await withTenant({ tenantId }, async (tx) => {
      const where: Prisma.DropshipProductWhereInput = { tenantId, supplierId: id };
      if (query.q) where.title = { contains: query.q, mode: 'insensitive' };
      return Promise.all([
        tx.dropshipProduct.findMany({
          where,
          include: {
            links: {
              // `product.status` is the commerce PUBLISH state (draft/active/
              // archived) — what actually governs site visibility — as opposed to
              // the link's own status (active/discontinued). The dropship products
              // list shows the publish state so "imported" never reads as "live".
              select: {
                id: true,
                productId: true,
                status: true,
                product: { select: { status: true } },
              },
            },
          },
          orderBy: { importedAt: 'desc' },
          take: query.take,
          skip: query.skip,
        }),
        tx.dropshipProduct.count({ where }),
      ]);
    });

    return reply.send(
      paged(products.map(toDropshipProductView), { total, skip: query.skip, take: query.take })
    );
  });

  // ── Import a dropship product into the commerce catalog ──────────────────────
  //
  //   1. Look up the DropshipProduct row (must belong to this supplier + tenant).
  //   2. Apply the supplier's pricing rule (or an override from the request body).
  //   3. Create a commerce_products row + product_variants rows.
  //   4. Create a dropship_product_links row.
  //   5. Publish search.entity.changed so the product gets indexed.

  app.post('/v1/dropship/suppliers/:id/catalog/:productId/import', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId, userId } = toDropshipContext(request);
    const { id, productId } = PathIdProduct.parse(request.params);
    const body = ImportBody.parse(request.body ?? {});

    const [supplier, dropshipProduct] = await withTenant({ tenantId }, async (tx) => {
      return Promise.all([
        tx.dropshipSupplier.findFirst({
          where: { id, tenantId, deletedAt: null },
          include: { siteScopes: { select: { propertyId: true } } },
        }),
        tx.dropshipProduct.findFirst({
          where: { id: productId, supplierId: id, tenantId },
          include: {
            links: {
              where: { status: 'active' },
              select: { id: true, productId: true },
            },
          },
        }),
      ]);
    });

    if (!supplier) throw notFound('Supplier not found');
    if (!dropshipProduct) throw notFound('Dropship product not found');
    if (dropshipProduct.links.length > 0) {
      throw conflict('This product is already imported into your catalog', 'ALREADY_IMPORTED');
    }

    const pricingRule: PricingRule | null =
      body.pricingRuleOverride ?? (supplier.pricingRule as PricingRule | null) ?? null;

    const variants = dropshipProduct.variants as {
      supplierSku: string;
      title: string;
      options: Record<string, string>;
      costPriceCents: number;
      msrpCents: number | null;
      inventoryQuantity: number | null;
      weight: number | null;
      imageUrls?: string[];
    }[];

    const result = await withTenant({ tenantId }, (tx) =>
      createCommerceProductFromDropship(tx, {
        tenantId,
        supplierId: id,
        dropshipProductId: productId,
        title: dropshipProduct.title,
        description: dropshipProduct.description ?? null,
        productImages: (dropshipProduct.images as string[]) ?? [],
        variants,
        pricingRule,
        siteScopeIds: supplier.siteScopes.map((s) => s.propertyId),
      })
    );

    await publishEvent(
      publisher,
      'search.entity.changed',
      tenantId,
      userId,
      { entityType: 'product', recordId: result.productId, op: 'upsert' },
      pubLogger
    );

    return reply.status(201).send(
      ok({
        productId: result.productId,
        linkId: result.linkId,
        variantCount: result.variantCount,
      })
    );
  });

  // ── Re-sync an already-imported product from the supplier ────────────────────
  //
  // Refreshes the EXISTING commerce product in place (no duplicate, no SKU
  // churn): restores dropship availability (inStock + every variant's
  // inventoryPolicy → continue) and backfills supplier imagery when the product
  // has none. This is how items imported before an import-path fix — or whose
  // supplier photos changed — get corrected through the normal UI rather than a
  // manual DB edit.

  app.post('/v1/dropship/suppliers/:id/catalog/:productId/reimport', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId, userId } = toDropshipContext(request);
    const { id, productId } = PathIdProduct.parse(request.params);

    const [supplier, dropshipProduct] = await withTenant({ tenantId }, async (tx) => {
      return Promise.all([
        tx.dropshipSupplier.findFirst({ where: { id, tenantId, deletedAt: null } }),
        tx.dropshipProduct.findFirst({
          where: { id: productId, supplierId: id, tenantId },
          include: {
            links: { where: { status: 'active' }, select: { productId: true } },
          },
        }),
      ]);
    });

    if (!supplier) throw notFound('Supplier not found');
    if (!dropshipProduct) throw notFound('Dropship product not found');
    const commerceProductId = dropshipProduct.links[0]?.productId;
    if (!commerceProductId) {
      throw conflict('This product has not been imported yet', 'NOT_IMPORTED');
    }

    const result = await withTenant({ tenantId }, async (tx) => {
      // Dropship items are supplier-fulfilled — always orderable, never sold out.
      await tx.product.update({ where: { id: commerceProductId }, data: { inStock: true } });
      await tx.productVariant.updateMany({
        where: { productId: commerceProductId, deletedAt: null },
        data: { inventoryPolicy: 'continue' },
      });

      // Only backfill imagery when the product has none, so re-syncing never
      // duplicates images a merchant may have already curated. Backfills BOTH
      // the product-level gallery and the per-variant mockups (which earlier
      // imports dropped) — this is how a product imported before the per-variant
      // image fix gets its colour-specific photos through the normal UI.
      const existingImages = await tx.variantImage.count({
        where: { productId: commerceProductId },
      });
      let imagesAdded = 0;
      if (existingImages === 0) {
        const imageVariants = dropshipProduct.variants as {
          supplierSku: string;
          imageUrls?: string[];
        }[];
        const imageUrlsBySku = new Map(
          imageVariants.map((v) => [v.supplierSku, v.imageUrls ?? []])
        );
        // Map back onto the commerce variants by sku (sku = supplierSku).
        const commerceVariants = await tx.productVariant.findMany({
          where: { productId: commerceProductId, deletedAt: null },
          select: { id: true, sku: true },
        });
        const perVariantImages = commerceVariants.map((cv) => ({
          variantId: cv.id,
          imageUrls: imageUrlsBySku.get(cv.sku) ?? [],
        }));
        imagesAdded = await attachDropshipImages(
          tx,
          tenantId,
          commerceProductId,
          dropshipProduct.images,
          perVariantImages
        );
      }

      // Backfill the option lattice for products imported before options were
      // materialized — their variants exist but carry no ProductOption rows, so
      // the storefront shows no size/colour picker. Only when the product has
      // none, so a merchant's hand-curated options are never clobbered.
      let optionsAdded = 0;
      const existingOptions = await tx.productOption.count({
        where: { productId: commerceProductId },
      });
      if (existingOptions === 0) {
        const normalizedVariants = dropshipProduct.variants as {
          supplierSku: string;
          options: Record<string, string>;
        }[];
        const optionValueIdsBySku = await materializeDropshipOptions(
          tx,
          tenantId,
          commerceProductId,
          normalizedVariants
        );
        if (optionValueIdsBySku.size > 0) {
          // Map back onto the commerce variants by sku — import stamps each
          // variant's sku as its supplierSku, so the join is exact.
          const commerceVariants = await tx.productVariant.findMany({
            where: { productId: commerceProductId, deletedAt: null },
            select: { id: true, sku: true },
          });
          for (const cv of commerceVariants) {
            const ids = optionValueIdsBySku.get(cv.sku) ?? [];
            if (ids.length === 0) continue;
            await tx.productVariantOptionValue.createMany({
              data: ids.map((optionValueId) => ({ variantId: cv.id, optionValueId })),
              skipDuplicates: true,
            });
            optionsAdded += 1;
          }
        }
      }

      return { productId: commerceProductId, imagesAdded, optionsAdded };
    });

    await publishEvent(
      publisher,
      'search.entity.changed',
      tenantId,
      userId,
      { entityType: 'product', recordId: result.productId, op: 'upsert' },
      pubLogger
    );

    return reply.send(ok(result));
  });
};

export default dropshipSupplierRoutes;
