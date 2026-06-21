// Calendar-connection input schemas (docs/79 §8).
//
// Three connection kinds: `oauth` (platform app or BYO client), `caldav` (Apple
// app-password / generic), `ical_feed` (read-only subscribe). Secrets (OAuth
// tokens, app-passwords, the secret feed URL) ride these inputs, and the api-rest
// service AES-256-GCM-encrypts them into the connection row's `*_enc` columns
// before persisting (key SCHEDULING_CALENDAR_TOKEN_KEY) — mirroring the Search
// Console OAuth-token box (docs/79 §8.4, §19). Out-of-band Secret Manager
// provisioning can't hold runtime-minted/refreshed tokens, so encrypt-at-rest is
// the platform pattern. The connection's safe view never echoes ciphertext.

import { z } from 'zod';

import { CalendarProvider, ConnectionKind, CredentialSource, SyncDirection, Uuid } from './common';

export const CreateCalendarConnectionInput = z.object({
  resourceId: Uuid,
  provider: CalendarProvider,
  connectionKind: ConnectionKind.default('oauth'),
  credentialSource: CredentialSource.default('platform'),
  direction: SyncDirection.default('two_way'),
  externalCalendarId: z.string().max(255).nullable().optional(),

  // Transient secrets — consumed by the service, encrypted at rest into the row's
  // `*_enc` columns (never persisted as plaintext). Which one is present by kind:
  //  - oauth (BYO): oauthClientId + oauthClientSecret + the returned authCode
  //  - oauth (platform): authCode only (platform client is server-side config)
  //  - caldav: caldavUsername + caldavAppPassword
  //  - ical_feed: icalUrl
  authCode: z.string().max(4096).optional(),
  oauthClientId: z.string().max(512).optional(),
  oauthClientSecret: z.string().max(512).optional(),
  caldavUsername: z.string().max(255).optional(),
  caldavAppPassword: z.string().max(512).optional(),
  icalUrl: z.string().url().max(2048).optional(),
});
export type CreateCalendarConnectionInput = z.infer<typeof CreateCalendarConnectionInput>;

// Layer-2 inbound iCal feed (docs/79 §8.2) — the friction-free path: a staff
// member's read-only secret `.ics` URL becomes external_busy_blocks so their
// outside commitments block sparx slots. The URL is the only secret; the service
// encrypts it at rest. `provider` is just the source label (defaults to 'ical').
export const CreateIcalFeedInput = z.object({
  resourceId: Uuid,
  icalUrl: z.string().url().max(2048),
  provider: CalendarProvider.default('ical'),
  label: z.string().max(120).optional(),
});
export type CreateIcalFeedInput = z.infer<typeof CreateIcalFeedInput>;

// Layer-3 inbound CalDAV (docs/79 §8.3) — a real account connection (Apple iCloud
// via an app-specific password, or a generic CalDAV server). The username +
// app-password are encrypted at rest; the busy import discovers the account's
// calendars and pulls VEVENTs. `serverUrl` defaults to iCloud for `apple_caldav`
// and is REQUIRED for generic `caldav` (the route enforces this).
export const CreateCaldavConnectionInput = z.object({
  resourceId: Uuid,
  provider: z.enum(['apple_caldav', 'caldav']).default('apple_caldav'),
  username: z.string().min(1).max(255),
  appPassword: z.string().min(1).max(512),
  serverUrl: z.string().url().max(2048).optional(),
  label: z.string().max(120).optional(),
});
export type CreateCaldavConnectionInput = z.infer<typeof CreateCaldavConnectionInput>;

// Start a platform-app OAuth flow — returns the provider consent URL.
export const StartCalendarOAuthInput = z.object({
  resourceId: Uuid,
  provider: z.enum(['google', 'microsoft']),
  credentialSource: CredentialSource.default('platform'),
  // BYO only — the tenant's own client, encrypted at rest before the redirect.
  oauthClientId: z.string().max(512).optional(),
  oauthClientSecret: z.string().max(512).optional(),
  redirectUri: z.string().url().max(2048),
});
export type StartCalendarOAuthInput = z.infer<typeof StartCalendarOAuthInput>;
