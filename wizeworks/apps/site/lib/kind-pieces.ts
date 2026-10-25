// Pieces of a content KIND the tenant made, read at their web address.
//
// A journal's Article kind says its pieces live at `/articles/{slug}`. The sitemap, the
// RSS feed and site search all printed those links; nothing served them. This is the
// read behind the catch-all's kind route, and the one shape a piece takes on its page
// and on the cards that link to it, so the two never disagree about what a field says.

import {
  authorPath,
  kindAddressForPath,
  kindLayout,
  type ContentKindLike,
  type KindFieldLike,
} from '@wizeworks/silica-catalog';

import { formatPublishedDate, projectByline } from './builder-data';
import { publicGet, type ApiEntry } from './content';
import { readSlugOrNull } from './slug-miss';
import { mediaUrl } from './media';

export { getPublicKind, pieceUrl, type KindRow } from './kind-url';

/** A kind as the public read answers it: its names, its fields, and where its pieces
 *  live (`/articles/`). */
export interface PublicKind extends ContentKindLike {
  prefix: string;
  fields: KindFieldLike[];
}

/** The people a piece's credit fields name, by author id. */
export type CreditedPeople = Record<string, { display_name: string; slug: string }>;

export interface KindPiece {
  entry: ApiEntry;
  kind: PublicKind;
  /** Everyone its credit fields name ("Photograph by"), so they print as a name. */
  people?: CreditedPeople;
}

/** The piece at `path`, or null when no kind's piece lives there. A path that cannot be
 *  a kind's address (`/about`, `/products/x`) costs no request at all. */
export async function getKindPiece(
  tenantSlug: string,
  path: string,
  options: { previewToken?: string } = {}
): Promise<KindPiece | null> {
  if (!kindAddressForPath(path)) return null;
  const target = path.startsWith('/') ? path : `/${path}`;
  // A stale preview link still shows the published piece, like the post route.
  return readSlugOrNull(
    (withPreview) =>
      publicGet<KindPiece>(
        '/v1/public/content/entries/by-path',
        { tenant: tenantSlug, path: target },
        {
          ...(withPreview && options.previewToken ? { previewToken: options.previewToken } : {}),
          tag: `entry:${tenantSlug}:path:${target}`,
        }
      ),
    options.previewToken
  );
}

function formatDateTime(raw: unknown, timeZone: string | null, locale: string): string {
  if (typeof raw !== 'string' || raw === '') return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timeZone ?? 'UTC',
    timeZoneName: 'short',
  }).format(d);
}

/**
 * One field's value as a reader should see it.
 *
 * A picture is an asset id, which a reader cannot see: it becomes `{ url, alt }`. A
 * choice is stored as its value (`ledger`) and shown as its label (`Ledger`). A date is
 * stored as a machine date and shown as one a person reads. Missing is `null`, never `''`:
 * the page hides a node whose value is missing, but an empty string would blank the
 * words beside it instead.
 */
export function fieldValue(
  field: KindFieldLike,
  raw: unknown,
  tenantSlug: string,
  alt: string,
  timeZone: string | null = null,
  locale = 'en-US'
): unknown {
  if (raw === undefined || raw === null || raw === '') return null;
  switch (field.type) {
    case 'asset': {
      const ids = Array.isArray(raw) ? raw : [raw];
      const images = ids
        .map((id) => (typeof id === 'string' ? mediaUrl(id, tenantSlug) : null))
        .filter((url): url is string => url !== null)
        .map((url) => ({ url, alt }));
      if (field.multiple) return images.length > 0 ? images : null;
      return images[0] ?? null;
    }
    case 'enum': {
      const label = (v: unknown) =>
        field.options?.find((o) => o.value === v)?.label ?? (typeof v === 'string' ? v : null);
      if (Array.isArray(raw)) {
        const labels = raw.map(label).filter((l): l is string => !!l);
        return labels.length > 0 ? labels.join(', ') : null;
      }
      return label(raw);
    }
    // A date with no time is a calendar day, stored as that day's midnight UTC: read on
    // any other clock it can land on the day before.
    case 'date':
      return formatPublishedDate(typeof raw === 'string' ? raw : null, 'UTC', locale) || null;
    case 'datetime':
      return formatDateTime(raw, timeZone, locale) || null;
    case 'boolean':
      return raw === true ? 'Yes' : raw === false ? 'No' : null;
    case 'number':
      return typeof raw === 'number' ? String(raw) : raw;
    default:
      return raw;
  }
}

