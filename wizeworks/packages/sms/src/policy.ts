// The rules a text message has to satisfy before anyone pays for it
// (docs/151 §8, docs/152 D1).
//
// Pure functions on purpose. Quiet hours and the segment count are the two
// things most likely to be subtly wrong and least likely to be noticed — a
// message sent at 3am is noticed by one annoyed person, and a segment
// miscount is noticed by nobody until the invoice — so they are separated from
// the database entirely and tested directly.

/** E.164-ish, and the COMPARISON key. A number stored one way and looked up
 *  another is a suppression that silently does not apply. */
export function normalizePhone(value: string): string {
  const stripped = value.replace(/[^\d+]/g, '');
  return stripped.startsWith('+') ? stripped : `+${stripped}`;
}

/**
 * What hour is it where the RECIPIENT is?
 *
 * Returns null when the timezone is unusable, and the caller treats that as
 * "cannot tell" rather than "fine to send". Guessing would mean enforcing quiet
 * hours against the sender's clock, and a shop in London texting Sydney at 10am
 * is reaching somebody at 9pm.
 */
export function localHourIn(timezone: string, now: Date): number | null {
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(now);
    const n = Number(hour);
    // `24` is a legal formatting of midnight in some locales/ICU versions.
    if (!Number.isFinite(n)) return null;
    return n === 24 ? 0 : n;
  } catch {
    return null;
  }
}

export interface QuietHours {
  /** Inclusive, local clock. */
  startHour: number;
  /** Exclusive, local clock. */
  endHour: number;
}

/**
 * Is this hour inside quiet hours?
 *
 * Handles the WRAPPING window, which is the normal case and the easy bug: 21→9
 * means 21,22,23,0,…,8 rather than an empty range. A non-wrapping window
 * (9→17, "only texts during business hours are quiet" — unusual but legal to
 * configure) is the simple comparison.
 */
export function isQuietHour(hour: number, quiet: QuietHours): boolean {
  const { startHour: start, endHour: end } = quiet;
  // Equal bounds mean a zero-length window: quiet hours are OFF, not always-on.
  // Reading it the other way would silently stop every message a tenant sends.
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

/**
 * The next moment it stops being quiet, in UTC.
 *
 * Used to say WHEN a held message will go, because "held" with no time attached
 * reads as "lost". Walks forward an hour at a time rather than doing arithmetic
 * on the local clock: an hour-by-hour walk is correct across a DST boundary,
 * where "add 9 hours to local 21:00" is not.
 */
export function nextSendableAt(timezone: string, quiet: QuietHours, now: Date): Date {
  const cursor = new Date(now.getTime());
  // A full day of hours is always enough to leave any window, and bounds the
  // loop so an unusable timezone cannot spin.
  for (let i = 0; i < 24; i += 1) {
    cursor.setTime(cursor.getTime() + 60 * 60 * 1000);
    const hour = localHourIn(timezone, cursor);
    if (hour === null) return cursor;
    if (!isQuietHour(hour, quiet)) {
      // Land on the top of that hour rather than mid-hour, so a batch of held
      // messages does not go out at whatever minute they happened to arrive.
      cursor.setUTCMinutes(0, 0, 0);
      return cursor;
    }
  }
  return cursor;
}

/**
 * How many messages this will actually be billed as.
 *
 * A text is 160 GSM-7 characters, or 70 if it contains anything outside that
 * alphabet — one curly apostrophe or one emoji more than halves the limit. Long
 * messages are then split with a header that costs 7 characters per part.
 *
 * This is an ESTIMATE and says so. The carrier decides, and encodings vary at
 * the edges; the number is here so a tenant can see that their 200-character
 * message is two texts rather than discovering it on an invoice.
 */
export function estimateSegments(body: string): number {
  // The GSM 03.38 basic set, plus the extension characters that cost two.
  const GSM = /^[ -~\n\r£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉÄÖÑÜ§¿äöñüà€^{}[\]~|\\]*$/;
  const unicode = !GSM.test(body);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  // UTF-16 CODE UNITS, not code points. A UCS-2 message is billed per 16-bit
  // unit, so an emoji outside the BMP is TWO of the 70 — counting code points
  // here undercounts exactly the messages most likely to be long.
  const length = body.length;
  if (length === 0) return 0;
  if (length <= single) return 1;
  return Math.ceil(length / multi);
}
