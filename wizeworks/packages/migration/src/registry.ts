// The catalogue — what we can take from whom, computed rather than written down.
//
// This module is the reason `@wizeworks/migration` is a package instead of living inside
// the worker. The marketing site imports it, the workbench imports it, and the API
// serves it, so all three describe the same capability. A page cannot promise that we
// bring Squarespace orders unless a Squarespace adapter actually maps orders — the
// list is derived from the adapters, not maintained beside them.
//
// That constraint is not pedantry. The `/migrate` page shipped before this work
// advertised Shopify, HubSpot, Mailchimp and WordPress importers that did not exist,
// because the claim and the capability had no connection to each other. This is the
// connection.

import { ENTITY_LABEL, ENTITY_MODULE, type CanonicalEntity } from './canonical';
import type { VendorKind } from './types';
import { VENDORS, getVendor } from './vendors';

export interface SourceSummary {
  id: string;
  entity: CanonicalEntity;
  /** Entities this one file yields, for a multi-entity source like a WXR. */
  yields: readonly CanonicalEntity[];
  label: string;
  file: string;
  where: string;
  format: 'csv' | 'xml' | 'json';
}

export interface VendorCapability {
  slug: string;
  name: string;
  kind: VendorKind;
  /** Every entity this vendor's files can produce, de-duplicated and ordered. */
  entities: CanonicalEntity[];
  /** Plain-language list for a marketing page: 'Products', 'Stock levels', … */
  brings: string[];
  sources: SourceSummary[];
  /** Whether a live API pull exists as well as the file path. */
  hasConnector: boolean;
  /** Modules a tenant needs on for the whole import to land. */
  modules: string[];
}

/** Stable display order for entities, so every page lists them the same way. */
const ENTITY_ORDER: readonly CanonicalEntity[] = [
  'products',
  'inventory_levels',
  'categories',
  'collections',
  'customers',
  'companies',
  'orders',
  'deals',
  'tickets',
  'segments',
  'discounts',
  'suppliers',
  'purchase_orders',
  'b2b_accounts',
  'content',
  'media',
  'redirects',
];

function orderEntities(entities: Iterable<CanonicalEntity>): CanonicalEntity[] {
  const set = new Set(entities);
  return ENTITY_ORDER.filter((entity) => set.has(entity));
}

export function vendorCapability(slug: string): VendorCapability | undefined {
  const vendor = getVendor(slug);
  if (vendor === undefined) return undefined;

  const entities = new Set<CanonicalEntity>();
  const sources: SourceSummary[] = [];

  for (const source of vendor.sources) {
    const yields = source.yields ?? [source.entity];
    for (const entity of yields) entities.add(entity);
    sources.push({
      id: source.id,
      entity: source.entity,
      yields,
      label: source.label,
      file: source.file,
      where: source.where,
      format: source.format,
    });
  }

  const ordered = orderEntities(entities);
  const modules = new Set<string>();
  for (const entity of ordered) {
    const module = ENTITY_MODULE[entity];
    if (module !== null) modules.add(module);
  }

  return {
    slug: vendor.slug,
    name: vendor.name,
    kind: vendor.kind,
    entities: ordered,
    brings: ordered.map((entity) => ENTITY_LABEL[entity].many),
    sources,
    hasConnector: vendor.connector !== undefined,
    modules: [...modules].sort(),
  };
}

/** The whole catalogue, in roster order. */
export function catalogue(): VendorCapability[] {
  return VENDORS.map((vendor) => vendorCapability(vendor.slug)).filter(
    (capability): capability is VendorCapability => capability !== undefined
  );
}

/** Vendors grouped by what a tenant is currently paying them to be. */
export function catalogueByKind(): {
  kind: VendorKind;
  label: string;
  vendors: VendorCapability[];
}[] {
  const labels: Record<VendorKind, string> = {
    commerce: 'Online stores',
    site: 'Website builders',
    cms: 'Publishing platforms',
    crm: 'CRMs',
    email: 'Email marketing',
  };
  const order: VendorKind[] = ['commerce', 'site', 'cms', 'crm', 'email'];
  const all = catalogue();
  return order.map((kind) => ({
    kind,
    label: labels[kind],
    vendors: all.filter((vendor) => vendor.kind === kind),
  }));
}

/** Every vendor slug — for `generateStaticParams` on the marketing pages. */
export function vendorSlugs(): string[] {
  return VENDORS.map((vendor) => vendor.slug);
}
