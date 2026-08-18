// The SMS provider abstraction (mirrors @wizeworks/payments' PaymentGateway). Every
// SMS the platform sends — booking confirmations, reminders, waitlist offers —
// goes through this interface and never knows the vendor. Adding a provider =
// implementing this interface + registering it; no caller changes.

export interface SendSmsParams {
  /** Recipient in E.164 (e.g. +15555550123). */
  to: string;
  /** Message body (plain text; providers segment long messages). */
  body: string;
  /** Sender id / number override. Falls back to the provider's default sender. */
  from?: string;
  /** Tenant the message belongs to — for the provider's logs/metering. */
  tenantId?: string;
}

export interface SmsResult {
  success: boolean;
  /** The provider's message id, for the notification ledger + delivery lookups. */
  messageId?: string;
  /** Provider error code (provider-specific) when `success` is false. */
  errorCode?: string;
  errorMessage?: string;
}

export interface SmsProvider {
  /** Stable id: 'twilio' | 'console' | … */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** Send one message. Implementations never throw for a provider-side failure —
   *  they return `{ success: false, … }` so callers can record + move on. */
  send(params: SendSmsParams): Promise<SmsResult>;
}

/** A recipient looks sendable (cheap E.164-ish guard so we skip obvious junk
 *  without a full libphonenumber dependency). */
export function looksLikePhone(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\+?[1-9]\d{6,14}$/.test(value.replace(/[\s()-]/g, ''));
}
