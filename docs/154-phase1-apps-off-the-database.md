# Phase 1: the apps stop touching the database

**Version:** 0.2
**Author:** Brandon Korous
**Last Updated:** 2026-10-30

Phase 1 of [153-repo-split.md](153-repo-split.md). Decision D3: no frontend app
touches the database or runs the Better Auth server. Decision Q2: the staff
auth server runs inside api-rest. This document is the design and the
definition of done.

## Scope

Three apps and one package do server-side auth or database work today:

| App                                | Session reads | Auth-server calls | Direct DB | Pure imports |
| ---------------------------------- | ------------: | ----------------: | --------: | -----------: |
| `sparx/apps/workbench`             |             9 |                16 |         2 |            3 |
| `piggles/apps/account`             |            14 |                 8 |        10 |            4 |
| `piggles/apps/workbench` (console) |             4 |                 9 |         1 |            2 |
| `piggles/packages/auth-handoff`    |               |                 1 |         1 |            1 |

The marketing apps (`sparx/apps/web`, `sparx/apps/market`, `piggles/apps/web`)
have none. Browser-side Better Auth client imports (`@wizeworks/auth/client`)
stay; they only need to reach the same origin's `/api/auth`, which keeps
working through the proxy below.

## Design

### 1. One process, two brands: the brand travels with the request

`currentPlatformBrand()` reads `PLATFORM_BRAND` from the environment. Its own
comment says that is wrong for a shared process, and api-rest is one. The
brand-scoped auth adapter, tenant provisioning, merchant sign-up and invited
owner provisioning all call it. Moved as they are, a Piggles sign-up inside
api-rest would be stamped `sparx`.

- `@wizeworks/brand-core` gains a request brand scope (`AsyncLocalStorage`):
  `runAsBrand(brand, fn)`. `currentPlatformBrand()` returns the scoped brand
  when one is set, and the environment otherwise.
- A process that serves every brand sets `PLATFORM_BRAND_SOURCE=request`. In
  that mode `currentPlatformBrand()` **throws** when no scope is set, instead
  of falling back to the default brand. Fail closed: an unscoped query is a
  bug that must stop, never a sparx query.
- `createAuth(brandConfig)` takes its brand, secret, base URL, cookie prefix,
  app name, Google keys and passkey relying party as arguments, not from the
  environment. Construction-time brand reads (the two-factor issuer, the MCP
  resource URL) use the argument.
- api-rest builds one instance per configured brand and runs every call to an
  instance inside `runAsBrand(instance.brand, ...)`.
- The frontends stop setting `PLATFORM_BRAND` for auth purposes.

### 2. The auth handler moves; its public address does not

Better Auth's base URL is part of every link it sends (verification, reset,
magic link), every OAuth redirect URI registered with Google, and the issuer of
the MCP OAuth server. Changing it signs out every connected AI tool and breaks
Google sign-in. So it stays where it is: `https://app.sparx.works/api/auth` and
`https://getpiggles.com/api/auth`.

- api-rest mounts each brand's handler at `/auth/<brand>/*`, internal only:
  an `onRequest` hook answers only the internal Host and a served brand, so
  Caddy routes no public host to it.
- Each app's `app/api/auth/[...all]/route.ts` forwards to
  `${SPARX_API_REST_URL}/auth/<brand>/:path*` (`authProxyHandlers` from
  `@wizeworks/auth-client-server`). A route handler, not a `next.config`
  rewrite: it relays every `Set-Cookie` line and the redirect untouched, so
  sessions stay first-party on the app's own domain.
- The client IP headers Better Auth reads (`x-client-ip`, `x-forwarded-for`)
  are forwarded by the rewrite.
- The `.well-known` OpenID and OAuth discovery routes proxy the same way.

### 3. Server-side session reads become one HTTP call

- api-rest: `GET /auth/<brand>/session` resolves the request's cookies to the
  same `SparxSession` shape `getSession()` returns today (user, active tenant,
  home tenant, role, active organization), including the active-membership
  lookup.
