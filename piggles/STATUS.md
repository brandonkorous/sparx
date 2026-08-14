# Piggles — build status

**Last updated:** 2026-08-14

Where the Piggles build actually is, what is decided, and what is known-broken.
Read [CLAUDE.md](CLAUDE.md) for the rules and [DESIGN.md](DESIGN.md) for the
design contract — this file is only state.

## Built and verified

| Thing                        | Where                                       | State                                                      |
| ---------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| Rules + design contract      | `CLAUDE.md`, `DESIGN.md`                    | Done                                                       |
| Brand tokens + theme         | `packages/brand`                            | Done. Compiles; every value measured                       |
| Marks (mark/wordmark/logo)   | `packages/brand/src/marks.ts` + `src/react` | Done, traced from the delivered SVGs                       |
| Product adapters             | `packages/config`                           | App registry, lexicon, product identity, `accountUrl()`    |
| `platform_brand`/`is_system` | `packages/db` migration `20270323000000`    | **Applied** to local docker; 96 tenants backfilled `sparx` |
| Site chrome                  | `components/marketing/site-{header,footer}` | Nav, mobile drawer, full 15-app footer index               |
| Homepage                     | `components/marketing/home.tsx`             | Video hero, six beats, 9 photographs                       |
| `/apps` + 15 `/apps/[app]`   | `app/apps/**` + `content/apps.ts`           | Built. **These are the satellite-domain landing pages**    |
| `/pricing`                   | `app/pricing`                               | One plan, allowance table, "never charge you for", FAQ     |
| `/trust`                     | `app/trust`                                 | Seven pillars, operations, FAQ                             |
| 404                          | `app/not-found.tsx`                         | Real page — offers the whole product, not an apology       |
| Social cards                 | `lib/og.tsx` + 20 `opengraph-image` routes  | Real vector lockup; app cards wear their group hue         |
| `sitemap.xml` / `robots.txt` | `app/sitemap.ts`, `app/robots.ts`           | App pages derived from the registry; AI crawlers welcomed  |
| Media                        | `apps/web/public/{video,photos}`            | 36 MB video, 2.3 MB photos, licences documented            |

44 static routes build clean. Typecheck, lint and prettier pass on `apps/web`.
Verified in a browser at desktop AND at 390px (in an iframe, so nobody's window
gets resized): every page stacks, the mobile drawer opens and closes, and the
console is clean.

Ports: **3020** meet, **3021** get (reserved), **3022** my (reserved).

## Decisions worth not re-litigating

- **Themes are the bare names `light` / `dark`**, not `piggles-light`. Safe because
  no Piggles app loads `@sparx/brand/theme.css` and no shared package imports it.
- **Colour is by GROUP, not by app.** Five hues plus the brand cover fifteen apps.
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
  secondary button asks for `outline` with **no colour**. Table in DESIGN.md §3.

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
   now in its `package.json`, matching `packages/brand`; it needs an install to
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
  centre. Hide with `max-sm:hidden` only. `apps/market/components/site-header.tsx`
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
handed a `sparx.zone` address. `packages/auth` typechecks clean.

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
`apps/workbench/surfaces/onboarding/` — a **story composer** backed by
`@sparx/story-schemas` (a clause grammar with industry, audience and tense, where
the owner literally writes a sentence describing their business), a six-step
wizard (`step-workspace`, `step-modules`, `step-blueprint`, `step-domain`,
`step-payments`, `step-launch`), a welcome banner + checklist, then `FirstRunTour`
and `ModuleTourOffers` afterwards.

Both must differ from sparx's, for the same structural reason: **`step-modules`
is the spine of sparx's wizard because modules are what sparx bills for.**
Piggles includes every app, so that step does not exist — which is not a step
removed, it is a different flow. `step-payments` differs too (no card at signup).

### Onboarding's answer now ACTIVATES, not just hides

The account app's "what do you do?" writes `settings.piggles.railGroups` AND
turns on the platform modules behind those apps
(`apps/account/lib/activate-modules.ts`).

