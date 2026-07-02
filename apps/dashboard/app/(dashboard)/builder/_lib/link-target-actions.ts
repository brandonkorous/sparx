'use server';

// The shared LINK-TARGET picker's reads (docs/57 §10 "target picker"). One place
// an author turns "the thing I want to link to" into a real storefront href —
// reused by the Button/Link `href` field and the NavItem target. Rather than a
// flat "content" list, it is a REGISTRY of link-target SOURCES (a curated set of
// site destinations, plus searchable pages / products / collections / CMS
// entries): each source knows how to search the tenant's records and resolve one
// to a routable URL. Adding a linkable module is one registry entry, not a new
// picker.
//
// Href resolution matches the live site's routes EXACTLY (apps/site), so a picked
// target never 404s — including the blog caveat (blog entries live at
// `/blog/{slug}`, everything else page-typed at `/{slug}`), which the platform's
// own `buildNavTree` gets wrong and we deliberately don't copy. We STORE the
// resolved href string (docs/57 D3 — nav is href-first), so this only helps you
// FIND the url; the stored value stays a plain string, backward-compatible with
// everything that already takes an href.
//
// Sources are MODULE-GATED server-side (`listEnabledModules`) — a commerce-off
// tenant never sees a Products tab, a scheduling-off tenant never a "Book online"
// destination — because the studio has no client-reachable module list, and a
// hardcoded destination URL (unlike a searched record) can't degrade to empty.

import { listEnabledModules, type ModuleSlug } from '@sparx/auth';

import { api } from '@/lib/api-rest-client';

import { listPages } from './api';
import { getTenant } from '../_brand/lib/api';

// ── Public read shapes (mirror apps/site loaders + the public routes) ─────────

interface PublicProduct {
  id: string;
  title: string;
  handle: string;
}
interface PublicCollection {
  id: string;
  name: string;
  handle: string;
}
interface PublicCategory {
  id: string;
  name: string;
  handle: string;
}
interface WireCmsEntry {
  id: string;
  typeKey: string;
  slug: string | null;
  title: string | null;
}

// ── Picker contract (what crosses to the client control) ──────────────────────

/** The link-target families the picker can browse. `custom` is the freeform-URL
 *  escape hatch (handled entirely client-side, no server source). */
export type LinkTargetKind = 'destination' | 'page' | 'product' | 'collection' | 'category' | 'cms';

/** One search hit — everything a results row renders + the value it writes. */
export interface LinkTargetHit {
  /** Stable id — React key + selection identity (never stored on the node). */
  id: string;
  /** Primary label shown in the results row. */
  label: string;
  /** The resolved, routable href — this is what the control writes to the node. */
  href: string;
  /** Secondary line (path / type) to disambiguate similar labels. */
  sub?: string;
}

/** A browsable source (a tab in the picker) available to THIS tenant. */
export interface LinkTargetSource {
  kind: LinkTargetKind;
  label: string;
}

async function tenant(): Promise<{ id: string; slug: string }> {
  const t = await getTenant();
  return { id: t.id, slug: t.slug };
}

/** Case-insensitive "does this row match the typed query" for the sources with no
 *  server-side `q` (destinations, pages, collections). */
