// Provider selection — the one place that decides which vendor dials.
//
// UNLIKE @sparx/sms, THE CREDENTIALS COME FROM THE TENANT, NOT THE ENVIRONMENT.
// sparx does not front its own vendor account for a tenant's outbound calls:
// their account, their number, their bill, and their compliance posture on a
// call their business is making. So `resolveVoiceProvider` takes credentials
// rather than reading `process.env` — the caller has already decrypted them
// from that tenant's integration record.
//
// No credentials → the console provider, which logs instead of dialling. The
// whole path still runs, so a tenant who has not connected a phone system still
// gets the call logged against the record; only the ringing is missing.

import { ConsoleVoiceProvider } from './providers/console';
import { TwilioVoiceProvider } from './providers/twilio';
import type { VoiceProvider } from './provider';

export interface VoiceCredentials {
  /** 'twilio' today. Anything unrecognized falls through to console rather than
   *  failing — a typo in a config value must not stop a person calling. */
  provider?: string | null;
  accountSid?: string | null;
  authToken?: string | null;
  /** The tenant's own number, in E.164 — what the customer sees ring. */
  fromNumber?: string | null;
}

/** Whether these credentials can actually place a call. */
export function canPlaceCalls(credentials: VoiceCredentials | null | undefined): boolean {
  if (!credentials) return false;
  return (
    credentials.provider === 'twilio' &&
    Boolean(credentials.accountSid && credentials.authToken && credentials.fromNumber)
  );
}

export function resolveVoiceProvider(
  credentials: VoiceCredentials | null | undefined
): VoiceProvider {
  if (canPlaceCalls(credentials) && credentials) {
    return new TwilioVoiceProvider({
      accountSid: credentials.accountSid ?? '',
      authToken: credentials.authToken ?? '',
    });
  }
  return new ConsoleVoiceProvider();
}
