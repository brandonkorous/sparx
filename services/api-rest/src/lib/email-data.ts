// Email DataSources resolver (docs/52 §7, §9 Phase 4). Reads tenant data
// (commerce + CRM + CMS) and produces the `DataSources` map the Builder email
// renderer (`renderEmailTree`) resolves bindings against, keyed to match
// `EMAIL_SOURCES` in @sparx/builder-schemas.
//
// Lives in api-rest — the composition root that already has @sparx/commerce — so
// @sparx/email-platform (imported by the lean email-worker) stays commerce-free.
// Injected into the broadcast send path + the dispatch tick as the
// `resolveEmailData` callback (docs/52 §6).
//
// Two tiers of source (EMAIL_PERSONALIZED_ROOTS draws the line):
//   · per-recipient — recipient / order / cart / loyalty: resolved against THIS
//     recipient; rendered per recipient at dispatch (the broadcast defers).
//   · per-send      — commerce.product / promotion / cms.<type>: resolved once.
// Only the sources a tree actually binds are resolved (bindingSourceKey over the
// tree's binding paths), so a static email costs nothing and a products email
// doesn't touch the orders table.

import { withTenant } from '@sparx/db';
import { discountService, productService } from '@sparx/commerce';
import {
  bindingSourceKey,
  collectBindingPaths,
  type BuilderNode,
  type DataSources,
} from '@sparx/builder-schemas';
import type { ServiceContext } from '@sparx/email-platform';

/** The recipient a personalized email resolves against. Absent for a render-once
 *  (preview / non-personalized broadcast) — per-recipient sources then resolve
 *  empty, exactly like the section path. */
export interface EmailRecipientRef {
  email: string;
  customerId?: string | null;
}

// Public api-rest origin for media URLs (GET /v1/public/media/:id) — REST-specific
// (GraphQL doesn't serve bytes); see brand-service.ts. Falls back to the internal
// REST url only for local/dev.
const API_BASE =
  process.env.SPARX_PUBLIC_API_REST_URL ??
  process.env.SPARX_API_REST_URL ??
  'http://localhost:3100';
// Storefront base for clickable links. `{slug}` is substituted per tenant; unset
// → path-only links (still valid, refined once tenant domain resolution is wired).
const STOREFRONT_BASE = process.env.SPARX_STOREFRONT_BASE ?? '';

function mediaUrl(mediaId: string | null | undefined, slug: string): string {
  if (!mediaId) return '';
  return `${API_BASE}/v1/public/media/${encodeURIComponent(mediaId)}?tenant=${encodeURIComponent(slug)}`;
}

function storefrontUrl(slug: string, path: string): string {
  if (!STOREFRONT_BASE) return path;
  return `${STOREFRONT_BASE.replace('{slug}', slug)}${path}`;
}

function money(cents: number | null | undefined): string {
  if (cents == null) return '';
  return `$${(cents / 100).toFixed(2)}`;
}

function dateLabel(d: Date | null | undefined): string {
  return d
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
}

async function tenantSlug(ctx: ServiceContext): Promise<string> {
  const row = await withTenant(ctx, (tx) =>
    tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { slug: true } })
  );
  return row?.slug ?? '';
}

// ── Per-recipient sources ─────────────────────────────────────────────────────

async function resolveRecipient(
  ctx: ServiceContext,
  recipient: EmailRecipientRef | undefined
): Promise<Record<string, string>> {
  if (!recipient) return { firstName: '', lastName: '', email: '' };
  const customer = recipient.customerId
    ? await withTenant(ctx, (tx) =>
        tx.customer.findUnique({
          where: { id: recipient.customerId! },
          select: { firstName: true, lastName: true, email: true },
        })
      )
    : null;
  return {
    firstName: customer?.firstName ?? '',
    lastName: customer?.lastName ?? '',
    email: customer?.email ?? recipient.email,
  };
}

async function resolveRecentOrder(
  ctx: ServiceContext,
  recipient: EmailRecipientRef | undefined
): Promise<Record<string, string>> {
  const empty = { numberLabel: '', statusLabel: '', totalLabel: '', dateLabel: '' };
  if (!recipient?.customerId) return empty;
  const order = await withTenant(ctx, (tx) =>
    tx.order.findFirst({
      where: { customerId: recipient.customerId! },
      orderBy: { placedAt: 'desc' },
      select: { orderNumber: true, status: true, total: true, placedAt: true },
    })
  );
  if (!order) return empty;
  return {
    numberLabel: order.orderNumber,
    statusLabel: order.status,
    totalLabel: `$${Number(order.total).toFixed(2)}`,
    dateLabel: dateLabel(order.placedAt),
  };
}

