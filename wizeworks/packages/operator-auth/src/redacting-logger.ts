// Better Auth's logger, with email addresses masked.
//
// Better Auth logs "User not found { email }" at error level on every failed
// sign-in, so each mistyped or guessed address went to the logs and on to
// WizeLens (trace 4d32a5bf). A copy of @wizeworks/auth's, kept in step with
// auth and customer-auth; this package does not depend on @wizeworks/auth.

import type { BetterAuthOptions } from 'better-auth';

type Level = 'debug' | 'info' | 'warn' | 'error';

const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const MAX_DEPTH = 4;

/** `jane@example.com` → `j***@example.com`, anywhere in the text. */
export function maskEmails(text: string): string {
  return text.replace(EMAIL, '$1***@$2');
}

/** A copy of `value` with every email in it masked, keys named email included. */
export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return maskEmails(value);
  if (value === null || typeof value !== 'object' || depth >= MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value instanceof Error) return maskEmails(value.message);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redact(item, depth + 1)])
  );
}

const WRITE: Record<Level, (...args: unknown[]) => void> = {
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

/** The `logger` option for betterAuth(): warn and up, emails masked. */
export const redactingLogger: NonNullable<BetterAuthOptions['logger']> = {
  level: 'warn',
  log: (level: Level, message: string, ...args: unknown[]) => {
    WRITE[level](`[Better Auth]: ${maskEmails(message)}`, ...args.map((arg) => redact(arg)));
  },
};
