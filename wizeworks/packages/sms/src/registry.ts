// Provider selection — the one place that decides which vendor sends. Mirrors the
// email pipeline's console-in-dev / real-provider-in-prod default: with no
// configured provider (or incomplete Twilio creds) it falls back to the Console
// provider so local + test booking flows run the full notification path safely.

import { ConsoleSmsProvider } from './providers/console';
import { TwilioSmsProvider } from './providers/twilio';
import type { SmsProvider } from './provider';

export interface SmsEnv {
  /** 'twilio' selects Twilio when its creds are present; anything else → console. */
  SMS_PROVIDER?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM?: string;
  TWILIO_MESSAGING_SERVICE_SID?: string;
}

/** True when the env carries everything Twilio needs to actually send. */
export function hasTwilioConfig(env: SmsEnv): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- `||` is intended: an empty-string env var must fall through to the messaging-service SID, which `??` would treat as set.
    (env.TWILIO_FROM || env.TWILIO_MESSAGING_SERVICE_SID)
  );
}

export function resolveSmsProvider(env: SmsEnv): SmsProvider {
  if (env.SMS_PROVIDER === 'twilio' && hasTwilioConfig(env)) {
    return new TwilioSmsProvider({
      accountSid: env.TWILIO_ACCOUNT_SID!,
      authToken: env.TWILIO_AUTH_TOKEN!,
      from: env.TWILIO_FROM ?? '',
      ...(env.TWILIO_MESSAGING_SERVICE_SID
        ? { messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID }
        : {}),
    });
  }
  return new ConsoleSmsProvider();
}
