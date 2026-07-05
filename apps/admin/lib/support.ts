// Support-console presentation helpers (Slice 6). Email delivery events have
// their own reading (an `opened`/`clicked` is a win, a `bounced`/`complained` is
// a failure) that the platform `statusTone` dictionary doesn't fully cover, so —
// per the Badge convention — support code keeps a curated map.

type Tone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const EMAIL_EVENT_TONE: Record<string, Tone> = {
  delivered: 'success',
  opened: 'success',
  clicked: 'success',
  accepted: 'info',
  sending: 'info',
  bounced: 'danger',
  complained: 'danger',
  failed: 'danger',
  unsubscribed: 'warning',
};

/** Semantic tone for an email delivery-event type. */
export function emailEventTone(type: string): Tone {
  return EMAIL_EVENT_TONE[type] ?? 'neutral';
}

/** Customer-type badge tone — b2b stands out (primary), the rest read neutral. */
export function customerTypeTone(type: string): Tone {
  return type === 'b2b' ? 'info' : 'neutral';
}

const COLLECTION_LABELS: Record<string, string> = {
  products: 'Products',
  customers: 'Customers',
  orders: 'Orders',
  entities: 'Content & other',
};

/** Human label for a Typesense collection name. */
export function collectionLabel(name: string): string {
  return COLLECTION_LABELS[name] ?? name;
}
