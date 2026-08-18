// Twilio SMS provider — talks to Twilio's REST API directly over fetch (HTTP
// Basic auth), so the package carries NO Twilio SDK dependency and stays light
// in every build that imports it. Swapping to another vendor is a new class +
// one branch in resolveSmsProvider; no caller changes (docs/79 §10).

import type { SmsProvider, SendSmsParams, SmsResult } from '../provider';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** Default sender — an E.164 number. Ignored when `messagingServiceSid` is set. */
  from: string;
  /** A Messaging Service SID (preferred for sender pools / compliance), optional. */
  messagingServiceSid?: string;
}

export class TwilioSmsProvider implements SmsProvider {
  readonly id = 'twilio';
  readonly name = 'Twilio';

  constructor(private readonly config: TwilioConfig) {}

  async send(params: SendSmsParams): Promise<SmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      this.config.accountSid
    )}/Messages.json`;
    const form = new URLSearchParams();
    form.set('To', params.to);
    form.set('Body', params.body);
    if (this.config.messagingServiceSid) {
      form.set('MessagingServiceSid', this.config.messagingServiceSid);
    } else {
      form.set('From', params.from ?? this.config.from);
    }
    const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString(
      'base64'
    );

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Basic ${auth}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      const json = (await res.json().catch(() => null)) as {
        sid?: string;
        code?: number;
        message?: string;
      } | null;
      if (!res.ok) {
        return {
          success: false,
          errorCode: json?.code !== undefined ? String(json.code) : String(res.status),
          errorMessage: json?.message ?? `Twilio HTTP ${res.status}`,
        };
      }
      return { success: true, messageId: json?.sid };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'Twilio request failed',
      };
    }
  }
}
