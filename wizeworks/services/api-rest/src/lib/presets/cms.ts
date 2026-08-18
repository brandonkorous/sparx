// CMS module presets — content types, a topic taxonomy, and starter navigation.
//
// These live at the api-rest composition root (not in a `@wizeworks/cms` package —
// there isn't one; CMS write paths are route handlers over raw Prisma), so the
// preset `build` mirrors those routes: raw Prisma on the open tenant tx (`sx.tx`),
// tenant-scoped under the same RLS. The contract comes from @wizeworks/auth (api-rest
// already deps it), the field vocabulary from @wizeworks/cms-schemas.
//
// CMS activation seeds NOTHING per-tenant (built-in content types like `page` /
// `blog_post` live in the platform tenant and are shared via RLS), so every key
// below — faq / testimonial / recipe, the `topic` taxonomy, the header/footer
// menus — is purely additive and tenant-owned.
//
// Data-as-code (line-limit exempt).

import {
  ContentTypeSchema,
  type ContentTypeDefinition,
  type FieldDef,
} from '@wizeworks/cms-schemas';
import { definePreset, type ModulePreset } from '@wizeworks/auth';
import type { Prisma, TenantContext } from '@wizeworks/db';

// ContentTypeSchema is a plain JSON-shaped object (Prisma's InputJsonObject
// permits optional/undefined values), so it's assignable to the Json column type
// directly — no cast needed.
const asJson = (schema: ContentTypeSchema): Prisma.InputJsonValue => schema;

// ─── Field helpers (each returns one FieldDef in the @wizeworks/cms-schemas union) ──

const text = (key: string, label: string, required = false): FieldDef => ({
  type: 'text',
  key,
  label,
  required,
});
const longText = (key: string, label: string, required = false): FieldDef => ({
  type: 'long_text',
  key,
  label,
  required,
});
const richText = (key: string, label: string, required = false): FieldDef => ({
  type: 'rich_text',
  key,
  label,
  required,
});
const number = (
  key: string,
  label: string,
  opts: { integer?: boolean; min?: number; max?: number } = {}
): FieldDef => ({ type: 'number', key, label, ...opts });
const repeater = (key: string, label: string, fields: FieldDef[], itemLabel: string): FieldDef => ({
  type: 'repeater',
  key,
  label,
  itemLabel,
  fields,
});

// ─── Content types ────────────────────────────────────────────────────

/** The content-type definitions installed by the content-type presets. Exported
 *  so a unit test can validate each `schema` against ContentTypeSchema. */
export const CMS_CONTENT_TYPES: ContentTypeDefinition[] = [
  {
    key: 'faq',
    name: 'FAQ',
    pluralName: 'FAQs',
    description: 'A question-and-answer entry for a help center or product FAQ section.',
    icon: 'circle-help',
    schema: {
      fields: [
        text('question', 'Question', true),
        richText('answer', 'Answer', true),
        text('category', 'Category'),
      ],
    },
  },
  {
    key: 'testimonial',
    name: 'Testimonial',
    pluralName: 'Testimonials',
    description: 'A customer quote with attribution and an optional star rating.',
    icon: 'quote',
    schema: {
      fields: [
        text('author', 'Author', true),
        text('role', 'Role / company'),
        longText('quote', 'Quote', true),
        number('rating', 'Rating (1–5)', { integer: true, min: 1, max: 5 }),
      ],
    },
  },
  {
    key: 'recipe',
    name: 'Recipe',
    pluralName: 'Recipes',
    description: 'A cooking recipe with timings, servings, ingredients, and steps.',
    icon: 'chef-hat',
    schema: {
      fields: [
        longText('summary', 'Summary'),
        number('prepTime', 'Prep time (min)', { integer: true, min: 0 }),
        number('cookTime', 'Cook time (min)', { integer: true, min: 0 }),
        number('servings', 'Servings', { integer: true, min: 1 }),
        repeater(
          'ingredients',
          'Ingredients',
          [text('item', 'Item', true), text('amount', 'Amount')],
          'Ingredient'
        ),
        repeater('steps', 'Steps', [longText('instruction', 'Instruction', true)], 'Step'),
      ],
    },
  },
];

