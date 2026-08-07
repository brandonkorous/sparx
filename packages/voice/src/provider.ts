// The voice provider abstraction (docs/144 §5.6), shaped exactly like
// @sparx/sms' SmsProvider and @sparx/payments' PaymentGateway. Every call the
// platform places goes through this interface and never knows the vendor.
// Adding a provider = implementing this interface + one branch in the registry;
// no caller changes.

export interface PlaceCallParams {
  /** Who to ring, in E.164. */
  to: string;
  /** Which of the tenant's numbers it comes from, in E.164. */
  from: string;
  /**
   * Where the provider should send status updates as the call progresses.
   *
   * Null in development and on any deployment with no public HTTPS origin — the
   * call still connects, it simply cannot report back, so its duration and
   * outcome stay unknown rather than wrong.
   */
  statusCallbackUrl?: string | null;
  /**
   * The number to ring FIRST and bridge from — the rep's own phone.
   *
   * This is what "click to call" actually is: the platform rings the person who
   * clicked, and when they pick up it dials the customer and joins the two. The
   * alternative, dialling the customer from a browser tab, needs WebRTC, a
   * microphone permission and a headset, and it fails in exactly the moment
   * someone most needs it to work.
   */
  bridgeTo: string;
  tenantId?: string;
}

export interface CallResult {
  success: boolean;
  /** The provider's call id, which every later status webhook carries. */
  providerCallId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/** What a provider tells us when a call ends. Normalized here so the CRM's own
 *  outcome vocabulary never has to learn a vendor's spelling. */
export type CallOutcome = 'connected' | 'no_answer' | 'voicemail' | 'busy' | 'wrong_number';

export interface CallStatusUpdate {
  providerCallId: string;
  outcome: CallOutcome | null;
  durationSec: number | null;
  /** Present only when the tenant switched recording on — off by default, and
   *  deliberately so (see the note in the CRM call service). */
  recordingUrl?: string | null;
}

export interface VoiceProvider {
  /** Stable id: 'twilio' | 'console' | … */
  readonly id: string;
  readonly name: string;
  /**
   * Place a call. Implementations never throw for a provider-side failure —
   * they return `{ success: false, … }` so the caller can record the attempt
   * and move on. A CRM that loses the record of a call it tried to place is
   * worse than one that records a failed attempt.
   */
  place(params: PlaceCallParams): Promise<CallResult>;
  /**
   * Turn a provider's status webhook body into our vocabulary, or null when the
   * payload is not a terminal status we care about (`ringing`, `in-progress`).
   */
  parseStatus(body: Record<string, unknown>): CallStatusUpdate | null;
}

/** A number looks callable — a cheap E.164-ish guard, matching the one
 *  @sparx/sms uses, so the two agree on what a phone number is. */
export function looksLikePhone(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\+?[1-9]\d{6,14}$/.test(value.replace(/[\s()-]/g, ''));
}

/**
 * Normalize a number people typed into a form.
 *
 * `(555) 010-9999` and `555-010-9999` are the same number and neither is
 * dialable as written. A number with no country code is assumed to be in the
 * tenant's default region, because the alternative — refusing it — means a US
 * business that has never written `+1` in its life cannot call anybody.
 */
export function toE164(raw: string, defaultCountryCode = '1'): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return looksLikePhone(digits) ? digits : null;
  if (digits.length === 0) return null;
  const withCode = digits.length <= 10 ? `${defaultCountryCode}${digits}` : digits;
  const e164 = `+${withCode}`;
  return looksLikePhone(e164) ? e164 : null;
}
