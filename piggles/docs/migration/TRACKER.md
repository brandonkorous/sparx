# Migration tracker

**Version:** 1.10.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-17

The working checklist. Tick a box only when its **exit test** passes — not when
the code is written. Update `Last Updated` and the counts below whenever you tick
anything.

**Track A — decoupling: 34 / 34. COMPLETE.** A0, A1, A2, A3, A4 and A5, plus
A4.9 which A4 itself created. **`check:boundaries` rule 1 has ZERO exceptions** —
nothing under `wizeworks/` imports from either brand tree.
**Track B — console: 18 / 18 for the MIGRATION, plus §B6 built on top.** The fork
lost nothing — every migration row is ticked. Two further items were agreed and
delivered on 2026-08-17: `check:console-parity`, a guard that fails when a system
capability lands in one console and not the other, and the Piggles product guide
in its own design and copy (which reverses B3.1). The guard found six real gaps on
its first run; all six are closed. See **§B6**.

**Nothing is open in the migration itself.** The last three closed on
2026-08-17: B5.1 (the email palette is `<BRAND>_EMAIL_PALETTE`, enforced by a
test), B5.2 (answered itself — the address has no MX record, so the line is
deleted), and B2.4 (capacity is metered, the allowance is per-brand config, and an
undecided ceiling stays absent rather than becoming a guess).

**And it is now verified by a build.** `pnpm install` ran; `pnpm typecheck
--force` is **116/116 with zero `error TS`**; `pnpm test` is green except one
suite belonging to in-flight marketplace work (below); all eight structural checks
pass; `format:check` is clean; the DB is up to date at 286 migrations.

Two environment notes, neither a code defect:

- **Run the typecheck with `NODE_OPTIONS=--max-old-space-size=8192`.** Without it
  a large package exits **134** — a V8 OOM in `tsc` that reads exactly like a
  failure and is not. Which package varies with cache state.
- **`prisma generate` fails `EPERM`** on `query_engine-windows.dll.node` while
  orphaned node processes hold it. `pnpm dev:kill` frees them; that failure also
  blocks `db#build` and therefore every task downstream of it.

**One test suite is red and it is not this migration's:**
`api-rest/src/lib/marketplace/blueprint-bundles.test.ts` (newly added, staged)
loads `marketplace-catalog/blueprints/*/blueprint.ts`, and the catalog sits
outside every package with no `tsconfig.json`, so the transform fails with
`Tsconfig not found`. api-rest is **67 files / 360 tests green** with that one
excluded.

**The invariant now holds and is proven mechanically.** `check:deletability`
walks Piggles' real dependency closure and finds nothing under `sparx/`;
`check:boundaries` rule 1 is live. Deleting `sparx/` would leave Piggles
building — and would break the WizeWorks staff console, which is exactly what
A4.9 is for.

**Blocked right now:** nothing. The three cross-track edges (B2.3←A2.1,
B3.1←A1.4, B3.4←A1.3) all cleared when A1 and A2 landed.

**The `docker build` is done, and it earned its place on this list.**
`piggles/apps/account` builds clean (460MB) — all 73 COPY stages, 762 packages
resolved against the lockfile, and the Next build through to a running image.

**It caught a bug nothing else could.** `@wizeworks/usage` re-exported from
`'./allowance.js'`, which is the right convention for the compiled server packages
and wrong for this one: it exports SOURCE and is consumed by a Next app, and
Turbopack resolves those specifiers literally rather than doing the `.js` → `.ts`
remap that `tsc` and `vitest` both do. So it typechecked, tested, linted and
passed all eight guards, and failed only at the last stage of the image build with
`Module not found`. Source-exported packages use EXTENSIONLESS relative imports —
`@wizeworks/links` and `entitlements` already did.

That is exactly why "check:docker is green" was never the same claim as "the image
builds": the guard proves a Dockerfile is a superset of what a package imports,
and says nothing about whether the code inside it resolves.

**And it caught a RELEASE-BLOCKING regression that nothing else could see.**
`Dockerfile.base` — the shared base every Node service is built `FROM` — was
migrated HALF WAY. The app manifest sources were repointed and the prisma step
already read `wizeworks/packages/db`, but the two bulk copies still said `COPY
packages ./packages` and `COPY services ./services`, directories that no longer
exist. It failed on `"/services": not found`, which means **api-rest,
api-graphql, api-mcp, mcp-site, event-worker, media-worker, import-worker and the
migration runner were all unbuildable** and a push to `main` would have failed the
containers stage.

Underneath it was a second fault that fixing the first would only have postponed:
the image laid everything out FLAT (`./apps`, `./packages`, `./services`) while
copying a `pnpm-workspace.yaml` that globs `wizeworks/packages/*`. Even with the
directories present, pnpm would have matched zero workspace members and
`--frozen-lockfile` would have refused.

**The image now MIRRORS THE REPO path for path**, which is what makes the copied
workspace file true rather than a second thing to keep in step:

- all 14 workspace manifests copied to their real paths, so `--frozen-lockfile`
  can resolve every importer;
- `wizeworks/packages` and `wizeworks/services` to their real destinations;
- the install filter `{./services/*}` → `{./wizeworks/services/*}`;
- **`WORKDIR` in all nine service Dockerfiles** plus the migration-runner image,
  every one still pointing at `/app/services/…` — so even on a working base, each
  service would have started in a directory that does not exist.

`check:docker` cannot catch any of this: it reads the APP Dockerfiles for COPY
completeness, never the base, and it cannot tell that a COPY source has ceased to
exist.

**Verified end to end.** `sparx-base`, `api-rest`, `event-worker`, the migration
runner and `piggles/apps/account` all build, and each was then RUN to confirm its
`WORKDIR` exists and its entrypoint file is there — because a green build says
nothing about whether a container starts somewhere real:

```
/app/wizeworks/services/api-rest      src/index.ts
/app/wizeworks/services/event-worker  src/index.ts
/app/wizeworks/packages/db            prisma/seed-platform.ts + prisma/schema
```

Legend: ⬜ open · 🔶 in progress · ✅ done · ⛔ blocked · ❌ decided against

---

# Track A — break the `@sparx/*` dependency

## A0 · Guardrails — do this first

