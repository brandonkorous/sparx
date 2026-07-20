// Content — everything you publish that isn't a product.

import {
  CornerUpRight,
  Database,
  FileText,
  Image as ImageIcon,
  Scale,
  Tags,
  User,
  Webhook,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { stub } from './stub';

export const CMS_SURFACES: SurfaceDefinition[] = [
  stub({
    key: 'cms.content.list',
    title: 'Content',
    module: 'cms',
    icon: FileText,
    order: 1,
    keywords: ['pages', 'posts', 'articles', 'blog', 'news'],
    body: 'Everything you have written — pages, posts, articles — whether it is published or still a draft.',
  }),

  /* ── Library ───────────────────────────────────────────────────────────── */
  stub({
    key: 'cms.media.list',
    title: 'Media',
    module: 'cms',
    icon: ImageIcon,
    section: 'Library',
    order: 10,
    keywords: ['images', 'photos', 'files', 'uploads', 'video'],
    body: 'Every image, file, and video you have uploaded, ready to drop into anything you write.',
  }),
  stub({
    key: 'cms.authors.list',
    title: 'Authors',
    module: 'cms',
    icon: User,
    section: 'Library',
    order: 11,
    keywords: ['writers', 'byline', 'contributors'],
    body: 'The people whose names appear on what you publish, with a photo and a short biography each.',
  }),
  stub({
    key: 'cms.taxonomy.list',
    title: 'Tags & topics',
    module: 'cms',
    icon: Tags,
    section: 'Library',
    order: 12,
    keywords: ['taxonomy', 'categories', 'labels'],
    body: 'The labels you file content under, so readers can find everything you have written on one subject.',
  }),

  /* ── Structure ─────────────────────────────────────────────────────────── */
  stub({
    key: 'cms.types.list',
    title: 'Content types',
    module: 'cms',
    icon: Database,
    section: 'Structure',
    order: 20,
    keywords: ['fields', 'schema', 'custom', 'model'],
    body: 'Define your own kinds of content — a recipe, a case study, a job listing — with exactly the fields each one needs.',
  }),
  stub({
    key: 'cms.redirects.list',
    title: 'Redirects',
    module: 'cms',
    icon: CornerUpRight,
    section: 'Structure',
    order: 21,
    keywords: ['301', 'moved', 'old links', 'broken'],
    body: 'When a page moves, a redirect sends anyone using the old link to the new one instead of a dead end.',
  }),

  /* ── Setup ─────────────────────────────────────────────────────────────── */
  stub({
    key: 'cms.legal.list',
    title: 'Legal pages',
    module: 'cms',
    icon: Scale,
    section: 'Setup',
    order: 30,
    keywords: ['privacy', 'terms', 'policy', 'cookies', 'returns policy'],
    body: 'Your privacy policy, terms, and the other pages you are expected to publish — kept up to date for you.',
  }),
  stub({
    key: 'cms.webhooks.list',
    title: 'Webhooks',
    module: 'cms',
    icon: Webhook,
    section: 'Setup',
    order: 31,
    keywords: ['notify', 'api', 'developer', 'integration'],
    body: 'Tells another system every time you publish something. Useful if a developer is building on top of your content.',
  }),
];
