// Substack.
//
// A writer leaving Substack is usually leaving because they want to own the
// relationship and stop paying 10% of it. Two files, and the second one is the whole
// point: the subscriber list, with paid status.
//
// The posts export is a directory, not a file — `posts.csv` is an INDEX, and each
// post's body lives beside it as `posts/<id>.<slug>.html`. So the CSV alone carries
// titles, dates and audience but no writing. Rather than silently importing a set of
// empty posts, the mapper marks each row with the body file it expects; the workbench
// asks for those files too when the tenant drops the folder, and the validator flags
// any post whose body never arrived.

import type { CanonicalRow } from '../canonical';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { pick, row } from './_helpers';

/** Bodies keyed by post id, filled in by the workbench when the tenant drops the
 *  whole export folder rather than just the CSV. */
export type SubstackBodies = Record<string, string>;

export function mapPosts(rows: SourceRow[], bodies: SubstackBodies = {}): CanonicalRow[] {
  return rows.map((source) => {
    const id = pick(source, 'post_id');
    const title = pick(source, 'title');
    const isPublished = pick(source, 'is_published').toLowerCase() === 'true';
    // Substack ids are `12345.slug-goes-here`; the slug half is the published path.
    const slug = id.includes('.') ? id.slice(id.indexOf('.') + 1) : '';

    return row({
      title,
      slug,
      type: 'post',
      body: bodies[id] ?? '',
      excerpt: pick(source, 'subtitle'),
      status: isPublished ? 'published' : 'draft',
      published_at: pick(source, 'post_date'),
      // Paid-only posts land as drafts rather than public: publishing a writer's
      // paywalled archive to the open web on migration day would be irreversible.
      tags: pick(source, 'audience') === 'only_paid' ? 'paid' : '',
      source_url: slug === '' ? '' : `/p/${slug}`,
    });
  });
}

function mapSubscribers(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const paid = pick(source, 'active_subscription').toLowerCase() === 'true';
    return row({
      email: pick(source, 'email'),
      accepts_marketing: pick(source, 'email_disabled').toLowerCase() === 'true' ? 'false' : 'true',
      tags: paid ? 'paid subscriber' : 'free subscriber',
      created_at: pick(source, 'created_at'),
      type: 'person',
    });
  });
}

export const substack: VendorAdapter = {
  slug: 'substack',
  name: 'Substack',
  kind: 'cms',
  sources: [
    {
      id: 'substack.posts',
      entity: 'content',
      label: 'Posts',
      file: 'posts.csv (plus the posts/ folder beside it)',
      where: 'Settings → Exports → Create a new export',
      format: 'csv',
      filePattern: /^posts\.csv$/i,
      required: ['post_id', 'is_published'],
      hints: ['audience', 'email_sent_at', 'subtitle', 'podcast_url'],
      map: (rows) => mapPosts(rows),
    },
    {
      id: 'substack.subscribers',
      entity: 'customers',
      label: 'Subscribers',
      file: 'email_list.csv',
      where: 'Subscribers → Export → All subscribers',
      format: 'csv',
      filePattern: /email_list|subscribers/i,
      required: ['email', 'active_subscription'],
      hints: ['email_disabled', 'expiry'],
      map: mapSubscribers,
    },
  ],
};

export const substackInternals = { mapPosts, mapSubscribers };
