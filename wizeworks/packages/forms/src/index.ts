'use client';

import * as React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Field validation — the client engine behind silica's FieldStatus treatment.
//
// silica's <Field status statusMessage> renders the control accent, the trailing
// status icon, and the attached message panel. This hook is the small, uniform
// state machine that decides WHICH field shows WHICH message, WHEN — so every form
// in the dashboard drives that treatment the same way instead of hand-rolling
// touched/submitted/error bookkeeping per form.
//
// Usage:
//   const values = { email, password };
//   const v = useFieldValidation(values, {
//     email: (val) => (isEmail(val) ? null : 'Enter a valid email address.'),
//     password: (val) => (val.length >= 8 ? null : 'At least 8 characters.'),
//   });
//   ...
//   <Field {...v.field('email')}>
//     <FieldLabel required>Work email</FieldLabel>
//     <FieldControl type="email" value={email}
//       onChange={(e) => setEmail(e.target.value)} {...v.control('email')} />
//   </Field>
//   ...
//   async function onSubmit(e) {
//     e.preventDefault();
//     if (!v.validate()) return;              // marks every field touched, blocks if invalid
//     const res = await action(values);
//     if (!res.ok) v.setServerErrors({ email: res.error });  // maps onto the field
//   }
//
// Gating: a client error surfaces only once its field is touched (blurred) OR a
// submit has been attempted — so a pristine form isn't a wall of red. Server errors
// surface immediately (they only ever arrive from a submit) and clear when the user
// re-touches that field to fix it.
// ─────────────────────────────────────────────────────────────────────────────

/** silica FieldStatusValue — the status axis a Field can render. */
export type FieldStatus = 'error' | 'warning' | 'success';

/** A rule for one field: return a message when invalid, or null/undefined when valid. */
export type FieldRule<T, K extends keyof T> = (value: T[K], all: T) => string | null | undefined;

export type FieldRules<T> = { [K in keyof T]?: FieldRule<T, K> };

type ErrorMap<T> = Partial<Record<keyof T, string>>;

export interface FieldValidation<T> {
  /** Live client errors (not gated by touched/submit) — every currently-invalid field. */
  errors: ErrorMap<T>;
  /** True when no field currently fails its client rule. */
  isValid: boolean;
  /** Mark a field interacted-with. Wired automatically via `control(field).onBlur`. */
  touch: (field: keyof T) => void;
  /** The message that should currently surface for a field (respects gating + server errors). */
  visibleError: (field: keyof T) => string | undefined;
  /** Spread onto a silica `<Field>` — drives status accent, icon, and message panel. */
  field: (field: keyof T) => { status?: FieldStatus; statusMessage?: string };
  /** Spread onto the field's `<FieldControl>` (or control) — wires blur tracking. */
  control: (field: keyof T) => { onBlur: () => void };
  /**
   * Call at the top of onSubmit, before async work. Marks every field touched (so
   * all outstanding errors reveal) and returns true when the form is valid.
   */
  validate: () => boolean;
  /** Surface server-returned errors keyed by field name (e.g. "email already in use"). */
  setServerErrors: (errors: ErrorMap<T>) => void;
  /** Clear all server errors (e.g. when re-opening a form). */
  clearServerErrors: () => void;
}

