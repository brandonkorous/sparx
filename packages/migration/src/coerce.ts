// Value coercion — one implementation, used by the browser validator, the vendor
// adapters and the import processors.
//
// The reason this is a module rather than three private helpers: the validator's job
// is to promise "this will import cleanly," and it can only keep that promise if it
// decides a value is readable using the exact function that will later read it. The
// moment the preview parses `$1,299.00` with a different regex than the worker does,
// the preview is a guess.
//
// Every function returns `undefined` for "absent or unreadable" and never throws.
// Distinguishing absent from unreadable is the validator's job — it has the field
// spec and can tell "" apart from "call for price".

/** Trim, and treat the strings exports use for emptiness as empty. */
export function clean(value: string | undefined | null): string {
  const text = (value ?? '').trim();
  // Magento writes `\N`; some Salesforce reports write `-`; Excel writes `#N/A`.
  if (text === '\\N' || text === '#N/A' || text === 'N/A' || text === '-') return '';
  return text;
}

export function isBlank(value: string | undefined | null): boolean {
  return clean(value) === '';
}

/**
 * Decide what a `,` and a `.` MEAN in a number, then rewrite it as plain JS.
 *
 * This is the single nastiest ambiguity in the whole package. `1,200` is twelve
 * hundred to a US export and one-point-two to a German one, and both land in the same
 * column. The rules, in order:
 *
 *   Both separators present → the LAST one is the decimal point. `1,299.00` is Anglo,
 *   `1.299,00` is European, and there is no ambiguity at all in this case.
 *
 *   Only commas → a group of exactly three digits after the last comma means it is a
 *   thousands separator (`1,200` → 1200). Anything else is a decimal comma (`8,99`
 *   → 8.99). Three digits after a decimal comma is possible but vanishingly rare in
 *   money, and reading `1,200` as 1.2 has been the more expensive mistake.
 *
 *   Only dots → one dot is a decimal point; several must be thousands (`1.299.000`).
 */
export function normalizeSeparators(body: string): string {
  const lastComma = body.lastIndexOf(',');
  const lastDot = body.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    return lastComma > lastDot ? body.replace(/\./g, '').replace(',', '.') : body.replace(/,/g, '');
  }

  if (lastComma !== -1) {
    const tail = body.slice(lastComma + 1);
    const groupsOfThree = /^\d{1,3}(,\d{3})+$/.test(body);
    return groupsOfThree ||
      (tail.length === 3 && body.split(',').length === 2 && !tail.startsWith('0'))
      ? body.replace(/,/g, '')
      : body.replace(',', '.');
  }

  if (lastDot !== -1 && body.split('.').length > 2) return body.replace(/\./g, '');

  return body;
}

/**
 * Money → integer minor units (cents).
 *
 * Handles the shapes exports actually contain: `1299`, `1,299.00`, `$1,299.00`,
 * `1.299,00` (European, Magento and Wix both emit it for EU stores), `(12.00)` for a
 * negative, and a trailing currency code (`12.00 USD`).
 */
export function toCents(value: string | undefined): number | undefined {
  const text = clean(value);
  if (text === '') return undefined;

  let body = text.replace(/[A-Za-z$£€¥₹\s]/g, '');
  let negative = false;
  if (body.startsWith('(') && body.endsWith(')')) {
    negative = true;
    body = body.slice(1, -1);
  }
  if (body.startsWith('-')) {
    negative = true;
    body = body.slice(1);
  }
  if (body === '') return undefined;

  const amount = Number(normalizeSeparators(body));
  if (!Number.isFinite(amount)) return undefined;
  const cents = Math.round(amount * 100);
  return negative ? -cents : cents;
}

/** A whole number. `12.0` is 12; `12.7` is 13; `twelve` is undefined. */
export function toInteger(value: string | undefined): number | undefined {
  const number = toDecimal(value);
  return number === undefined ? undefined : Math.round(number);
}

/** A plain number, tolerating thousands separators and a stray unit suffix. */
export function toDecimal(value: string | undefined): number | undefined {
  const text = clean(value);
  if (text === '') return undefined;
  const body = text.replace(/[^\d.,-]/g, '');
  if (body === '' || body === '-') return undefined;
  const negative = body.startsWith('-');
  const number = Number(normalizeSeparators(negative ? body.slice(1) : body)) * (negative ? -1 : 1);
  return Number.isFinite(number) ? number : undefined;
}

