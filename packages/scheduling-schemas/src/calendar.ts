// Calendar-connection input schemas (docs/79 §8).
//
// Three connection kinds: `oauth` (platform app or BYO client), `caldav` (Apple
// app-password / generic), `ical_feed` (read-only subscribe). Secrets (OAuth
// tokens, app-passwords, the secret feed URL) are NOT stored on the row — the
// service exchanges/persists them to Secret Manager and keeps only a ref. This
// input is the non-secret config; transient secrets ride a separate field the
// service consumes then discards.

import { z } from 'zod';

import { CalendarProvider, ConnectionKind, CredentialSource, SyncDirection, Uuid } from './common';

export const CreateCalendarConnectionInput = z.object({
  resourceId: Uuid,
  provider: CalendarProvider,
  connectionKind: ConnectionKind.default('oauth'),
  credentialSource: CredentialSource.default('platform'),
  direction: SyncDirection.default('two_way'),
  externalCalendarId: z.string().max(255).nullable().optional(),

  // Transient secrets — consumed by the service, written to Secret Manager, then
  // dropped (never persisted on the row). Which one is present depends on kind:
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

// Start a platform-app OAuth flow — returns the provider consent URL.
export const StartCalendarOAuthInput = z.object({
  resourceId: Uuid,
  provider: z.enum(['google', 'microsoft']),
  credentialSource: CredentialSource.default('platform'),
  // BYO only — the tenant's own client, stored to Secret Manager before redirect.
  oauthClientId: z.string().max(512).optional(),
  oauthClientSecret: z.string().max(512).optional(),
  redirectUri: z.string().url().max(2048),
});
export type StartCalendarOAuthInput = z.infer<typeof StartCalendarOAuthInput>;
