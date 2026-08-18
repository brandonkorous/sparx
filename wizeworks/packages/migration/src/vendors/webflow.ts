// Webflow.
//
// Webflow exports one CSV per CMS collection, and the columns ARE the collection's
// fields — which means the header row is different for every tenant and there is no
// fixed fingerprint to match on. Detection therefore keys on the four columns Webflow
// adds to every collection export (`Name`, `Slug`, `Collection ID`, `Item ID`), and
// everything else is carried through as-is.
//
// That variability is also why the content mapper keeps unknown columns rather than
// dropping them: a Webflow "Recipes" collection has `Cook time` and `Servings`, and a
// tenant who loses those on the way in has lost the collection.

import type { CanonicalRow } from '../canonical';
import { clean } from '../coerce';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { contentStatus, pick, row, tags } from './_helpers';

/** Field names Webflow puts on every collection export, so a mapper can tell the
 *  structural columns apart from the tenant's own fields. */
const WEBFLOW_SYSTEM = new Set(
  [
    'Name',
    'Slug',
    'Collection ID',
    'Item ID',
    'Created On',
    'Updated On',
    'Published On',
    'Archived',
    'Draft',
  ].map((header) => header.toLowerCase())
);

/** The likeliest body field, in order of how Webflow templates name them. */
const BODY_FIELDS = ['Post Body', 'Body', 'Content', 'Rich Text', 'Post Content', 'Description'];
const EXCERPT_FIELDS = ['Post Summary', 'Summary', 'Excerpt', 'Subtitle'];
const IMAGE_FIELDS = ['Main Image', 'Thumbnail Image', 'Image', 'Cover Image', 'Featured Image'];

function mapContent(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const archived = pick(source, 'Archived').toLowerCase() === 'true';
    const draft = pick(source, 'Draft').toLowerCase() === 'true';

    const mapped = row({
      title: pick(source, 'Name'),
      slug: pick(source, 'Slug'),
      type: 'post',
      body: pick(source, ...BODY_FIELDS),
      excerpt: pick(source, ...EXCERPT_FIELDS),
      status: archived ? 'archived' : draft ? 'draft' : contentStatus('publish'),
      published_at: pick(source, 'Published On'),
      updated_at: pick(source, 'Updated On'),
      featured_image_url: pick(source, ...IMAGE_FIELDS),
      author: pick(source, 'Author', 'Written By'),
      tags: tags(pick(source, 'Tags', 'Categories')),
      seo_title: pick(source, 'Meta Title', 'SEO Title'),
      seo_description: pick(source, 'Meta Description', 'SEO Description'),
    });

    // Carry the tenant's own fields through untouched. They land as custom properties
    // on the content entry rather than being dropped, because in Webflow they are the
    // entire reason the collection exists.
    for (const [header, value] of Object.entries(source)) {
      if (WEBFLOW_SYSTEM.has(header.toLowerCase())) continue;
      if (BODY_FIELDS.includes(header) || EXCERPT_FIELDS.includes(header)) continue;
      if (IMAGE_FIELDS.includes(header)) continue;
      const text = clean(value);
      if (text === '' || mapped[header] !== undefined) continue;
      mapped[`custom:${header}`] = text;
    }

    return mapped;
  });
}

function mapProducts(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const images = [
      pick(source, 'Main Image'),
      ...pick(source, 'More Images')
        .split(/[;,]/)
        .map((url) => url.trim()),
    ].filter((url) => url !== '');

    return row({
      handle: pick(source, 'Slug'),
      title: pick(source, 'Name', 'Product Name'),
      description: pick(source, 'Description', 'Product Description'),
      sku: pick(source, 'SKU'),
      status: pick(source, 'Draft').toLowerCase() === 'true' ? 'draft' : 'active',
      price: pick(source, 'Price'),
      compare_at_price: pick(source, 'Compare-at price', 'Compare At Price'),
      quantity: pick(source, 'Quantity'),
      track_inventory: pick(source, 'Track Inventory'),
      weight_grams: pick(source, 'Weight'),
      length_cm: pick(source, 'Length'),
      width_cm: pick(source, 'Width'),
      height_cm: pick(source, 'Height'),
      collections: pick(source, 'Category', 'Categories'),
      option1_name: pick(source, 'Option 1 Name'),
      option1_value: pick(source, 'Option 1 Value'),
      option2_name: pick(source, 'Option 2 Name'),
      option2_value: pick(source, 'Option 2 Value'),
      images: images.join(', '),
      image_url: images[0],
      seo_title: pick(source, 'Meta Title'),
      seo_description: pick(source, 'Meta Description'),
      source_url: pick(source, 'Slug') === '' ? '' : `/product/${pick(source, 'Slug')}`,
    });
  });
}

export const webflow: VendorAdapter = {
  slug: 'webflow',
  name: 'Webflow',
  kind: 'site',
  sources: [
    {
      id: 'webflow.products',
      entity: 'products',
      label: 'Products',
      file: 'Products.csv',
      where: 'Ecommerce → Products → Export',
      format: 'csv',
      required: ['Item ID', 'SKU', 'Price'],
      hints: ['Compare-at price', 'Track Inventory', 'More Images'],
      map: mapProducts,
    },
    {
      id: 'webflow.content',
      entity: 'content',
      label: 'A CMS collection',
      file: 'Blog Posts.csv',
      where: 'CMS → pick a collection → Export',
      format: 'csv',
      required: ['Name', 'Slug', 'Collection ID', 'Item ID'],
      hints: ['Archived', 'Draft', 'Published On'],
      map: mapContent,
    },
  ],
};

export const webflowInternals = { mapContent, mapProducts };