| ID   | Step                                                                                                                                | Exit test                                                             | State |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----- |
| A0.1 | Write `scripts/check-boundaries.mjs`, carrying over the two app-crossing patterns from `check-piggles-isolation.mjs`                | `pnpm check:boundaries` runs and is green                             | ✅    |
| A0.2 | Add rule 5 — a per-package baseline of `@sparx/*` counts in `piggles/` that may only fall                                           | Adding one `@wizeworks/query` import to a Piggles file turns it red   | ✅    |
| A0.3 | Add rules 3 + 4 (hex / brand-name literals under `wizeworks/**`), inert until A4                                                    | Script runs; documents that rules 1, 3, 4 are dormant                 | ✅    |
| A0.4 | Wire into `package.json`, `.githooks/pre-push`, CI beside `check:events`                                                            | A push with a fresh `@sparx/*` import in `piggles/` is blocked        | ✅    |
| A0.5 | Retire `check-piggles-isolation.mjs`                                                                                                | No script references it; its patterns live in the new check           | ✅    |
| A0.6 | Split the rule in two: a **hard ban** on `@sparx/brand` / `@wizeworks/ui` that no baseline can absorb, and the ratchet for the rest | Appending a `@sparx/brand` import fails even with `--update-baseline` | ✅    |

**A0.6 came from the check being wrong in practice.** A single ratchet over all
34 packages is noisy where it matters least and silent where it matters most:
every new Piggles pane legitimately imports `@wizeworks/query` and `@wizeworks/api-client`
(the two largest counts), so the check fired constantly for the brand-blind infra
— and a brand leak, where the correct number is zero, could be baselined away
like anything else. Being able to do that is precisely how five sparx-mark render
sites survived the fork unnoticed.

Now: `@sparx/brand` and `@wizeworks/ui` fail at any count, `--update-baseline`
refuses to write while such a leak is present, and everything else ratchets. It
caught two real leftovers the moment it existed — `next.config.mjs` was still
transpiling both packages after the deps were dropped.

**The baseline is `piggles/docs/migration/sparx-usage-baseline.json`, and it went
UP once, on purpose.** 420 → 432, all of it Track B building capability that did
not exist: `@wizeworks/auth` +7 (the MCP consent screen and `/accept-invite`, which
are Better Auth flows and cannot be anything else), `@wizeworks/app-kit` +2 (the two
error boundaries need the stale-chunk helpers), `@wizeworks/links` +2 (the
brand-aware invite URL — the fix itself), and one measurement drift in
`@wizeworks/query` where `git diff` shows no import added at all.

That is the intended use of `--update-baseline`: a rise that is argued and
written down. It is NOT for making a red check green because the number is
inconvenient — if you cannot name what capability each increment bought, the
answer is to undo the import, not to re-baseline. The check ran red first and
caught this exact work, which is the evidence it functions.

## A1 · Evict sparx brand from `piggles/`

| ID   | Step                                                                                                                                                                                                                                                                                                     | Exit test                                                                         | State |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----- |
| A1.1 | `pane-waiting.tsx` — removed the `SparkMascot` branch entirely. **Correction: it was UNREACHABLE, not live.** Piggles registers `StateArt`, which draws every state including `waiting`, so the fallback could never run. A build-time dependency on another brand's art for a branch with no path to it | No `@sparx/brand` import; the loading pose is Piggles'                            | ✅    |
| A1.2 | `spark-field.tsx` — **deleted.** Its only consumer was `onboarding-gate.tsx`, itself unmounted                                                                                                                                                                                                           | File gone; no importer left                                                       | ✅    |
| A1.3 | `onboarding-layout.tsx` — **deleted `OnboardingHeader`**, which held the sparx wordmark AND signed out to a `/sign-in` that does not exist in the console. Only the gate rendered it. `OnboardingLayout` (reachable) stays and now imports nothing sparx                                                 | No `@sparx/brand` import; the reopenable wizard/story panes still work            | ✅    |
| A1.4 | `lib/tour/*` — **DELETED** (8 files + `driver.js`). Zero references anywhere; `surfaces/first-run.tsx` already replaced the first-run tour. Module tour offers have no Piggles equivalent — recorded, not silently dropped                                                                               | Files gone, dep gone, `data-tour` anchors left in place for a future Piggles tour | ✅    |
| A1.5 | Moved `silica-gaps.css` + `toast.css` into the new `@wizeworks/silica-corrections`; re-pointed all six apps. `toast.css`'s one brand statement (`box-shadow: none`) became `--toast-elevation`, defaulting to the current rendering for both brands                                                      | Piggles `globals.css` imports no `@sparx/*`; neither brand's toasts changed       | ✅    |
| A1.6 | Dropped `@wizeworks/ui` **and `@sparx/brand`** — both declared, both imported zero times                                                                                                                                                                                                                 | Neither appears in `piggles/apps/workbench/package.json`                          | ✅    |
| A1.7 | Phase gate                                                                                                                                                                                                                                                                                               | `grep -rE "@sparx/(brand\|ui)" piggles/` returns comments only                    | ✅    |

## A2 · De-sparx the shared packages

| ID   | Step                                                                                                                                                                                                                                                                                                                                                                                                             | Exit test                                                               | State |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----- |
| A2.1 | `wizeworks/packages/links` — `appOrigin(brand)`, variable name DERIVED from the brand key so the file names no brand; the `app.sparx.works` literal is gone and an unconfigured production origin now throws instead of guessing. **Plus `accountOrigin(brand)`** — see the note below                                                                                                                           | 42 tests in `wizeworks/packages/links/src/server.test.ts`, all green    | ✅    |
| A2.2 | Threaded the brand through every caller that has a tenant: api-rest team (invites, role change), chat notify, email domains, tenant module toggle, operator feedback, Stripe billing webhook, domain-worker (handler + cron ×2), social-worker (×2), and `@wizeworks/auth`'s own invitation email. The two sparx-ONLY emitters (market payouts, partner programme) keep the default with the reason written down | No caller silently takes the default without a comment saying why       | ✅    |
| A2.3 | `wizeworks/packages/attribution` — `LAUNCH_LINKS` is sparx's own campaign data, not a mechanism, so it moved OFF the barrel to a `./launch-links` subpath rather than growing a fake brand lookup. Piggles imports the barrel and can no longer reach it                                                                                                                                                         | `@wizeworks/attribution`'s barrel states no brand value                 | ✅    |
| A2.4 | `@wizeworks/brand-core` — **shipped, and it is not the token contract.** See below                                                                                                                                                                                                                                                                                                                               | 8 tests in `wizeworks/packages/brand-core/src/index.test.ts`, all green | ✅    |
| A2.5 | Sweep the 29 remaining Class-1 packages for brand literals in code. **Done, and it was far larger than "a sweep" — see below**                                                                                                                                                                                                                                                                                   | 159 tests across `email` + `brand-core`, all green                      | ✅    |
| A2.6 | Break `@piggles/console → @wizeworks/cms-editor → @wizeworks/ui → @sparx/brand` — **done, and it was an hour, not a phase.** See below                                                                                                                                                                                                                                                                           | No `packages/{brand,ui}` in the console image; the ban enforces it      | ✅    |

