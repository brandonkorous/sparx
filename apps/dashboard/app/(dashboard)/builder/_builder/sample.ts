// The mock module data the editor composes from, plus the binding-picker paths.
//
// UI-FIRST phase: bindings resolve against this mock data so the canvas can
// prove the composition model (object binding that sets scope, array binding
// that ITERATES, per-leaf field binding) before the real schema keystone lands
// (docs/40 §5 / docs/41 §1 — "real data + schema keystone" is its own slice).
//
// The page TREES the editor opens with are no longer here — Sparx's curated
// starter pages live in @sparx/builder-schemas (STARTER_PAGES) and are seeded
// server-side on a tenant's first load (docs/41 §5). This file keeps only the
// mock binding sources + the picker vocabulary.

import type { DataSources } from './model';

// ── Active modules (drives the context bar + palette) ────────────────────────

export interface ModuleInfo {
  key: string;
  label: string;
  /** The module's brand color (docs/sparx-brand-guide). */
  color: string;
  on: boolean;
}

export const MODULES: ModuleInfo[] = [
  { key: 'cms', label: 'CMS', color: '#14b8a6', on: true },
  { key: 'commerce', label: 'Commerce', color: '#f97316', on: true },
  { key: 'crm', label: 'CRM', color: '#06b6d4', on: true },
  { key: 'events', label: 'Events', color: '#a855f7', on: false },
];

export function moduleColor(key: string | undefined): string {
  return MODULES.find((m) => m.key === key)?.color ?? '#6366f1';
}

// ── Mock data sources ────────────────────────────────────────────────────────

export const SAMPLE_DATA: DataSources = {
  // A singleton CMS page record (the page's own fields).
  page: {
    title: 'Field notes & finds',
    tagline: 'Essays on making things by hand — and a small shelf of tools we love.',
  },
  cms: {
    posts: [
      {
        title: 'The quiet geometry of a well-made bowl',
        excerpt: "Why the curve under the rim is the part you never notice — until it's wrong.",
        cover: { url: '', alt: 'A turned wooden bowl, side on', description: '' },
        tag: 'Craft',
        author: 'Maya R.',
        readMins: 6,
      },
      {
        title: 'Linen, after a hundred washes',
        excerpt: 'A field test that took three years and ruined two tablecloths.',
        cover: { url: '', alt: 'Folded linen in afternoon light', description: '' },
        tag: 'Materials',
        author: 'Devin K.',
        readMins: 4,
      },
      {
        title: 'Notes from a slow week',
        excerpt: 'On letting a piece sit unfinished long enough to hear it.',
        cover: { url: '', alt: 'A half-finished piece on the bench', description: '' },
        tag: 'Studio',
        author: 'Maya R.',
        readMins: 3,
      },
    ],
  },
  commerce: {
    products: [
      { title: 'Plush Cotton Towel', price: 34, image: { url: '', alt: 'Folded cotton towel' } },
      { title: 'Stoneware Mug', price: 22, image: { url: '', alt: 'Glazed stoneware mug' } },
      { title: 'Linen Apron', price: 48, image: { url: '', alt: 'Natural linen apron' } },
    ],
  },
  crm: {
    list: { name: 'Field Notes', subscribers: 1240 },
  },
  // Single sample records — the one the editor previews when you're editing a
  // CONTENT-TYPE-BOUND template (one template → many records). `post.*` for the
  // Blog post template, `product.*` for the Product page template.
  post: {
    title: 'The quiet geometry of a well-made bowl',
    excerpt: "Why the curve under the rim is the part you never notice — until it's wrong.",
    body: 'A longer essay would run here — the template decides how the post looks; the writer fills the words in the CMS.',
    cover: { url: '', alt: 'A turned wooden bowl, side on', description: '' },
    tag: 'Craft',
    author: 'Maya R.',
    readMins: 6,
  },
  product: {
    title: 'Plush Cotton Towel',
    price: 34,
    description: 'Long-staple cotton, woven heavy and washed soft. The kind you keep.',
    images: [
      { url: '', alt: 'Folded towel, front' },
      { url: '', alt: 'Towel weave, close up' },
      { url: '', alt: 'Towel on a rail' },
    ],
  },
};

/** Paths the binding picker offers, grouped by the module that supplies them.
 *  `item.*` paths are offered when the selected node sits inside an iterating
 *  or scope-setting container — the picker filters by what's in scope. */
export const BIND_PATHS: { module: string; paths: { path: string; label: string }[] }[] = [
  {
    module: 'cms',
    paths: [
      { path: 'page.title', label: 'page.title' },
      { path: 'page.tagline', label: 'page.tagline' },
      { path: 'cms.posts', label: 'cms.posts (list)' },
      { path: 'cms.posts[0]', label: 'cms.posts[0] (latest)' },
      { path: 'post.title', label: 'post.title (this record)' },
      { path: 'post.excerpt', label: 'post.excerpt' },
      { path: 'post.body', label: 'post.body' },
      { path: 'post.cover', label: 'post.cover' },
      { path: 'post.author', label: 'post.author' },
      { path: 'post.tag', label: 'post.tag' },
    ],
  },
  {
    module: 'commerce',
    paths: [
      { path: 'commerce.products', label: 'commerce.products (list)' },
      { path: 'product.title', label: 'product.title (this record)' },
      { path: 'product.price', label: 'product.price' },
      { path: 'product.images', label: 'product.images (gallery)' },
      { path: 'product.description', label: 'product.description' },
    ],
  },
  {
    module: 'crm',
    paths: [{ path: 'crm.list', label: 'crm.list' }],
  },
];

/** `item.*` paths offered when an `item` is in scope. */
export const ITEM_PATHS: { path: string; label: string }[] = [
  { path: 'item.title', label: 'item.title' },
  { path: 'item.excerpt', label: 'item.excerpt' },
  { path: 'item.cover', label: 'item.cover' },
  { path: 'item.image', label: 'item.image' },
  { path: 'item.price', label: 'item.price' },
  { path: 'item.tag', label: 'item.tag' },
  { path: 'item.author', label: 'item.author' },
  { path: 'item.name', label: 'item.name' },
  { path: 'index', label: 'index' },
];
