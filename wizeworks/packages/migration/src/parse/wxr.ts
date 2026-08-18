// WordPress eXtended RSS.
//
// WXR matters far past WordPress itself: Squarespace and WooCommerce both emit it,
// because both cloned WordPress's exporter rather than inventing a format. One reader
// therefore covers three vendors on the roster, and it is the only path that brings a
// tenant's actual writing — years of posts, with their slugs, dates and authors — off
// a competitor. A catalogue is replaceable. A blog archive is not.
//
// The file is one `<item>` per thing, discriminated by `wp:post_type`:
//
//   post / page     the content
//   attachment      an uploaded file, with the real URL in `wp:attachment_url`
//   nav_menu_item   menu structure — skipped, since the tenant is rebuilding nav here
//   product         WooCommerce products, which the product CSV covers far better
//   revision        every intermediate save; importing these would multiply the
//                   tenant's content by ten and is the single most common way a
//                   WordPress import produces garbage
//
// Statuses matter as much as types. `trash` is content the tenant deleted, and
// `inherit` marks a revision — importing either is importing something the tenant
// already decided they did not want.

import type { CanonicalRow } from '../canonical';
import { toIsoDate } from '../coerce';
import { child, childText, children, metaValue, parseXml, type XmlNode } from './xml';

export interface WxrDocument {
  siteTitle: string;
  siteUrl: string;
  content: CanonicalRow[];
  media: CanonicalRow[];
  categories: CanonicalRow[];
  redirects: CanonicalRow[];
  authors: CanonicalRow[];
}

const SKIP_TYPES = new Set([
  'nav_menu_item',
  'revision',
  'custom_css',
  'customize_changeset',
  'wp_global_styles',
  'wp_navigation',
  'wp_template',
  'wp_template_part',
  'oembed_cache',
  'user_request',
  'scheduled-action',
  'shop_order_refund',
]);

const SKIP_STATUSES = new Set(['trash', 'inherit', 'auto-draft', 'spam']);

function statusOf(item: XmlNode): string {
  const raw = childText(item, 'wp:status').toLowerCase();
  if (raw === 'publish') return 'published';
  if (raw === 'future') return 'scheduled';
  if (raw === 'private') return 'draft';
  if (raw === 'pending') return 'draft';
  return 'draft';
}

/** `<category domain="category" nicename="news">News</category>` — the same element
 *  carries both taxonomies, told apart only by the attribute. */
function termsOf(item: XmlNode, domain: string): string[] {
  return children(item, 'category')
    .filter((node) => node.attrs.domain === domain)
    .map((node) => node.text)
    .filter((text) => text !== '');
}

function pathOf(url: string, siteUrl: string): string {
  if (url === '') return '';
  const stripped = siteUrl !== '' && url.startsWith(siteUrl) ? url.slice(siteUrl.length) : url;
  const match = /^https?:\/\/[^/]+(\/[^?#]*)?/.exec(stripped);
  const path = match ? (match[1] ?? '/') : stripped.split('?')[0]!;
  return path.startsWith('/') ? path : `/${path}`;
}

/** Read a WXR file into every canonical entity it contains. */
export function parseWxr(source: string): WxrDocument {
  const rss = parseXml(source);
  const channel = child(rss, 'channel');

  const siteTitle = childText(channel, 'title');
  const siteUrl = (childText(channel, 'wp:base_site_url') || childText(channel, 'link')).replace(
    /\/$/,
    ''
  );

  const authors: CanonicalRow[] = [];
  for (const author of children(channel, 'wp:author')) {
    const email = childText(author, 'wp:author_email');
    if (email === '') continue;
    authors.push({
      email,
      name: childText(author, 'wp:author_display_name') || childText(author, 'wp:author_login'),
      first_name: childText(author, 'wp:author_first_name'),
      last_name: childText(author, 'wp:author_last_name'),
      type: 'person',
    });
  }

  const categories: CanonicalRow[] = [];
  for (const category of children(channel, 'wp:category')) {
    const name = childText(category, 'wp:cat_name');
    if (name === '') continue;
    categories.push({
      name,
      slug: childText(category, 'wp:category_nicename'),
      parent: childText(category, 'wp:category_parent'),
      description: childText(category, 'wp:category_description'),
    });
  }

  const content: CanonicalRow[] = [];
  const media: CanonicalRow[] = [];
  const redirects: CanonicalRow[] = [];

  for (const item of children(channel, 'item')) {
    const type = childText(item, 'wp:post_type').toLowerCase();
    const rawStatus = childText(item, 'wp:status').toLowerCase();
    if (SKIP_TYPES.has(type)) continue;
    // Attachments are ALWAYS `inherit` — that is how WordPress marks a child of
    // another post, not a revision. Applying the status filter to them drops the
    // entire media library, which is exactly what happened the first time.
    if (type !== 'attachment' && SKIP_STATUSES.has(rawStatus)) continue;

    const title = childText(item, 'title');
    const link = childText(item, 'link');
    const slug = childText(item, 'wp:post_name');

    if (type === 'attachment') {
      const url = childText(item, 'wp:attachment_url');
      if (url === '') continue;
      media.push({
        url,
        filename: url.split('/').pop() ?? '',
        title,
        alt: metaValue(item, '_wp_attachment_image_alt'),
        caption: childText(item, 'excerpt:encoded'),
        uploaded_at: toIsoDate(childText(item, 'wp:post_date_gmt')) ?? '',
      });
      continue;
    }

    // WooCommerce products come through the product CSV, which carries price, stock
    // and variations that the WXR item does not.
    if (type === 'product' || type === 'product_variation') continue;

    if (type !== 'post' && type !== 'page') continue;

    const publishedAt =
      toIsoDate(childText(item, 'wp:post_date_gmt')) ??
      toIsoDate(childText(item, 'wp:post_date')) ??
      toIsoDate(childText(item, 'pubDate')) ??
      '';

    const entry: CanonicalRow = {
      title,
      slug: slug || '',
      type: type === 'page' ? 'page' : 'post',
      body: childText(item, 'content:encoded'),
      excerpt: childText(item, 'excerpt:encoded'),
      status: statusOf(item),
      author: childText(item, 'dc:creator'),
      categories: termsOf(item, 'category').join(', '),
      tags: termsOf(item, 'post_tag').join(', '),
      // Yoast and Rank Math are on a large share of WordPress sites, and their SEO
      // titles are the only place a tenant's search snippets exist. Losing them on
      // migration is a ranking loss the tenant will notice and we will not.
      seo_title: metaValue(item, '_yoast_wpseo_title') || metaValue(item, 'rank_math_title'),
      seo_description:
        metaValue(item, '_yoast_wpseo_metadesc') || metaValue(item, 'rank_math_description'),
    };
    if (publishedAt !== '') entry.published_at = publishedAt;
    const sourcePath = pathOf(link, siteUrl);
    if (sourcePath !== '') entry.source_url = sourcePath;

    for (const key of Object.keys(entry)) if (entry[key] === '') delete entry[key];
    content.push(entry);

    // A redirect only earns its place when the old path and the new one differ —
    // `/about/` → `/about` is noise, and a self-redirect is a loop.
    const target = entry.slug !== undefined ? `/${entry.slug}` : '';
    if (sourcePath !== '' && target !== '' && sourcePath.replace(/\/$/, '') !== target) {
      redirects.push({ from: sourcePath, to: target, status_code: '301' });
    }
  }

  return { siteTitle, siteUrl, content, media, categories, redirects, authors };
}
