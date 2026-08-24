# Piggles — build status

**Last updated:** 2026-08-17

Where the Piggles build actually is, what is decided, and what is known-broken.
Read [CLAUDE.md](CLAUDE.md) for the rules and [DESIGN.md](DESIGN.md) for the
design contract — this file is only state.

## Built and verified

| Thing                        | Where                                              | State                                                      |
| ---------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Rules + design contract      | `CLAUDE.md`, `DESIGN.md`                           | Done                                                       |
| Brand tokens + theme         | `sparx/packages/brand`                             | Done. Compiles; every value measured                       |
| Marks (mark/wordmark/logo)   | `sparx/packages/brand/src/marks.ts` + `src/react`  | Done, traced from the delivered SVGs                       |
| Product adapters             | `packages/config`                                  | App registry, lexicon, product identity, `accountUrl()`    |
| `platform_brand`/`is_system` | `wizeworks/packages/db` migration `20270323000000` | **Applied** to local docker; 96 tenants backfilled `sparx` |
| Site chrome                  | `components/marketing/site-{header,footer}`        | Nav, mobile drawer, full 15-app footer index               |
| Homepage                     | `components/marketing/home.tsx`                    | Video hero, six beats, 9 photographs                       |
| `/apps` + 15 `/apps/[app]`   | `app/apps/**` + `content/apps.ts`                  | Built. **These are the satellite-domain landing pages**    |
| `/pricing`                   | `app/pricing`                                      | One plan, allowance table, "never charge you for", FAQ     |
| `/trust`                     | `app/trust`                                        | Seven pillars, operations, FAQ                             |
| 404                          | `app/not-found.tsx`                                | Real page — offers the whole product, not an apology       |
| Social cards                 | `lib/og.tsx` + 20 `opengraph-image` routes         | Real vector lockup; app cards wear their group hue         |
| `sitemap.xml` / `robots.txt` | `app/sitemap.ts`, `app/robots.ts`                  | App pages derived from the registry; AI crawlers welcomed  |
| Media                        | `sparx/apps/web/public/{video,photos}`             | 36 MB video, 2.3 MB photos, licences documented            |

44 static routes build clean. Typecheck, lint and prettier pass on `sparx/apps/web`.
Verified in a browser at desktop AND at 390px (in an iframe, so nobody's window
gets resized): every page stacks, the mobile drawer opens and closes, and the
console is clean.

Ports: **3020** meet, **3021** get (reserved), **3022** my (reserved).

## Decisions worth not re-litigating

- **Themes are the bare names `light` / `dark`**, not `piggles-light`. Safe because
  no Piggles app loads `@sparx/brand/theme.css` and no shared package imports it.
- **Color is by GROUP, not by app.** Five hues plus the brand cover fifteen apps.
  An 18-hue wheel does not stay distinguishable once the rose family is reserved
  for the brand — the six-family alternative measured 17 pairs under ΔE 18.
- **Marks render in `currentColor`**, so the token drives the logo. The delivered
  art's pink (`#fd829a`) is ΔE 10.5 from the approved token (`#FF6F86`) — Brandon
  is updating the token, and `currentColor` means the logo follows for free.
- **`--depth: 1`** — silica's own default, and the entirety of Piggles' elevation.
  sparx runs 0. A hand-rolled `shadow-*` is still banned.
- **Capacity never blocks work in progress**, expansion is one tap in place, and
  the console never knows a price. See `docs/initial/docs/commercial/BILLING_RULES.md`.
- **SEO satellites are real sites on a `system` tenant**, never 301s — a redirect
  makes the domain unable to rank, which is the only reason to own it. They point
  at `/apps/<id>`, whose `alsoKnownAs` field carries the technical term.
- **The hero IS the video**, full-bleed, with a solid `base-100` panel over it
  rather than sparx's scrim. No text is ever laid on open footage, so contrast is
  a fact rather than a hope about which frame is on screen.
- **`<Logo>` is the DELIVERED lockup, not the two marks in a flex row.** The
  original composed `<Mark>` + `<Wordmark>` with `gap-3` and independent heights,
  which was a guess and was wrong twice over: the real lockup has a specific size
  ratio between the two, and their padded boxes OVERLAP, so no positive gap could
  ever reproduce it. Comparing `logo.svg` against the standalone files shows
  byte-identical path bodies at scale 1 differing only by a constant translation,
  so `<Logo>` now renders one `<svg>` on the lockup canvas with the two groups at
  the measured offsets (`LOGO_ICON_OFFSET`, `LOGO_WORDMARK_OFFSET`). Geometry is
  still shared, so it cannot drift from the standalone marks. Verified against
  the source file side by side at matched height. **If the art is revised,
  re-derive the offsets — never nudge them by eye.**
