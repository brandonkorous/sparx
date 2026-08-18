// Text → typed value, for every place a field's value arrives as a string.
//
// A spreadsheet has no types. Every cell is text: "yes", "1,250.00", "3/14/2027",
// "$4,800". The validator in ./validate is deliberately strict — it is the thing
// standing between a tenant's declared schema and their stored data — so the
// coercion has to happen BEFORE it, in one place, rather than as a pile of
// per-caller `Number(x) || 0` that each guess differently.
//
// This module is the one place that guesses, and it guesses conservatively:
// anything it cannot read confidently comes back as a `problem` rather than as a
// silently wrong value. A CSV row that says "maybe" under a yes/no column is a
// row the person needs to look at, not a `false`.
//
// Used by the CRM import worker (docs/144 §3.5) and available to the CMS and
// commerce importers, which have the same problem and had been solving it
// ad hoc.

import type { CurrencyValue, FieldDef } from './types';

export interface CoercionProblem {
  field: string;
  message: string;
}

export interface CoercionResult {
  /** The typed value, or `undefined` when the text was blank. */
  value?: unknown;
  problem?: CoercionProblem;
}

/** Words a person actually types in a spreadsheet for "yes". */
const TRUTHY = new Set(['true', 'yes', 'y', '1', 'on', 'x', '✓', 'checked']);
const FALSY = new Set(['false', 'no', 'n', '0', 'off', '', '-', '—']);

/**
 * A number as a person writes it: "1,250.00", "$4,800", "12.5%", "(300)".
 *
 * Returns null rather than NaN so a caller can tell "unreadable" from "zero" —
 * `Number('')` is 0, which is exactly how a blank cell becomes a real number
 * nobody typed.
 */
export function parseLooseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;

  // Accounting negatives: (300) means -300.
  const negated = /^\(.*\)$/.test(trimmed);
  const stripped = trimmed
    .replace(/^\(|\)$/g, '')
    // Currency symbols, thousands separators, a trailing percent, and the
    // non-breaking space some spreadsheets export inside numbers (written as
    // an escape — a literal one is invisible in a diff, and lint rightly bans it).
    .replace(/[$£€¥₹\s\u00a0,]/g, '')
    .replace(/%$/, '');

  if (stripped === '' || !/^[+-]?\d*\.?\d+$/.test(stripped)) return null;
  const value = Number(stripped);
  if (!Number.isFinite(value)) return null;
  return negated ? -value : value;
}

/**
 * A date as a person writes it, normalised to `YYYY-MM-DD`.
 *
 * Handles the ISO form and the US `M/D/YYYY` a spreadsheet exports by default.
 * `D/M/YYYY` is DELIBERATELY not guessed: 3/4/2027 is two different days
 * depending on where you live and nothing in a CSV says which, so a locale guess
 * here would put a quarter of all dates silently in the wrong month. Ambiguous
 * input is reported, and the person can re-export as ISO.
 */
export function parseLooseDate(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return `${iso[1]!}-${iso[2]!}-${iso[3]!}`;

  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${us[3]!}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
}

/** A date and time, normalised to an ISO instant. */
export function parseLooseDateTime(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    // Fall back to a bare date at midnight, so a "date and time" column that
    // happens to hold only days still imports.
    const day = parseLooseDate(trimmed);
    return day === null ? null : new Date(`${day}T00:00:00.000Z`).toISOString();
  }
  return parsed.toISOString();
}

/**
 * Match a person's text against an enum's options — by stored value first, then
 * by the label they actually see. A spreadsheet filled in by hand holds labels
 * ("Net 30"), not the values behind them ("net30").
 */
function matchOption(field: Extract<FieldDef, { type: 'enum' }>, text: string): string | undefined {
  const needle = text.trim().toLowerCase();
  const byValue = field.options.find((o) => o.value.toLowerCase() === needle);
  if (byValue) return byValue.value;
  const byLabel = field.options.find((o) => o.label.toLowerCase() === needle);
  return byLabel?.value;
}

