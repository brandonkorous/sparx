import 'server-only';
import { platformRequest } from '@wizeworks/auth-client-server';

// ── WHERE IT IS READ AND WRITTEN ────────────────────────────────────────────
//
// In api-rest (`/auth/piggles/platform/consent`), as the person signed in: this
// app holds no database (docs/154). The write lands under the person's HOME
// business, because RLS lets a member read their own row from a business they
// joined but never write it there (sparx persona issue 122). api-rest takes
// the person from the session, never from this app.

/** The one optional thing Piggles runs, and when the person answered. */
export interface ConsentRecord {
  analytics: boolean;
  /** ISO time of the answer. Empty on an older record that carried none. */
  at: string;
}

/** The person's decision, or null when they were never asked. Throws when it
 *  cannot be read: "we could not tell" must never read as "never asked" or as
 *  "said yes". */
export async function readConsent(): Promise<ConsentRecord | null> {
  return (await platformRequest<{ consent: ConsentRecord | null }>('consent')).consent;
}

/** Record the person's answer. Only ever called when a person answered. */
export async function writeConsent(analytics: boolean): Promise<void> {
  await platformRequest('consent', { body: { analytics } });
}