**Why this changed.** A first attempt switched the whole catalogue on at
provisioning, by writing `settings.modules.<slug>.enabled` directly. That is
wrong twice: it answers a question nobody has asked yet, and — the real bug — a
flag write **fires nothing**. `module.activated` is what seeds the CRM's
pipeline, segments, SLA policies and object registry, the automation catalogue,
commerce's tax and shipping defaults, finance's accounts and the default emails.
Write the flag alone and every Piggles business arrives with fifteen apps
switched on and none of them set up: Customers "on", with no pipeline in it.

So: flags and events are two halves of one operation. The onboarding action
writes the flags inside the rename transaction, expands them through the
platform's dependency graph (`requiredModules` — B2B without Commerce is not a
smaller feature set, it is a broken one), and publishes `module.activated` AFTER
the commit. After, never inside: a consumer that wakes on the event has to find
the flag already true.

It deliberately skips three things api-rest's route does — the in-process cache
flush (nothing to invalidate for a brand-new tenant), the WizeWorks platform-CRM
event (FOLLOW_UPS #4) and the Stripe module-item sync (FOLLOW_UPS #1). The
`modules` parameter briefly added to `provisionTenant` has been REMOVED: a flag
write with no fan-out is a footgun nobody should be able to reach for.

**And "not activated" never means locked.** `components/all-apps-dialog.tsx`
lists every app in the catalogue, on or not, with a one-tap **Add app** carrying
no price, going through the real route (`PUT /v1/tenant/modules`, which merges
and fires the same fan-out). It is pinned in the rail footer and the mobile
drawer — permanently, not in a menu. Bury that door and onboarding's question
quietly becomes a paywall nobody can find the far side of.

### The story is stored, and now finally reaches the board

`tenants.settings.onboarding.story` has been collecting the story since
onboarding shipped — text, industry, audience, customers, implied modules,
composed-at. **It was never reaching `packages/platform-crm`**, the mirror that
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

`packages/platform-crm` typechecks clean and its 18 tests pass.

## Capacity metering — the meters now exist

Nothing was counting storage, email volume, contacts or seats anywhere on the
platform. Piggles prices on exactly those, and **usage history cannot be
backfilled** — nobody can reconstruct last March's storage figure — so every day
without meters was pricing evidence permanently lost. Built now, ahead of the
billing surfaces that will read it:

| Piece     | Where                                                                        |
| --------- | ---------------------------------------------------------------------------- |
| Model     | `RollupTenantDailyUsage` in `75-analytics-rollups.prisma`                    |
| Migration | `20270325000000_tenant_usage_rollup` (RLS included)                          |
| Measuring | `packages/usage` — `measureTenant` / `snapshotTenant` / `snapshotAllTenants` |

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
And `packages/usage` cannot typecheck until the Prisma client is regenerated,
since `rollupTenantDailyUsage` does not exist on the client yet.

## After the first install — what typechecks, and four things it caught

`@piggles/brand`, `@piggles/auth-handoff` and `@sparx/usage` all typecheck clean.
Four defects only became visible once the packages could actually resolve:

1. **The handoff's single-use guard could not compile.** `verifications.identifier`
   is INDEXED but not UNIQUE (only `id` is), so `findUnique` was never a valid
   call. Replaced with one atomic `DELETE … RETURNING` — better than the
   `findFirst` + `deleteMany` alternative, because that one lets a losing racer
   read a live session token into memory before the delete count rejects it.
2. **`forgetPassword` is not callable on this client.** The emailOTP plugin
   claims the name as a NAMESPACE (`forgetPassword.emailOtp`). The call is
   `requestPasswordReset`, which is what `apps/workbench` uses.
3. **A package that imports `@sparx/db` needs `"types": ["node"]` in its own
   tsconfig.** Type roots are per-compilation, so the dependency having
   `@types/node` does not help the consumer typecheck its source.
4. **`@piggles/brand` needs `"jsx": "react-jsx"`.** Under the base config's
   `preserve`, JSX resolves against the GLOBAL `JSX` namespace, which only exists
   once something has pulled in `@types/react` — `packages/brand` (sparx) gets
   that from `import * as React from 'react'`, and the Piggles marks deliberately
   import nothing. Matching sparx's tsconfig was the wrong instinct: the configs
   differ because the code differs.

Metering is now wired end to end: `POST /internal/platform/usage-rollup` in
api-rest (registered in `app.ts`) and `k8s/cronjobs/platform-usage-rollup.yaml`
at 05:00 UTC, before the reporting rollups — those recompute closed data and can
catch up whenever, this one takes a point-in-time reading and wants a clean day
boundary. `check:events`, `check:routes` and `check:docker` all pass.

## apps/workbench (mypiggles.com) — BUILT, NEVER SIGNED INTO

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
launcher, status strip, deep links, update notifier — is `apps/workbench`,
imported through a `@workbench/*` tsconfig alias. That works because the shared
tree has **zero `@/` imports**: every one of its internal imports is relative, so
the whole thing is reachable from outside without touching a line of it.

### The seam that made it possible: `apps/workbench/lib/product.ts`

The platform-side vocabulary provider (item 4 on the old Next list, now done).
Three things a surface says out loud that are not a colour: the **product name**,
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
   from `ALL_MODULES`, newly exported from `@sparx/modules`. **The same comment
   says other copies exist** — see FOLLOW_UPS #3.
3. **`.sparx-pulse-nudge` was defined in one app's stylesheet** for a shared
   component, so the other shell rendered a control that silently never moved.
   Moved to `surface-support.css` as `.pulse-nudge`.
4. Four strings said "sparx" out loud from inside shared surfaces.

### `apps/workbench/app/surface-support.css`

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

## Next

1. **Sign into the console and drive it.** Everything about it is unverified
   beyond a redirect and a typecheck — the rail, the dock, a real pane, the
   density change, "Add app". Sign up fresh at `localhost:3021/signup` rather
   than reusing `marta@thistlebakery.test`: that tenant predates the activation
   fix and has `railGroups: []` and `modules: NULL`, so it lands in a console
   with only Home on the rail. (Useful for testing "Add app" — useless for
   testing onboarding.)
2. **The in-console first run.** The console mounts no onboarding gate, so a new
   business arrives at a working console with an empty site and no guidance.
   Piggles' version has no modules step (everything is included) and no card
   step. The story composer and the shared `useOnboardingActions` are reusable;
   the chrome and the step list are Piggles'.
3. **Deployment**, as one piece — see the four missing parts above. Gated on the
   three domains actually resolving to us. `meetpiggles.com` can go first and
   alone; the account app before the console gives a live funnel with a dead end.
4. **Billing** on top of the meters: payment method, invoices, one-tap
   expansion. The meters record; nothing reads them yet. Do FOLLOW_UPS #1 and #2
   as part of this — flat-plan Stripe items and the console's lifecycle notice
   are the same piece of work.
5. Piggles' own video footage (currently sparx's), and a decision on the pricing
   allowances (`/pricing` publishes the low end of an unvalidated range).

**Done since this list was last written:** the console shell (item 1) and the
platform-side vocabulary provider (item 4) — see the two sections above.

## How to resume

Read this file, then `piggles/CLAUDE.md` (rules), `piggles/DESIGN.md` (the
design contract, §5 is new) and `docs/FOLLOW_UPS.md` (parked decisions).

**The habit this build keeps re-teaching: a green typecheck, lint and build says
almost nothing about whether a screen works.** Every real defect has been found
by opening the page or querying the database, and every one of them passed all
three checks first — the unsized logo, the invisible button, the site that never
got renamed, the token sent to a parked domain, module flags that activated
nothing, and a route segment config that compiled perfectly and 500'd on every
request.

The console is the current instance of that risk: it typechecks, it lints, its
redirects are right, and **not one pixel of it has ever been on a screen.**