**A2.4 turned out to be load-bearing, and it is a different package than
planned.** The plan filed it as the token-contract split — which tokens exist,
values stay with each brand. What shipped first is the **identity** half: who the
platform is speaking AS. That got promoted because chasing the support-name
question surfaced a much larger leak underneath it.

`resolveEmailBrand` resolves the TENANT's brand — their logo, for their own
customers. It has no notion of the PLATFORM brand at all, so a tenant who has not
set up branding falls through to `@wizeworks/email`'s `defaultBrand`, which carries
`siteName: 'sparx'`. Worse, `wordmark.tsx` asked `siteName !== 'sparx'` to decide
whether a name was real — making one brand's name the literal definition of
"unbranded". **Every platform email to a Piggles tenant without branding arrived
wearing sparx's name, and no amount of configuring Piggles could have stopped
it.** Same class as the invite link, one layer deeper and far wider.

Fixed by: `platformBrandIdentity(brand)` reading `<BRAND>_BRAND_NAME` /
`_SUPPORT_NAME` / `_SUPPORT_EMAIL`; a `siteNameIsPlatformDefault` flag replacing
the string comparison; and email-worker overriding the fallback's name from the
tenant's `platformBrand`. Support replies are now signed by the tenant's own
product and carry its reply-to when one is configured.

**Deliberately NOT fixed: the fallback PALETTE.** A platform email to an
unbranded tenant still uses sparx's colors. What a brand-neutral platform email
should look like is a design question, and silently restyling every sparx email
while fixing a name would be smuggling one in. Open, and listed below.

**A2.5 was filed as a tidy-up and was the largest single item in Track A.**
A2.4 fixed the fallback NAME on a platform email. The sweep found that the name
was the smallest part of it:

- **`PlatformEmailLayout`'s masthead rendered the literal JSX
  `spar<span>x</span>`** — so every platform email a Piggles owner receives, the
  password reset above all, arrived under another company's wordmark. The
  tenant frame's `EmailWordmark` had its own copy of the same literal as its
  fallback. Both now render `brand.platform` through ONE `PlatformWordmark`;
  the accent split is `accentChars` (sparx sets 1, everyone else 0), so sparx's
  rendering is byte-identical and nothing else inherits it.
- **~110 sparx literals in the COPY of 29 templates** — "your sparx account",
  "Sign in to sparx", "your sparx subscription" — plus **11 subject lines**.
  Copy is the widest surface of the leak and the least visible, because every
  sentence reads perfectly. `usePlatformName()` for bodies, `platformNameOf()`
  for subjects (which are strings and cannot read context).
- **The `From` was `sparx <noreply@sparx.email>` for both brands.** The ADDRESS
  cannot move until Piggles has DNS of its own — one Mailgun domain serves both
  — so `platformFrom()` corrects the display NAME and keeps the address, which
  is the half that is safe to fix.
- **Both footers stated `WizeWorks · sparx.works`** regardless of tenant
  branding, because that line was never about the tenant.
- **The TOTP `issuer` was `'sparx'`** — baked into the QR at enrollment and
  uncorrectable afterwards, so a Piggles owner would have had another product
  sitting in their authenticator app permanently.
- **A Google signup stamped `platform_brand = 'sparx'` and minted
  `<slug>.sparx.zone`.** The OAuth hook runs before any tenant exists, so there
  was no row to read a brand from and nothing supplied one. This is the worst of
  the set: it silently defeats every other fix for that tenant, forever. Same
  for an invited owner. Fixed by `currentPlatformBrand()` — each brand's account
  app is its own deployment, so `PLATFORM_BRAND` on the pod is the answer.
- **`customers.sparx.zone` was the hardcoded CNAME target** in `@wizeworks/registrar`
  and `domain-worker` — the hostname a customer is told to point their own domain
  at. Now per-tenant-zone in both, and in api-rest's and api-mcp's purchase paths.
- **Three places CONSTRUCTED `${slug}.sparx.zone`** as a fallback when a Domain
  row lookup came back empty (`customer-auth`, `automation-actions`, `social`).
  Every one of them had just queried the real host; the fallback was a guess at
  which company's zone the tenant lived in. They read the row or return null now.
- **The builder's Browser-mockup catalog entry shipped `app.sparx.works`** as its
  placeholder address, so every tenant of every brand dropped a component onto
  their own page pre-filled with one company's console URL.
- **A Piggles onboarding description still said "Leads from sparx.market route
  here too"** — a sparx PRODUCT offered to a Piggles owner, which is the leak
  `hiddenSurfaces` exists to prevent and which copy had walked around.

The new configuration, all keyed by brand and named by derivation so no file
names a brand: `<BRAND>_BRAND_URL`, `<BRAND>_BRAND_ACCENT_CHARS`,
`<BRAND>_EMAIL_FROM`, `<BRAND>_BILLING_EMAIL`, `<BRAND>_ZONE_DOMAIN`, plus the
per-process `PLATFORM_BRAND`.

**Deliberately left, with reasons.** `SPARX_EMAIL_FROM` / `FALLBACK_FROM` /
`defaultBrand.billingEmail` are the DEFAULT brand's values in the documented
fallback chains, not leaks. `wizeworks/packages/email-platform`'s two `FALLBACK_FROM`
constants (broadcasts, builder email) are tenant-facing sends that should resolve
the TENANT's sending domain first — a separate fix, filed as B5.3 below.
`market-settlement-report`, the three `partner-*` and the two `job-application-*`
templates name sparx because sparx is what they are ABOUT; the test excludes them
by name rather than silently.

