// The adapter contract.
//
// A vendor adapter is a pure function plus a fingerprint. It knows one competitor's
// export format and nothing else — not our database, not our services, not even which
// tenant it is running for. That constraint is what makes twenty of them maintainable:
// an adapter can be read, reasoned about and tested in isolation, and a change to how
// products are stored cannot break Shopify's column mapping.

import type { CanonicalEntity, CanonicalRow } from './canonical';
import type { SourceRow } from './parse/csv';

/** What a tenant is currently paying this vendor to be. Drives grouping in the UI
 *  and on the marketing site — somebody leaving Mailchimp and somebody leaving
 *  Magento are not looking for the same page. */
export type VendorKind = 'commerce' | 'site' | 'cms' | 'crm' | 'email';

export type SourceFormat = 'csv' | 'xml' | 'json';

export interface VendorSource {
  /** `<vendor>.<what>`, stable and persisted in a run's options. */
  id: string;
  entity: CanonicalEntity;
  /** What this file is, in the tenant's words: 'Products', 'Contacts'. */
  label: string;
  /** The vendor's own file name, shown verbatim because that is what they will see
   *  in their downloads folder. */
  file: string;
  /** Where to click, in the vendor's own menu language. */
  where: string;
  format: SourceFormat;
  /**
   * Headers that must ALL be present for this source to match.
   *
   * Chosen to be the columns that vendor emits and nobody else does — matching on
   * `Title` would claim half the roster. Compared case-insensitively with whitespace
   * collapsed, because exports differ on both between versions.
   */
  required: readonly string[];
  /** Headers that raise confidence when present. Never required. */
  hints?: readonly string[];
  /** Filename shape that also identifies this source, e.g. /products_export/i. */
  filePattern?: RegExp;
  /**
   * A marker tested against the first few KB of an XML/JSON file.
   *
   * WordPress, WooCommerce and Squarespace all emit the SAME format, so headers and
   * filenames cannot tell them apart — but each writes its own name into the
   * `<generator>` element, which is the only reliable discriminator.
   */
  vendorMarker?: RegExp;
  /** Delimited sources: whole-file mapping, because a product spans rows. */
  map?: (rows: SourceRow[]) => CanonicalRow[];
  /** XML/JSON sources: the raw text, since there are no header rows to key off. */
  mapText?: (text: string) => CanonicalRow[];
  /**
   * One file, several entities.
   *
   * A WordPress export is not "a posts file" — it is the posts, the pages, the media
   * library, the categories and every old URL, in one document. Modelling that as
   * five sources would make the tenant upload the same file five times and would give
   * detection five indistinguishable candidates. So a source may instead declare that
   * it yields a map of entity → rows, and the run fans out into one job per entity.
   */
  mapAll?: (text: string) => Partial<Record<CanonicalEntity, CanonicalRow[]>>;
  /** Everything `mapAll` can produce, for the UI to list before the file is read. */
  yields?: readonly CanonicalEntity[];
}

export interface VendorAdapter {
  slug: string;
  /** How the vendor spells its own name. */
  name: string;
  kind: VendorKind;
  sources: readonly VendorSource[];
  /** Set when a live API pull exists as well as the file path. */
  connector?: 'shopify' | 'wordpress' | 'hubspot';
}

/** A source that carries a delimited mapper. */
export function isDelimited(source: VendorSource): source is VendorSource & {
  map: (rows: SourceRow[]) => CanonicalRow[];
} {
  return source.format === 'csv' && typeof source.map === 'function';
}

/** A source that reads raw text into one entity. */
export function isTextual(source: VendorSource): source is VendorSource & {
  mapText: (text: string) => CanonicalRow[];
} {
  return typeof source.mapText === 'function';
}

/** A source that reads raw text into several entities at once. */
export function isMultiEntity(source: VendorSource): source is VendorSource & {
  mapAll: (text: string) => Partial<Record<CanonicalEntity, CanonicalRow[]>>;
} {
  return typeof source.mapAll === 'function';
}