export function useFieldValidation<T extends Record<string, unknown>>(
  values: T,
  rules: FieldRules<T>
): FieldValidation<T> {
  const [touched, setTouched] = React.useState<Partial<Record<keyof T, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [serverErrors, setServerErrorsState] = React.useState<ErrorMap<T>>({});

  // Callers pass an inline `rules` literal whose identity changes every render; hold
  // the latest in a ref so it never destabilises the memo below.
  const rulesRef = React.useRef(rules);
  rulesRef.current = rules;

  const errors = React.useMemo<ErrorMap<T>>(() => {
    const out: ErrorMap<T> = {};
    const currentRules = rulesRef.current;
    for (const key in currentRules) {
      const rule = currentRules[key];
      if (!rule) continue;
      const message = rule(values[key], values);
      if (message) out[key] = message;
    }
    return out;
  }, [values]);

  const isValid = Object.keys(errors).length === 0;

  const touch = React.useCallback((field: keyof T) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
    // The user is fixing this field — retire its stale server error.
    setServerErrorsState((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const visibleError = React.useCallback(
    (field: keyof T): string | undefined => {
      const client = errors[field];
      if (client && (touched[field] || submitAttempted)) return client;
      return serverErrors[field];
    },
    [errors, touched, submitAttempted, serverErrors]
  );

  const field = React.useCallback(
    (f: keyof T): { status?: FieldStatus; statusMessage?: string } => {
      const message = visibleError(f);
      return message ? { status: 'error', statusMessage: message } : {};
    },
    [visibleError]
  );

  const control = React.useCallback((f: keyof T) => ({ onBlur: () => touch(f) }), [touch]);

  const validate = React.useCallback((): boolean => {
    setSubmitAttempted(true);
    setServerErrorsState({});
    return Object.keys(errors).length === 0;
  }, [errors]);

  const setServerErrors = React.useCallback((next: ErrorMap<T>) => {
    setServerErrorsState(next);
    setSubmitAttempted(true);
  }, []);

  const clearServerErrors = React.useCallback(() => setServerErrorsState({}), []);

  return {
    errors,
    isValid,
    touch,
    visibleError,
    field,
    control,
    validate,
    setServerErrors,
    clearServerErrors,
  };
}

// ── Small, reusable rule builders ────────────────────────────────────────────
// Composable so forms read declaratively. Each returns a FieldRule.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Hostname / registrable domain: labels of a–z0–9(-), no leading/trailing hyphen,
// at least one dot, TLD ≥ 2 letters. Lowercased before testing.
const HOSTNAME_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Lenient phone: 7–15 digits after stripping spaces, dashes, parens, dots, +.
const PHONE_DIGITS_RE = /^\+?[\d\s().-]{7,20}$/;

/** Coerce an input value (often a string from a controlled `<input>`) to a number. */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

/**
 * Options accepted by the string-format builders. Pass a bare string as shorthand
 * for `{ message }` (backwards-compatible), or an object to also set `optional`.
 * An `optional` format field validates only when non-blank — pair with `required`
 * when the field is mandatory.
 */
type FormatOpts = string | { optional?: boolean; message?: string };

function normFormat(
  opts: FormatOpts | undefined,
  fallback: string
): {
  optional: boolean;
  message: string;
} {
  if (typeof opts === 'string') return { optional: false, message: opts };
  return { optional: opts?.optional ?? false, message: opts?.message ?? fallback };
}

export const rule = {
  required:
    (message = 'This field is required.') =>
    (value: unknown): string | null => {
      if (value == null) return message;
      if (typeof value === 'string' && value.trim().length === 0) return message;
      if (typeof value === 'boolean' && !value) return message;
      if (Array.isArray(value) && value.length === 0) return message;
      return null;
    },
  email:
    (opts?: FormatOpts) =>
    (value: unknown): string | null => {
      const { optional, message } = normFormat(opts, 'Enter a valid email address.');
      if (optional && isBlank(value)) return null;
      return typeof value === 'string' && EMAIL_RE.test(value.trim()) ? null : message;
    },
  minLength:
    (min: number, message?: string) =>
    (value: unknown): string | null => {
      const length = typeof value === 'string' ? value.length : 0;
      return length >= min ? null : (message ?? `Must be at least ${min} characters.`);
    },
  maxLength:
    (max: number, message?: string) =>
    (value: unknown): string | null => {
      const length = typeof value === 'string' ? value.length : 0;
      return length <= max ? null : (message ?? `Must be ${max} characters or fewer.`);
    },
  matches:
    <T>(other: keyof T, message = 'Values do not match.') =>
    (value: unknown, all: T): string | null =>
      value === all[other] ? null : message,
  pattern:
    (re: RegExp, opts?: FormatOpts) =>
    (value: unknown): string | null => {
      const { optional, message } = normFormat(opts, 'Invalid format.');
      if (optional && isBlank(value)) return null;
      return typeof value === 'string' && re.test(value.trim()) ? null : message;
    },
  // Numeric bounds — coerce the (usually string) input; a blank/non-numeric value
  // fails so pair with `required` when the field is mandatory.
  min:
    (limit: number, message?: string) =>
    (value: unknown): string | null => {
      const n = toNumber(value);
      return n != null && n >= limit ? null : (message ?? `Must be at least ${limit}.`);
    },
  max:
    (limit: number, message?: string) =>
    (value: unknown): string | null => {
      const n = toNumber(value);
      return n != null && n <= limit ? null : (message ?? `Must be at most ${limit}.`);
    },
  // Numeric validator with composable constraints — the workhorse for money/qty
  // fields. `rule.number()` alone just requires a parseable number; add options for
  // bounds/integer/non-zero. A single custom `message` overrides every sub-message.
  number:
    (
      opts: {
        min?: number;
        max?: number;
        gt?: number;
        integer?: boolean;
        nonZero?: boolean;
        /** Blank/empty passes (for non-required numeric fields). */
        optional?: boolean;
        message?: string;
      } = {}
    ) =>
    (value: unknown): string | null => {
      if (opts.optional && (value == null || (typeof value === 'string' && value.trim() === '')))
        return null;
      const n = toNumber(value);
      if (n == null) return opts.message ?? 'Enter a valid number.';
      if (opts.integer && !Number.isInteger(n)) return opts.message ?? 'Must be a whole number.';
      if (opts.nonZero && n === 0) return opts.message ?? 'Must not be zero.';
      if (opts.gt != null && !(n > opts.gt))
        return opts.message ?? `Must be greater than ${opts.gt}.`;
      if (opts.min != null && n < opts.min) return opts.message ?? `Must be at least ${opts.min}.`;
      if (opts.max != null && n > opts.max) return opts.message ?? `Must be at most ${opts.max}.`;
      return null;
    },
  url:
    (opts?: FormatOpts) =>
    (value: unknown): string | null => {
      const { optional, message } = normFormat(opts, 'Enter a valid URL.');
      if (optional && isBlank(value)) return null;
      if (typeof value !== 'string' || value.trim() === '') return message;
      try {
        // Accept bare hosts by defaulting the scheme.
        new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
        return null;
      } catch {
        return message;
      }
    },
  hostname:
    (opts?: FormatOpts) =>
    (value: unknown): string | null => {
      const { optional, message } = normFormat(opts, 'Enter a valid domain (e.g. example.com).');
      if (optional && isBlank(value)) return null;
      return typeof value === 'string' && HOSTNAME_RE.test(value.trim().toLowerCase())
        ? null
        : message;
    },
  slug:
    (opts?: FormatOpts) =>
    (value: unknown): string | null => {
      const { optional, message } = normFormat(
        opts,
        'Use lowercase letters, numbers, and hyphens only.'
      );
      if (optional && isBlank(value)) return null;
      return typeof value === 'string' && SLUG_RE.test(value.trim()) ? null : message;
    },
  phone:
    (opts?: FormatOpts) =>
    (value: unknown): string | null => {
      const { optional, message } = normFormat(opts, 'Enter a valid phone number.');
      if (optional && isBlank(value)) return null;
      return typeof value === 'string' && PHONE_DIGITS_RE.test(value.trim()) ? null : message;
    },
};

/**
 * Compose multiple rules into one — first failing message wins. Lets a field carry
 * `required` + `email` (etc.) without nesting ternaries at the call site.
 */
export function rules<T, K extends keyof T>(...list: FieldRule<T, K>[]): FieldRule<T, K> {
  return (value, all) => {
    for (const r of list) {
      const message = r(value, all);
      if (message) return message;
    }
    return null;
  };
}
