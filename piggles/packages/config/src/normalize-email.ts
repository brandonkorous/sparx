// One normalisation for an email address, used everywhere an address is either
// STORED or LOOKED UP.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
// An account is reachable only if the address used to create it and the address
// used to sign in normalise to the same string. Nothing enforces that on its
// own: Better Auth's sign-in route does not lower-case or trim, and the column
// is a plain `text`, so `Bob@Shop.com ` and `bob@shop.com` are two different
// accounts as far as the lookup is concerned.
//
// The Piggles signup action trimmed its email (via `text()`) and the sign-in
// form sent whatever was typed. That asymmetry is a LOCKOUT: a leading or
// trailing space — trivially easy from autofill, from a paste, or from a phone
// keyboard's autocorrect adding one after an address — creates the account under
// the trimmed address and then fails every attempt to sign in to it, with the
// only feedback being "that email and password do not match an account". The
// person is looking at the correct address and the correct password and being
// told they are wrong.
//
// Case does the same thing and is even easier to hit, because phone keyboards
// capitalise the first letter of a field by default.
//
// ── WHY IT LIVES HERE ───────────────────────────────────────────────────────
//
// Same reasoning as `safeInternalPath`: both ends of the flow must apply the
// identical rule, and a rule that is stricter at one end than the other is a
// rule with a hole in the middle. Anything that creates, looks up, invites or
// resets by email address goes through this function.
//
// ── WHAT IT DELIBERATELY DOES NOT DO ────────────────────────────────────────
//
// No dot-stripping, no `+tag` removal. Those are provider-specific conventions
// (`b.o.b@gmail.com` reaching bob@gmail.com is Gmail's behaviour, not the
// internet's), and applying them would merge addresses that are genuinely
// different on most other hosts. Lower-casing the whole address is technically
// beyond spec too — the local part is case-sensitive per RFC 5321 — but no mail
// provider in practice treats it that way, and the alternative is locking people
// out of their own accounts over a capital letter.
//
// PASSWORDS ARE NEVER NORMALISED. A leading or trailing space is a legitimate
// part of a password, and trimming one silently locks somebody out of the
// account they just created. Only the address is touched.

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