- `@wizeworks/auth-client-server` (new, no DB, no Better Auth server):
  `getSession()` and `requireSession()` with the same signatures, forwarding
  the incoming request's `cookie` and client IP headers. Wrapped in React
  `cache()` so a render makes one call.
- Every session-read call site switches its import. No call-site logic
  changes.

### 4. The consoles stop minting API tokens

- api-rest: `POST /auth/<brand>/api-token` returns the same response body
  `/api/token` returns today, minted server-side.
- Both consoles' `app/api/token/route.ts` forward to it.
  `SPARX_INTERNAL_JWT_SECRET` leaves both consoles.

### 5. Every other operation becomes an api-rest endpoint

All under `/auth/<brand>/platform/*`, authenticated by the forwarded session
cookie unless noted, and acting on the session's own business, never one named
in the request. The `/platform` prefix keeps them apart from Better Auth's own
paths: an unknown `/platform/...` path is a 404, never Better Auth. Each app
call site becomes a typed call through `platformRequest` in
`@wizeworks/auth-client-server`. A step that writes a session (sign-up,
accepting an invitation) answers with the cookies as `cookies`, and the app
sets them with `setSessionCookies`.

| #   | Operation                                                                                                                      | Callers today                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Memberships: list mine, set active                                                                                             | both `app/api/businesses/route.ts`, both `accept-invite/actions.ts`                                                                                 |
| 2   | Merchant sign-up, then sign-in (returns the session cookies to relay)                                                          | `sparx/.../components/auth/sign-up-action.ts`, `piggles/apps/account/app/signup/actions.ts`                                                         |
| 3   | Sign out (returns the cookies to clear)                                                                                        | both `app/sign-out/route.ts` in Piggles                                                                                                             |
| 4   | Account security: change password, sessions list and revoke, sign-in methods, two-factor enable, verify, disable, backup codes | the 7 `app/api/account/*` routes in each console                                                                                                    |
| 5   | Send verification email                                                                                                        | both `verify-email/actions.ts`, both `accept-invite/actions.ts`                                                                                     |
| 6   | Invitations: detail, brand match, accept and notify                                                                            | both `accept-invite/{page,actions}.ts`, both `lib/invite-joining.ts`                                                                                |
| 7   | MCP OAuth: consent request, submit consent, discovery metadata                                                                 | both `oauth/consent/page.tsx`, both `oauth/consent/submit/route.ts`, both `lib/mcp-oauth-metadata.ts`                                               |
| 8   | Cookie consent: read, write                                                                                                    | `sparx/.../app/api/consent/route.ts`, `piggles/apps/account/lib/consent.ts`                                                                         |
| 9   | Account summary (tenant, subdomain, capacity, consent)                                                                         | `piggles/apps/account/lib/account-load.ts`                                                                                                          |
| 10  | Onboarding: state, save answers, claim slug and subdomain, rename property, heard-about, finish, address check, acquisition    | `piggles/apps/account/lib/{onboarding-save,heard-about-save,business-slug,subdomain-hosts,late-acquisition}.ts`, `app/page.tsx`, `app/onboarding/*` |
| 11  | Cross-domain handoff: mint (getpiggles.com), consume and issue cookies (mypiggles.com)                                         | `piggles/apps/account/app/handoff/route.ts`, `piggles/apps/workbench/app/auth/callback/route.ts`, `piggles/packages/auth-handoff`                   |

### 6. api-rest stops calling into the apps

`api-rest/src/lib/users/password-reset.ts` and
`api-rest/src/lib/partners/provision-account.ts` call the apps' `/api/internal/*`
routes. With the auth instance in api-rest, both call it directly, and the two
app routes are deleted.

