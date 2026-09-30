'use client';

// Currencies, in plain names — for every screen that asks what money something
// is in.
//
// The wire format everywhere is ISO 4217 ("USD", "GBP"), because that is what
// the schemas validate and what payment and tax providers speak. A shop owner
// should never have to TYPE one, though, so this module is the one place that
// turns a code into a real name ("US Dollar", "British Pound") and back. Names
// come from the platform's own Intl.DisplayNames rather than a hand-kept table,
// so they stay correct and localise for free.
//
// ── Four answers to one question ────────────────────────────────────────────
//
// MEASURED 2026-09-19: nine Currency fields in this console, and they did four
// different things.
//
//   • Gift cards listed NAMES          "US dollars"        — one screen
//   • Selling settings listed BOTH     "US Dollar (USD)"   — one screen
//   • Special prices and Bookings listed CODES  "USD"      — two screens
//   • The other five were an empty BOX, three letters, no list at all:
//     How stock is valued, a supplier, a deal, a thing you track, a course.
//
// So "US Dollar" was already written down twice, in two different spellings,
// and five screens still asked her to know that dollars are USD. Issue 730.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── The box was worse than untidy ───────────────────────────────────────────
//
// `money-format.ts` exists because "123" typed into one of those boxes reached
// a delivery pane and took the screen out with a thrown RangeError. That fix is
// a FLOOR: it makes a bad code render as "123 12.50" instead of crashing. It
// does not stop the bad code being typed, and nothing else did either — the
// schema behind these fields checks three letters and nothing more, so "ZZZ"
// saves, syncs, and prints on an invoice forever.
//
// A list of names has no such state. [[feedback_never_present_absence_as_measurement]]

const CURRENCY_DISPLAY =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(undefined, { type: 'currency' })
    : null;

/** Every currency this platform can name, ISO 4217. Order is alphabetical by
 *  CODE; callers sort by display name for the picker. */
export const CURRENCY_CODES: readonly string[] = [
  'AED',
  'AFN',
  'ALL',
  'AMD',
  'ANG',
  'AOA',
  'ARS',
  'AUD',
  'AWG',
  'AZN',
  'BAM',
  'BBD',
  'BDT',
  'BGN',
  'BHD',
  'BIF',
  'BMD',
  'BND',
  'BOB',
  'BRL',
  'BSD',
  'BTN',
  'BWP',
  'BYN',
  'BZD',
  'CAD',
  'CDF',
  'CHF',
  'CLP',
  'CNY',
  'COP',
  'CRC',
  'CUC',
  'CUP',
  'CVE',
  'CZK',
  'DJF',
  'DKK',
  'DOP',
  'DZD',
  'EGP',
  'ERN',
  'ETB',
  'EUR',
  'FJD',
  'FKP',
  'GBP',
  'GEL',
  'GHS',
  'GIP',
  'GMD',
  'GNF',
  'GTQ',
  'GYD',
  'HKD',
  'HNL',
  'HRK',
  'HTG',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'IQD',
  'IRR',
  'ISK',
  'JMD',
  'JOD',
  'JPY',
  'KES',
  'KGS',
  'KHR',
  'KMF',
  'KPW',
  'KRW',
  'KWD',
  'KYD',
  'KZT',
  'LAK',
  'LBP',
  'LKR',
  'LRD',
  'LSL',
  'LYD',
  'MAD',
  'MDL',
  'MGA',
  'MKD',
  'MMK',
  'MNT',
  'MOP',
  'MRU',
  'MUR',
  'MVR',
  'MWK',
  'MXN',
  'MYR',
  'MZN',
  'NAD',
  'NGN',
  'NIO',
  'NOK',
  'NPR',
  'NZD',
  'OMR',
  'PAB',
  'PEN',
  'PGK',
  'PHP',
  'PKR',
  'PLN',
  'PYG',
  'QAR',
  'RON',
  'RSD',
  'RUB',
  'RWF',
  'SAR',
  'SBD',
  'SCR',
  'SDG',
  'SEK',
  'SGD',
  'SHP',
  'SLE',
  'SLL',
  'SOS',
  'SRD',
  'SSP',
  'STN',
  'SVC',
  'SYP',
  'SZL',
  'THB',
  'TJS',
  'TMT',
  'TND',
  'TOP',
  'TRY',
  'TTD',
  'TWD',
  'TZS',
  'UAH',
  'UGX',
  'USD',
  'UYU',
  'UZS',
  'VES',
  'VND',
  'VUV',
  'WST',
  'XAF',
  'XCD',
  'XCG',
  'XDR',
  'XOF',
  'XPF',
  'XSU',
  'YER',
  'ZAR',
  'ZMW',
  'ZWG',
  'ZWL',
];

/** A currency's real name for a code, e.g. "USD" → "US Dollar". */
export function currencyName(code: string): string {
  if (!code) return '';
  const upper = code.toUpperCase();
  try {
    return CURRENCY_DISPLAY?.of(upper) ?? upper;
  } catch {
    return upper;
  }
}

/**
 * Currency options sorted by name — the shape the Select `items` prop wants.
 *
 * The code stays in the label, in brackets. A country picker does not need one
 * because nobody writes an invoice in "DE", but a business owner reading a
 * supplier's paperwork sees USD on it and needs to match the two up. Selling
 * settings had worked that out already; this is that spelling, everywhere.
 */
export function currencyOptions(): { value: string; label: string }[] {
  return CURRENCY_CODES.map((code) => ({
    value: code,
    label: `${currencyName(code)} (${code})`,
  })).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Every currency by name, plus two entries that depend on what is there:
 * a way back to blank when the field is optional, and the current value when it
 * is not a currency we can name.
 *
 * Nothing ever validated these fields beyond "three letters", so a stored value
 * may be a code this platform cannot name. A picker that silently dropped it
 * would change her data by being opened. [[feedback_honor_the_users_choice]]
 */
export function currencyItems(
  value: string,
  required?: boolean
): { value: string; label: string }[] {
  const known = CURRENCY_CODES.includes(value.toUpperCase());
  return [
    ...(required === true ? [] : [{ value: '', label: 'No currency' }]),
    ...(value !== '' && !known ? [{ value, label: `${value} (not a currency we know)` }] : []),
    ...currencyOptions(),
  ];
}
