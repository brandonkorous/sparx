// Framer.
//
// Framer exports one CSV per CMS collection with the tenant's own field names as
// headers, so — like Webflow — there is no fixed schema to match. The one reliable
// marker is that Framer always emits `Slug` alongside a title-ish first column and
// writes its date fields in ISO.
//
// Because a Framer collection is arbitrary, unknown columns are carried through as
// custom properties rather than dropped. A tenant's "Case Studies" collection with
// `Client`, `Sector` and `Result` columns is not a blog post with three fields
// missing — it is the thing they came here to move.

import type { CanonicalRow } from '../canonical';
import { clean } from '../coerce';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { pick, row, tags } from './_helpers';

const FRAMER_SYSTEM = new Set(
  ['Slug', 'Title', 'Name', 'Published', 'Draft', 'Date', 'Updated', 'Created'].map((header) =>
    header.toLowerCase()
  )
);

const BODY_FIELDS = ['Content', 'Body', 'Article', 'Post', 'Text'];
const IMAGE_FIELDS = ['Image', 'Cover', 'Thumbnail', 'Featured Image'];

function mapContent(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const mapped = row({
      title: pick(source, 'Title', 'Name'),
      slug: pick(source, 'Slug'),
      type: 'post',
      body: pick(source, ...BODY_FIELDS),
      excerpt: pick(source, 'Excerpt', 'Description', 'Summary'),
      status: pick(source, 'Draft').toLowerCase() === 'true' ? 'draft' : 'published',
      published_at: pick(source, 'Date', 'Published', 'Created'),
      updated_at: pick(source, 'Updated'),
      author: pick(source, 'Author'),
      tags: tags(pick(source, 'Tags', 'Category', 'Categories')),
      featured_image_url: pick(source, ...IMAGE_FIELDS),
    });

    for (const [header, value] of Object.entries(source)) {
      if (FRAMER_SYSTEM.has(header.toLowerCase())) continue;
      if (BODY_FIELDS.includes(header) || IMAGE_FIELDS.includes(header)) continue;
      const text = clean(value);
      if (text === '' || mapped[header] !== undefined) continue;
      mapped[`custom:${header}`] = text;
    }

    return mapped;
  });
}

export const framer: VendorAdapter = {
  slug: 'framer',
  name: 'Framer',
  kind: 'site',
  sources: [
    {
      id: 'framer.content',
      entity: 'content',
      label: 'A CMS collection',
      file: 'Blog.csv',
      where: 'CMS → pick a collection → ⋯ → Export CSV',
      format: 'csv',
      required: ['Slug'],
      hints: ['Draft', 'Published', 'Title'],
      map: mapContent,
    },
  ],
};

export const framerInternals = { mapContent };