/** Split a multi-value cell: "red, blue" or "red|blue". */
function splitList(text: string): string[] {
  return text
    .split(/[,|;]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read one spreadsheet cell as one declared field.
 *
 * A blank cell always yields `{}` — "this row says nothing about this field" —
 * never a zero, an empty string or a false. That distinction is what lets an
 * import update three columns without blanking the other twelve.
 */
export function coerceFromText(field: FieldDef, raw: string): CoercionResult {
  const text = raw.trim();
  const bad = (message: string): CoercionResult => ({
    problem: { field: field.key, message },
  });

  // Calculated fields are worked out on write and would be overwritten anyway,
  // so a column for one is silently ignored rather than reported — the person
  // exported what they saw, and being told off for it helps nobody.
  if (field.type === 'calculated') return {};

  if (text === '') {
    // Except yes/no, where an empty cell in a column full of ticks is a
    // deliberate "no" — that is what an unticked box looks like on export.
    if (field.type === 'boolean') return { value: false };
    return {};
  }

  switch (field.type) {
    case 'text':
    case 'long_text':
    case 'rich_text':
    case 'slug':
    case 'url':
    case 'email':
      return { value: text };

    case 'number': {
      const parsed = parseLooseNumber(text);
      if (parsed === null) return bad(`"${raw}" is not a number.`);
      if (field.integer === true && !Number.isInteger(parsed)) {
        return bad(`"${raw}" needs to be a whole number.`);
      }
      return { value: parsed };
    }

    case 'currency': {
      // A code written in the cell ("4800 EUR", "EUR 4800") wins over the
      // field's default, because the person was more specific than the schema.
      // It is pulled off BEFORE the number is read — three letters glued to a
      // figure are not part of the figure.
      const written = /(?:^|\s)([A-Z]{3})(?:\s|$)/.exec(text.toUpperCase());
      const currency = written?.[1] ?? field.currency ?? 'USD';
      const amount = parseLooseNumber(written ? text.replace(/[A-Za-z]{3}/, ' ') : text);
      if (amount === null) return bad(`"${raw}" is not an amount of money.`);
      const value: CurrencyValue = { amount, currency };
      return { value };
    }

    case 'boolean': {
      const needle = text.toLowerCase();
      if (TRUTHY.has(needle)) return { value: true };
      if (FALSY.has(needle)) return { value: false };
      return bad(`"${raw}" is not a yes or a no.`);
    }

    case 'date': {
      const parsed = parseLooseDate(text);
      if (parsed === null) {
        return bad(`"${raw}" is not a date we can read. Try 2027-03-14 or 3/14/2027.`);
      }
      return { value: parsed };
    }

    case 'datetime': {
      const parsed = parseLooseDateTime(text);
      if (parsed === null) return bad(`"${raw}" is not a date and time we can read.`);
      return { value: parsed };
    }

    case 'enum': {
      if (field.multiple === true) {
        const picked: string[] = [];
        for (const part of splitList(text)) {
          const match = matchOption(field, part);
          if (match === undefined) return bad(`"${part}" is not one of the choices.`);
          picked.push(match);
        }
        return { value: picked };
      }
      const match = matchOption(field, text);
      if (match === undefined) return bad(`"${raw}" is not one of the choices.`);
      return { value: match };
    }

    case 'user':
    case 'reference':
    case 'asset': {
      // These point at other records, and a spreadsheet can only carry the id.
      // Resolving a NAME to a person or a record is a different job (it needs a
      // lookup, and it can be ambiguous), so anything that is not an id is
      // reported rather than guessed at.
      const ids = field.multiple === true ? splitList(text) : [text];
      const wrong = ids.find((id) => !UUID_RE.test(id));
      if (wrong !== undefined) {
        return bad(`"${wrong}" is not an id. This column needs the id of the record it points at.`);
      }
      return { value: field.multiple === true ? ids : ids[0] };
    }

    case 'object':
    case 'repeater': {
      // A nested structure has no honest one-cell representation, so the only
      // thing a column can hold is the JSON itself.
      try {
        return { value: JSON.parse(text) as unknown };
      } catch {
        return bad('This detail holds several values, so its column has to contain JSON.');
      }
    }

    default:
      return {};
  }
}