const TRUE = new Set([
  'true',
  'yes',
  'y',
  '1',
  'on',
  'enabled',
  'active',
  'visible',
  'published',
  'x',
]);
const FALSE = new Set(['false', 'no', 'n', '0', 'off', 'disabled', 'inactive', 'hidden', 'draft']);

/** Boolean from the dozen spellings exports use. */
export function toBoolean(value: string | undefined): boolean | undefined {
  const text = clean(value).toLowerCase();
  if (text === '') return undefined;
  if (TRUE.has(text)) return true;
  if (FALSE.has(text)) return false;
  return undefined;
}

/**
 * Date → ISO 8601 string.
 *
 * Accepts ISO, `YYYY-MM-DD HH:MM:SS` (Shopify, WooCommerce), `MM/DD/YYYY` (HubSpot US
 * exports, Salesforce reports), and a bare Unix epoch in seconds or milliseconds
 * (Ghost, Klaviyo). Ambiguous `03/04/2026` is read US-first because every platform in
 * the roster that emits slashes is US-headquartered and exports US order by default —
 * a documented guess, surfaced to the tenant as a warning by the validator rather than
 * silently assumed.
 */
export function toIsoDate(value: string | undefined): string | undefined {
  const text = clean(value);
  if (text === '') return undefined;

  if (/^\d{10}$/.test(text)) return new Date(Number(text) * 1000).toISOString();
  if (/^\d{13}$/.test(text)) return new Date(Number(text)).toISOString();

  const slash =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/.exec(
      text
    );
  if (slash) {
    const [, mm, dd, yyyy, hh = '0', min = '0', ss = '0', meridiem] = slash;
    let hour = Number(hh);
    if (meridiem?.toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (meridiem?.toLowerCase() === 'am' && hour === 12) hour = 0;
    const date = new Date(
      Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), hour, Number(min), Number(ss))
    );
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  // `2026-05-27 14:03:22 -0400` and `2026-05-27 14:03:22` both need the space swapped
  // for a T before Date will read them consistently across engines.
  const normalized = /^\d{4}-\d{2}-\d{2} /.test(text) ? text.replace(' ', 'T') : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** True when a date string is ambiguous between US and European ordering. */
export function isAmbiguousDate(value: string | undefined): boolean {
  const match = /^(\d{1,2})\/(\d{1,2})\/\d{4}/.exec(clean(value));
  if (!match) return false;
  const first = Number(match[1]);
  const second = Number(match[2]);
  return first <= 12 && second <= 12 && first !== second;
}

/** Split a delimited list cell. Commas by default; falsy entries dropped. */
export function toList(value: string | undefined, separator = ','): string[] {
  const text = clean(value);
  if (text === '') return [];
  return text
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/** URL-safe slug. Matches the shape the rest of the platform expects. */
export function toSlug(value: string | undefined): string {
  return (
    clean(value)
      .toLowerCase()
      .normalize('NFKD')
      // Strip the combining marks NFKD just split off, so `Café` slugs as `cafe`
      // rather than `cafe-` — written as escapes because bare combining characters
      // in source are invisible in a diff and get mangled by editors.
      .replace(/[\u0300-\u036f]/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 255)
  );
}

/** Path-only form of a URL, for redirects. `https://old.com/a/b?x=1` → `/a/b`. */
export function toPath(value: string | undefined): string | undefined {
  const text = clean(value);
  if (text === '') return undefined;
  if (text.startsWith('/')) return text.split('?')[0];
  const match = /^https?:\/\/[^/]+(\/[^?#]*)?/.exec(text);
  if (!match) return undefined;
  const path = match[1] ?? '/';
  return path === '' ? '/' : path;
}

const EMAIL = /^[^\s@,;]+@[^\s@,;.]+\.[^\s@,;]+$/;

export function isEmail(value: string | undefined): boolean {
  return EMAIL.test(clean(value));
}

/** Digits-only comparison form of a phone number, for dedupe. */
export function toPhoneDigits(value: string | undefined): string {
  return clean(value).replace(/\D/g, '');
}

export function isUrl(value: string | undefined): boolean {
  const text = clean(value);
  if (text === '') return false;
  if (text.startsWith('/')) return true;
  if (text.startsWith('//')) return true;
  return /^https?:\/\/[^\s]+$/i.test(text);
}
