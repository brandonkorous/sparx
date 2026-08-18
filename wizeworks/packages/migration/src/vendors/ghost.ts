// Ghost.
//
// The only JSON export on the roster, and a well-made one: Ghost's backup file is a
// complete relational dump, so posts, tags, authors and the post↔tag join table all
// arrive together and the tags actually survive. Most CMS migrations lose taxonomy
// because the export flattens it; here it is simply a join to walk.
//
// Ghost stores post bodies in two shapes depending on version — `html`, or Lexical /
// Mobiledoc JSON. HTML is preferred where present, and where it is not the plaintext
// field is used rather than shipping a serialised editor document into a tenant's CMS
// as if it were their article.
//
// Members (paying and free subscribers) are a separate CSV and are the half a Ghost
// publisher cares most about — that list is their business.

import type { CanonicalEntity, CanonicalRow } from '../canonical';
import { toIsoDate } from '../coerce';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { pick, row, tags } from './_helpers';

interface GhostPost {
  id?: string;
  title?: string;
  slug?: string;
  html?: string;
  plaintext?: string;
  custom_excerpt?: string;
  excerpt?: string;
  status?: string;
  visibility?: string;
  published_at?: string;
  updated_at?: string;
  feature_image?: string;
  meta_title?: string;
  meta_description?: string;
  type?: string;
  page?: boolean;
  author_id?: string;
}

interface GhostTag {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
}

interface GhostUser {
  id?: string;
  name?: string;
  email?: string;
  slug?: string;
}

interface GhostData {
  posts?: GhostPost[];
  tags?: GhostTag[];
  posts_tags?: { post_id?: string; tag_id?: string }[];
  users?: GhostUser[];
}

/** Ghost wraps the payload as `{ db: [ { data: {...} } ] }`, and older versions ship
 *  `{ data: {...} }` directly. Both are in tenants' download folders. */
function readGhost(text: string): GhostData {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null) return {};
  const root = parsed as { db?: { data?: GhostData }[]; data?: GhostData };
  return root.db?.[0]?.data ?? root.data ?? {};
}

export function ghostEntities(text: string): Partial<Record<CanonicalEntity, CanonicalRow[]>> {
  let data: GhostData;
  try {
    data = readGhost(text);
  } catch {
    return {};
  }

  const tagsById = new Map<string, GhostTag>();
  for (const tag of data.tags ?? []) if (tag.id !== undefined) tagsById.set(tag.id, tag);

  const tagNamesByPost = new Map<string, string[]>();
  for (const link of data.posts_tags ?? []) {
    if (link.post_id === undefined || link.tag_id === undefined) continue;
    const name = tagsById.get(link.tag_id)?.name;
    if (name === undefined) continue;
    const bucket = tagNamesByPost.get(link.post_id);
    if (bucket === undefined) tagNamesByPost.set(link.post_id, [name]);
    else bucket.push(name);
  }

  const usersById = new Map<string, GhostUser>();
  for (const user of data.users ?? []) if (user.id !== undefined) usersById.set(user.id, user);

  const content: CanonicalRow[] = [];
  for (const post of data.posts ?? []) {
    const title = (post.title ?? '').trim();
    if (title === '') continue;
    const isPage = post.page === true || post.type === 'page';
    content.push(
      row({
        title,
        slug: post.slug,
        type: isPage ? 'page' : 'post',
        body: post.html ?? post.plaintext,
        excerpt: post.custom_excerpt ?? post.excerpt,
        status:
          post.status === 'published'
            ? 'published'
            : post.status === 'scheduled'
              ? 'scheduled'
              : 'draft',
        author: post.author_id === undefined ? '' : (usersById.get(post.author_id)?.name ?? ''),
        published_at: toIsoDate(post.published_at) ?? '',
        updated_at: toIsoDate(post.updated_at) ?? '',
        tags: (post.id === undefined ? [] : (tagNamesByPost.get(post.id) ?? [])).join(', '),
        featured_image_url: post.feature_image,
        seo_title: post.meta_title,
        seo_description: post.meta_description,
        source_url: post.slug === undefined ? '' : `/${post.slug}`,
      })
    );
  }

  const categories: CanonicalRow[] = [];
  for (const tag of data.tags ?? []) {
    if (tag.name === undefined || tag.name.startsWith('#')) continue;
    categories.push(row({ name: tag.name, slug: tag.slug, description: tag.description }));
  }

  const out: Partial<Record<CanonicalEntity, CanonicalRow[]>> = {};
  if (content.length > 0) out.content = content;
  if (categories.length > 0) out.categories = categories;
  return out;
}

function mapMembers(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const name = pick(source, 'name');
    const [first = '', ...rest] = name.split(' ');
    return row({
      email: pick(source, 'email'),
      name,
      first_name: first,
      last_name: rest.join(' '),
      note: pick(source, 'note'),
      accepts_marketing: pick(source, 'subscribed_to_emails', 'subscribed'),
      tags: tags(pick(source, 'labels')),
      created_at: pick(source, 'created_at'),
      type: 'person',
    });
  });
}

export const ghost: VendorAdapter = {
  slug: 'ghost',
  name: 'Ghost',
  kind: 'cms',
  sources: [
    {
      id: 'ghost.export',
      entity: 'content',
      label: 'Posts, pages and tags',
      file: 'yoursite.ghost.2026-01-01.json',
      where: 'Settings → Migration → Export your content',
      format: 'json',
      filePattern: /\.ghost\.[\d-]+\.json$|ghost.*export.*\.json$/i,
      required: [],
      yields: ['content', 'categories'],
      mapAll: ghostEntities,
    },
    {
      id: 'ghost.members',
      entity: 'customers',
      label: 'Members',
      file: 'members.csv',
      where: 'Members → ⚙ → Export all members',
      format: 'csv',
      filePattern: /members/i,
      required: ['email', 'subscribed_to_emails'],
      hints: ['complimentary_plan', 'stripe_customer_id', 'tiers'],
      map: mapMembers,
    },
  ],
};

export const ghostInternals = { ghostEntities, mapMembers, readGhost };
