// One published piece as an email card: the fields a content rail binds (`title`,
// `excerpt`, `imageUrl`, `url`), read from whatever the piece's KIND calls them.
//
// The rail (`contentRail` in builder-schemas) was written for the blog, so the send read
// `featuredImage` for the picture and `excerpt` for the line under the title, and built
// the link as `/<kind>/<slug>`. The Marrow Review's Article kind calls its picture
// `heroImage` and its summary `standfirst`, and serves pieces at `/articles/<slug>`: her
// newsletter would have gone out with no pictures, no standfirsts, and a 404 behind every
// headline (Piggles persona P09).

interface KindField {
  key: string;
  type: string;
}

/** The fields a kind declares, from its stored schema. Anything unreadable is none. */
export function kindFieldsOf(schemaJson: unknown): KindField[] {
  const fields = (schemaJson as { fields?: unknown } | null)?.fields;
  if (!Array.isArray(fields)) return [];
  return fields.flatMap((field) => {
    const f = field as { key?: unknown; type?: unknown };
    return typeof f.key === 'string' && typeof f.type === 'string'
      ? [{ key: f.key, type: f.type }]
      : [];
  });
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** The words a kind names its headline, summary and picture, most specific first. */
const TITLE_KEYS = ['title', 'name', 'heading'];
const SUMMARY_KEYS = ['excerpt', 'standfirst', 'summary', 'description', 'dek'];
const IMAGE_KEYS = ['featuredImage', 'heroImage', 'image', 'photo', 'cover'];

/** The first named key that holds words, then the first field of `type` that does. */
function pick(
  body: Record<string, unknown>,
  keys: string[],
  fields: KindField[],
  type: string
): string {
  for (const key of keys) {
    const value = str(body[key]);
    if (value) return value;
  }
  for (const field of fields) {
    if (field.type !== type) continue;
    const value = str(body[field.key]);
    if (value) return value;
  }
  return '';
}

/**
 * The card fields for one piece. `imageId` is the stored picture (a media id or an
 * absolute URL) for the caller to turn into an address; the body's own fields stay on
 * the card too, so a rail bound to any of them still fills.
 */
export function contentCard(
  body: Record<string, unknown>,
  fields: KindField[]
): Record<string, unknown> & { title: string; excerpt: string; imageId: string } {
  return {
    ...body,
    title: pick(body, TITLE_KEYS, fields, 'text'),
    excerpt: pick(body, SUMMARY_KEYS, fields, 'long_text'),
    imageId: pick(body, IMAGE_KEYS, fields, 'asset'),
  };
}
