// Twilio voice — talks to the REST API directly over fetch (HTTP Basic auth),
// so this package carries NO Twilio SDK dependency and stays light in every
// build that imports it. Mirrors @sparx/sms' TwilioSmsProvider exactly.
//
// CREDENTIALS ARE THE TENANT'S OWN. sparx never fronts its own vendor account
// for a tenant's outbound traffic (memory: no platform-credentialed vendor
// usage) — their Twilio account, their number, their bill, their compliance
// posture on a call their business is making.

import type {
  CallOutcome,
  CallResult,
  CallStatusUpdate,
  PlaceCallParams,
  VoiceProvider,
} from '../provider';

export interface TwilioVoiceConfig {
  accountSid: string;
  authToken: string;
}

/**
 * Twilio's call statuses → ours.
 *
 * `completed` is the interesting one: it means the call ENDED, not that anybody
 * spoke. A completed call of a few seconds is almost always a voicemail
 * greeting being reached, so duration decides — and the caller can correct it,
 * because a machine guessing at what happened on a phone call is exactly the
 * kind of thing a person needs to be able to overrule.
 */
export function outcomeFor(status: string, durationSec: number | null): CallOutcome | null {
  switch (status) {
    case 'completed':
      return durationSec !== null && durationSec > 0 ? 'connected' : 'no_answer';
    case 'busy':
      return 'busy';
    case 'no-answer':
      return 'no_answer';
    case 'failed':
    case 'canceled':
      return 'no_answer';
    default:
      // `queued`, `ringing`, `in-progress` — not terminal, nothing to record.
      return null;
  }
}

export class TwilioVoiceProvider implements VoiceProvider {
  readonly id = 'twilio';
  readonly name = 'Twilio';

  constructor(private readonly config: TwilioVoiceConfig) {}

  async place(params: PlaceCallParams): Promise<CallResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      this.config.accountSid
    )}/Calls.json`;

    // Ring the REP first, then dial the customer and bridge. TwiML inline via
    // `Twiml` rather than a hosted URL, so there is no second endpoint to keep
    // reachable and no callback that can 404 mid-call.
    const twiml = `<Response><Dial callerId="${escapeXml(params.from)}">${escapeXml(
      params.to
    )}</Dial></Response>`;

    const form = new URLSearchParams();
    form.set('To', params.bridgeTo);
    form.set('From', params.from);
    form.set('Twiml', twiml);
    if (params.statusCallbackUrl) {
      form.set('StatusCallback', params.statusCallbackUrl);
      form.set('StatusCallbackEvent', 'completed');
      form.set('StatusCallbackMethod', 'POST');
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
          errorMessage: json?.message ?? `Twilio HTTP ${String(res.status)}`,
        };
      }
      return { success: true, providerCallId: json?.sid ?? '' };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'Twilio request failed',
      };
    }
  }

  parseStatus(body: Record<string, unknown>): CallStatusUpdate | null {
    const providerCallId = typeof body.CallSid === 'string' ? body.CallSid : '';
    const status = typeof body.CallStatus === 'string' ? body.CallStatus : '';
    if (!providerCallId || !status) return null;

    const rawDuration = Number(body.CallDuration);
    const durationSec = Number.isFinite(rawDuration) && rawDuration >= 0 ? rawDuration : null;
    const outcome = outcomeFor(status, durationSec);
    if (!outcome) return null;

    return {
      providerCallId,
      outcome,
      durationSec,
      recordingUrl: typeof body.RecordingUrl === 'string' ? body.RecordingUrl : null,
    };
  }
}

/** A phone number cannot contain these, but TwiML is XML and building markup by
 *  concatenation without escaping is how an injection gets written by accident. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
