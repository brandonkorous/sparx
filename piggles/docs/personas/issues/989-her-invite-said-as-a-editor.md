# 989 — Her invite said "as a editor"

**Status:** fixed (code)
**Severity:** copy
**Found by:** P09 · The Marrow Review · act 10, inviting her sub-editor
**Surface:** the team invitation email, every brand (`wizeworks/packages/email/src/templates/team-invitation.tsx`)
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** not yet on screen
**Blocked on:** a resent invitation in the dev outbox

## What happened

Rosalind invited Tomas Reyes to The Marrow Review as an Editor. His email said:

- **"Rosalind Pike invited you to join The Marrow Review on Piggles as a editor.
  Accept the invitation to get access to the workspace."**

"a editor" is a grammar mistake in the first email a new colleague gets from her
business. Every editor and every admin ever invited got it. "The workspace" is
a word nothing else in Piggles uses; her business is The Marrow Review.

## Why

The template wrote a fixed "a" before the role: `as a{' '}<strong>{role}</strong>`.

## The fix

`roleWithArticle(role)` in the template picks "an" before a vowel and "a" before
anything else: "an editor", "an admin", "a member". The sentence ends "Accept
the invitation to start working in it."

## Proof

- `src/__tests__/templates.test.ts`: the editor invite reads "as an editor" and
  never says "workspace"; a new case reads "as a member". 10 pass.
- Red: with the article fixed back to "a", 1 fails. Restored, 10 of 10. Lint and
  format clean.
- Not yet on screen. The resend button on Tomas's row said "Could not send that
  invitation again" at the moment api-rest was restarting for this change; to
  confirm, resend and read `pnpm dev:mail tomas`.
