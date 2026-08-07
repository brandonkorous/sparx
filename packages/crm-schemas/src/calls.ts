// Calling — write shapes (docs/144 §5.6).
//
// Click-to-call is the CRM feature that fixes the hardest logging problem: a
// phone call is the highest-signal thing that happens in most sales
// relationships and the one least likely to be written down, because logging it
// means opening a screen after the conversation is already over. When the
// platform places the call it already knows who, when and how long — leaving
// only what was said for a person to add.

import { z } from 'zod';

import { CallOutcome } from './engagement';
import { Uuid } from './common';

/** E.164, which is the only form a carrier will dial. Normalization from what a
 *  person typed happens in `@sparx/voice`'s `toE164`, before this. */
const PhoneNumber = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Enter a phone number including its country code.');

export const PlaceCallInput = z.object({
  /** Who to ring. Their number is read from the RECORD, not the request, for
   *  the same reason an email address is: a typo in a body must not be able to
   *  dial a stranger. */
  customerId: Uuid,
  dealId: Uuid.nullable().optional(),
  ticketId: Uuid.nullable().optional(),
  /**
   * The rep's own phone, which rings FIRST.
   *
   * That is what click-to-call is: the platform rings the person who clicked,
   * and bridges to the customer when they pick up. Dialling the customer from a
   * browser tab instead needs WebRTC, a microphone permission and a headset,
   * and it fails in exactly the moment somebody most needs it to work.
   */
  fromDeviceNumber: PhoneNumber,
});
export type PlaceCallInput = z.infer<typeof PlaceCallInput>;

export const UpdateCallInput = z.object({
  /** What was said. The whole reason for logging a call. */
  notes: z.string().max(20_000).nullable().optional(),
  /**
   * Correctable, deliberately.
   *
   * The provider's guess is inferred from a status code and a duration, and a
   * six-second "completed" call is a voicemail greeting about as often as it is
   * a very short conversation. A machine guessing at what happened on a phone
   * call must be something a person can overrule.
   */
  outcome: CallOutcome.nullable().optional(),
  durationSec: z.number().int().min(0).max(86_400).nullable().optional(),
});
export type UpdateCallInput = z.infer<typeof UpdateCallInput>;

export const ConnectVoiceInput = z.object({
  provider: z.enum(['twilio']).default('twilio'),
  accountSid: z.string().trim().min(1).max(255),
  /** Plaintext on the way IN only; encrypted before storage and never returned
   *  by any read. */
  authToken: z.string().min(1).max(512),
  /** The tenant's own number — what the customer sees ring. */
  fromNumber: PhoneNumber,
  propertyId: Uuid.nullable().optional(),
  /**
   * OFF unless deliberately switched on.
   *
   * Call recording is jurisdictionally loaded — one-party and two-party consent
   * states, and the EU's own rules — so a platform that defaulted it on would be
   * handing a business a legal problem they never agreed to. This flag exists so
   * that turning it on is a decision somebody made.
   */
  recordingEnabled: z.boolean().default(false),
});
export type ConnectVoiceInput = z.infer<typeof ConnectVoiceInput>;

/** Terminal lifecycle states. `placing`/`ringing` mean the call has not
 *  finished, which is why the timeline entry is not written until one of these. */
export const CallStatus = z.enum(['placing', 'ringing', 'completed', 'failed']);
export type CallStatus = z.infer<typeof CallStatus>;
