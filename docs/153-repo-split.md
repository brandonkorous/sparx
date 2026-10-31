# Splitting the platform, sparx and Piggles into three repositories

**Version:** 0.3
**Author:** Brandon Korous
**Last Updated:** 2026-10-30

## Why

One repository holds three things: the shared platform (`wizeworks/`, about
745k lines), sparx (`sparx/`, about 465k) and Piggles (`piggles/`, about 480k,
31% of the tracked files). Every push type-checks, lints and tests all three,
and every release builds every image, so a one-line Piggles fix rides a
two-hour release. Splitting them lets each repository check and ship only
itself.

## Decisions (2026-10-30)

|     | Decision                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Three repositories.** The platform, sparx and Piggles each get their own.                                                        |
| D2  | **Shared private packages publish to GitHub Packages**, scope `@wizeworksllc`.                                                     |
| D3  | **No app touches the database or runs the auth server.** Not Piggles, not sparx. Apps reach data only through the platform's APIs. |
| D4  | **The two consoles stay matched** for now, by a check that runs across repositories.                                               |
| Q1  | **Today's repository becomes the platform**, renamed `wizeworksllc/platform`. sparx and Piggles move out of it, Piggles first.     |
| Q2  | **The staff auth server runs inside api-rest.** No new service.                                                                    |

## What stays shared

Both brands keep **one database, one tenant pool, one api-rest**. A Piggles
tenant is a platform tenant with `platformBrand = 'piggles'`. Nothing here
forks the backend. The platform keeps every brand feature it serves today: the
Piggles-only internal endpoints (furnish, billing), the domain-check hosts,
`<slug>.piggles.site` tenant sites, the `piggles-starter` blueprint, the Piggles
Stripe keys.

| Repository | Holds                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| platform   | `wizeworks/services/*`, `wizeworks/packages/*`, `wizeworks/apps/site` (tenant sites for both brands), the Prisma schema and migrations, `marketplace-catalog/`, the release pipeline, `k8s/` |
| sparx      | `sparx/apps/*` (web, market, workbench), `sparx/packages/*`                                                                                                                                  |
| piggles    | `piggles/apps/*` (web, account, console), `piggles/packages/*`                                                                                                                               |

## What ties the apps to the platform today

Measured at `58e3d13c5`.

1. **Workspace packages.** All 98 `wizeworks/packages/*` are `"private": true`;
   none is published. Piggles uses about 25 of them (the console's Dockerfile
   copies about 40). sparx uses its own similar set.
2. **The auth server runs inside the apps.** `sparx/apps/workbench` and
   `piggles/apps/account` each mount Better Auth at `app/api/auth/[...all]` and
   run it against the shared user and session tables. sparx's workbench imports
   `@wizeworks/auth` in 37 files. Both apps' pods load `sparx-app-secrets`,
   including `DATABASE_URL`.
3. **Direct database reads.** `piggles/apps/account` imports `@wizeworks/db` in
   11 places (`lib/account-load.ts`, `lib/onboarding-save.ts`,
   `lib/business-slug.ts`, ...). sparx's workbench has one
   (`app/api/consent/route.ts`).
4. **A platform signing secret.** Both consoles mint api-rest JWTs themselves
   with `SPARX_INTERNAL_JWT_SECRET` (`app/api/token/route.ts`).
5. **api-rest calls back into the apps.** Password reset calls piggles-account
   (`api-rest/src/lib/users/password-reset.ts`).
6. **Shared config.** `piggles-app-env`, the `PIGGLES_*` keys in the shared
   `app-env-configmap.env`, `BILLING_PLANS` built from
   `piggles/config/billing-plan.json`, the wordmark serialized into the
   ConfigMap.
7. **Tooling.** Root `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`,
   `turbo.json`, `.npmrc`; 13 root `piggles/scripts/*` checks, the pre-push
   hook, two CI jobs and about 58 root scripts that scan `piggles/`.
8. **Console parity.** `check:console-parity` compares the two consoles
   structurally. The Piggles console is about 423k lines in 2,414 files.
9. **Stale.** `piggles/apps/account/Dockerfile` lines 59 and 108 still copy
   `sparx/packages/brand`. `check:deletability` misses it: it walks imports,
   not Dockerfiles.
10. **`@wizeworks/studio` is used only by Piggles.**

## How the shared packages publish (D2)

- **Scope `@wizeworksllc`.** GitHub Packages requires a package's scope to
  match its owner, so `@wizeworks/api-client` becomes
  `@wizeworksllc/api-client`. `@wizeworks` stays the public npm scope
  (silicaui, the wizelens SDKs). One scope can resolve from only one registry,
  so keeping the two apart is what lets the public packages keep installing
  from npm with no token.
- **The rename is one mechanical sweep** of every `wizeworks/packages/*` name
  and every import of it, done while all three trees are still in one
  repository, so the typecheck proves it. The diff is read back before it is
  committed.
- **Cost.** wizeworksllc is on GitHub Free. Private packages get 500 MB of
  storage and 1 GB of transfer per month at no charge, and downloads inside
  GitHub Actions using `GITHUB_TOKEN` do not count. These are small JavaScript
  packages. Check the Packages line on the org billing page after the first
  month.
- **Access.** Every developer machine needs a token with `read:packages` in
  `~/.npmrc`. In CI, each package must grant the sparx and piggles repositories
  read access, or `GITHUB_TOKEN` cannot install it. Docker builds receive the
  token as a build secret, never a build argument, so it never lands in an
  image layer.
- **Versioning.** Changesets in the platform repository. The platform release
  publishes after its containers deploy, so a published version always matches
  a deployed API.

## The plan

Each phase ships on its own and leaves every product working. Phases 1 to 3
run inside today's repository, so nothing moves until it no longer needs to be
here.