function matches(q: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

// ── Curated site destinations — the well-known routable pages authors link most
//    (nav "Shop" → /products, "Book now" → /book, cart, search, account). Each is
//    gated to the module that owns its route so it never 404s. ─────────────────

const DESTINATIONS: { label: string; href: string; module?: ModuleSlug }[] = [
  { label: 'Home', href: '/' },
  { label: 'All products', href: '/products', module: 'commerce' },
  { label: 'All collections', href: '/collections', module: 'commerce' },
  { label: 'Shop by category', href: '/category', module: 'commerce' },
  { label: 'Search', href: '/search', module: 'commerce' },
  { label: 'Cart', href: '/cart', module: 'commerce' },
  { label: 'Book online', href: '/book', module: 'scheduling' },
  { label: 'Account', href: '/account' },
];

// ── Source providers — one per family; all degrade to [] at the dispatch site ──

function searchDestinations(q: string, enabled: Set<string>): LinkTargetHit[] {
  return DESTINATIONS.filter((d) => !d.module || enabled.has(d.module))
    .filter((d) => matches(q, d.label, d.href))
    .map((d, i) => ({ id: `dest-${i}`, label: d.label, href: d.href, sub: d.href }));
}

/** Builder pages — the routable singletons (a home page has a null slug → `/`).
 *  Collection templates render per-record, not one URL, so they're excluded.
 *  Authed + per-site (the active site's pages), unlike the tenant-wide catalog
 *  sources below. */
async function searchPages(q: string): Promise<LinkTargetHit[]> {
  const pages = await listPages();
  return pages
    .filter((p) => p.kind === 'singleton')
    .filter((p) => matches(q, p.name, p.slug))
    .map((p) => ({
      id: p.id,
      label: p.slug ? p.name : `${p.name} (home)`,
      href: p.slug ? `/${p.slug}` : '/',
      sub: p.slug ? `/${p.slug}` : '/',
    }));
}

/** Products — the one source with real server-side search (`q` over title/desc). */
async function searchProducts(q: string, slug: string): Promise<LinkTargetHit[]> {
  const params = new URLSearchParams({ tenant: slug, perPage: '24' });
  if (q.trim()) params.set('q', q.trim());
  const { data } = await api.getPaged<PublicProduct[]>(
    `/v1/public/commerce/products?${params.toString()}`
  );
  return data.map((p) => ({
    id: p.id,
    label: p.title,
    href: `/products/${p.handle}`,
    sub: `/products/${p.handle}`,
  }));
}

/** Collections — full list, filtered in-action (no server `q`). */
async function searchCollections(q: string, slug: string): Promise<LinkTargetHit[]> {
  const data = await api.get<PublicCollection[]>(
    `/v1/public/commerce/collections?tenant=${encodeURIComponent(slug)}`
  );
  return data
    .filter((c) => matches(q, c.name, c.handle))
    .map((c) => ({
      id: c.id,
      label: c.name,
      href: `/collections/${c.handle}`,
      sub: `/collections/${c.handle}`,
    }));
}

/** Categories — full browse tree, filtered in-action (no server `q`). Resolves to
 *  the storefront browse-node route `/category/{handle}`. */
async function searchCategories(q: string, slug: string): Promise<LinkTargetHit[]> {
  const data = await api.get<PublicCategory[]>(
    `/v1/public/commerce/categories?tenant=${encodeURIComponent(slug)}`
  );
  return data
    .filter((c) => matches(q, c.name, c.handle))
    .map((c) => ({
      id: c.id,
      label: c.name,
      href: `/category/${c.handle}`,
      sub: `/category/${c.handle}`,
    }));
}

/** CMS entries — cross-type published search (`q` over title + slug). Blog posts
 *  route at `/blog/{slug}`, every other (page-typed) entry at `/{slug}` — the
 *  distinction the catch-all enforces and `buildNavTree` misses. Entries with no
 *  slug aren't routable, so they're dropped. */
async function searchCmsEntries(q: string): Promise<LinkTargetHit[]> {
  const params = new URLSearchParams({ status: 'published', take: '50' });
  if (q.trim()) params.set('q', q.trim());
  const data = await api.get<WireCmsEntry[]>(`/v1/content/entries?${params.toString()}`);
  return data
    .filter((e) => e.slug)
    .map((e) => {
      const href = e.typeKey === 'blog_post' ? `/blog/${e.slug}` : `/${e.slug}`;
      // `||` (not `??`) is intentional: an empty-string title falls through to the
      // slug, which `??` would keep.
      const title = e.title?.trim();
      return {
        id: e.id,
        label: title && title.length > 0 ? title : (e.slug ?? e.id),
        href,
        sub: `${e.typeKey} · ${href}`,
      };
    });
}

// ── Dispatch + discovery ──────────────────────────────────────────────────────

/** Search one source for link targets matching `q`. Degrades to [] on any failure
 *  (module off / empty / read error) so the picker stays usable. */
export async function searchLinkTargets(kind: LinkTargetKind, q: string): Promise<LinkTargetHit[]> {
  try {
    switch (kind) {
      case 'destination': {
        const { id } = await tenant();
        return searchDestinations(q, new Set(await listEnabledModules(id)));
      }
      case 'page':
        return await searchPages(q);
      case 'product':
        return await searchProducts(q, (await tenant()).slug);
      case 'collection':
        return await searchCollections(q, (await tenant()).slug);
      case 'category':
        return await searchCategories(q, (await tenant()).slug);
      case 'cms':
        return await searchCmsEntries(q);
    }
  } catch {
    return [];
  }
}

/** The link-target tabs available to this tenant — module-gated so the picker only
 *  offers what actually resolves. `custom` (freeform URL) is added client-side and
 *  is not returned here. Degrades to the always-on sources on any failure. */
export async function linkTargetSources(): Promise<LinkTargetSource[]> {
  const base: LinkTargetSource[] = [
    { kind: 'destination', label: 'Site pages' },
    { kind: 'page', label: 'Custom pages' },
  ];
  try {
    const { id } = await tenant();
    const enabled = new Set(await listEnabledModules(id));
    const gated: LinkTargetSource[] = [];
    if (enabled.has('commerce')) {
      gated.push({ kind: 'product', label: 'Products' });
      gated.push({ kind: 'collection', label: 'Collections' });
      gated.push({ kind: 'category', label: 'Categories' });
    }
    if (enabled.has('cms')) gated.push({ kind: 'cms', label: 'Content' });
    // Destination · Custom pages · [Products · Collections] · [Content]
    return [base[0]!, ...gated, base[1]!];
  } catch {
    return base;
  }
}
