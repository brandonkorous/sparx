// Notification preferences — per-PERSON control over what sparx tells them about
// and how it reaches them (in-app inbox vs. email), plus how email is batched.
//
// These live on the `users.preferences` JSON blob (the same place `/v1/me/
// preferences` keeps the operator's view defaults), NOT in a new table. A
// notification is addressed to one person and its read-state already lives on
// the per-user `notifications` row, so the person's DELIVERY choices belong on
// the same user record — no schema change, and it reads/writes through the same
// `withRequestTenant` path everything on `users` uses.
//
// The category list is the CONTRACT: a category groups the events a business
// owner thinks of together ("orders", "payments", "stock") rather than the raw
// `kind` strings the automation engine emits. `notificationCategoryForKind`
// folds a raw notification onto one category so a delivery decision can be made
// from a preference the person actually set.
//
// ENFORCEMENT: `resolveNotificationDelivery` is the single decision function.
// The in-app writer (the `platform.notify` automation action) and the email
// pipeline (`email.send` → email-worker) are the two places that consume it —
// they gate a person out of a channel they muted. Kept as a pure function here
// so both callers share one definition rather than re-deriving the rule.

/** How a category reaches a person. `email` = inbox + email; `inapp` = inbox
 *  only; `off` = don't tell them at all. */
export const NOTIFICATION_CHANNELS = ['email', 'inapp', 'off'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** How email is delivered: as it happens, or rolled up into one message. */
export const EMAIL_DIGESTS = ['immediate', 'daily', 'weekly'] as const;
export type EmailDigest = (typeof EMAIL_DIGESTS)[number];

/** The categories a person can tune. Keys are stable and stored — renaming one
 *  orphans a saved choice. The client renders the plain-language labels; this
 *  list is the source of truth for WHICH categories exist and the module each
 *  belongs to (for the kind→category fold). */
export const NOTIFICATION_CATEGORIES = [
  'orders',
  'payments',
  'inventory',
  'customers',
  'content',
  'bookings',
  'sites',
  'team',
  'system',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotificationPreferences {
  channels: Record<NotificationCategory, NotificationChannel>;
  digest: EmailDigest;
}

/**
 * Sensible starting point for someone who has never touched this screen. Money
 * and customer-facing events default to email because missing one has a cost;
 * ambient "something published" / "a background task finished" default to the
 * inbox only, so a new account is not buried in mail on day one.
 */
const DEFAULT_CHANNELS: Record<NotificationCategory, NotificationChannel> = {
  orders: 'email',
  payments: 'email',
  inventory: 'email',
  customers: 'email',
  content: 'inapp',
  bookings: 'email',
  sites: 'email',
  team: 'email',
  system: 'inapp',
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  channels: { ...DEFAULT_CHANNELS },
  digest: 'immediate',
};

function isChannel(value: unknown): value is NotificationChannel {
  return typeof value === 'string' && (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}

function isDigest(value: unknown): value is EmailDigest {
  return typeof value === 'string' && (EMAIL_DIGESTS as readonly string[]).includes(value);
}

/**
 * Read the person's preferences out of the `users.preferences` blob, filling
 * every gap with a default — so callers always get a complete map and never
 * have to reason about "unset". Tolerant of a missing or malformed blob: a
 * corrupt value falls back to the default rather than throwing at a person who
 * only wanted to see their settings.
 */
export function parseNotificationPreferences(raw: unknown): NotificationPreferences {
  const channels: Record<NotificationCategory, NotificationChannel> = { ...DEFAULT_CHANNELS };
  let digest: EmailDigest = DEFAULT_NOTIFICATION_PREFERENCES.digest;

  const container =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>).notifications : undefined;
  if (container && typeof container === 'object') {
    const obj = container as Record<string, unknown>;
    const storedChannels = obj.channels;
    if (storedChannels && typeof storedChannels === 'object') {
      for (const category of NOTIFICATION_CATEGORIES) {
        const value = (storedChannels as Record<string, unknown>)[category];
        if (isChannel(value)) channels[category] = value;
      }
    }
    if (isDigest(obj.digest)) digest = obj.digest;
  }

  return { channels, digest };
}

/**
 * Merge a patch onto the CURRENT preferences and return the whole
 * `users.preferences` object to write back — preserving every unrelated key
 * (the view defaults `/v1/me/preferences` owns) that also lives in that blob.
 */
export function mergeNotificationPreferences(
  currentPreferences: unknown,
  patch: {
    channels?: Partial<Record<NotificationCategory, NotificationChannel>>;
    digest?: EmailDigest;
  }
): { merged: Record<string, unknown>; next: NotificationPreferences } {
  const base =
    currentPreferences && typeof currentPreferences === 'object'
      ? (currentPreferences as Record<string, unknown>)
      : {};
  const current = parseNotificationPreferences(base);

  const next: NotificationPreferences = {
    channels: { ...current.channels, ...(patch.channels ?? {}) },
    digest: patch.digest ?? current.digest,
  };

  return { merged: { ...base, notifications: next }, next };
}

/** Should a notification in this category reach the person on each channel. The
 *  one decision function both the in-app writer and the email pipeline call. */
export function resolveNotificationDelivery(
  preferences: NotificationPreferences,
  category: NotificationCategory
): { inApp: boolean; email: boolean } {
  const channel = preferences.channels[category];
  return { inApp: channel !== 'off', email: channel === 'email' };
}

/**
 * Fold a raw notification (`kind` + optional `module`) onto the category whose
 * preference governs it. `kind` is checked first — it is the specific signal —
 * with `module` as the fallback for kinds this map has not enumerated. Anything
 * unrecognised lands in `system`, the catch-all, so a new event type is never
 * silently un-gated.
 */
export function notificationCategoryForKind(
  kind: string,
  module: string | null
): NotificationCategory {
  const k = kind.toLowerCase();

  if (k.startsWith('order') || k.includes('.order') || k.includes('checkout')) return 'orders';
  if (
    k.includes('payment') ||
    k.includes('invoice') ||
    k.includes('refund') ||
    k.includes('payout')
  )
    return 'payments';
  if (k.includes('inventory') || k.includes('stock') || k.includes('low_stock')) return 'inventory';
  if (
    k.includes('customer') ||
    k.includes('review') ||
    k.includes('question') ||
    k.includes('lead')
  )
    return 'customers';
  if (k.includes('content') || k.includes('post') || k.includes('article') || k.includes('form'))
    return 'content';
  if (k.includes('booking') || k.includes('appointment') || k.includes('schedul'))
    return 'bookings';
  if (k.includes('domain') || k.includes('site') || k.includes('certificate') || k.includes('ssl'))
    return 'sites';
  if (k.includes('team') || k.includes('member') || k.includes('login') || k.includes('security'))
    return 'team';

  switch (module) {
    case 'commerce':
      return 'orders';
    case 'invoicing':
    case 'finance':
      return 'payments';
    case 'inventory':
      return 'inventory';
    case 'crm':
      return 'customers';
    case 'cms':
      return 'content';
    case 'scheduling':
      return 'bookings';
    default:
      return 'system';
  }
}