function contentTypePreset(def: ContentTypeDefinition): ModulePreset {
  const fieldCount = def.schema.fields.length;
  return definePreset({
    module: 'cms',
    slug: `content-${def.key}`,
    kind: 'content-types',
    name: `${def.name} content type`,
    description: def.description ?? `A ${def.name} content type.`,
    iconKey: def.icon ?? 'file-text',
    tags: ['cms', 'content-type', def.key],
    summary: [
      { label: def.pluralName, tone: 'neutral' },
      { label: `${fieldCount} fields`, tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.contentType
        .findFirst({ where: { tenantId, key: def.key }, select: { id: true } })
        .then(Boolean),
    build: async (sx: TenantContext) => {
      const created = await sx.tx!.contentType.create({
        data: {
          tenantId: sx.tenantId,
          key: def.key,
          name: def.name,
          pluralName: def.pluralName,
          description: def.description ?? null,
          icon: def.icon ?? null,
          urlPattern: def.urlPattern ?? null,
          isSingleton: def.isSingleton ?? false,
          isBuiltIn: false,
          schemaJson: asJson(def.schema),
        },
        select: { id: true },
      });
      return { id: created.id };
    },
  });
}

// ─── Taxonomy ─────────────────────────────────────────────────────────

const TOPIC_TERMS: { slug: string; name: string }[] = [
  { slug: 'news', name: 'News' },
  { slug: 'guides', name: 'Guides' },
  { slug: 'announcements', name: 'Announcements' },
  { slug: 'product-updates', name: 'Product updates' },
];

const topicTaxonomyPreset: ModulePreset = definePreset({
  module: 'cms',
  slug: 'taxonomy-topic',
  kind: 'taxonomy',
  name: 'Topic taxonomy',
  description:
    'A hierarchical “Topic” taxonomy seeded with News, Guides, Announcements, and Product updates — tag any content entry to organize and filter it.',
  iconKey: 'tags',
  tags: ['cms', 'taxonomy', 'topics'],
  summary: [
    { label: 'Hierarchical', tone: 'neutral' },
    { label: `${TOPIC_TERMS.length} starter terms`, tone: 'module' },
  ],
  marker: (tx, tenantId) =>
    tx.taxonomy
      .findFirst({ where: { tenantId, key: 'topic' }, select: { id: true } })
      .then(Boolean),
  build: async (sx: TenantContext) => {
    const taxonomy = await sx.tx!.taxonomy.create({
      data: {
        tenantId: sx.tenantId,
        key: 'topic',
        name: 'Topic',
        pluralName: 'Topics',
        hierarchical: true,
      },
      select: { id: true },
    });
    for (const term of TOPIC_TERMS) {
      await sx.tx!.taxonomyTerm.create({
        data: {
          tenantId: sx.tenantId,
          taxonomyId: taxonomy.id,
          parentTermId: null,
          slug: term.slug,
          name: term.name,
        },
      });
    }
    return { id: taxonomy.id };
  },
});

// ─── Navigation ───────────────────────────────────────────────────────

interface MenuDef {
  location: string;
  name: string;
  items: { label: string; url: string }[];
}

const STARTER_MENUS: MenuDef[] = [
  {
    location: 'header',
    name: 'Main menu',
    items: [
      { label: 'Home', url: '/' },
      { label: 'Shop', url: '/shop' },
      { label: 'Blog', url: '/blog' },
      { label: 'About', url: '/about' },
      { label: 'Contact', url: '/contact' },
    ],
  },
  {
    location: 'footer',
    name: 'Footer',
    items: [
      { label: 'About', url: '/about' },
      { label: 'Contact', url: '/contact' },
      { label: 'Privacy', url: '/privacy' },
      { label: 'Terms', url: '/terms' },
    ],
  },
];

const navStarterPreset: ModulePreset = definePreset({
  module: 'cms',
  slug: 'nav-starter',
  kind: 'navigation',
  name: 'Starter menus',
  description:
    'A header and footer navigation menu pre-filled with the common pages (Home, Shop, Blog, About, Contact, plus Privacy and Terms in the footer). Re-point or add links once your pages exist.',
  iconKey: 'menu',
  tags: ['cms', 'navigation', 'menu'],
  summary: [
    { label: 'Header + footer', tone: 'neutral' },
    { label: 'Common pages linked', tone: 'module' },
  ],
  // Installed ⇔ a tenant-wide header menu exists (the sentinel for this pair).
  marker: (tx, tenantId) =>
    tx.navigationMenu
      .findFirst({
        where: { tenantId, propertyId: null, location: 'header' },
        select: { id: true },
      })
      .then(Boolean),
  build: async (sx: TenantContext) => {
    let headerId: string | null = null;
    for (const menu of STARTER_MENUS) {
      const created = await sx.tx!.navigationMenu.create({
        data: { tenantId: sx.tenantId, propertyId: null, location: menu.location, name: menu.name },
        select: { id: true },
      });
      headerId ??= created.id;
      let position = 0;
      for (const item of menu.items) {
        await sx.tx!.navigationItem.create({
          data: {
            tenantId: sx.tenantId,
            menuId: created.id,
            parentItemId: null,
            position: position++,
            label: item.label,
            entryId: null,
            externalUrl: item.url,
            openInNewTab: false,
          },
        });
      }
    }
    // Non-null: STARTER_MENUS is a non-empty constant.
    return { id: headerId! };
  },
});

/** Every CMS module preset, in picker order (content types, taxonomy, navigation). */
export const cmsPresets: ModulePreset[] = [
  ...CMS_CONTENT_TYPES.map(contentTypePreset),
  topicTaxonomyPreset,
  navStarterPreset,
];

// Re-export so the composition-root preset test can validate each content-type
// schema against the real validator without importing the zod value elsewhere.
export { ContentTypeSchema };
