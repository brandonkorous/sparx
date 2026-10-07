# 122 — An invited member could not save their own settings

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 8 (Mike Van Der Berg's first minutes in Gillett)
**Surface:** workbench (both consoles): the analytics question, the welcome tour, view defaults, notification choices; Piggles account app (cookie choices); `PATCH /v1/me/preferences`, `PUT /v1/me/notification-preferences`, `POST /api/consent`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Mike signed up from his invitation. That gave him a home business of his own ("Mike's workspace"), and he joined Gillett as an Editor. Inside Gillett, nothing he set for himself saved:

- The analytics question answered "That did not save". It came back on every page load.
- Stopping the welcome tour, and every view default, saved nothing. `PATCH /v1/me/preferences` answered 500.
- Notification choices (`PUT /v1/me/notification-preferences`) failed the same way.

A person's `users` row belongs to their home business. The database rules let a member READ that row from a business they joined, and never write it. Every one of these writes ran under the business he was acting in.

## What should have happened

A person's own settings save wherever they are working.

## Why it matters

Every person a business invites hits this on day one. The same question on every page load, a tour that will not go away, and "That did not save" on choices about their own privacy tell a new employee the product is broken.

## The fix

Writes to a person's own row run under their home business. One rule, applied at both doors:

- API: `wizeworks/packages/api-core/src/db.ts` gains `withOwnUserRow(request, fn)`. It looks up the person's home business and runs the write there. `me.ts` (preferences) and `notification-preferences.ts` use it.
- Session: `wizeworks/packages/auth/src/session.ts` now reports `homeTenantId` beside `tenantId`. `tenantId` stays the business they act in.
- `sparx/apps/workbench/app/api/consent/route.ts` writes under `homeTenantId`.
- Piggles account app: `lib/consent.ts` and its callers (`account/page.tsx`, `cookie-choices/actions.ts`, `cookie-choices/page.tsx`, `handoff/route.ts`) read and write under `homeTenantId`.

No other code writes a person's own row (searched: every `user.update`, `user.upsert` and `UPDATE users`; the sign-in stamp uses the auth client, which these rules do not limit).

Tests, each proved red:

- `api-rest/test/integration/member-saves-own-preferences.test.ts` (database): a member of a joined business saves preferences and notification choices, and the row in their home business holds them. Back on `withRequestTenant`, it reddens 1 of 1 with the 500.
- `wizeworks/packages/auth/src/session.test.ts`: in a joined business the session names both businesses; at home, both are the same; a lost membership falls back home both ways. Setting `homeTenantId` to the active business reddens 1 of 3.
- `sparx/apps/workbench/app/api/consent/route.test.ts`: the answer is written under the home business. Back on `tenantId`, it reddens 1 of 1.

## Confirmed by

On screen, 2026-10-06, as Mike in Gillett: before the fix, "No thanks" gave "That did not save" and the question stayed. After it, "No thanks" closed the question (`/api/consent` 200). Stop here closed the tour (`PATCH /v1/me/preferences` 200). On reload neither came back. His row holds `consent.analytics: false` and `tour.welcome.status: "skipped"`.

Not checked on screen: the Piggles account app's cookie choices for a member of a joined business. The fix there is the same call with the same field, and both consoles typecheck.

## Rating effect

—