Done for password reset: it runs `auth.api.requestPasswordReset` in-process
under the brand's scope, and both apps' `user-password-reset` routes and
`accountInternalOrigin` are gone. The other direction went too:
`/internal/tenant/furnish` and `/internal/tenant/billing` (the account app's
shared-secret calls into api-rest) are now `/platform/business/furnish` and
`/platform/business/billing`, as the signed-in owner, and
`SPARX_INTERNAL_FURNISH_TOKEN` is unused.

### 7. Pure helpers move to a pure entry point

Role constants, `isFriendlySlug`, `SAMPLE_DATA_PACKS`,
`socialProviderConfigured` and the shared types import from entry points that
pull in no Prisma and no auth server.

### 8. Secrets and config

- api-rest gains, per brand: `BETTER_AUTH_SECRET`, base URL, cookie prefix, app
  name, Google client id and secret, passkey relying party, and
  `AUTH_DATABASE_URL`. Read as `<BRAND>_BETTER_AUTH_*` through brand-core's
  existing `<BRAND>_*` derivation.
- The frontend pods lose `sparx-app-secrets` and get only what they still use:
  `SPARX_API_REST_URL`, `NEXT_ACTIONS_KEY_*`, their WizeLens key.

## Rollout without signing anyone out

Sessions are database rows and cookies are signed with each brand's existing
secret, so a cookie issued by the app today validates in api-rest tomorrow.

1. Ship api-rest with both brands' auth endpoints while the apps still run
   their own handlers. Nothing calls the new endpoints yet.
2. Switch Piggles' account app, then the Piggles console, then sparx's
   workbench, one release each. Each switch is reversible by reverting that
   app's commit.
3. Remove the apps' database and secret access last, once nothing reads them.

Each step gets a test pass before it ships: sign-up, sign-in (password, email
code, magic link, passkey, Google), two-step verification, password reset,
invitation accept, switching business, the getpiggles.com to mypiggles.com
handoff, an MCP connector authorization, and sign-out.

## Progress (2026-10-30)

Built on branch `phase1/apps-off-the-database`, committed, not pushed:

- The brand request scope, `createAuth(brandConfig)`, and api-rest serving
  both brands at `/auth/<brand>/*`.
- The session read, the API token, account security, the handoff and sign-out.
- Endpoints 1 to 11, with the flows (sign-up, verification email, invitations,
  MCP consent and discovery) as typed calls in `@wizeworks/auth-client-server`
  shared by both brands' sign-in apps.
- All three apps switched: the Piggles console, the Piggles account app and
  sparx's workbench. `scripts/check-app-data-access.mjs` now reads every app
  under `*/apps/*` from the tree, and none imports the database or the auth
  server or depends on `@wizeworks/db`.
- Partner provisioning runs on api-rest's own sparx instance;
  `app/api/internal/partner-provision` and `SPARX_DASHBOARD_INTERNAL_URL` are
  gone.

Still to do: step 8 (the frontend pods drop `sparx-app-secrets` and the
`BETTER_AUTH_*` values), and the test pass on both brands.

## Definition of done

- [ ] brand-core request scope and fail-closed shared mode, with tests that
      prove an unscoped call throws.
- [ ] `createAuth(brandConfig)`; no environment brand reads inside an
      instance.
- [ ] api-rest mounts both brands at `/auth/<brand>/*`.
- [ ] `/auth/<brand>/session` and `@wizeworks/auth-client-server`.
- [ ] `/auth/<brand>/api-token`; both consoles forward to it.
- [ ] Endpoints 1 to 11 above, each with its callers switched.
- [ ] api-rest calls its own auth instance for password reset and partner
      provisioning; the two app internal routes are deleted.
- [ ] Pure helpers moved.
- [ ] Rewrites in all three apps; the apps' `app/api/auth/[...all]` routes
      deleted.
- [ ] No app imports `@wizeworks/db`, `@prisma/client` or the auth server
      (enforced by a check, proven red first).
- [ ] Frontend pods no longer load `sparx-app-secrets`.
- [ ] The test pass above, on both brands.
