import type { ActivityItem, Raw } from './types';

// The recent-activity feed — the bottom of the inverted pyramid ("what just
// happened / route follow-up"). Merges real events across modules (content
// publishes/edits, inventory movements, email engagement), newest first. Each
// source is capped before the merge so one chatty stream can't crowd out the
// rest. docs research §6.

const INV_REASON: Record<string, string> = {
  sale: 'Sold',
  return: 'Returned',
  receive: 'Received',
  recount: 'Recounted',
  loss: 'Shrinkage',
  damage: 'Damaged',
  transfer_in: 'Transferred in',
  transfer_out: 'Transferred out',
  reserve: 'Reserved',
  release: 'Released',
  manual: 'Adjusted',
  sync: 'Synced',
};

const EMAIL_EVENT: Record<string, string> = {
  delivered: 'Email delivered',
  opened: 'Email opened',
  clicked: 'Link clicked',
  bounced: 'Email bounced',
  unsubscribed: 'Unsubscribed',
  complained: 'Spam complaint',
};

export function buildActivity(raw: Raw, m: ReadonlySet<string>): ActivityItem[] {
  const has = (mod: string) => m.has(mod);
  const items: ActivityItem[] = [];

  if (has('cms') && raw.cmsRecent) {
    for (const e of raw.cmsRecent.activity.slice(0, 6)) {
      const published = e.status === 'published';
      items.push({
        key: `cms-${e.id}`,
        title: `${published ? 'Published' : 'Updated'} ${e.title}`,
        meta: e.author ? `${e.typeName} · ${e.author}` : e.typeName,
        at: e.updatedAt,
        module: 'cms',
      });
    }
  }

  if (has('inventory') && raw.invActivity) {
    for (const e of raw.invActivity.slice(0, 6)) {
      const verb = INV_REASON[e.reason] ?? 'Adjusted';
      items.push({
        key: `inv-${e.id}`,
        title: `${verb} ${e.title}`,
        meta: `${e.delta > 0 ? '+' : ''}${e.delta} · ${e.location}`,
        at: e.createdAt,
        module: 'inventory',
      });
    }
  }

  if (has('email') && raw.emailOverview) {
    for (const [i, e] of raw.emailOverview.recent.slice(0, 3).entries()) {
      items.push({
        key: `email-${i}-${e.occurredAt}`,
        title: EMAIL_EVENT[e.type] ?? e.type,
        meta: e.recipient,
        at: e.occurredAt,
        module: 'email',
      });
    }
  }

  return items
    .filter((i) => !Number.isNaN(new Date(i.at).getTime()))
    .sort((a, b) => (a.at > b.at ? -1 : 1))
    .slice(0, 8);
}