**A2.6 was mis-filed as a phase-A3/A4 problem and was neither.** The chain was
held up by exactly two things: `cn`, a 26-line tailwind-merge wrapper with no
brand in it, and `type ModuleManifest` from a module-manifest contract written
for the removed dashboard. `cn` moved to `@wizeworks/silica-corrections`
(re-exported from `@wizeworks/ui`, so admin's six call sites were untouched) and the
four dead `manifest.ts` files were deleted. The lesson worth keeping: **trace a
transitive dependency to what it actually imports before scheduling it.**

## A3 · The rename — `@sparx/x` → `@wizeworks/x`

| ID   | Step                                                                                                          | Exit test                                                 | State |
| ---- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----- |
| A3.1 | `scripts/codemod-scope-rename.mjs` — map built from the MANIFESTS, not a regex. See below                     | Dry run reports the map, the kept five, and every phantom | ✅    |
| A3.2 | **The three waves collapsed into ONE pass.** See below                                                        | 7,464 references across 2,859 files                       | ✅    |
| A3.3 | —                                                                                                             | (folded into A3.2)                                        | ✅    |
| A3.4 | —                                                                                                             | (folded into A3.2)                                        | ✅    |
| A3.5 | `marketplace-catalog/` + `.tmp/` scratch deleted (4 tracked files; `git checkout HEAD -- .tmp` recovers them) | All seven structural checks green                         | ✅    |
| A3.6 | Phase gate                                                                                                    | Only the kept five remain; no dangling workspace dep      | ✅    |

**A3.1 — the map is read from the manifests, and that is the whole design.**
A blanket `s/@sparx//@wizeworks//` is wrong three ways, and the third is the
one that bites:

1. It renames FRAGMENTS — `@sparx/provider-`, `@sparx/cms-`, `@sparx/x` all
   appear in prose and none is a package.
2. It renames the FIVE THAT STAY: `@sparx/brand` and `@wizeworks/ui` (sparx's marks
   and compositions) and `@sparx/web` / `@sparx/market` / `@sparx/workbench`
   (its applications). All five keep the scope and move to `sparx/` in A4.
3. It renames packages THAT DO NOT EXIST. **31 tokens are referenced only in
   docs** — `@sparx/ai`, `@sparx/audit`, `@sparx/errors`, `@sparx/geo`,
   `@sparx/dashboard`, `@sparx/site-ui` (82 hits) — naming things planned,
   renamed or deleted. Renaming those would launder a stale reference into one
   that looks current, which is strictly worse than leaving it obviously old.
   They are REPORTED and left alone.

**A3.2 — one pass, not three waves, and the plan was wrong about this.** The
waves assumed `pnpm install && pnpm typecheck` between them. The moment a package
is renamed nothing resolves until the workspace is relinked, so a wave boundary
is not a checkpoint — it is just a longer stretch of broken. Half-renamed is the
one state worse than either end.

**Three things the run taught, worth keeping:**

- **`.sql` migrations must NEVER be rewritten.** Prisma checksums every applied
  migration into `_prisma_migrations` on every deployed database; editing one —
  even a comment — makes `migrate deploy` refuse the entire release everywhere at
  once. `wizeworks/packages/db/prisma/migrations/` is now an explicit exclusion with the
  reason written next to it. Migrations are history and may name things by the
  names those things had.
- **The codemod found itself.** Its own docstring examples were rewritten on the
  first pass, so the comment describing the regex started describing the wrong
  regex.
- **It could only run ONCE, which meant it could not finish.** The map was built
  from `@sparx/*` manifests, so after the first pass it came back empty and a
  second run — needed for `.tf` and `.prisma`, two file types the first pass had
  no extension for — refused, reporting the rename already done. It was not. The
  map is now keyed on the SHORT name across both scopes, so it is idempotent: a
  third run reports zero.

**The ratchet retired itself, in the best possible way.** `check-boundaries`'
per-package baseline for `piggles/` is now **0**, because Piggles no longer
references the scope at all. A ratchet whose baseline is zero is a hard ban on
the whole scope, for free and with no code change — any new `@sparx/*` reference
under `piggles/` rises above zero and fails the push.

## A4 · The tree move

| ID   | Step                                                                                                  | Exit test                                                 | State |
| ---- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----- |
| A4.1 | `packages/` → `wizeworks/packages/`, `services/` → `wizeworks/services/`; `brand` → `sparx/packages/` | 111 directories moved; old roots gone                     | ✅    |
| A4.2 | `apps/{web,market,workbench,b2b-portal}` → `sparx/apps/`; `apps/{admin,site}` → `wizeworks/apps/`     | Layout matches pnpm-workspace.yaml                        | ✅    |
| A4.3 | `pnpm-workspace.yaml` globs, 96 tsconfig `extends` depths, every relative path                        | Globs rewritten; `../../` → `../../../` throughout        | ✅    |
| A4.4 | `Dockerfile.base` paths + `--filter` args                                                             | `--filter "@wizeworks/db..."`, `{./wizeworks/services/*}` | ✅    |
| A4.5 | Replace the hand-enumerated `COPY` lines with a glob — **decided against**, see below                 | `check:docker` already guards the drift it targeted       | ❌    |
| A4.6 | `release.yml` — image matrix, `azure-bootstrap.sql` path                                              | All four rewritten by the path pass                       | ✅    |
| A4.7 | Every `scripts/check-*.mjs` path assumption — **two were passing FALSELY**, see below                 | All seven structural checks green, and meaningfully so    | ✅    |
| A4.8 | Activate A0 rule 1 (`wizeworks/` may not import `sparx/` or `piggles/`)                               | Live, green, with 9 enumerated exceptions it prints       | ✅    |
| A4.9 | **NEW —** the per-brand credit badge, plus `@wizeworks/brand` for the staff console. See below        | **Rule 1 has ZERO exceptions**                            | ✅    |

**A4.7 caught two checks passing FALSELY, which is the finding worth keeping.**
`check-deletability` and `check-boundaries` both read `apps` / `packages` /
`services` as their scan roots. After the move those directories did not exist,
so the closure walk reached only Piggles' own 8 packages instead of 43, found no
sparx-owned package among them — because it had found almost nothing at all — and
printed a green tick. `check-boundaries` scanned `apps/` and likewise saw an
empty tree.

Both are now guarded: a missing scan root is a FAILURE, not a skip. This is the
same failure the deletability check was written to catch, committed by the
deletability check, one file below the comment describing it.

**A4.8 surfaced a real architectural violation, and the fix was a package split.**
`wizeworks/apps/admin` — the WizeWorks STAFF console, which administers both
brands — imported `@wizeworks/ui` in 75 files. Deleting sparx would have broken the
console you need to run Piggles.

The package turned out to be brand-blind apart from four symbols, two of which
were pure re-exports of `@sparx/brand/react` kept for compile compatibility. So:
`@wizeworks/ui` → **`@wizeworks/ui`** in `wizeworks/packages/`, with `Wordmark`,
`SparxMark`, `AppIcon` and `MadeWithSparx` returned to `@sparx/brand/react`
where the marks already lived. 206 files repointed; 8 mixed imports split in two.
`@wizeworks/ui` no longer exists, which is why the hard-ban list is down to
`@sparx/brand` alone.

**What rule 1 still allows, out loud.** Nine files: `admin` and `site` take their
design TOKENS from `@sparx/brand/theme.css`, and `admin` renders sparx's
`Wordmark` at `admin.wize.works`. An enumerated allowlist, not a softened rule —
a pattern would let the next one in silently, and this list has to grow in a diff
somebody reads. The check prints the count on every run.

**One of those is worse than cosmetic and is why A4.9 exists.** `site` renders
tenant sites for BOTH brands and its layout mounts `MadeWithSparx` — so a Piggles
business's public footer currently says "Made with sparx". Same class as the
email leaks A2.5 fixed, on the most public surface there is.

**A4.5 was decided against rather than skipped.** The item assumed a glob would
be safer than 90 hand-listed `COPY` lines. Post-move a glob means
`COPY wizeworks/packages` — all 93 of them — which bloats every image and
destroys layer caching, and the enumeration exists precisely to avoid that.
`check:docker` already fails on the drift the glob was meant to prevent, so the
item's premise did not survive the move.

**A4.9, part two: the staff console gets its own identity — and it was never a
design decision.** `wizeworks/apps/admin` took its tokens AND its wordmark from
`@sparx/brand`, so the console you need in order to administer Piggles would break
if sparx were deleted. The fix was filed here as "a design decision with real
values in it", which was wrong: **WizeWorks has a locked palette**, in
docs/wizeworks/04-brand-and-visual-identity.md, dated 2026-07-30. Nobody had looked.

So `@wizeworks/brand` now ships those exact values — the warm bone/ink neutrals, the
house trio (pine `#1B5E43` primary, brass `#A9761F` for figures, clay `#9C4A2F` for
emphasis), both modes — structurally identical to `@sparx/brand/theme.css` so the
swap was a one-line import change. Brass carries DARK ink because white on it
measures 4.0:1 and fails AA; that lives in the token, not in a call site.

The wordmark came with it: **"WizeWorks", with the `z` in pine** — the same
one-letter move sparx makes with its "x". Set as TYPE rather than shipped as the
SVG, so the `z` reads from `--color-primary` and follows the theme in both modes
instead of needing four baked files.

**Rule 1 now has zero exceptions**, and the allowlist stays in the code with its
two former entries written up, because the next violation will have that shape.

**A4.9, part one: the credit badge — done, and it was the worst leak in the
migration.** `wizeworks/apps/site` renders tenant sites for BOTH brands and its
layout mounted a fixed `MadeWithSparx`, so every Piggles business's public footer
said "Made with sparx" and sent their visitors to another company. The most
public surface the platform has.

The badge is now `PlatformCredit` in `@wizeworks/ui` — same self-contained dark
tab, but the name, accent, destination and accent-split arrive as props.
`apps/site` resolves them per tenant through `platformBrandIdentity()`, keyed on
a `platformBrand` now carried on the public site payload. `@sparx/brand`'s
`MadeWithSparx` became a thin wrapper supplying sparx's values, so its own call
sites are unchanged and sparx renders byte-identically.

The accent is a HEX in configuration (`<BRAND>_BRAND_ACCENT`), not a token, and
that is deliberate: this badge renders on a tenant's own site and must be immune
to the tenant's CSS, so it inlines everything it paints. A token would resolve
against the tenant's theme and the badge would change color from one site to the
next.

**And `site` turned out to need nothing else from `@sparx/brand`.** Its base
tokens come from `@wizeworks/ui` plus the tenant's own injected theme — which is
what a tenant renderer should have been reading all along. The dependency is
dropped, the COPY lines are out of its Dockerfile, and the tenant site renderer
is now genuinely brand-free.

**What remains is `admin` alone:** six files taking `@sparx/brand/theme.css` for
tokens and `Wordmark` for the rail, on `admin.wize.works`. Cosmetic rather than a
customer-facing leak — nobody outside WizeWorks sees it — but it is still why
deleting sparx would break the console you need to administer Piggles.

**A third check was found passing falsely, after the first two.**
`check-dockerfile-deps` matched `^COPY (piggles/)?packages/` to decide which
images hand-list their dependencies. After the move every COPY reads
`wizeworks/packages/…`, so five of the eight images stopped matching, were
skipped, and the run printed "3 hand-listed image(s), every workspace dependency
copied" in green. Once corrected it immediately found real drift: five
Dockerfiles still copying `sparx/packages/ui` (a path the split deleted) and two
missing genuinely-new dependencies. A missing workspace group is now a hard
failure there too.

Three checks, three identical failures. **The pattern is worth naming: a
structural check that hard-codes a path is one refactor away from scanning
nothing and reporting success.** Every one of them now fails loudly when its own
roots go missing.

## A5 · Prove it

| ID   | Step                                                                                                                                  | Exit test                                                     | State |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----- |
| A5.1 | `scripts/check-deletability.mjs` — **a dependency-CLOSURE proof, not a build.** See below                                             | Runs green; goes red under an injected transitive leak        | ✅    |
| A5.2 | The destructive version — `--build`: throwaway worktree, sparx paths deleted, install, build                                          | `pnpm check:deletability:build` runs the real thing on demand | ✅    |
| A5.3 | CI + pre-push, beside `check:boundaries`                                                                                              | Blocks a push that reintroduces a sparx-owned dependency      | ✅    |
| A5.4 | Correct piggles/CLAUDE.md — delete _"What is ALLOWED, deliberately: `@sparx/_` package imports"\* and the paragraph under "The guard" | No binding file still grants the allowance                    | ✅    |

**A5.1 is a closure walk rather than the planned install-and-build, and that is
the stronger check, not the cheaper one.**

`check-boundaries` reads source text, so it catches the import somebody WROTE.
The import that actually breaks you is never that one. It is the one four
packages down — `@piggles/console → @wizeworks/cms-editor → @wizeworks/ui →
@sparx/brand`. Nothing under `piggles/` mentioned `@sparx/brand`, the text scan
was green, and sparx's mascot was in the Piggles container image.

So this walks every workspace edge from Piggles' eight packages and asserts that
nothing it reaches lives in a sparx-owned directory. If no package in the closure
sits under a deleted path, deleting those paths cannot break the build — that is
a proof, and it runs in well under a second with no install.

Two design points worth keeping:

- **It prints the CHAIN, not just the package.** A bare "you depend on
  `@sparx/brand`" sends you looking in `piggles/`, where there is nothing to
  find. The chain names the first edge that should not exist, which is the one
  to break.
- **A missing `SPARX_OWNED` path is a FAILURE, not a skip.** After the tree move
  those paths change, and a check that quietly passed because there was nothing
  left to reach is the exact shape of a guard that stops guarding.

`SPARX_OWNED` is a list today because the tree move has not happened; after A4 it
collapses to `sparx/` and nothing else about the check changes. `wizeworks/apps/admin` and
`wizeworks/apps/site` are deliberately NOT in it — the staff console and the tenant site
renderer serve either brand, so neither is sparx's to delete.

**Verified by injecting the real historical leak.** Adding `@wizeworks/ui` to
`@wizeworks/cms-editor`'s manifest turns it red and reproduces that exact four-hop
chain. A guard nobody has watched fail is a guard nobody knows works.

`--build` is the destructive version for when someone wants to watch it happen: a
throwaway detached worktree, the sparx paths genuinely deleted, then install and
build. Minutes rather than milliseconds, so CI runs the closure and this stays
on-demand. It works from HEAD, so it proves what is COMMITTED — which is what
ships — and leaves the worktree in place on failure, because that directory is
the evidence.

---

# Track B — finish the console

Independent of Track A except where marked ⛔.

## B1 · Broken today

| ID  | Step | Exit test | State |
| --- | ---- | --------- | ----- |

All four callbacks are thin routes over ONE shared
`components/oauth-popup-relay.tsx`, rather than four copies of a
security-relevant `postMessage` — four places to get `targetOrigin` wrong is four
too many. The wire discriminators were renamed on both sides
(`sparx-social` → `piggles-social`, and the same for gsc / accounting / stripe).

| ID   | Step                                                                                                   | Exit test                                                              | State |
| ---- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----- |
| B1.1 | `app/social/callback/page.tsx`                                                                         | Connect a social account end to end in the Piggles console             | ✅    |
| B1.2 | `app/seo/search-console/callback/page.tsx`                                                             | Connect Search Console end to end                                      | ✅    |
| B1.3 | `app/finance/accounting/callback/page.tsx` — forwards unnamed params so QuickBooks' `realmId` survives | Connect an accounting provider end to end                              | ✅    |
| B1.4 | `app/onboarding/stripe-callback/page.tsx` — `done`-only, since Stripe's hosted flow has no code        | Stripe Connect popup returns and the pane advances                     | ✅    |
| B1.5 | `app/error.tsx`                                                                                        | A thrown route segment shows the recover screen, not Next's white page | ✅    |
| B1.6 | `app/global-error.tsx` — Piggles' own palette inline, the one sanctioned hex exception                 | A layout-level throw shows a Piggles page                              | ✅    |

## B2 · Absent capabilities

**Correction to the plan: all three of these belong in `piggles/apps/account`,
not the console.** The plan put them in `sparx/apps/workbench` because that is where
sparx has them — and sparx can, because its workbench mounts Better Auth. The
Piggles console mounts none, has no `/sign-in`, and never will. Discovery
metadata served from there would have advertised
`https://mypiggles.com/api/auth/mcp/authorize`, and every advertised endpoint
would have been a 404. `lib/mcp-oauth-metadata.ts` moved to the account app with
its dev fallback corrected from port 3011 to 3021.

| ID   | Step                                                                                                                                                             | Exit test                                                                                      | State |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----- |
| B2.1 | MCP OAuth metadata — both `.well-known` routes, in the **account** app                                                                                           | Both routes return the documents `lib/mcp-oauth-metadata.ts` builds                            | ✅    |
| B2.2 | `/oauth/consent` page + form + submit route, in the **account** app                                                                                              | An MCP client completes a connect against a Piggles tenant                                     | ✅    |
| B2.3 | `/accept-invite` page + client + actions, in the **account** app. Needed a second platform primitive — see note below                                            | An invited teammate lands on `getpiggles.com/accept-invite` and joins                          | ✅    |
| B2.4 | Capacity notices — **done.** Metered nightly, allowance per brand from config, the full picture at Get Piggles and a warning-only card in the console. See below | An owner near a ceiling is told before they hit it, and nothing shows a number nobody measured | ✅    |

**B2.3 needed `accountOrigin(brand)`, not just `appOrigin(brand)`.** An invitee
is not signed in yet, so the page must offer sign-in AND sign-up — which means it
lives wherever the brand's auth lives. For sparx that is the same host as the
console; for Piggles it is a different registrable domain. `appOrigin` answers
"where you work", `accountOrigin` answers "where you prove who you are", and code
that assumes those are one place breaks for exactly one brand. Both the api-rest
route and `@wizeworks/auth`'s own invitation email now use it.

**B2.4 was two things wearing one id, and only one of them was a migration
item.** The orphaned `lib/billing/*` was sparx's trial-banner ladder; Piggles had
already reimplemented that decision differently in the rail's account-state card,
so it is superseded and deleted (B3.2). What remained — warning somebody they are
near a ceiling — was new platform work rather than a port.

**It is now built, and the shape is worth recording because two of the four
decisions are about refusing to state things.**

- **Metering** (`@wizeworks/usage`, `rollup_tenant_daily_usage`, the nightly
  `/internal/platform/usage-rollup` CronJob) was already in the tree — this row
  said "the `Bill` API carries no meters, so there is nothing to render", which
  was true of `Bill` and false of the platform. Six measures per tenant per UTC
  day, every one NULLABLE, because a figure nobody took must never render as a
  measurement.
- **The allowance is per-brand CONFIGURATION** (`<BRAND>_CAPACITY`), like every
  other brand-varying value. `SPARX_CAPACITY` is deliberately unset — sparx sells
  per module, not per capacity, so every sparx meter reads `unmetered`.
- **An undecided ceiling stays `null`.** Piggles' pricing sheet states four
  allowances outright (3 users, 1 site, 1 location, 10,000 customers) and gives
  storage and email as RANGES under "Final numbers must be validated against
  infrastructure cost." Those two are ABSENT, and an absent ceiling means
  **metered without a limit**: the usage shows because it was measured, and no
  bar, percentage or warning is drawn because there is nothing true to draw them
  against. Rendering the middle of an undecided range would manufacture a
  commercial decision, and "12.4 GB of 25 GB" cannot be told from a real limit.
  This is what let metering ship ahead of pricing — which it had to, since usage
  history cannot be backfilled.
- **`unmetered` and `unknown` are first-class states, not absences.** Neither may
  collapse into `ok`, which is a claim. Half the meters are counted LIVE (seats,
  sites, locations — small, deliberate, and changed by the person reading the
  screen; a day-old seat count reads as a broken meter) and half come from the
  snapshot, with `measuredAt` returned so a surface can say when.

The split of surfaces follows `BILLING_RULES.md`: Get Piggles carries the whole
picture (`components/capacity.tsx`), the console carries a **warning-only** card
that renders nothing while every meter is comfortable and deep-links scoped to the
meter that raised it. `GET /v1/usage/capacity` carries no money at all, which is
what makes it readable from a console that is never allowed to know a price.

**Not an enforcement point, and deliberately so.** Nothing here blocks anything:
the percentages come from a snapshot up to 24 hours old, which is right for a
nudge and wrong for a gate. Pausing a new addition belongs at the action, counting
live — as does RULE #2's guarantee that a limit never stops work in progress and
never degrades what already exists.

## B3 · Decisions on dead code

Each needs a recorded outcome. ❌ (delete) is a legitimate answer.

| ID   | Step                                                                                                                                                                                                                                                               | Exit test                                | State |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ----- |
| B3.1 | Module tour offers — deleted with the rest of `lib/tour`. **REOPENED and then DELIVERED 2026-08-17** as Piggles' own guide, in its own design and copy — see §B6.2                                                                                                 | Rebuilt as `lib/tour/*`, no `driver.js`  | ✅    |
| B3.2 | `lib/billing/*` — **DELETED.** Superseded by the rail's own account-state card, which is explicitly written as Piggles' different answer to the same question                                                                                                      | No orphaned module                       | ✅    |
| B3.3 | `components/feedback/button.tsx` — **MOUNTED**, replacing the topbar's hand-rolled copy. Not a tidy-up: the copy could not show the unread dot, so a customer who wrote in and got a reply had no way to find out                                                  | One help control, and it carries the dot | ✅    |
| B3.4 | `surfaces/onboarding/*` — **KEPT, gate deleted.** The _reopenable_ wizard and story surfaces are registered and reachable from ⌘K, so they are live capability, not dead code. The GATE is what was dead, and it redirected to a `/sign-in` this app does not have | Gate gone; the panes still open          | ✅    |

## B4 · Chrome and polish

| ID   | Step                                                                                                                                                                                                                   | Exit test                              | State |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----- |
| B4.1 | `app/icon.svg` — the delivered Piggles mark, matching the account app. No `.ico` or `apple-icon`: Next generates what it needs from the SVG, and two more raster copies of one mark is two more things to keep in step | The console tab shows the Piggles mark | ✅    |
| B4.2 | `app/robots.ts` — blanket disallow. Not `public/robots.txt`: a route composes with the layout's `robots` metadata and cannot go stale against it                                                                       | Served, and it disallows everything    | ✅    |
| B4.3 | Real-time presence — **decided: NO, and it is not a migration item.** See below                                                                                                                                        | A yes/no is written down here          | ❌    |

## B5 · Open, and named so it is not carried silently

| ID   | Step                                                                                                                                                                                                                                                                            | Exit test                                                                  | State |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----- |
| B5.1 | The platform email PALETTE. **Done** — it is `<BRAND>_EMAIL_PALETTE`, resolved per send from the tenant's `platform_brand`; the fallback is achromatic and belongs to nobody. See below                                                                                         | An unbranded Piggles tenant's receipt looks like neither brand by accident | ✅    |
| B5.2 | `PIGGLES_SUPPORT_EMAIL` — **deleted, on evidence.** `meetpiggles.com` and `getpiggles.com` have NO MX RECORDS (checked 2026-08-17); only `mypiggles.com` does. The address cannot receive mail, so the exit test answered itself                                                | The address accepts mail, or the line is deleted                           | ✅    |
| B5.3 | `@wizeworks/email-platform`'s two `FALLBACK_FROM` constants (broadcast + builder email). **Done** — both paths were identical copies of the same six lines, including the same bug, so the fix is one `buildTenantFrom()` in `services/platform-sender.ts` and both now call it | A Piggles tenant's newsletter is not from `sparx <noreply@…>`              | ✅    |

**B5.1 — the palette is CONFIGURATION, and the fallback is nobody's.** The
question as filed was "brand-neutral chrome, or per-brand values in
`brand-core`?", and the answer is that those are not alternatives: per-brand
values cannot live in `brand-core` (RULE #0 — the platform states no brand's
value, and the consumer is a shared worker that may import neither brand's
package), and brand-neutral chrome alone would make a Piggles owner's receipt
look like nothing at all.

So the same shape as `BRAND_NAME` before it. `<BRAND>_EMAIL_PALETTE` carries one
JSON object per brand; `resolveEmailPalette` in
[`brand-core/src/email-palette.ts`](../../../wizeworks/packages/brand-core/src/email-palette.ts)
validates it as a UNIT and `email-worker` resolves it once per send from
`tenants.platform_brand`. Four things are worth knowing:

1. **A palette is one decision, so it is one variable.** Sixteen loose names is
   sixteen chances to set half of it, and half a palette — this brand's accent on
   that brand's ink — is the only outcome worse than none. A palette that fails
   validation is treated as ABSENT rather than partially applied.
2. **The fallback is achromatic and belongs to nobody.** Deliberately not sparx's
   values: a default that happens to be one brand's is exactly how the Ember
   masthead reached every Piggles owner, and it survived the fork because a wrong
   palette renders perfectly. A plain email looks like a missing variable, which
   is what it is — and the worker logs a warning naming the variable, because a
   fallback nobody can see is a fallback nobody fixes.
3. **Nothing is computed.** Piggles' palette carries only what its approved board
   states, mapped by ROLE (primary → accent, secondary → ink, base-100/200/300 →
   paper/well/canvas, base-content → heading+body, neutral → meta). Four roles it
   has no value for — `accentEdge`, `accentWash`, `inkMeta`, `lineStrong` —
   COLLAPSE onto ones it does (a flat button, a hairline step chip). Darkening the
   primary to invent an edge would be the platform choosing a Piggles color.
   Those four are the only outstanding ask, and they are four hex values.
4. **`defaultBrand` went brand-blind with it**, which was the half nobody had
   named: its `primary` was Ember, its `dark` was sparx's night theme, and every
   unbranded tenant send under either brand inherited both.

Enforced, not asserted: `every-template.test.ts` renders all 29 shared templates
under a second brand and fails on any of 14 sparx hexes, plus a positive case
that the supplied palette is the one on the page. Reintroducing a single literal
turns 19 tests red — checked by doing it.

**B4.3 — decided: NO, and it is closed as a MIGRATION item while staying open as
a product one.** Neither console has presence, and neither ever did: no SSE, no
WebSocket, no "who is looking at this". socket.io ships in both but serves only
the builder's live session and chat.

That is the whole decision. This tracker's job is "did the fork lose anything?",
and the answer here is no — there was nothing to lose. Carrying it as ⬜ implied
Piggles was missing something sparx has, which is false, and an item that can
never be ticked by the work this document describes makes the remaining count
lie.

**What must not happen is it disappearing.** Presence is a real capability
neither product has, and the reason to want it is real too: Piggles' pricing
includes three users, so two people editing the same thing is a Tuesday rather
than an edge case. It belongs on a product backlog, not here. Recorded as ❌
(decided against, in this scope) rather than deleted, so the decision is
findable — closing it because it was never promised is how a gap becomes
invisible.

## B6 · Reopened, and delivered

Two items agreed on 2026-08-17 and **both built the same day**. They answer the
same worry, in Brandon's words: _"I'm really worried about the things I didn't
name, the things that aren't at the top of my mind."_

| ID   | Step                                                                                                        | Exit test                                                                           | State |
| ---- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----- |
| B6.1 | `check:console-parity` — a guard that fails when a system capability lands in one console and not the other | Deleting one console's toast host, or adding a capability to one only, turns it red | ✅    |
| B6.2 | The Piggles product guide, in Piggles' own design and copy. **Reverses B3.1**                               | A new Piggles owner is walked through their console, in Piggles' words              | ✅    |

### B6.1 — `scripts/check-console-parity.mjs`

Wired into `package.json`, `.githooks/pre-push` and `ci.yml` beside
`check:deletability`. It compares four axes — `components/**`, `lib/**`, the app
routes, and each console's dependencies — plus a fifth that no file diff can do:
it walks the import graph from `app/layout.tsx` and asserts the system furniture
is REACHABLE, because an unmounted provider renders exactly as much as a deleted
one.

It carries the rename map (`rail`↔`app-rail`, `toolbar`↔`topbar`,
`workbench-shell`↔`console-shell`, `module-panel`↔`app-panel`,
`mobile-shell`↔`compact-console`, and the four tour modules), a COLLAPSE list for
directories Piggles split under RULE #0.5, and **43 exceptions each carrying its
reason**. A stale exception — one that no longer describes a real divergence —
fails the check too, so the list cannot become the place gaps go to die.

**Proven able to go red**, both halves: removing `piggles/lib/consent.ts` reports
the capability gap; unmounting `<FirstRunGuide>` while leaving the file in place
reports the mounting gap.

**Two limits, stated in its own header.** It cannot find what NEITHER console has.
And it compares NAMES, not depth — two files called `pane-toolbar.tsx` pair
whether one is 94 lines and the other 283.

### What it found on first run, and what was done

| Gap                                                          | Where   | Outcome                                                                                                     |
| ------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------- |
| PostHog initialised with no consent — autocapture + identify | sparx   | **Fixed.** `lib/consent.ts` reader, gated provider, `<ConsentAsk>`, `POST /api/consent`, a card on Security |
| No "this surface could not load" state                       | sparx   | **Fixed.** `components/pane-load-error.tsx`                                                                 |
| No non-list empty state                                      | sparx   | **Fixed.** `components/pane-empty.tsx`                                                                      |
| No sub-block waiting state (dozens of hand-written lines)    | sparx   | **Fixed.** `components/inline-waiting.tsx`                                                                  |
| A following pane could not be linked                         | sparx   | **Fixed.** `lib/workbench/share-as.ts`, wired into `usePaneLink` + `product-scope`                          |
| No product guide                                             | Piggles | **Built.** See B6.2                                                                                         |
| `use-unload-guard`                                           | —       | **False positive.** sparx has the same beforeunload guard inline in `lib/dock/dock.tsx`                     |
| Window modes, floating placement, per-mode layouts           | Piggles | **Excepted.** A Piggles product premise; sparx's workbench is a dock                                        |

### B6.2 — the guide, and why it is not a port

`piggles/apps/workbench/lib/tour/` — same two tiers, same persistence contract,
**a different delivery**, because a console whose premise is "the operator decides
what occupies the screen" cannot explain itself by taking the screen away.

**It lives in the status strip.** No overlay, no dim, no cut-out, no trapped
keyboard — the same shelf the sentiment chip already uses, for the same reason.
The step's subject gets a 2px `outline` ring (drawn outside the box, so nothing
shifts) and everything on screen keeps working, including the thing being pointed
at. Wandering off is not an escape; the strip is still there, on the step you left.
No `driver.js`.

**The curriculum is Piggles' problem, not sparx's.** sparx's rail is nearly empty
on a first visit, so its tour shows you what you could buy. Every Piggles app ships
enabled, so the rail is FULL on the first morning — the guide answers "where am I,
what are all these, where does my work go, how do I find anything" in seven steps.

**Tier 2 walks the app's PANEL, not its buttons.** Nobody here is stuck for want of
an Add button; they are stuck for want of knowing which of twenty screens they
want. 14 app guides, 47 steps, one file per color group. Every anchor is verified
to name a real surface that genuinely belongs to that app.

It **offers** rather than auto-starts, records a decline as an answer so it never
nags, and stays replayable from each app panel's header. Desktop only — it points
at the rail, the panel and the strip, and the compact shell deliberately has none
of the three; nothing is recorded until it is answered, so a phone-first owner is
simply offered it the first time they sit down.

Platform side: `TOUR_MODULES` in `routes/v1/me.ts` grew from sparx's 7 keys to 15,
since Piggles teaches every app it ships. Adding a key needs no migration; removing
one would degrade an existing user's whole tour branch, so the list only grows.
