// Placeholder canvas data — the resolver root silica reads bindings against.
//
// The binding catalog says what a page CAN bind to; this shapes typed placeholder
// records to that catalog so every offered path resolves to something believable
// on the canvas (a bound heading reads a sample title, a product repeater renders
// three cards). Real records arrive on the live site — the Preview action opens
// it. Pure + deterministic (no Date.now / Math.random) so the canvas is stable.
//
// A lean sibling of the dashboard's `buildPreviewData`, built fresh for the
// workbench off the SAME `DataSource`/`FieldSchema` shapes from
// `@sparx/builder-schemas`.

import type { DataSource, DataSources, FieldSchema } from '@sparx/builder-schemas';

/** The tenant's REAL site-chrome identity, shaped exactly like the storefront's
 *  `site.identity` resolver root — so a bound Wordmark/logo/name on the frame
 *  previews the actual brand instead of a placeholder. */
export interface SiteIdentityPreview {
  name: string;
  /** `null`, not '' — an empty string is a known-but-empty value the resolver fills
   *  OVER the authored content, blanking the node. */
  tagline: string | null;
  logo: { url: string; alt: string } | null;
  logoDark: { url: string; alt: string } | null;
}

/** The tenant's real `site.*` chrome data — identity + social links — overlaid onto
 *  the placeholder preview data so the canvas header AND footer match the live site. */
export interface SitePreviewData {
  identity: SiteIdentityPreview;
  social: { platform: string; url: string }[];
}

const SAMPLE_TITLES = [
  'Built for the work',
  'A closer look at the craft',
  'Notes from the field',
  'Made to last',
  'The details that matter',
];
const SAMPLE_LINES = [
  'A short, human sentence standing in for the real copy.',
  'Placeholder text — the writer fills this in from the module form.',
  'Just enough preview copy to see the layout breathe.',
];
const SAMPLE_PARAS = [
  'A longer passage would run here. The template decides how it looks; the writer supplies the words in the module.',
  'Two or three sentences of body copy — enough to show measure and rhythm. Real content replaces this once the record is filled.',
];

function pick(arr: string[], i: number): string {
  return arr[i % arr.length] ?? '';
}

function titleish(key: string): boolean {
  return /(title|name|heading|headline|label|question)/i.test(key);
}

function imageValue(f: FieldSchema, i: number): { url: string; alt: string; description: string } {
  return { url: '', alt: `${f.label || 'Image'} ${i + 1}`, description: '' };
}

function placeholder(f: FieldSchema, i: number): unknown {
  switch (f.kind) {
    case 'richtext':
      return pick(SAMPLE_PARAS, i);
    case 'number':
      return /price/i.test(f.key) ? 24 + i * 10 : i + 1;
    case 'boolean':
      return i % 2 === 0;
    case 'date':
      return '2026-01-15';
    case 'option':
      return f.cardinality === 'array' ? ['Sample', 'Tag'] : 'Sample';
    case 'reference':
      return f.cardinality === 'array' ? [`${f.label} A`, `${f.label} B`] : `${f.label}`;
    case 'image':
      return imageValue(f, i);
    case 'images':
      return [0, 1, 2].map((k) => imageValue(f, k));
    case 'file':
      return { url: '', name: `${f.label || 'file'}.pdf` };
    case 'group':
      return buildRecord(f.fields ?? [], i);
    case 'list':
      return [0, 1].map((k) => buildRecord(f.fields ?? [], k));
    case 'text':
    default:
      return titleish(f.key) ? pick(SAMPLE_TITLES, i) : pick(SAMPLE_LINES, i);
  }
}

function buildRecord(fields: FieldSchema[], i: number): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const f of fields) rec[f.key] = placeholder(f, i);
  return rec;
}

function setAtPath(root: DataSources, dottedKey: string, value: unknown): void {
  const segs = dottedKey.split('.');
  let cursor = root as Record<string, unknown>;
  for (let i = 0; i < segs.length - 1; i += 1) {
    const seg = segs[i] ?? '';
    const next = cursor[seg];
    if (typeof next !== 'object' || next === null) cursor[seg] = {};
    cursor = cursor[seg] as Record<string, unknown>;
  }
  cursor[segs[segs.length - 1] ?? ''] = value;
}

/** Build placeholder data shaped to the catalog so every offered binding path
 *  resolves: an array source → 3 placeholder records; a record source → one. When
 *  the tenant's real chrome is supplied it OVERRIDES the synthetic `site.identity` +
 *  `site.social`, so the header (Logo/Wordmark) and footer (SocialLinks) preview the
 *  actual brand/links, matching the live site instead of placeholder text. */
export function buildPreviewRoot(
  sources: readonly DataSource[],
  site?: SitePreviewData | null
): DataSources {
  const root: DataSources = {};
  for (const s of sources) {
    const value =
      s.cardinality === 'array'
        ? [0, 1, 2].map((i) => buildRecord(s.fields, i))
        : buildRecord(s.fields, 0);
    setAtPath(root, s.key, value);
  }
  // Real chrome wins over the placeholder. Set even when the catalog has no `site.*`
  // source, so the frame's bound header/footer still resolve; `site.social` is
  // overwritten even when empty (SocialLinks then falls back to its own clean
  // placeholder icons rather than synthetic record garbage).
  if (site) {
    setAtPath(root, 'site.identity', site.identity);
    setAtPath(root, 'site.social', site.social);
  }
  return root;
}