/** The headline field's value, for the page title and the pictures' alt text. */
export function pieceTitle(
  fields: readonly KindFieldLike[],
  body: Record<string, unknown>
): string {
  const key = kindLayout(fields).headline;
  const value = key ? body[key] : undefined;
  return typeof value === 'string' ? value : '';
}

/** The lede field's value, for the page description. */
export function pieceSummary(
  fields: readonly KindFieldLike[],
  body: Record<string, unknown>
): string {
  const key = kindLayout(fields).lede;
  const value = key ? body[key] : undefined;
  return typeof value === 'string' ? value : '';
}

/** The main picture's address, for the social card. */
export function pieceImage(
  fields: readonly KindFieldLike[],
  body: Record<string, unknown>,
  tenantSlug: string
): string | null {
  const key = kindLayout(fields).image;
  const value = key ? body[key] : undefined;
  return typeof value === 'string' ? mediaUrl(value, tenantSlug) : null;
}

/** The written body, for the article-body core. */
export function pieceDoc(fields: readonly KindFieldLike[], body: Record<string, unknown>): unknown {
  const key = kindLayout(fields).body;
  return key ? (body[key] ?? null) : null;
}

/**
 * A piece as the record its page binds — every field under its own key, shown the way a
 * reader reads it, plus what the row knows and the body does not: when it went out, who
 * wrote it, and where it lives. A field the kind defines wins over a derived one of the
 * same name (a kind with its own `date` field means that date).
 */
export function pieceRecord(
  entry: ApiEntry,
  fields: readonly KindFieldLike[],
  url: string,
  tenantSlug: string,
  timeZone: string | null = null,
  locale = 'en-US',
  people: CreditedPeople = {}
): Record<string, unknown> {
  const body = entry.body ?? {};
  const alt = pieceTitle(fields, body);
  const record: Record<string, unknown> = {
    id: entry.id,
    slug: entry.slug ?? '',
    url,
    date: formatPublishedDate(entry.published_at, timeZone, locale),
    publishedAt: entry.published_at ?? '',
    ...projectByline(entry, tenantSlug),
  };
  for (const field of fields) {
    if (field.type === 'author') {
      Object.assign(record, creditValue(field.key, body[field.key], people));
      continue;
    }
    record[field.key] = fieldValue(field, body[field.key], tenantSlug, alt, timeZone, locale);
  }
  return withPostWords(record, fields);
}

/**
 * A credit as the page prints it: the person's name under the field's key and the
 * address of their page beside it (`photographByUrl`). Someone not in `people` (deleted,
 * or on another site) is left out rather than printed as an id. A name typed before the
 * field credited an author ("Photograph by" was short text) still prints, unlinked,
 * until the piece is saved again. Several people read as one line, linked to the first.
 */
export function creditValue(
  key: string,
  raw: unknown,
  people: CreditedPeople
): Record<string, string | null> {
  const values = (Array.isArray(raw) ? raw : [raw]).filter(
    (v): v is string => typeof v === 'string' && v.trim() !== ''
  );
  const named = values.flatMap((v) => (people[v] ? [people[v]] : []));
  const typed = values.filter((v) => !people[v] && !ID_SHAPE.test(v));
  const names = [...named.map((p) => p.display_name), ...typed];
  return {
    [key]: names.length > 0 ? names.join(', ') : null,
    // Empty, not missing, for a typed name: the link loses its address and reads as text.
    [`${key}Url`]: named[0] ? authorPath(named[0].slug) : names.length > 0 ? '' : null,
  };
}

/** What a stored author id looks like, so an unknown one is never printed. */
const ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A piece of any kind, also answering to the words a blog-post card is written against:
 * `title`, `excerpt` and `featuredImage`, from the kind's own headline, lede and picture
 * (`kindLayout`).
 *
 * Designs ship their lists as blog-post cards. A journal that points one at its own
 * Articles ("What this list shows") should get each article's headline, standfirst and
 * photograph on those cards, not the card's placeholder words. A kind that defines one
 * of these keys itself keeps its own.
 */
export function withPostWords(
  record: Record<string, unknown>,
  fields: readonly KindFieldLike[]
): Record<string, unknown> {
  const layout = kindLayout(fields);
  const own = new Set(fields.map((f) => f.key));
  const alias = (name: string, from: string | null) => {
    if (from && !own.has(name) && record[from] !== undefined) record[name] = record[from];
  };
  alias('title', layout.headline);
  alias('excerpt', layout.lede);
  alias('featuredImage', layout.image);
  return record;
}
