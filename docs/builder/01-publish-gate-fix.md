# 01 — Phase 1: Fix the publish gate (verified-email RLS read)

> ⚠️ **SUPERSEDED 2026-07-22.** This plan predates the silicaui `<Builder>` adoption — sparx now HOSTS silica's engine (Insert palette, canvas, layers, inspector, undo/redo) instead of building its own. See **docs/118-builder-silicaui-html-migration.md** for the current architecture. Kept for historical context.

Version: 1.1
Author: Brandon Korous
Last Updated: 2026-07-22

> Publishing — and rollback and schedule — is **blocked in local dev for any
> post-onboarding tenant**, even when the user's email _is_ verified. The cause is
> a base-client `prisma.user` read inside `requireVerifiedEmail` that the `users`
> table's RLS returns empty for under the app role. This phase makes the gate read
> the verified flag from a source that can actually see it, and adds a regression
> test under the non-owner role so it can't silently regress.
>
> This is Phase 1 because it is a correctness bug, and because the canvas↔live
> parity work (Phase 2) and every "does what ships match the canvas?" check
> depend on being able to publish locally. See
> [evaluation Finding 1](../evaluations/builder-eval-findings-2026-06-14.md).

## 1. The problem

`POST /v1/sitebuilder/publish` (and `/rollback`, `/schedule`) call
`requireVerifiedEmail(request)` after the role + module gates
(`wizeworks/services/api-rest/src/routes/v1/sitebuilder/publish.ts:41,82,91`). That guard:

```ts
// wizeworks/services/api-rest/src/lib/verified-email-guard.ts:39
const [user, tenant] = await Promise.all([
  prisma.user.findUnique({ where: { id: auth.actorId }, select: { emailVerified: true } }),
  prisma.tenant.findUnique({ where: { id: auth.tenantId }, select: { settings: true } }),
]);
if (user?.emailVerified) return;
if (!onboardingFinished(tenant?.settings ?? null)) return;
throw forbidden(VERIFY_EMAIL_MESSAGE);
```

`prisma` here is the **base client**, with no tenant GUC set. The `users` table is
`ENABLE` RLS (auth tables are `ENABLE`-only, not `FORCE` —
[wizeworks/packages/db/CLAUDE.md](../../packages/db/CLAUDE.md)). In local dev api-rest
connects as **`sparx_app`** (a non-owner role; see `wizeworks/services/api-rest/.env`
`DATABASE_URL`). For a non-owner under `ENABLE`-only RLS with no permissive
policy, the row read returns **null** → `user?.emailVerified` is `undefined` →
falsy → if onboarding is finished, `forbidden()` is thrown.

**Confirmed:** `e2e-staff@sparx.test` has `users.email_verified = t` in the DB, yet
Publish on `/builder/brand` flips the save state to "Save failed" with the title
_"Confirm your email address to use this feature."_

**Why it "works in prod":** prod api-rest connects as the table-owner role, which
bypasses `ENABLE`-only RLS, so the read succeeds. Relying on that asymmetry hides
the bug from every local test and is fragile.

## 2. Decisions

**2.1 Read the verified flag from the authenticated identity, not a fresh DB
read.** The actor is already authenticated by `requireAuth`; the session/JWT that
produced `auth` is the authority on who the user is. Source `emailVerified` from
the auth context (extend the session/JWT claim if it isn't already carried), so
the guard makes **zero** RLS-sensitive reads for the common path.

**2.2 If a DB read is unavoidable, scope it.** Should the verified flag need to
come from the DB (e.g. it must be live, not a stale claim), read it through a
context that can see the row — either the request's tenant-scoped client, or an
explicit owner/bypass path reserved for auth lookups — never the bare base client
under the app role. Document the choice inline.

**2.3 Add a regression test that runs as the non-owner role.** The existing tests
pass because they run as the owner (or via `app.inject` without RLS). Add an
integration test that exercises `requireVerifiedEmail` (or the publish route) with
the connection acting as `sparx_app`, asserting a verified user is allowed.

**2.4 The gate's _policy_ is unchanged.** Verified-OR-still-onboarding stays the
rule ([16](../16-auth-security.md)); this phase only fixes _how the verified bit
is read_. No change to who is gated or the onboarding exemption.

## 3. Work breakdown

| Step | File(s)                                                       | Change                                                                                                                                                                           |
| ---- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `wizeworks/services/api-rest/src/lib/verified-email-guard.ts` | Source `emailVerified` from `auth` (or a scoped read); drop the base-client `prisma.user.findUnique`.                                                                            |
| 2    | auth context / session plumbing                               | Ensure `emailVerified` is on the authenticated identity (add the claim if missing; verify Better Auth session carries it).                                                       |
| 3    | `wizeworks/services/api-rest/test/integration/…`              | New test: verified user under the `sparx_app` role can publish; unverified + onboarding-finished is still blocked; unverified + onboarding-unfinished is allowed.                |
| 4    | (verify)                                                      | Drive the browser: `/builder/brand` → Publish on a post-onboarding tenant succeeds; check a new `sitebuilder_versions` row + `published_version_id` set for the active property. |

## 4. Acceptance criteria

- Publishing the active site from `/builder/brand` (and `/builder/page`) succeeds
  for `e2e-staff@sparx.test` in local dev; a new published version is written for
  the **active property** (verify both primary and a non-primary site).
- An unverified, post-onboarding user is still blocked with the same message.
- The new integration test fails against the old code and passes against the new.
- No base-client RLS-sensitive read remains in `requireVerifiedEmail`.

## 5. Risks & notes

- **Stale claim risk (2.1):** if `emailVerified` rides a long-lived session, a user
  who verifies _after_ signing in might carry a stale `false` until re-auth.
  Mitigate by refreshing the claim on verification, or by choosing the scoped-read
  approach (2.2) if liveness matters more than avoiding the DB hit. Decide and
  document.
- **Audit other `requireVerifiedEmail`-style base-client reads.** Grep for other
  `prisma.<authTable>.find*` on the base client in request paths; the same RLS
  asymmetry could bite elsewhere (sessions, accounts).
- Small, isolated change — no schema migration. Lands independently of all later
  phases.