### Phase 1. The apps stop touching the database (D3)

- **Move the staff auth server into the platform** (where: Q2). Each app keeps
  its own cookies by proxying `/api/auth/*` to it, so sessions stay
  first-party on app.sparx.works, getpiggles.com and mypiggles.com. The brand
  settings that exist today (each brand's `BETTER_AUTH_SECRET`, cookie prefix,
  app name) carry over unchanged, so nobody is signed out.
- **Server-side session checks become an API call** (or a token the app
  verifies with a public key), replacing `requireSession()` against the
  database. This touches sparx's 37 auth-importing files.
- **Every `@wizeworks/db` use in an app moves behind an api-rest endpoint.**
  Piggles' account load, onboarding save and business slug; sparx's consent
  route.
- **A platform token endpoint replaces both consoles' own JWT minting**, so
  `SPARX_INTERNAL_JWT_SECRET` leaves the apps.
- **App pods get only their own secrets**, not `sparx-app-secrets`.
- Remove the stale `sparx/packages/brand` copy from the account Dockerfile, and
  teach `check:deletability` to read Dockerfiles.

Done when no app imports `@wizeworks/db` or the auth server, and no app pod can
read `DATABASE_URL`. A test pass on both brands covers sign-up, sign-in, the
getpiggles.com to mypiggles.com handoff, password reset and two-step
verification before it ships. This is the riskiest phase.

### Phase 2. Each thing on its own side

- `@wizeworks/studio` moves to `piggles/packages/studio`.
- Piggles' platform config (the billing plan, the wordmark) moves to a platform
  brand registry that api-rest reads.
- The three paths that climb out of `piggles/` into `wizeworks/` (the console's
  `globals.css` `@source`/`@import`, two tests) become package exports. The same
  audit runs on `sparx/`.

### Phase 3. Rename and publish the shared packages (D2)

- The `@wizeworks` to `@wizeworksllc` rename sweep for workspace packages.
- Changesets and a publish job in the release.
- sparx and Piggles switch from `workspace:*` to published versions **while
  still in this repository**, so the switch is proven before anything moves.

### Phase 4. Piggles moves to `wizeworksllc/piggles`

- Created from the history of `piggles/` with `git filter-repo`, so history and
  blame survive. Decide then whether to drop the doc zips and the 93 MB of
  `piggles/images` from history.
- Its own TypeScript, ESLint and Prettier config, turbo pipeline, pre-push hook,
  CI and release. The 13 `piggles/scripts/*` checks move with it.
- Infrastructure first (wize-infrastructure releases before Piggles relies on
  it): a deploy identity, a `piggles` namespace, its own vault, and the Caddy
  upstreams for meetpiggles.com, getpiggles.com and mypiggles.com.
- Images publish to `ghcr.io/wizeworksllc/piggles-*`.
- Cut over one app at a time: web (about 35k lines), then account, then the
  console.
- **Console parity (D4):** Piggles' CI checks sparx out (at this point still in
  today's repository) and runs `check:console-parity` against both, the way
  wize-infrastructure's CI checks sparx out today.

Piggles goes first because it is the less critical product, so the playbook is
proven on it before sparx follows.

### Phase 5. sparx moves to its own repository

First, today's repository is renamed `wizeworksllc/platform` (Q1), which frees
the name. Then the same playbook as Phase 4, for `sparx/apps/*` and
`sparx/packages/*`:
history kept, own CI and release, a `sparx` namespace for its frontends,
cut over one app at a time (web, market, then the workbench). The parity check
in Piggles' CI then checks out `wizeworksllc/sparx` instead of today's
repository.

### Phase 6. Today's repository becomes the platform

What is left is the platform: services, packages, tenant sites, schema and
migrations, the release pipeline and `k8s/`. Its release builds only platform
images, applies migrations and publishes packages. `check:boundaries`,
`check:deletability` and the brand-isolation CI job lose their reason to exist:
three repositories are the boundary.

## What this saves

- **Platform push:** no longer checks about 945k lines of frontend code.
- **sparx and Piggles pushes:** check only their own code (about 465k and 480k).
- **sparx and Piggles releases:** a handful of images, no migrations, minutes
  instead of about two hours.
- **Platform release:** no frontend images.

## Risks

- **API changes break a frontend later instead of in the same push.** Today a
  breaking api-rest change fails both consoles' typecheck at once. After the
  split it fails them on their next run. Mitigated by versioned `api-client`
  publishes and by each frontend's CI running when a new version publishes.
- **Feature work crosses repositories.** Most sparx features touch api-rest and
  the workbench together, so they become two pull requests: the API first
  (already the house rule), then the screen.
- **Package version drift.** A frontend can lag the platform's packages.
  Mitigated by publishing on every platform release and testing frontends
  against the newest versions.

## Decided questions

**Q1.** Today's repository becomes the platform and is renamed
`wizeworksllc/platform`. It already holds the release pipeline, the migrations
(whose names are permanent keys in every database) and the vault sync. The
rename changes its OIDC subject (`repo:wizeworksllc@350084568/platform@1251494871`;
the repository id does not change) and its image paths, so it follows
wize-infrastructure `docs/org-move.md`: trust the new subject first, then
rename, then update the image paths. The rename happens at the start of Phase 5, before the
new `wizeworksllc/sparx` repository is created, because that repository needs
the name.
Creating it ends GitHub's redirect from the old name, so every local checkout's
remote is updated first.

**Q2.** The staff auth server runs inside api-rest, beside the shopper OAuth
provider it already hosts (`api-rest/src/lib/customer-oauth.ts`). It picks the
brand by host, as api-mcp already does. No new Deployment, no new cost.
