// Dev/test SMS provider — logs the message instead of sending, and returns a
// synthetic id. Mirrors the email pipeline's "console in dev, real provider in
// prod" default, so local booking flows exercise the full notification path with
// no Twilio credentials and no real texts.

import type { SmsProvider, SendSmsParams, SmsResult } from '../provider';

export class ConsoleSmsProvider implements SmsProvider {
  readonly id = 'console';
  readonly name = 'Console (dev)';

  send(params: SendSmsParams): Promise<SmsResult> {
    const preview = params.body.length > 160 ? `${params.body.slice(0, 157)}…` : params.body;
    console.info(
      `[sms:console] → ${params.to}${params.tenantId ? ` (tenant ${params.tenantId})` : ''}: ${preview}`
    );
    return Promise.resolve({ success: true, messageId: `console_${Date.now().toString(36)}` });
  }
}