async function resolveCart(
  ctx: ServiceContext,
  recipient: EmailRecipientRef | undefined
): Promise<Record<string, string>[]> {
  if (!recipient?.customerId) return [];
  const cart = await withTenant(ctx, (tx) =>
    tx.cart.findFirst({
      where: { customerId: recipient.customerId!, recoveredAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        items: {
          select: {
            unitPriceCents: true,
            variant: {
              select: {
                product: {
                  select: {
                    title: true,
                    // The product hero: explicit primary first, else first
                    // product-level image by position (parity with the product list).
                    images: {
                      where: { variantId: null },
                      orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
                      take: 1,
                      select: { mediaAssetId: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
  );
  const items = cart?.items ?? [];
  if (items.length === 0) return [];
  // Abandoned-cart line thumbnails now resolve from the product's primary image
  // (see [[project_product_primary_image]]). Resolved via the public-media endpoint
  // (mediaUrl), the same way CMS featured images resolve in this file.
  const slug = await tenantSlug(ctx);
  return items.map((it) => ({
    title: it.variant.product.title,
    priceLabel: money(it.unitPriceCents),
    imageUrl: mediaUrl(it.variant.product.images[0]?.mediaAssetId, slug),
  }));
}

async function resolveLoyalty(
  ctx: ServiceContext,
  recipient: EmailRecipientRef | undefined
): Promise<Record<string, string>> {
  // No points model exists — surface the store-credit balance (mirrors the
  // section loyalty resolver; revisit if a points engine lands).
  const empty = { pointsLabel: '', tierName: '' };
  if (!recipient?.customerId) return empty;
  const bal = await discountService.getStoreCreditBalance(ctx, recipient.customerId);
  if (!bal || bal.balanceCents <= 0) return empty;
  return { pointsLabel: money(bal.balanceCents), tierName: 'Store credit available' };
}

// ── Per-send sources ──────────────────────────────────────────────────────────

async function resolveProducts(
  ctx: ServiceContext,
  slug: string
): Promise<Record<string, string>[]> {
  // Newest active products — the email featured-products default. (Manual /
  // collection selection is a per-node config refinement; deferred.)
  const { items } = await productService.list(ctx, {
    status: 'active',
    take: 6,
    sortBy: 'createdAt',
  });
  // productService.list now resolves imageUrl from the product's primary image
  // (explicit flag, else first product-level image by position), so product emails
  // get thumbnails for free — see [[project_product_primary_image]].
  return items.map((p) => ({
    title: p.title,
    priceLabel: money(p.priceMinCents),
    imageUrl: p.imageUrl ?? '',
    url: storefrontUrl(slug, `/products/${p.handle}`),
  }));
}

async function resolvePromotion(ctx: ServiceContext): Promise<Record<string, string>> {
  const now = Date.now();
  const active = (await discountService.listDiscounts(ctx, { status: 'active' })).find((d) => {
    const startOk = !d.startAt || new Date(d.startAt).getTime() <= now;
    const endOk = !d.endAt || new Date(d.endAt).getTime() >= now;
    return startOk && endOk;
  });
  if (!active) return { title: '', body: '', ctaLabel: '', ctaHref: '' };
  return {
    title: active.name ?? '',
    body: active.description ?? '',
    ctaLabel: '',
    ctaHref: '',
  };
}

async function resolveCmsCollection(
  ctx: ServiceContext,
  slug: string,
  typeKey: string
): Promise<Record<string, unknown>[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.contentEntry.findMany({
      where: { typeKey, status: 'published', deletedAt: null },
      orderBy: { publishedAt: 'desc' },
      take: 6,
      select: { slug: true, body: true, publishedAt: true },
    })
  );
  return rows.map((r) => {
    const body = (r.body ?? {}) as Record<string, unknown>;
    const featured = typeof body.featuredImage === 'string' ? body.featuredImage : undefined;
    return {
      ...body,
      slug: r.slug ?? '',
      url: storefrontUrl(slug, `/${typeKey === 'blog_post' ? 'blog' : typeKey}/${r.slug ?? ''}`),
      imageUrl: featured ? mediaUrl(featured, slug) : '',
      dateLabel: dateLabel(r.publishedAt),
    };
  });
}

// ── Entry point ─────────────────────────────────────────────────────────────

/** Resolve only the sources an email tree binds, into the nested `DataSources`
 *  the renderer reads (`resolvePath` walks `root.<source>.…`). `recipient` is
 *  present for the per-recipient dispatch render and absent for render-once. */
export async function resolveEmailData(
  ctx: ServiceContext,
  tree: BuilderNode,
  recipient?: EmailRecipientRef
): Promise<DataSources> {
  const keys = new Set(collectBindingPaths(tree).map(bindingSourceKey).filter(Boolean));
  if (keys.size === 0) return {};

  const needsLinks = [...keys].some((k) => k === 'commerce.product' || k.startsWith('cms.'));
  const slug = needsLinks ? await tenantSlug(ctx) : '';

  const out: DataSources = {};
  const tasks: Promise<void>[] = [];

  if (keys.has('recipient')) {
    tasks.push(resolveRecipient(ctx, recipient).then((v) => void (out.recipient = v)));
  }
  if (keys.has('order')) {
    tasks.push(resolveRecentOrder(ctx, recipient).then((v) => void (out.order = v)));
  }
  if (keys.has('cart')) {
    tasks.push(resolveCart(ctx, recipient).then((v) => void (out.cart = v)));
  }
  if (keys.has('loyalty')) {
    tasks.push(resolveLoyalty(ctx, recipient).then((v) => void (out.loyalty = v)));
  }
  if (keys.has('commerce.product')) {
    tasks.push(
      resolveProducts(ctx, slug).then((v) => {
        const commerce = (out.commerce as Record<string, unknown>) ?? {};
        commerce.product = v;
        out.commerce = commerce;
      })
    );
  }
  if (keys.has('promotion')) {
    tasks.push(resolvePromotion(ctx).then((v) => void (out.promotion = v)));
  }
  for (const key of keys) {
    if (!key.startsWith('cms.')) continue;
    const typeKey = key.slice('cms.'.length);
    tasks.push(
      resolveCmsCollection(ctx, slug, typeKey).then((v) => {
        const cms = (out.cms as Record<string, unknown>) ?? {};
        cms[typeKey] = v;
        out.cms = cms;
      })
    );
  }

  await Promise.all(tasks);
  return out;
}

/** A `resolveEmailData` callback bound to a request's context — what the broadcast
 *  send path and the dispatch tick inject so @sparx/email-platform resolves email
 *  data without a @sparx/commerce dependency (docs/52 §6). */
export function emailDataResolver(ctx: ServiceContext) {
  return (tree: BuilderNode, recipient?: EmailRecipientRef): Promise<DataSources> =>
    resolveEmailData(ctx, tree, recipient);
}
