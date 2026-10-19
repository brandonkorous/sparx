// The clock a stored moment is SHOWN on: the shop's (sparx persona issue 333).
//
// A card payment Stripe took at 09:28 UTC read "Oct 18, 2026, 2:28 AM" on
// Gillett's order, because the console was open on a computer set to Pacific
// time. In Bluffdale it was 3:28 AM, and the receipt the shop sent said so.
// Bookings, schedules and due dates already read the business's clock (issues
// 086, 885, 942); the "when did this happen" stamps on orders, invoices, payouts
// and the rest still read the computer's, through eight copies of one
// formatter in each console.
//
// One setting, read by every one of them. The console shell fills it once from
// the business's time zone (`useShopClock`, in business-timezone.ts). Until then, or for a business with
// no zone set, a stamp falls back to this computer's clock, which is the answer
// those formatters always gave.

let shopZone: string | null = null;

/** Which clock stamps are shown on: the shop's zone, or null for this computer's. */
export function shopClockZone(): string | null {
  return shopZone;
}

/** Set the shop's zone. The shell does it through `useShopClock` in
 *  business-timezone.ts, which keeps this file free of React so any formatter,
 *  server-rendered or not, can read it. */
export function setShopClock(zone: string | null | undefined): void {
  shopZone = zone ?? null;
}

/** A moment as "Oct 18, 2026, 3:28 AM" on the shop's clock. A dash for nothing,
 *  or for something that is not a date. */
export function formatShopDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
  if (shopZone) {
    try {
      return date.toLocaleString(undefined, { ...options, timeZone: shopZone });
    } catch {
      // A zone this browser does not know: this computer's clock, as before.
    }
  }
  return date.toLocaleString(undefined, options);
}
