// SMS bodies for booking notifications (docs/79 §10). SMS has no layout, so —
// unlike the email channel, which renders a tenant-editable Builder tree by key —
// these are compact plain-text strings built from the booking's resolved fields.
// Kept here in the engine (not the api-rest dispatch tick) so the copy lives in
// one place and is unit-testable, mirroring how the email trees live in
// @sparx/builder-schemas.

import type { BookingNotificationType } from './notifications';

export interface BookingSmsFields {
  /** The service / class / reservation name, e.g. "Oil change" or "Yoga Flow". */
  serviceName: string;
  /** Date + time already formatted in the booking's timezone, e.g.
   *  "Mon, Jun 22 at 2:30 PM". */
  whenLabel: string;
  /** The customer-facing site name (Property.name) for the signature. */
  siteName: string;
}

/**
 * Render the SMS body for a booking notification. Kept short — the common case
 * fits a single 160-char GSM segment; a long service/site name may spill to a
 * second segment, which carriers concatenate transparently.
 */
export function renderBookingSms(type: BookingNotificationType, f: BookingSmsFields): string {
  switch (type) {
    case 'confirmation':
      return `${f.siteName}: your ${f.serviceName} is booked for ${f.whenLabel}. See you then!`;
    case 'reminder':
      return `${f.siteName} reminder: your ${f.serviceName} is ${f.whenLabel}. Call us to reschedule.`;
    case 'change':
      return `${f.siteName}: your ${f.serviceName} has been rescheduled to ${f.whenLabel}.`;
    case 'cancellation':
      return `${f.siteName}: your ${f.serviceName} on ${f.whenLabel} has been cancelled. Contact us to rebook.`;
  }
}