- **Comfortable density is a TOKEN, not a size prop.** Piggles runs
  `--size-field: 0.3rem` (silica's default is 0.25), which moves the whole ladder:
  default control 48px, `lg` 58px, and a form asks for `lg` to land in the 56–60
  comfort target. `size="xl"` at call sites was the obvious move and is wrong
  twice — it cannot reach the ~500 shared surfaces, and it is the call-site patch
  RULE #1 exists to stop. 0.35 (default = 56px) was tried and rejected: the
  default is what every toolbar and filter row renders, and the same lever drives
  Alert/Toast/Progress/Meter. Table is NOT on it. Full reasoning: DESIGN.md §5.
- **`neutral` is unusable as ink on a dark ground** in this palette (2.52:1 even
  inside a dark island). Dark bands are real `data-theme="dark"` islands and their
  secondary button asks for `outline` with **no color**. Table in DESIGN.md §3.
  **Superseded for the CONSOLE, and worth knowing which half:** that measurement
  was of a dark ISLAND on the marketing site, where the surrounding page is light
  and `neutral` has to keep working on both. In the console the whole document is
  `data-theme="dark"`, so `neutral` could simply be inverted the way `secondary`
  already was — it is now `#c2b1bc` with near-black content. The marketing-site
  rule stands unchanged; see the 2026-08-14 (last) section.
- **Color tokens are NOT theme-independent, and the reasoning that said they
  were is the trap.** "A saturated hue reads on either canvas" is true of a FILL
  and false of INK, and most of a console is ink. Any new hue needs measuring on
  base-100 in BOTH themes before it is written down.

## Where the open questions live

Things needing a DECISION, or work outside the slice that surfaced them, are in
[docs/FOLLOW_UPS.md](docs/FOLLOW_UPS.md) — a register, one entry per item, with
what it is and when it bites. Known defects in what is BUILT stay below; what to
build next stays at the bottom of this file. Keep the three apart: a decision
buried in a defect list is a decision nobody makes.

## Known defects

1. **`pnpm install` is needed once.** `@piggles/brand` was missing `@types/react`,
   so it has never typechecked standalone — five bogus "unsafe return" lint errors
   on `wordmark.tsx` that are really "JSX has no types here". The devDependency is
   now in its `package.json`, matching `sparx/packages/brand`; it needs an install to
   take effect. The apps were always fine, which is why this hid.
2. **The video clips are sparx's.** License-clean (Pexels + Mixkit) but identical
   footage across two brands competing for the same customer is a tell. Piggles
   needs its own before launch.
3. **`app/icon.svg` has `#FF6F86` baked in.** A favicon is static and cannot read a
   CSS variable, so it is the one duplicated hex — it needs the same edit when the
   token changes.
4. **Pricing allowances are a hypothesis, not a measurement.** The source pack
   gives ranges for storage and email and says to validate against infrastructure
   cost. `/pricing` publishes the LOW end of each. Confirm before launch — raising
   an allowance later is a gift, lowering one is a repricing.
5. **`/trust` makes operational promises that must be true on day one** — backups,
   monitoring, a public status page, incident notification. Deliberately absent:
   certifications (not held) and uptime figures (not measured). Do not add either
   back without the thing behind it.

   Two-step sign-in WAS in that absent list, wrongly: the root CLAUDE.md said MFA
   was unimplemented and it has been shipped for months (`TwoFactor` model, two
   migrations, both plugins, workbench UI). The doc is corrected and the claim is
   on the page. **This was the fourth time a built capability was taken for a
   missing one** — check the schema and the registered plugins before believing
   any "not yet".

## Environment gotchas found the hard way

- **Tailwind only scans the app.** `@piggles/brand`'s components carry their own
  classes, so `globals.css` needs `@source '../../../packages/brand/src/**/*'`.
  Without it the marks render UNSIZED — the logo came out the size of the
  viewport, and typecheck, `next build` and grepping the built CSS all passed.
  **Anything that ships className strings from a package needs a scan line.**
- **Never write a `display` utility onto a silica control.** `hidden sm:inline-flex`
  on a `.btn` overrides `.btn`'s own display and shifts the label off vertical
  centre. Hide with `max-sm:hidden` only. `sparx/apps/market/components/site-header.tsx`
  already carried a comment saying so; it got repeated here anyway.
- **`metadataBase` is required or social cards silently do not exist.** Without
  it `opengraph-image` resolves to a relative URL, every scraper rejects it, and
  nothing anywhere reports an error.
- **`DrawerClose` cannot wrap a link.** It is a Base UI close control that
  assumes a native `<button>` and logs an error on every open; silica's wrapper
  takes only `children`, so Base UI's `nativeButton={false}` escape hatch is not
  reachable. Control the drawer with `open`/`onOpenChange` and close it from the
  link's `onClick` — the nav items have to stay real anchors.
- **`<Button render={<a/>}>` is client-only.** From a server component the element
  crosses the `"use client"` boundary and arrives without its props — the link
  renders perfectly and goes nowhere. Use `buttonClasses()` / `badgeClasses()`
  from `@wizeworks/silicaui-react/server` on a real anchor. Doing that everywhere
  also avoids jsx-a11y's `anchor-has-content`, which the render form always trips.
- **`DrawerTrigger` / `DrawerClose` take a single element CHILD, not `render`.**
- **Never replace an image in place.** `/_next/image?url=…` is the same URL before
  and after, with a long `max-age`. Clearing `.next/cache/images` is not enough —
  the stale copy is in the browser, and on a live site in the CDN and every
  returning visitor. Give the new file a new path.
- **Route segment config CANNOT be re-exported.** `export { GET, dynamic } from '…'`
  compiles, typechecks and lints — and returns 500 on every request:
  _"Next.js can't recognize the exported `dynamic` field in route. It mustn't be
  reexported."_ Config is read by STATIC ANALYSIS at build time, so only the
  HANDLER travels; `dynamic` / `revalidate` / `runtime` are declared per file.
  Found by curling the route, not by any check.
- **Dynamic class names never compile.** `bg-${token}` produces nothing.
- **`divide-base-300` does not exist** though `border-base-300` does. Use `border-b`.
- **Register `module` and `group-*`** in the silica `colors:` list or every
  app-tinted control renders unstyled. The list REPLACES silica's defaults.
- **Windows: a running dev server blocks `pnpm install`** on file locks. It hangs
  rather than failing.
- **Wikimedia rejects a generic user agent** and silently returns a 4 KB HTML
  error page saved as `.jpg`.
- **Verify migrations against the database**, not `migrate status`. Connect as
  `sparx_owner` (there is no `postgres` role): `docker exec sparx-postgres psql -U sparx_owner -d sparx`.

## apps/account (getpiggles.com) — DRIVEN END TO END

Typechecks, builds (11 routes), and a real account was created through the UI.
Verified in the database, not inferred:

- `platform_brand = 'piggles'` on the new tenant
- subdomain `sleek-orchard-5021.piggles.site` — **the `zoneDomain` parameter
  doing its job**; the old env-var path would have handed this a `sparx.zone`
  address
- `acquisition_channel = marketing-site`, `acquisition_source = home-hero` —
  attribution survived the cross-domain hop from the marketing link
- 14-day trial stamped, `is_system = false`
- onboarding wrote `settings.piggles.railGroups = ["web","sell","money"]` and
  renamed both the tenant AND its primary site to "Thistle Bakery"
- the handoff minted a real 60-second single-use token and redirected

| Surface                          | Route                                 |
| -------------------------------- | ------------------------------------- |
| Create account                   | `/signup`                             |
| Sign in (+ two-step, magic link) | `/sign-in`                            |
| Forgot / reset password          | `/forgot-password`, `/reset-password` |
| Onboarding — two questions       | `/onboarding`                         |
| Account home                     | `/account`                            |
| Cross-domain handoff             | `/handoff`                            |
| Better Auth handler              | `/api/auth/[...all]`                  |

**It reuses the platform's `signUpMerchant`** — the one place that knows an
account means a tenant, its primary site, a subdomain, the owner user, the owner
membership, legal acceptance, the trial clock and the welcome email. Piggles
declares two things and reimplements none of it.

**Two platform seams were added, both parameters and neither a conditional:**
`provisionTenant` now takes `platformBrand` (recorded on the tenant) and
`zoneDomain`. The second is the load-bearing one — the subdomain zone used to
come from `SPARX_ZONE_DOMAIN`, and an env var is fixed per deployment while both
brands are served by the SAME processes, so every Piggles signup would have been
handed a `sparx.zone` address. `wizeworks/packages/auth` typechecks clean.

**The handoff** lives in `piggles/packages/auth-handoff` and holds BOTH halves,
so the console side is a five-line call when it is built. It mints a one-time,
60-second, audience-bound token into Better Auth's existing `verification` table
(already reused this way by the MCP OAuth provider, so no new model and no
migration) and consumes it with a `deleteMany` whose count decides the outcome —
a read-then-delete would let two racing requests both win.

## Onboarding — two flows, and the story

There is more than one onboarding here and they are not the same job:

| Flow                   | Where                                                    | Piggles state                         |
| ---------------------- | -------------------------------------------------------- | ------------------------------------- |
| **Account / business** | getpiggles.com `/onboarding`                             | **Built** — two questions             |
| **In-console**         | mypiggles, `OnboardingGate` (owns the whole viewport)    | **Not built** — needs the shell first |
| Per-module setup       | e.g. inventory's guided setup (`InventorySetupProgress`) | Platform-owned; Piggles inherits it   |

**The in-console one is substantial**, not a form: it is
`sparx/apps/workbench/surfaces/onboarding/` — a **story composer** backed by
`@wizeworks/story-schemas` (a clause grammar with industry, audience and tense, where
the owner literally writes a sentence describing their business), a six-step
wizard (`step-workspace`, `step-modules`, `step-blueprint`, `step-domain`,
`step-payments`, `step-launch`), a welcome banner + checklist, then `FirstRunTour`
and `ModuleTourOffers` afterwards.

Both must differ from sparx's, for the same structural reason: **`step-modules`
is the spine of sparx's wizard because modules are what sparx bills for.**
Piggles includes every app, so that step does not exist — which is not a step
removed, it is a different flow. `step-payments` differs too (no card at signup).

### Onboarding hands the tenant to api-rest to be FURNISHED

**Superseded 2026-08-15.** `apps/account/lib/activate-modules.ts` is DELETED and
onboarding no longer activates anything itself. It names the business, records
`settings.piggles.railGroups`, and calls
`POST /internal/tenant/furnish` (`lib/furnish.ts`, shared-secret
`SPARX_INTERNAL_FURNISH_TOKEN`). That endpoint does the whole second half, in
order: **modules → industry starter → blueprint → sample data.**

**`module.activated` RIDES TWO BUSES, AND THIS APP WAS ONLY ON ONE.** That is why
the work moved, and it is the defect worth remembering. `lib/module-toggle.ts`
announces a module transition on BOTH the Pub/Sub topic (the automation-worker,
another process) AND api-rest's **in-process platform bus** — and the in-process
one carries every consumer that matters here: the CRM's pipeline, segments and
SLA policies; commerce's tax, shipping and site-commerce defaults; scheduling's
defaults; the default transactional emails; finance's accounts; the saved-view
presets; invoicing's config.

The account app published to the broker alone. The flags went true, a message
landed on a topic, and **none of that seeding ever happened** — for every Piggles
business created this way, with nothing anywhere reporting a failure because
nothing failed. It is the exact outcome the old file was written to prevent,
reached by the mechanism it chose; its comment claimed "the same event on the
same bus", and it is not the same bus. Only a process with those consumers
registered can announce on both.

**Every module is now switched on, for every business**, regardless of what was
ticked (RULE #2). It used to activate only the ticked groups' modules, which
contradicted the screen's own promise that "everything is included either way" —
a module that is off returns 404, runs no workers and stores no rows, so the
unticked apps WERE locked doors. The rail groups now decide only what is on the
rail.

`billPerModule: false` is passed, so no per-module Stripe items are synced —
under one flat price those would be line items nobody agreed to pay.

**And "not activated" never means locked.** `components/all-apps-dialog.tsx`
lists every app in the catalogue, on or not, with a one-tap **Add app** carrying
no price, going through the real route (`PUT /v1/tenant/modules`, which merges
and fires the same fan-out). It is pinned in the rail footer and the mobile
drawer — permanently, not in a menu. Bury that door and onboarding's question
quietly becomes a paywall nobody can find the far side of.

### The story is stored, and now finally reaches the board

`tenants.settings.onboarding.story` has been collecting the story since
onboarding shipped — text, industry, audience, customers, implied modules,
composed-at. **It was never reaching `wizeworks/packages/platform-crm`**, the mirror that
puts one contact per person and one deal per tenant on WizeWorks' own signups
pipeline. So the board could show WHEN tenants arrived and never WHAT KIND, which
is the half that matters for growth. Now on the deal:
`storyIndustry`, `storyAudience`, `storyText`, `storyImpliedModules`,
`storyComposedAt`.

Two more things landed in the mirror at the same time:

- **`brand:piggles` / `brand:sparx` as a contact TAG.** Without it the two
  products are indistinguishable on the board and growth-per-brand — the entire
  reason for running a second brand — is unanswerable. A tag, not just metadata,
  because tags are what the board segments on.
- **`railGroups`**, Piggles' own shorter onboarding answer, under its own key
  rather than pretending to be the same answer as the story.

`wizeworks/packages/platform-crm` typechecks clean and its 18 tests pass.

## Capacity metering — the meters now exist

Nothing was counting storage, email volume, contacts or seats anywhere on the
platform. Piggles prices on exactly those, and **usage history cannot be
backfilled** — nobody can reconstruct last March's storage figure — so every day
without meters was pricing evidence permanently lost. Built now, ahead of the
billing surfaces that will read it:

| Piece     | Where                                                                                  |
| --------- | -------------------------------------------------------------------------------------- |
| Model     | `RollupTenantDailyUsage` in `75-analytics-rollups.prisma`                              |
| Migration | `20270325000000_tenant_usage_rollup` (RLS included)                                    |
| Measuring | `wizeworks/packages/usage` — `measureTenant` / `snapshotTenant` / `snapshotAllTenants` |

Platform-wide, not Piggles-only: sparx bills per module and still needs to know
what a tenant costs to serve, and a meter that existed for one brand would be
the fork this repo works to avoid.

**Three things about it that are easy to get wrong later:**

- **The columns are not the same kind of number.** Storage, contacts, seats,
  sites and locations are POINT-IN-TIME (never sum them across days). Email
  sends is a DAILY TOTAL (summing across a period is the correct read).
- **Every measure is NULLABLE, never 0-defaulted.** A meter that has not been
  collected must read as "not measured", not as "measured, and the answer was
  none" — those produce different bills.
- **Enforcement must not read this table.** A figure up to 24h old is right for
  pricing and for a "nearing your limit" nudge, and wrong for "may this upload
  proceed", which has to count at the moment it acts.

Nightly snapshot rather than live counters, matching the other rollups
(docs/97 §5): every measure is recomputable, so a missed night self-repairs on
the next run, where a missed increment stays wrong until somebody notices.

**Not yet wired:** the `/internal/platform/usage-rollup` endpoint on api-rest and
the k8s CronJob that curls it — the pattern is `k8s/cronjobs/automation-runs-rollup.yaml`.
And `wizeworks/packages/usage` cannot typecheck until the Prisma client is regenerated,
since `rollupTenantDailyUsage` does not exist on the client yet.

## After the first install — what typechecks, and four things it caught

`@piggles/brand`, `@piggles/auth-handoff` and `@wizeworks/usage` all typecheck clean.
Four defects only became visible once the packages could actually resolve:

1. **The handoff's single-use guard could not compile.** `verifications.identifier`
   is INDEXED but not UNIQUE (only `id` is), so `findUnique` was never a valid
   call. Replaced with one atomic `DELETE … RETURNING` — better than the
   `findFirst` + `deleteMany` alternative, because that one lets a losing racer
   read a live session token into memory before the delete count rejects it.
2. **`forgetPassword` is not callable on this client.** The emailOTP plugin
   claims the name as a NAMESPACE (`forgetPassword.emailOtp`). The call is
   `requestPasswordReset`, which is what `sparx/apps/workbench` uses.
3. **A package that imports `@wizeworks/db` needs `"types": ["node"]` in its own
   tsconfig.** Type roots are per-compilation, so the dependency having
   `@types/node` does not help the consumer typecheck its source.
4. **`@piggles/brand` needs `"jsx": "react-jsx"`.** Under the base config's
   `preserve`, JSX resolves against the GLOBAL `JSX` namespace, which only exists
   once something has pulled in `@types/react` — `sparx/packages/brand` (sparx) gets
   that from `import * as React from 'react'`, and the Piggles marks deliberately
   import nothing. Matching sparx's tsconfig was the wrong instinct: the configs
   differ because the code differs.

Metering is now wired end to end: `POST /internal/platform/usage-rollup` in
api-rest (registered in `app.ts`) and `k8s/cronjobs/platform-usage-rollup.yaml`
at 05:00 UTC, before the reporting rollups — those recompute closed data and can
catch up whenever, this one takes a point-in-time reading and wants a clean day
boundary. `check:events`, `check:routes` and `check:docker` all pass.

## sparx/apps/workbench (mypiggles.com) — BUILT, NEVER SIGNED INTO

24 files, ~3,100 lines, on port **3022**. Typecheck, lint (`--max-warnings=0`)
and prettier are clean, and the routes below were exercised against the running
dev server. **No session has ever rendered it** — see "What is NOT done" below.

| Piece              | Where                                                          |
| ------------------ | -------------------------------------------------------------- |
| Shell              | `components/console-shell.tsx` + topbar / app-rail / app-panel |
| Compact shell      | `components/compact-console.tsx` (drawer, one column)          |
| Nav model          | `lib/console/nav.ts` — 15 apps from the platform's surfaces    |
| All apps / Add app | `components/all-apps-dialog.tsx`                               |
| Auth boundary      | `app/auth/callback`, `app/sign-out`, `lib/session.ts`          |
| Brand seam         | `lib/product-adapter.tsx`                                      |

Verified with curl against dev:

| Request                        | Result                                         |
| ------------------------------ | ---------------------------------------------- |
| `/` unauthenticated            | 307 → `localhost:3021/handoff?next=%2F`        |
| `/sell/orders?site=x`          | 307 → handoff, full address preserved          |
| `/auth/callback` no/junk token | 303 → `/handoff?handoff=missing`, never a loop |
| `/api/health`                  | `{"ok":true,"service":"piggles-console"}`      |
| `/api/version`                 | `{"version":"dev"}`                            |

**It mounts the shared surfaces and forks none of them.** The shell is Piggles'
(chrome, nav, vocabulary, theme); everything inside it — dock, controller,
launcher, status strip, deep links, update notifier — is `sparx/apps/workbench`,
imported through a `@workbench/*` tsconfig alias. That works because the shared
tree has **zero `@/` imports**: every one of its internal imports is relative, so
the whole thing is reachable from outside without touching a line of it.

### The seam that made it possible: `sparx/apps/workbench/lib/product.ts`

The platform-side vocabulary provider (item 4 on the old Next list, now done).
Three things a surface says out loud that are not a color: the **product name**,
the **module labels**, and the **loading mark**. A registry rather than a React
context, because `moduleLabel()` is a plain function called from render bodies
across a dozen surfaces and from the imperative update toast.

Building a second consumer found four defects that were invisible with one:

1. **The command palette grouped surfaces under `"Crm"`, `"B2b"`, `"Seo"`** — a
   title-cased slug, in the one place the app is meant to be findable by someone
   who does not know the vocabulary. Now asks `moduleLabel()`, like the rail.
2. **api-rest kept a hand-typed copy of the module list.** Its own comment
   recorded that `inventory` and `finance` had each fallen out of sync — the
   symptom being that the module typechecks everywhere and then CANNOT BE TURNED
   ON (the toggle refuses the slug as "Request validation failed"). Now derives
   from `ALL_MODULES`, newly exported from `@wizeworks/modules`. **The same comment
   says other copies exist** — see FOLLOW_UPS #3.
3. **`.sparx-pulse-nudge` was defined in one app's stylesheet** for a shared
   component, so the other shell rendered a control that silently never moved.
   Moved to `surface-support.css` as `.pulse-nudge`.
4. Four strings said "sparx" out loud from inside shared surfaces.

### `sparx/apps/workbench/app/surface-support.css`

The rules the SURFACES depend on — the site-canvas safelist, the
field-description correction, the `[data-module]` field accents, the popover
stacking fix, the print rules — extracted from sparx's globals.css so both shells
import them. A surface that renders correctly under one shell and unstyled under
the other is a fork by omission.

**It holds no path-based `@source`.** Tailwind resolves those relative to the
file the directive sits in, and this file is reached by `@import` from two
different depths; a path that resolves to a directory which does not exist
generates nothing and reports nothing. Each app keeps its own scan lines, where
the depth is a local fact.

### What is NOT done

- **Nobody has signed into it.** Every check above is a redirect, a typecheck or
  a lint. The shell itself — rail, dock, panes, the whole reason it exists — has
  never rendered. Assume nothing about it until it has.
- **No in-console first run.** sparx's `OnboardingGate` is deliberately not
  mounted (it is the modules-first wizard, which Piggles has no use for) and the
  Piggles equivalent is not written. A brand-new business lands in a working
  console with an empty site and no guidance.
- **No lifecycle notice.** FOLLOW_UPS #2.

## 2026-08-14 — all three Piggles apps are now in the pipeline

Superseded: the "Neither Piggles app is deployable" section below is kept for the
reasoning, but every one of its four missing pieces now exists, for THREE apps
rather than two (the console did not exist when that list was written).

| Piece           | Where                                                               |
| --------------- | ------------------------------------------------------------------- |
| Dockerfiles     | `piggles/apps/{web,account,workbench}/Dockerfile`                   |
| Release matrix  | `release.yml` — `piggles-web`, `piggles-account`, `piggles-console` |
| Manifests       | `k8s/apps/piggles-{web,account,console}.yaml` + both kustomizations |
| Routing         | `k8s/ingress/Caddyfile` — four host blocks                          |
| Brand env       | `piggles-app-env`, generated per overlay                            |
| The dep checker | `scripts/check-dockerfile-deps.mjs` now reads `piggles/*`           |

### The trap was real, and it would have passed in green

`check-dockerfile-deps.mjs` walked `['apps','services','packages']` only. That is
not merely "it did not check Piggles": Piggles' packages were absent from the
workspace map, so every closure came back EMPTY, and its Dockerfiles were absent
from the scan, so they were not even reported as orphans. The script would have
printed "every workspace dependency copied" over an image built without code it
imports — which is the exact failure it exists to prevent, one directory over.

Fixed by extracting `WORKSPACE_GROUPS` (one list, used by all three loops) and
teaching the COPY matcher both prefixes. **The two prefixes are kept apart on
purpose:** `sparx/packages/brand` and `piggles/packages/brand` are different packages,
and a Piggles image needs BOTH — matching on the slug alone would let either
satisfy the other and pass an image that cannot build.

Verified by deleting one COPY line from each Piggles Dockerfile and confirming
the check fails with the right message for both spellings, then restoring them.

### What each image actually is

Closures computed from the manifests rather than guessed:

- **piggles-web** — 3 packages, all `@piggles/*`, and NOT ONE `@sparx/*`. No
  database, no auth, no api-rest. It is the only Piggles surface that can ship
  alone; the account app before the console is a live funnel with a dead end.
- **piggles-account** — 27: the platform account spine (`@wizeworks/auth` → the whole
  `signUpMerchant` closure) plus the four Piggles packages.
- **piggles-console** — 38, and it hits the same V8 heap wall sparx's workbench
  does (`--max-old-space-size=8192`), because it carries the same surface layer.

### The environment, and the ordering that keeps it honest

The three Deployments mount `sparx-app-env` → `sparx-app-secrets` →
**`piggles-app-env`**, in that order, and later entries win. So the platform's
values arrive first and the brand replaces the handful that must differ — one
origin, in one place, for both apps.

`BETTER_AUTH_URL` is the exception and is set PER POD, because the two Piggles
apps run on two different origins. Getting it wrong is THE LOCKOUT (below): sign-
up keeps working (a server action, no `Origin` header), curl keeps working (no
`Origin` header), and the browser gets `Invalid origin` on sign-in which the UI
reports as a wrong password.

`PIGGLES_BETTER_AUTH_SECRET`, `PIGGLES_GOOGLE_CLIENT_ID` and
`PIGGLES_GOOGLE_CLIENT_SECRET` are new keys in the EXISTING `sparx-app-secrets`,
mapped onto the ordinary names per-pod. One credential store, synced by one path;
a second store is a second thing to keep populated. Documented in
`k8s/local/secrets.example.env`. **The account and console pods must carry the
SAME auth secret** — they read and write the same session rows, so a mismatch
makes every handed-off session unverifiable.

### api.mypiggles.com

The console hands an api-rest origin to the customer's BROWSER, which then calls
it directly with a short-lived bearer token — so it is the one platform address a
Piggles customer actually sees, in their network tab and in any CORS error. It is
now `api.mypiggles.com`: the same Service behind the same Caddy, one extra host
block, no extra pod, and no allowlist change (api-rest runs `cors: { origin: true }`).

**Media is deliberately NOT done.** api-rest mints variant URLs server-side from
the shared `MEDIA_PUBLIC_URL`, so product images still resolve through
`media.sparx.works`. Giving Piggles its own needs a per-brand value threaded
through the media path — a real change, not a routing line — so it is flagged
rather than half-done.

### mcp.mypiggles.com (2026-08-23)

The same reasoning as `api.mypiggles.com`, on an address that is **read aloud**.
The AI connections pane does not merely link to the MCP endpoint — it tells the
owner to COPY it and paste it into Claude or ChatGPT by hand, and their assistant
then shows it back to them on every reconnection. It was serving
`https://mcp.sparx.works/mcp`, inside the Piggles console, to a Piggles customer.

**And it was not only a label.** RFC 9728 discovery — the document that tells a
client which authorization server to go to — is fetched BEFORE any token exists,
so there is no tenant to read `platform_brand` from and there never can be. The
request's host is the only thing carrying a brand at that moment. One shared
hostname therefore meant one answer for both brands, and the answer was
`app.sparx.works`: every Piggles customer connecting an assistant was sent to
sparx to sign in and approve access to their own business, on a sparx consent
screen. Meanwhile `getpiggles.com` — the only place Piggles mounts Better Auth —
served a `/oauth/consent` route nothing ever reached, whose validator compared the
requested `resource` against sparx's address and would have refused a genuine
Piggles request as "for a different service". The whole Piggles MCP path was
forked and then unreachable.

The fix is one Caddy host block, one Cloudflare record, no extra pod, and a
brand-scoped seam: `mcpResourceUrl(brand)` / `mcpAuthServerOrigin(brand)` in
`@wizeworks/links/server`, beside `appOrigin` and `accountOrigin` and derived the
same way, so a third brand is configuration. api-mcp builds a host→brand map at
boot from `PLATFORM_BRANDS` and **exits 78** rather than serve a brand it has no
address for — a host that falls through to the default returns a 200 and a valid
document and the wrong company's sign-in page, which is indistinguishable from
working software.

### What this costs the node, stated rather than assumed

Three more pods on a single 2-vCPU / 8 GiB box is a capacity decision:

- **CPU** +75m against a ~1290m budget (after kube-system's ~610m)
- **Memory** +800Mi of requests (288 + 256 + 256) against ~2.4Gi already
  requested on ~5.3Gi allocatable — landing near 3.2Gi

Comfortable, but the memory requests are ESTIMATES sized to the nearest measured
sibling, not measurements. The kubelet evicts by usage ABOVE request, so a
request that sits under actual is a vote for that pod to be killed first —
which is precisely how api-rest (128Mi requested, 614Mi used) became the first
casualty of the 2026-08-08 eviction. **Measure all three with `kubectl top` once
they serve traffic and move the numbers.** If the node cannot take them the
answer is a bigger node, not smaller requests.

### Decisions worth not re-litigating

- **They live in `sparx-prod`, not their own namespace.** What makes deletion
  real is `--prune` on the release's ownership label: removing the three lines
  from `k8s/apps/kustomization.yaml` actually deletes the pods. A separate
  namespace buys the same guarantee and costs a duplicated `sparx-app-secrets` —
  one more copy of every credential on the platform, drifting.
- **Ordinary certificates, not on-demand TLS.** The on-demand policy asks
  api-rest's `/internal/domain-check`, which knows tenant subdomains and custom
  domains and has never heard of meetpiggles.com. It would refuse, and the host
  would have no certificate at all. Same reasoning as the kanNINJA blocks.
- **The image is `piggles-console`, the directory is `sparx/apps/workbench`.** The app
  is workbench-shaped; "workbench" is a sparx word and nothing an operator reads
  should carry it (RULE #3).
- **Probes hit `/api/health` on all three**, including the marketing site.
  sparx's marketing pod probes its home page and gets away with it; that page
  renders a full-bleed video hero, and a probe that renders fails when the app is
  merely BUSY. A 1s default timeout is what SIGKILLed the workbench mid-roll.

### DNS is Terraform, not the Cloudflare dashboard

`terraform/modules/dns` holds every record and is shared VERBATIM between the GCP
and Azure envs — the only thing that varies is `var.ingress_ip`. The Piggles
records are in it now: three zones (apex + www, proxied), `api.mypiggles.com`,
and the `piggles.site` tenant zone. `terraform validate` passes and
`fmt -check` is clean.

Nothing here is done by hand. Editing a record in the dashboard is drift the next
apply silently reverts, and the module's own header records that the Azure
deployment once had exactly that: hand-made records that diverged from Terraform
the moment they were made.

Two gates, neither of them code:

- **The zones must exist in the Cloudflare account.** The module looks each one
  up with `data "cloudflare_zone"`, so a zone that is not there fails the PLAN —
  loudly, before anything changes, which is the good failure.
- **`CLOUDFLARE_ENABLED` must be `true`** (a repo variable; `cloudflare_enabled`
  defaults to FALSE and counts every DNS resource to zero). Flipping it repoints
  the platform's live public DNS, which is why it is a deliberate act.

### The certificate path — one blocker, and a correction

**Correction first, because the first version of this section was wrong.** It
claimed a Piggles TENANT site could not get a certificate, on the reasoning that
`/internal/domain-check` resolves against the single `SPARX_ZONE`. It does not
call `isZoneHost` at all: it checks a hardcoded platform allow-list, then falls
through to `resolveSiteByHost`, which matches the `domains` table **by exact
host**. Signup already writes a `<slug>.piggles.site` row (that is what
`provisionTenant`'s `zoneDomain` parameter is for), so path 1 authorises it and
the certificate issues. Tenant sites were never blocked.

**The real blocker was the opposite of the guess: the three BRAND domains.**
Their Caddy blocks `import tls_policy`, and `tls_policy` is `tls { on_demand }`
(k8s/ingress/mode.caddy) — so every first HTTPS request asks that endpoint.
meetpiggles.com, getpiggles.com, mypiggles.com and api.mypiggles.com are
PLATFORM hosts with no `domains` row and never will have one, so all four would
have returned 403 `unknown_host` → no certificate → **Cloudflare 525 for the
entire brand**. That is precisely what happened to `workbench.sparx.works` and
`media.sparx.works`, both of which sit in that list for the same reason.

Fixed: the seven Piggles hostnames are in `PLATFORM_HOSTNAMES`. Tenant sites
under `piggles.site` are deliberately NOT — those are real tenant hosts and are
authorised by the resolver, per brand, exactly like `*.sparx.zone`.

### api-rest now owns more than one zone

The single-zone reading was still a real defect, just a smaller and different one
than claimed. `SPARX_ZONE` is now `OWNED_ZONES`, a list from
`SPARX_ZONE_DOMAINS` (`sparx.zone,piggles.site`, declared in both env configmaps).
The singular `SPARX_ZONE_DOMAIN` still works and means a one-entry list, so no
existing deployment changes behaviour.

**Why a list is right here when signup deliberately used a parameter.** Two
different questions. "Which zone does this NEW tenant get?" varies per request
and can never come from the environment — hence `provisionTenant`'s argument.
"Which zones does this deployment own?" is identical for every request, and a
list is exactly what it is.

What it fixed, each a real bug:

- **`isZoneHost`** now matches any owned zone. It is what stops a host being
  "connected" as a custom domain, so without this a Piggles tenant could have
  claimed `someone-else.piggles.site` as their own.
- **The routing fallbacks** (bare `<tenant>.<zone>` and hierarchical
  `<property>.<tenant>.<zone>`) work for every owned zone. They are the safety
  net for a missing `domains` row, and a Piggles tenant needs it for the same
  reasons a sparx one does.
- **`mintZoneHost`** takes the zone. A Piggles business adding a SECOND site was
  getting `<site>.<tenant>.sparx.zone` — one business with two sites in two
  brands' zones, the second named after a product it has never heard of.
- **`cnameTargetFor`** replaces the constant, so a Piggles customer connecting
  their own domain is told to point it at `customers.piggles.site` (which is what
  `piggles/packages/config` already advertises) rather than at another company's
  hostname.

**No brand conditional anywhere.** `tenantZone(tenantId)` reads the zone off the
subdomain the tenant already has — provisioning recorded the answer at signup, so
the honest way to find it later is to look, not to re-decide it from the brand. A
third brand needs no change to any of this.

One trap worth keeping: `rows.map(toView)` had to become
`rows.map((row) => toView(row, cname))`. Adding a second parameter to a function
used point-free hands it `.map`'s INDEX, and it was caught only because the
parameter is typed.

### Still not done

- **Nothing has been built.** These are structurally verified — every check
  passes, all three kustomize overlays render, the images resolve to GHCR and the
  env wiring is correct in the rendered output — but no `docker build` has run,
  so a missing transitive dependency inside a package's SOURCE (as opposed to its
  manifest) would still surface on the first release.
- **The three `PIGGLES_*` secrets do not exist yet.** The pods will not start
  without them, deliberately: a missing auth secret must stop a pod rather than
  produce an app that half-works. They go in `SPARX_APP_SECRETS_ENV` / Key Vault.
- **The Google Cloud project for Piggles** still has to be created — see the
  section below on why it cannot be another client in sparx's.
- **DNS is written; two switches are not flipped.** The records are in
  `terraform/modules/dns` — see the section above. What remains is confirming the
  four zones are in the Cloudflare account and setting `CLOUDFLARE_ENABLED=true`.

## Neither Piggles app is deployable — four missing pieces

Both build locally and neither can ship. Nothing about them is wired into the
deploy path:

1. **No Dockerfiles.** Every shipped app has one (`apps/{web,site,market,admin,workbench}/Dockerfile`);
   `piggles/apps/web` and `piggles/apps/account` have none, despite both being
   configured `output: 'standalone'`.
2. **Not in the release matrix.** `.github/workflows/release.yml` (~line 265)
   hardcodes 14 image targets by name and Dockerfile path. Neither is listed, so
   a push to `main` builds nothing for them.
3. **No Kubernetes manifests.** `k8s/apps/` holds one YAML per app — nine of
   them, none for Piggles. No Deployment, no Service.
4. **No routing or certificates.** `k8s/ingress/Caddyfile` routes by explicit
   host block. There is no block for any Piggles hostname, so even a running pod
   would be unreachable.

**The trap:** `scripts/check-dockerfile-deps.mjs` is the guard against a
workspace dependency missing from an app image — the failure that kills a release
three minutes in. It reports "5 hand-listed images" and is BLIND to these two.
The first Piggles Dockerfile must be added to that checker **in the same
change**, or it inherits exactly the drift the checker exists to prevent.

**Two prerequisites that are not code:**

- **The domains must actually be ours.** Completing onboarding locally redirected
  to `https://mypiggles.com/auth/callback` and got a **403 from a parked lander** —
  that host currently resolves to somebody else's server. Confirm all three are
  registered and pointed at the cluster before any deploy. This is also why the
  console origin is now environment-aware: until DNS is ours, a handoff token
  would travel to a third party.
- **The Google OAuth project**, per the section above — `getpiggles.com` only.

Doing it is one coherent piece: two Dockerfiles, two matrix entries, two k8s
manifests, three Caddy blocks, the checker update, and the environment variables
above. Mechanical once the domains resolve.

**Sequencing note:** `meetpiggles.com` genuinely stands alone and is finished, so
it can ship on its own. Deploying the account app before the console exists gets
a live funnel with a dead end — signup hands off to a console that is not there.

## Four bugs that only clicking found

Every one of these passed typecheck, lint and build.

1. **The primary site was never renamed.** `properties` is under FORCE RLS, and
   the action used the raw client, so `updateMany` matched zero rows and returned
   `{ count: 0 }` — not an error. The tenant rename worked (the `tenants` dispatch
   row is deliberately non-RLS), so it looked successful while the business kept
   sending receipts as "Marta's workspace". Fixed with `withTenant`, plus an
   assertion that throws when the count is 0 — the failure is now loud.
2. **The handoff sent a live token to a domain we do not control.** The URL was
   built from `PRODUCT.hosts.console`, the PRODUCTION host, so completing
   onboarding on localhost redirected the browser to
   `https://mypiggles.com/auth/callback?t=…` — currently parked, returning 403.
   Single-use and 60 seconds bounds it, but an origin-bound token must only ever
   travel to an origin we own. The origin is now `PIGGLES_CONSOLE_ORIGIN`,
   defaulting to production only when `NODE_ENV=production` and to
   `localhost:3022` otherwise.
3. **"the Pigglesterms and privacy policy."** JSX deletes a newline sitting
   directly against an expression container, so a wrapped `{PRODUCT.name} terms`
   loses the space. Invisible in the source, plain on the page.
4. **Everything was a 448px column.** The centred-card auth shape is right for a
   three-field sign-in and wrong for onboarding's five option rows, which wrapped
   three deep and read as an unfinished phone layout. `AuthShell` now takes
   `width="form" | "wide"`; onboarding is wide with the options in two columns
   and fits on one screen.

A fifth, from writing the fix for #3: a `/* */` comment containing the closing
sequence inside its own prose ends early and turns the rest into code. The block
comment broke the build; line comments replaced it.

## Environment — what each Piggles surface needs

| Variable                       | Where   | Value                                                  |
| ------------------------------ | ------- | ------------------------------------------------------ |
| `BETTER_AUTH_URL`              | account | `https://getpiggles.com` (dev `http://localhost:3021`) |
| `BETTER_AUTH_APP_NAME`         | account | `Piggles`                                              |
| `GOOGLE_CLIENT_ID` / `_SECRET` | account | the Piggles OAuth client                               |
| `PIGGLES_CONSOLE_ORIGIN`       | account | `https://mypiggles.com` (dev `http://localhost:3022`)  |

`BETTER_AUTH_URL` must match the Google redirect URI exactly — protocol included,
no trailing slash — because the callback path is derived from it.

`BETTER_AUTH_APP_NAME` is new and defaults to `sparx`. It was hardcoded, and it
feeds the PASSKEY PROMPT, so a Piggles customer would have been asked to "save a
passkey for sparx". A parameter, never a brand conditional.

## Google OAuth — only ONE domain gets it

**`getpiggles.com` only. `mypiggles.com` gets none, by design** — the console
mounts no Better Auth handler and has no sign-in UI; it receives a session
through the handoff. A callback there would be a second thing that can mint
sessions, which is what the three-domain split exists to prevent.
`meetpiggles.com` never authenticates either.

**Create a SEPARATE Google Cloud project for Piggles**, not just another client
in sparx's. The OAuth consent screen — app name, logo, support email — is
configured PER PROJECT and shared by every client in it, so a Piggles customer
would otherwise see "sparx" on the consent screen.

One Web-application client in that project:

- **JavaScript origins** — `https://getpiggles.com`, `http://localhost:3021`
  (needed separately because Google One Tap runs client-side; Better Auth
  registers the One Tap plugin automatically once both credentials are present)
- **Redirect URIs** — `https://getpiggles.com/api/auth/callback/google`,
  `http://localhost:3021/api/auth/callback/google`

Two consequences worth expecting: passkeys are domain-scoped via `rpID` derived
from `BETTER_AUTH_URL`, so sparx and Piggles passkeys are separate credentials
even for the same person; and a custom logo on the consent screen triggers
Google verification (days, wants a privacy policy on a verified domain), so
launch without the logo and add it once meetpiggles.com is live.

## 2026-08-14 — the account app's face, and the console stops looking like sparx

### The account app (getpiggles) — sign-in, signup, onboarding

Rebuilt to the approved reference: a split shell (`components/auth-shell.tsx`),
the mascot at her desk with two app cards floating in the artwork's clear
top-left quadrant, and a full-bleed assurance band. Onboarding shares the shell
but replaces the pitch with a LIVE RAIL PREVIEW — all fifteen apps, filling in as
the boxes are ticked, so "everything is included either way" is shown rather than
only stated.

Rules that came out of it, now in [DESIGN.md](DESIGN.md) §10 and §11:

- **Nothing on a Piggles screen may be invented.** The reference had "trusted by
  thousands of small businesses", five customer logos and 99.9% uptime. Piggles
  has not launched. Every claim on a product surface must already be made on
  meetpiggles.com, whose /trust page refuses badges and uptime figures in
  writing.
- **Signed-out screens are a glance, not a read.** Title of three or four words,
  then ONE short line. The first pass wrote paragraphs and had to be cut.

Assets: this artwork is the `desk` pose in [@piggles/mascot](packages/mascot/README.md)
and is served from `apps/account/public/mascot/desk.webp`, generated by the
ingest. It is a genuinely clean cutout — 52% clear / 48% opaque, 0.4% partial,
which is edge antialiasing rather than a glow — which is what lets it sit
directly on the pink wash.

`piggles/images/piggles-at-desk.png` is a duplicate of the batch-01 master
`images/mascot/01/assets/png/piggles-desk-scene.png` (same 1536×1024 canvas, same
1502×851 subject box). The hand-trimmed web copy that used to sit at
`apps/account/public/piggles-at-desk.png` is deleted — two copies of one asset
meant a re-cut would land in the catalog and silently miss this screen.

### THE LOCKOUT — read this before debugging any Piggles auth problem

`piggles/apps/account/.env` did not exist, so `BETTER_AUTH_URL` fell back to
`http://localhost:3001` while the app runs on **3021**. Better Auth derives its
trusted origin from that value and answered `Invalid origin` to every
BROWSER sign-in.

It hid for hours because every cheap check passes:

- **Sign-up keeps working** — it is a server action, so no `Origin` header.
- **curl keeps working** — curl sends no `Origin` header either, so the endpoint
  tests healthy from a terminal and fails in a browser.
- **The UI blamed the password**, because the error handler collapsed every
  failure into the credential message.

`sparx/apps/workbench/.env` carries a comment predicting this exact symptom
("looks exactly like a wrong password"). It was read and not connected.

Fixed: `.env` + `.env.example` in the account app, and three error handlers that
now name the real cause. The ambiguity on SIGN-IN is still deliberate for
`INVALID_EMAIL_OR_PASSWORD` only — note it keys off the CODE, because `403` is
what invalid-origin returns and an earlier draft treated 403 as a credential
failure, which would have re-hidden the bug it was written to expose.

Also added `normalizeEmail()` in `@piggles/config` — signup trimmed the address
and sign-in did not, so a stray space or capital created an account that could
never be signed into. Passwords are never normalised.

Dev email is DEAD: `SPARX_DEV_WORKER_ROUTES` is unset, so `email.send` is a
silent no-op and both recovery paths do nothing while claiming success
(FOLLOW_UPS #8). Reset tokens are stored PLAINTEXT in `verifications.identifier`
— usable for recovery in dev, and a security item to raise.

### The console (mypiggles) — Piggles owns its dock chrome

`sparx/apps/workbench` has **zero modifications**. The console has its own dock:

```
piggles/apps/workbench/lib/dock/console-dock.tsx    the dockview component
                            /pane-tab.tsx           the title bar
                            /group-actions.tsx      its buttons
                            /default-layout.ts      the six opening windows
piggles/apps/workbench/lib/dock-theme.ts            theme + gap
piggles/apps/workbench/lib/window-mode.ts           windows ⇄ tabs
```

The split: **presentation is Piggles', plumbing is platform.** It still imports
`Pane`, `DockPaneHost`, `loadLayout`/`saveLayout` and the controller — forking
those means two consoles losing arrangements in two different ways. sparx's
`dock-theme.css` is deliberately NOT imported; Piggles starts from dockview's
bare reset.

Also landed: business switcher AND site switcher (the tenancy spine was already
session-aware with a membership check — the only missing piece was
`organizationClient()` on the shared auth client), the plan card in the rail
footer, labelled rail by default, and the top bar's wide "What do you want to
do?" search, quick-add, help and named avatar.

### Four traps that cost hours, in order of how much

1. **The compiled chunk is the only honest witness.** Typecheck and lint never
   look at CSS. Four rounds of dock styling were reasoned about while the browser
   was serving a stylesheet from 03:45. Fetch
   `/_next/static/chunks/*globals_css*.single.css` and grep it before believing
   any CSS change landed.
2. **There are two directories called `workbench`.** Clearing
   `sparx/apps/workbench/.next` or `piggles/apps/account/.next` does nothing for the
   console. The console's cache is `piggles/apps/workbench/.next`, and a plain
   restart reuses it.
3. **`<DockviewReact theme={…}>` typechecks and does nothing.** The props
   interface extends `DockviewOptions`, so TypeScript accepts it; the React
   wrapper's compiled source contains no reference to `theme`. Use
   `api.updateOptions({ theme })` in `onReady`.
4. **Never scope CSS to a class a library is expected to apply.** Every dock rule
   originally hung off dockview's theme `className`, which was never verified.
   They now also match `.piggles-dock-host`, a wrapper the console renders
   itself.

Related: `gap` is read by dockview's LAYOUT ENGINE (`gridview.margin`), which
derives drop targets and sash hit-areas — so it can never be done in CSS. Three
attempts proved it.

### The surface ramp is a contract

base-300 = ground (gutters), base-200 = window (title bar + body), base-100 =
content lifted onto it. An early version made the window base-100 and every card
in every shared surface lost its lift. **Piggles may change what the tones ARE —
warm here, cool in sparx — never what they MEAN.**

### Still open on the console

- The Piggles **Home surface** (greeting, KPI tiles, quick actions) — decided to
  be a NEW Piggles-owned surface, an addition rather than a fork. Not started.
- **Unread badges** on rail items (the reference shows Messages 3) — needs a real
  unread count; do not invent one.
- The reference's **settings gear** — deliberately not built, because no
  console-wide settings surface exists to open (the ones that exist are
  per-module).
- One file outside `piggles/` is modified: `wizeworks/packages/auth/src/client.ts`
  (`organizationClient()`). Shared auth, no sparx behaviour change — flagged, not
  yet blessed.

### Verify surface keys before using them

Four of six default-layout keys were guessed and wrong. A key that does not
resolve opens nothing and reports nothing. Real ones: `workbench.home`,
`builder.site`, `crm.customers.list`, `scheduling.calendar`, `chat.inbox`,
`invoicing.invoices.list`. Grep `key: '` in
`sparx/apps/workbench/lib/surfaces/catalog` first.

## 2026-08-14 (later) — the pane states, and Piggles stops speaking as sparx

Two jobs, both in SHARED code (`sparx/apps/workbench`), both because a Piggles console
was mounting surfaces written for a different product and a different reader.

### 1. Every pane's states now have one shape each

Three idioms existed for "there is nothing to show", and a person saw all three
side by side in one window: an `<Alert>` centred in a bare div, a bare
`<EmptyState>` centred in a bare div, and an `<EmptyState>` inside the surface's
own card. Plus `<p className="p-4 text-sm">Loading…</p>` in the top-left.

Now: **waiting → `<PaneWaiting>` · nothing there → `<ListEmptyState>` /
`<PaneEmpty>` · could not load → `<PaneLoadError>`**, all rendering INSIDE the
surface's content card with the toolbar above still present and still enabled.
Contract in [sparx/apps/workbench/CLAUDE.md](../apps/workbench/CLAUDE.md).

Swept: **92 error blocks · 43 empty blocks · 299 loading blocks**. Zero of the
old idioms remain.

**`<Alert>` is a banner and is never a replacement.** It is for when the content
IS on screen and something needs saying. When content is absent, an alert is
describing a thing nobody can see — which is exactly why the Site pane read as a
stray red box floating in a void.

**The frame belongs to the SURFACE, not the state.** Tried it the other way (the
state component carrying its own card) and it broke the one pane that was already
correct. The card is the content REGION; what fills it is the state.

**Glyph tones, decided inside the components.** silica's `EmptyState` is
colorless by design — a 55%-faded glyph on base-200 — so a failure, an empty
filter and a first run drew the identical grey picture and only a sentence told
them apart. Now error → `text-error`, gone → `text-warning`, no-results →
`text-warning`, first-run / nothing-chosen → `text-module`. Decided in the two
components because there are a hundred call sites: callers pass their glyph, the
component decides what that STATE looks like.

**`reason: 'missing' | 'unreachable'`** on `PaneLoadError`. 27 surfaces already
distinguished a deleted record (retry is pointless) from an unreachable server
(retry is the move) via `color={gone ? 'warning' : 'danger'}`. The component
would have flattened both, so it grew the distinction instead, and it IGNORES
`onRetry` when the reason is missing — a button that cannot work is worse than no
button.

### 2. Piggles speaks for itself inside shared surfaces

**The product adapter was never wired for Piggles.** `sparx/apps/workbench/lib/product.ts`
is the one seam for what cannot ride a token, and the console never called it —
so inside every shared pane Piggles was showing sparx's product name, sparx's
module vocabulary ("CRM", "Commerce"), and **Sparky, sparx's mascot**. Nearly
invisible until the loading sweep put the mark on every list's first load.

Now wired in [lib/console/product.tsx](sparx/apps/workbench/lib/console/product.tsx),
with the module lexicon DERIVED from the APPS registry (each app already declares
the modules it fronts — restating it would create a second source that drifts).

The adapter grew from 3 fields to 6:

| field            | for                                   |
| ---------------- | ------------------------------------- |
| `name`           | the product's name mid-sentence       |
| `moduleLabels`   | what a module is called               |
| `LoadingMark`    | the brand's mark while a pane loads   |
| `hiddenSurfaces` | a whole pane this brand does not have |
| `hiddenFeatures` | a BLOCK inside a shared pane          |
| `copy`           | whole sentences, written by hand      |

**108 strings written in Piggles' voice** — [lib/console/copy.ts](sparx/apps/workbench/lib/console/copy.ts).
Not substituted. `productCopy(key, sparxFallback)` for quoted strings,
`productCopyWith(key, fallback, values)` for template literals with `{placeholders}`.
108 wired, 108 written, zero gaps in either direction (there is a reconcile script
pattern in the scratchpad; regenerate it by walking `productCopy(?:With)?\(\s*'([^']+)'`).

**TWO STRINGS WERE FACTUALLY WRONG, not merely off-voice** — and both would have
survived a name swap looking perfect:

- turning off an app: _"…and you stop being billed for it"_ (sparx charges per
  module; Piggles is one flat price, so turning an app off saves nothing)
- the partner pitch: _"priced only on the modules they keep switched on"_ — a
  partner repeating that would be misselling

This is the whole argument against find-and-replace on prose, and it is now a
rule in [piggles/CLAUDE.md](CLAUDE.md): **"A sparx PRODUCT is not a Piggles
capability."** Exclude, never rename, never ask. Excluded so far: `sparx.market`
(whole surface), the marketplace card on a product's Channels tab, and the
`sparx_pay` gateway.

### Traps this cost time on — do not repeat

1. **A codemod is right for JSX structure and WRONG for prose.** The structural
   sweeps were fine; proposing `productName()` interpolation for copy was not.
2. **Template literals are invisible to a quoted-string scan.** 17 were missed on
   the first pass, including BOTH factually-wrong pricing claims. Scan backticks
   separately.
3. **Prettier splits a call across lines, which breaks an "already wired" guard**
   that looks for `productCopy('key'` as a contiguous string. Produced two
   double-wrapped calls. Reconcile both directions afterwards rather than
   trusting the wiring.
4. **`tsc` and `prettier` OOM on this repo.** Use
   `NODE_OPTIONS=--max-old-space-size=8192`, and never glob prettier over
   `surfaces/**` — format changed files only, in batches.
5. **Line-numbered edit lists go stale the moment an import is inserted.** Match
   by content.

### Still open from this session

- **`noreply@piggles.email` has no DNS behind it.** Wired as the sender fallback
  so Piggles mail does not arrive from `sparx.email`, but it will not deliver
  until the domain exists. Flagged rather than invented.
- **Dock elevation is unverified by eye** — `shadow-sm` at rest, `shadow-lg` torn
  off, via Tailwind's scale (silica ships no elevation utility because Tailwind
  already has one).
- **`wizeworks/packages/auth/src/client.ts`** still carries the `organizationClient()` line
  — the only file changed outside `piggles/` and `sparx/apps/workbench`.

## 2026-08-14 (later still) — THE SEPARATION

**The console no longer shares a single line of code with sparx.** This is the
biggest structural change the project has had and it invalidates a lot of what
is written above.

### What was true before

`piggles/apps/workbench` MOUNTED `sparx/apps/workbench` through a `@workbench/*`
tsconfig alias — 84 imports reaching into sparx's application for the surfaces,
the dock plumbing, the controller, the registry and three API routes. The old
RULE #0 called for it in as many words: _"mount them, never fork them."_

### Why it had to go

Brandon, plainly: _"piggles might be deleted tomorrow and must not affect sparx.
and sparx might be deleted tomorrow and must not affect piggles."_

That test was failing in both directions. Making Piggles speak for itself meant
editing sparx's tree — around 350 of sparx's files ended up carrying
Piggles-shaped machinery — and a build error in one product surfaced in the
other. (It did: a `Spinner` import that does not exist in silica broke the
PIGGLES build, in a file under `sparx/apps/workbench`.)

### What was done

1. Copied `sparx/apps/workbench/{components,lib,surfaces}` + `app/surface-support.css`
   into `piggles/apps/workbench`, from the WORKING TREE — so every Piggles-facing
   change made that day came along.
2. Rewrote all 84 `@workbench/*` imports and 5 escaping relative paths to `@/`,
   the console's alias for itself. Directory shape was preserved exactly, which
   is why the relative imports inside the copied tree needed no edits at all.
3. Repointed `globals.css` — a `@source '@/…'` does not resolve, because `@/` is
   a TypeScript alias and PostCSS has never heard of it.
4. Gave the console its own `token` / `active-site` / `version` handlers. They
   used to re-export sparx's, which after the rewrite meant re-exporting
   themselves (`TS2303: Circular definition of import alias`).
5. **Restored `sparx/apps/workbench` to HEAD.** `git status apps/` is now 0 files. The
   uncommitted diff is preserved at
   `scratchpad/apps-workbench-uncommitted.patch` (16k lines) if anything in it
   is ever wanted for sparx.
6. Deleted sparx's own shell from the Piggles copy — toolbar, workbench-shell,
   mobile-shell, mobile-nav, auth-shell, rail, module-panel, `auth/`, `billing/`.
   None of it was reachable and all of it said "sparx".
7. Unregistered `workbench.home` ("Start here"). Piggles has its own Home, and
   two screens with that name is one too many.

### The guard

`scripts/check-boundaries.mjs`, wired into `pnpm check:boundaries`, the pre-push
hook and a CI job. It fails on any import from `piggles/` into `apps/` or the
reverse, and it strips comments first so prose ABOUT the boundary does not trip
it.

**It also ratchets `@sparx/*` usage inside `piggles/`, and that replaced the
opposite rule.** This section used to say those imports "stay allowed and that is
deliberate — deleting the sparx APPS does not delete them, so depending on one
couples nothing." That defended the right boundary for the question it was asked
and the wrong one for the question that matters. "Does Piggles import sparx's app
code?" is not the same as "**can sparx be deleted without affecting Piggles?**",
and under the second a package named `@wizeworks/db` that Piggles cannot boot without
is an unanswered question rather than a pass.

So the counts are recorded per package in a baseline file and may only fall. The
scope is being renamed to `@wizeworks/*` and moved out of both brands' trees —
see [docs/migration/](docs/migration/) for the phases and the running checklist.
Superseded on 2026-08-16.

### What this costs, stated honestly

A platform fix now has to be made twice. That is real and it is the price of the
guarantee; do not "fix" it by reintroducing an alias. RULE #0 in
[CLAUDE.md](CLAUDE.md) is rewritten around this and carries the history so
nobody re-derives the old arrangement from first principles.

### What else landed the same day, before the separation

All of it survived the copy and now lives in Piggles' own tree:

- **The console could not load anything.** `piggles/apps/workbench` had no
  `.env`, so `/api/token` answered 500 and every pane failed at once while the
  chrome rendered perfectly. Same shape as THE LOCKOUT.
- **Home rebuilt** — sentences, not a KPI grid. Pale-pink hero, greeting by
  name, the date, rows whose number is the loudest thing in the line, cleared
  items collapsed into one quiet line, the mascot cropped by the panel's edge.
- **The default layout is ONE pane.** Six `controller.open()` calls do not tile
  — they make one group with six tabs whose active one is in the overflow menu.
- **The business switcher never appeared.** `organization.list()` posts to
  `/api/auth`, which this console does not mount, so it got the catch-all page
  back as HTML with a 200 and rendered "one business". Now a console route.
- **97 screen names and 30 section headings** written in Piggles' words. Two
  sections were literally called "What sparx does" and "What you pay sparx".
- **Partners fronted sparx's reseller programme** — referrals, commissions,
  bootcamps — while meetpiggles advertises it as suppliers and purchase orders.
  Re-pointed via a new `claims` field on the app registry.
- **187 copy keys**, all written by hand, reconciled both directions.
- **Spacious density.** The real defect was that `--size-field` moves HEIGHT and
  silica bakes font-size per size step, so every control was a comfortable box
  with cramped type (48px button, 14px text; `sm` at 12px). The type ladder is
  re-hung on the size ladder in `@piggles/brand`, nav rows are 16px, and
  silica's `--ease` finally points at `--ease-piggles`.
- **The mascot is in the states.** `StateArt` on the product adapter maps
  waiting / empty / no-results / unreachable / missing to a pose, per app where
  one exists. Small on purpose.

### The console works, end to end, standalone

Driven in a browser after the separation, and it is the first time anything
here has been checked by eye rather than by typecheck:

| Checked                 | Result                                                      |
| ----------------------- | ----------------------------------------------------------- |
| Home                    | greets by name, date, counts land, quiet line, mascot       |
| First run               | three steps, real server ticks, module-hued                 |
| Rail + app panels       | six group hues, sentence-case headings, no truncation       |
| Stock panel             | purchasing gone (moved to Partners) — the claims seam works |
| Partners panel          | suppliers and POs, no reseller programme anywhere           |
| Launcher (⌘K)           | groups by PIGGLES app names, Piggles screen names           |
| All apps                | every app, "On" badges, the flat-plan sentence              |
| Empty state (Customers) | mascot, centred, honest copy                                |
| Waiting state           | mascot + "Just a moment…"                                   |
| Dark theme              | warm dark canvas, hero holds, rail hues survive             |
| 390px                   | compact shell, drawer, Home + first run all render          |

`apps/` has 0 changed files throughout.

**One trap the separation left, worth knowing about.** `/api/token` hung —
literally no response in 180 seconds — while `/api/health`, `/api/version`,
`/api/active-site` and `/api/businesses` all answered in under a second. Every
pane waits on that token, so the whole console sat on skeletons and the renderer
eventually stopped answering CDP at all.

It was ONE wedged incremental compile in Turbopack, not a poisoned cache: the
route had been a re-export and became a real handler with new imports, and the
dev server had been hot-patching through 668 moved files and a `tsconfig` paths
change. **Touching the file was the entire fix** — inserting a line forced a
recompile and it answered in 0.7s. If a single route hangs after a big move,
edit it before restarting anything.

### Windows stay in the workspace

A floating window could be dragged out over the app rail and sit on top of the
navigation — covering the one thing you would use to get out from under it.

dockview positions a floating group against its OWN container rather than the
browser, so the geometry was never wrong; the DEFAULT is. `floatingGroupBounds`
is unset by default, which means dockview keeps only
`DEFAULT_FLOATING_GROUP_OVERFLOW_SIZE` inside the dock and lets the rest hang
out. Set to `'boundedWithinViewport'` — dockview's way of saying fully inside —
in the same `api.updateOptions` call as the theme, and BEFORE the layout is
restored, because dockview reads the option when it constructs each overlay.

Verified by dragging a window 600px past the left edge: it moved down and its
left edge stayed pinned to the workspace boundary.

### The in-console first run

A brand-new business used to land in a working console with an empty site and no
guidance. It now gets three real jobs on Home — something to sell, somebody to
sell it to, an invoice — each ticked from the same server `total` the real list
screen reads, and the panel retires itself permanently once all three are done.

Deliberately NOT a wizard. sparx's `OnboardingGate` owns the viewport and its
spine is the modules step, which Piggles has no use for; and a wizard opening
over a working console contradicts the one promise the product makes, which is
that you are already in. getpiggles has also already asked the two questions
worth asking, so asking again would be the software forgetting a conversation it
just had.

## 2026-08-14 (last) — the console gets its color, its ranking, and its own voice

Driven app by app, screen by screen, at desktop, at 360px and in dark. Everything
below was found by looking at it; every one of them passed typecheck and lint.

### The two biggest finds were both invisible to every check we run

**1. In dark mode, every app color was unreadable.** The five group hues were
declared once for both themes, on the stated reasoning that "a saturated hue
reads on either canvas". True of a FILL, where the hue is the background. False
wherever the hue is the INK — and that is most of this console, because the app
panel's glyphs, the launcher's glyphs and every `soft` control paint with it.
Measured against the canvas each one lands on:

| group  | was    | is now  |
| ------ | ------ | ------- |
| web    | 2.20:1 | 6.93:1  |
| sell   | 2.67:1 | 8.19:1  |
| people | 2.58:1 | 9.53:1  |
| money  | 2.77:1 | 10.57:1 |
| run    | 1.98:1 | 7.81:1  |

Same families, three steps lighter, so an app keeps its identity across a theme
switch. **Lightening a palette usually costs separation, so both gates were
re-run:** closest group pair 12.8 ΔE2000, closest to a semantic color 10.8 —
against the SHIPPING LIGHT SET's own 9.6 and 5.9. The dark set is better
separated than the one already in production, which is the bar that matters.
`-content` inverts with them and is not optional: white on `#bef264` is 1.3:1.

**`--color-neutral` had the same bug and the same fix.** `secondary` was already
inverted for dark with a comment explaining why; `neutral` was missed. It worked
as a fill and failed as ink — the rail's own "View plan" button measured
**2.52:1**, the exact figure this file already records under "Decisions worth not
re-litigating". Now 6.78:1 as ink, 8.09:1 as a fill, holding a 1.47 surface step
against `secondary` (the light pair's is 1.38).

**2. The first-run checklist was asking two endpoints that do not exist.** It
called `/v1/products` and `/v1/customers`; the console's own list panes call
`/v1/commerce/products` and `/v1/crm/customers`. The requests failed, the failure
became `unknown`, and `unknown` drew the same empty ring as `todo` — so a
business that had just added its first product was told, in a panel about first
products, that it had not added one. Fixed three ways, because one was not
enough:

- the paths now match the lists that own them;
- `unknown` draws a **dashed grey** ring and says "We could not check this one
  just now" — absence must never render as a measurement;
- the queries are keyed UNDER the roots each list already invalidates
  (`productKeys.lists()`, `customerKeys.all`, `['invoicing']`), so the tick
  refreshes on exactly the events that could change it. `staleTime: Infinity`
  was the other half of the bug: adding a product left the answer stuck at zero
  for the whole session.

Verified by adding a product through the form: the row turned green and read
"You have something to sell".

### The app panel wears its app

Every row's glyph was `base-content`, so the widest, most-read column in the
product was twenty identical black marks and the only color on a browsing screen
was the one rail row behind it. They now carry the app's hue from the `<AppScope>`
already wrapping the panel. Within one app the color distinguishes nothing;
between apps it is the whole distinction, which is what the rail already does.

Its header was `text-sm` — a 14px heading over 16px rows, a heading smaller than
its own contents. Now `text-base font-semibold`.

### The launcher ranks

Typing `customers` put **"How this app behaves"** first and the screen actually
called Customers third. The filter was one `includes` across the label, the GROUP
and the keywords, with results left in registry order — and every screen in the
Customers app carries "Customers" as its group, so they all matched equally.

Now scored: exact name 100, name starts with it 80, contains it as a word 60,
anywhere in the name 40, keyword 30/20, group alone 10. A group match is the
weakest possible evidence and must never outrank a real name. Groups are ordered
by their best member so the runs stay contiguous — the render re-collects rows
into group buckets while the keyboard walks the flat array, and a scattered group
would make ↓ jump around the screen.

Glyphs also carry their module's hue (via `data-module` written straight onto the
row — `<ModuleScope>` renders a `<div>`, which is invalid inside a `<button>`),
and the rows went from 14px to 16px, the group headings from 12px to 14px.

### 131 sentences that still spoke as sparx

Not a rename — a rewrite, read and written one at a time. Most were the product
naming itself and Piggles is simply the true subject. The ones that were not:

- **"you only pay for the parts you use"**, on the screen shown when a link opens
  an app you have not switched on. Piggles is one flat plan with every app in it,
  so that sentence is not off-voice, it is **false** — and a customer reading it
  would reasonably expect a smaller bill for using less. This is the third
  factually-wrong pricing claim inherited from sparx's copy.
- **"turn on the AI part of sparx under Modules"** (×2) points at a screen this
  product does not have — `platform.settings.modules` is excluded, because it is
  built around per-module pricing. Now points at All apps.
- **"parts of sparx you have switched on"** (×6) is the module vocabulary. Apps.
- **"the Online store, Invoicing or Email"** → Sell, Invoices, Messages.
- **"your sparx administrator"** invents a role Piggles has no name for.
- **"the free sparx.zone address"** (×3) — a Piggles business is provisioned on
  `piggles.site`; that is what `provisionTenant`'s `zoneDomain` parameter is for.

Three channel-label maps printed the literal string `sparx.market`. They now say
"Marketplace", matching what `surfaces/chat/data.ts` already decided — the value
cannot occur for a Piggles business, and the fallback would otherwise print the
raw slug.

**Hidden is not the same as absent, and one surface proved it.** `sparx_pay` is
in `hiddenFeatures`, so the provider LIST filters it out — but the DETAIL pane is
deep-linkable and restored from a saved arrangement, and it rendered a full "Set
up sparx Pay" form. It now applies the same seam, one level down. Hiding a row
and leaving its screen open is a door that is only closed from the front.

Fifteen client-side names still said `sparx-workbench` — storage keys, the
BroadcastChannel, the user agent it sends. All Piggles' now. Deliberately NOT
touched: `sparx_active_property` (a cookie api-rest reads), `sparx_attr_first`,
the `sparx-stripe` / `sparx-accounting` postMessage sources (the far side of an
OAuth popup sends them back), and the `sparx_market` / `sparx_pay` wire enums.

### Smaller things, all found by clicking

- **The Add-a-product form opened with a red error.** "Give the product a code."
  was computed and rendered unconditionally, so the first product form a new
  business ever sees told them off before they typed a character — and the error
  replaced the description explaining what a product code even is. Held until the
  form has been started, which is when it can be true and useful at once.
- **The mobile drawer's navigation was 72px narrower than the drawer.** Silica's
  `Sidebar` sizes from its own `--sidebar-w` (16rem) and does not fill. Worse,
  `AppPanel` hardcoded `20rem`, which on a 320px phone is 48px WIDER than the
  drawer containing it. `AppPanel` grew a `width` prop; the desktop case keeps
  the fixed width because its wrapper animates `w-80 → w-0` and a percentage
  panel would re-wrap every label on the way shut instead of sliding.
- **The first-run tick floated in the middle of its row on a phone**, beside the
  explanation rather than the job, because the row was `items-center` and the
  label wraps to five lines at 360px.
- **"Nothing in your catalog yet"** was a third word for a thing this console
  already calls two things. "Nothing to sell yet".
- **The All apps dialog's description contradicted the list under it** — "these
  are just the ones you have not switched on yet", above all fifteen.
- `sparx.market` came out of a visible surface's launcher KEYWORDS, where typing
  another company's product name would surface a Piggles screen.
- `lib/product.ts`'s unconfigured default named the wrong product.

### What was checked and is right

| Checked                   | Result                                                      |
| ------------------------- | ----------------------------------------------------------- |
| All 15 app panels         | own hue, sentence headings, Piggles screen names throughout |
| Launcher, empty and typed | ranks the named screen first, hued glyphs, groups by app    |
| All apps                  | fifteen cards, honest description, flat-plan sentence       |
| Add a product, end to end | created, list populated, tab renamed, first-run ticked      |
| Product detail            | pills, lifecycle in the header, plain-English descriptions  |
| Dark, every surface above | measured, not eyeballed — table at the top of this section  |
| 360px in an iframe        | drawer fills, hero stacks, checklist aligns, no h-scroll    |

`apps/` has 0 changed files throughout, and the boundary check passes (then
`check:isolation`; now `check:boundaries` — see "The guard" above).

### Still open from this session

- **The console shows an empty workspace for a few seconds on a cold load.** In
  development that is Turbopack compiling the surface chunks and says nothing
  about production; it wants a production build to measure honestly before
  anything is designed around it.
- **`lib/tour/` is dead code in Piggles** — nothing imports it, the first run is
  deliberately not a tour, and its `.sparx-tour` CSS classes have no definitions
  in this app. It costs nothing at runtime (unreferenced, so unbundled) and is
  left rather than deleted mid-session.
- **The money field carries no currency symbol.** Noticed while adding a product;
  shared-surface behaviour, not investigated.

## 2026-08-17 — the builders are Piggles' own, and the old editor is gone

The console had ONE editor that owned every document at once: the site's pages, its
chrome, its look, its saved pieces and its emails, all held in one in-memory `Site`
and written back through one whole-site save. It has been replaced by **eight panes,
one document each** — page, header & footer, look, saved piece, email, plus history,
preview and publish — over a new engine, `wizeworks/packages/studio`.

**Why per-document, in one sentence:** two panes can now be open on two documents at
once and neither is a copy of the other, so a look edits beside the page it repaints,
and a footer typo ships without shipping every half-built page with it.

| Thing                           | Where                                      | State                                                                                                      |
| ------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| The engine                      | `wizeworks/packages/studio`                | Documents, ops with self-computed inverses, per-doc undo, the theme→layout→page resolution chain. 94 tests |
| Page / layout / piece builders  | `piggles/apps/workbench/surfaces/studio/*` | Canvas, layers, insert, inspector; save + publish per document                                             |
| Look builder                    | same                                       | Every silica token, live contrast warnings, own + ready-made + marketplace shelves                         |
| Email builder                   | same                                       | Its own node vocabulary, own session, merge tags resolved against sample data                              |
| History · Preview · Publish     | same                                       | Per-document history + restore; the real page in a pane; whole-site publish + rollback                     |
| Piggles' copy of the old editor | `surfaces/builder/{studio,email}`          | **Deleted** — nine files, 4,810 lines                                                                      |

**sparx's editor is untouched and is not going anywhere.** The fork on 2026-08-14
gave Piggles its own copy of that tree; what was deleted is that copy.
`check:deletability` confirms the two products still share nothing but the platform.

### Three things this build found that no check could

- **Six panes had no address.** `check:routes` only scanned sparx's catalog, so every
  studio pane built across six phases was unlinkable and blanked the address bar when
  focused. The script now scans both consoles.
- **A page could lose its content to a concurrent save.** The per-document Save
  spliced one document into a whole-site payload; `sync` upserts every page in that
  roster, so two panes saving two different pages could put a stale copy of one back.
  Deletion was never the exposure, which is why nothing caught it. Now one row, one
  UPDATE (`writePageRoot` / `writeFrameRoot`).
- **A saved piece had no way back.** Editing one wrote its JSON column directly and
  skipped the snapshot, making it the one document with no history.

### Not yet true

**Nobody has opened any of it in a browser.** Typecheck, lint, prettier, 94 tests and
every structural check pass; that is the same set that passed before each of the three
defects above. Task 9.4 in
[docs/features/builder/TASKS.md](docs/features/builder/TASKS.md) is the drive-through,
and 8.5 (the session surviving a pane tear-off) rests on it.

`builder_theme_versions` (migration `20270328000000`) is authored but **not applied** —
it needs the pipeline, or a local `migrate dev`. A look's history is empty until it runs.

## Next

1. **Sign up once, and watch what a new business actually gets.** The whole
   furnishing path — onboarding → `/internal/tenant/furnish` → modules → starter
   → blueprint → sample data → handoff → the workbench — has NEVER been run by a
   person. It is typechecked, linted, schema-validated and swept; not one signup
   has gone through it. Everything below "how to resume" applies with force here:
   every real defect this build has produced was found by opening a page or
   querying the database, and every one of them passed all three checks first.

   What to check, in the order it can go wrong: the furnish call returns at all
   (it needs `PIGGLES_API_REST_URL` + `SPARX_INTERNAL_FURNISH_TOKEN` matching
   api-rest's, or onboarding refuses to finish and says so); all fifteen modules
   read as on; the CRM has a **pipeline** (its absence is what silently empties
   the Deals board); the chosen template's pages exist on the site; the shop
   holds the six Rowan goods. Then open the site and confirm the theme is
   Piggles pink rather than sparx ember.

2. **A first release.** The pipeline is wired and structurally verified but
   nothing has been BUILT — see "Still not done" in the deployment section. The
   three things standing between here and a live meetpiggles.com are the
   `PIGGLES_*` secrets, the Piggles Google Cloud project, and DNS. Ship
   `meetpiggles.com` first: it stands alone, it needs no secrets at all, and it
   is the one surface where a broken deploy costs nothing.

3. **Billing** on top of the meters: payment method, invoices, one-tap
   expansion. The meters record; nothing reads them yet. Do FOLLOW_UPS #1 and #2
   as part of this — flat-plan Stripe items and the console's lifecycle notice
   are the same piece of work.

4. **`noreply@piggles.email` still has no DNS behind it.** Wired as the sender
   fallback so Piggles mail does not arrive from sparx.email, and it will not
   deliver until the domain exists.

5. Piggles' own video footage (currently sparx's), and a decision on the pricing
   allowances (`/pricing` publishes the low end of an unvalidated range).

6. **Two dock ideas, deliberately NOT built** — raised, discussed, parked by
   Brandon ("keep the tabs in windows for now"). They are two different features
   and worth keeping apart:
   - _A one-pane window gets a title bar._ Today a floating window holding one
     pane shows a single tinted chip with `min-width: 8rem` in an otherwise
     empty 44px bar, which reads as "there are other tabs you cannot see". Pure
     CSS on `.dv-resize-container .dv-tab:only-child` — reactive for free, and
     the tabs return the moment two panes share a window.
   - _Windows never hold more than one pane._ Refuse the drop into a floating
     group, which would make the title bar unconditional. The bigger change of
     the two, because stacking windows is a real arrangement today.

## Known defect

**`piggles/apps/workbench/.next` predates the fork.** The dev server hot-patched
through 668 moved files, three replaced route handlers and a `tsconfig` paths
change. It survived, but `/api/token` wedged once (see above) and a clean
`rm -rf piggles/apps/workbench/.next` before the next session would remove the
whole class of problem.

## The reverted sparx work

`apps-workbench-reverted-2026-08-14.patch` at the repo root (gitignored) is the
16k-line diff that `sparx/apps/workbench` carried before it was restored to HEAD. It
holds today's Piggles-motivated edits AND the previous session's genuine sparx
improvement — the unified pane states swept across 447 surfaces. **That sweep is
no longer in sparx.** If sparx wants it back, it is in there; if not, delete the
file. It is kept only because reverting was the right call for the boundary and
a wrong one to make silently.

## How to resume

Read this file, then `piggles/CLAUDE.md` (RULE #0 is rewritten — the two
products share nothing), `piggles/DESIGN.md` and `docs/FOLLOW_UPS.md`.

**The habit this build keeps re-teaching: a green typecheck, lint and build says
almost nothing about whether a screen works.** Every real defect has been found
by opening the page or querying the database, and every one of them passed all
three checks first — the unsized logo, the invisible button, the site that never
got renamed, the token sent to a parked domain, module flags that activated
nothing, a route segment config that compiled perfectly and 500'd on every
request, and — this session — a console with no `.env` whose chrome rendered
beautifully while every pane failed to load.

The console has now been driven, and the table above is what was actually seen.
