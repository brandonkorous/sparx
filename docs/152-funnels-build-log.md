# sparx Platform — Funnels Feature Build Log

**Version:** 1.5
**Author:** Brandon Korous
**Last Updated:** 2026-08-26

---

## 0. What this doc is

The **living build state** for the Funnels module. The design lives in
[docs/151](151-funnels-module.md); this doc tracks **what is actually built**, in
what order, and **where to resume** when context shifts. Update the status
markers + the `▶ RESUME HERE` pointer every working session.

Status legend: ☐ not started · ◐ in progress · ☑ done · ⃠ deferred/blocked

> **▶ RESUME HERE: nothing is outstanding.** Phases A, B, C, D and E are done.
> F1 (split testing) stays deferred on purpose, gated on real stage counts
> rather than on a date.
>
> What is left is not building, it is LOOKING. Every slice has been exercised
> against the real database or covered by tests; none of the workbench surfaces
> has been opened in a browser, no offer has been placed on a real page, and no
> campaign has been driven end to end by a person. That is the gap
> [[feedback_test_as_a_business_owner]] describes, and it is where the next real
> defects are.
>
> **Five migrations were authored in this run** (`…423` through `…427`). The
> Prisma client has been regenerated against them; if the DB-backed integration
> suites fail with "column does not exist", the database is behind the client and
> wants `migrate deploy`.

## 1. The four decisions, settled 2026-08-25

These were open at plan time and are now closed. Recorded here because each one
changes what gets built, and rediscovering them costs more than reading them.

| #   | Question                                | Decision                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Billable module, or free like `social`? | **Free.** Own flag, off by default, no `MODULE_MONTHLY_CENTS` entry, no `REQUIRES`, no `BUNDLED_FREE`. Reasoning + the rejected counter-argument in [docs/151 §3](151-funnels-module.md).                                                                                                                              |
| 2   | Which hue, given eighteen are taken?    | **Wine `#881337`**, white `-content` ink. Measured hue 342°, L 30%, white at 9.56:1. Distance from scheduling rose-600 (347°, L 50%) is carried by lightness, the same move `staff` rust makes against commerce orange. Plus the borrowing rule: the stage ladder wears the hue of the module whose outcome it drives. |
| 3   | SMS spend                               | **Build it, ship it safe, ship it dark.** Full consent / `STOP` / quiet hours / per-tenant rate limiting, with the provider credential absent so it cannot spend until deliberately enabled.                                                                                                                           |
| 4   | Offer stack scope                       | **Its own design pass**, after Phase C. It is the only work that touches payment capture, tax, inventory commitment and refunds at once.                                                                                                                                                                               |

## 2. Phase A — truth, and the free win

No new module. No schema. No decisions blocking it.

- ☑ **A1 — Make the conversion funnel report true.** _(2026-08-25)_
  `sessions` and a new `visitors` now come from a window-unique
  `COUNT(DISTINCT session_hash / visitor_hash)` over `site_analytics_events`,
  mirroring the `summary()` aggregation in api-rest's `site-analytics-reports`
  deliberately — two definitions of "a session" that can drift is worse than one
  raw query in two places. Added `sessionToCartRate` and `sessionToOrderRate`
  (the figure "conversion rate" normally means, unreportable while sessions read
  zero). `overallConversion` keeps its existing cart-funnel meaning so no
  existing consumer silently changes.
  **Every rate is now `number | null`,** and null is the answer whenever the
  stage above it was empty. Returning 0 was the tempting shape and it is a lie:
  a tenant selling through B2B, POS or the phone has no web sessions at all, and
  "0% conversion" tells them their storefront is failing when they do not have
  one. Same fix applied to `abandonedCarts.recoveryRate`.
  _Correction to the plan:_ there is **no workbench tile** for this report. It is
  exposed only through REST and MCP, so a tenant can currently see their own
  conversion funnel only by asking their AI. Worth a surface; folded into B5.

- ☑ **A2 — Scope the commerce reports per site.** _(2026-08-25)_
  `conversionFunnel()` counted carts, checkout sessions and orders through
  `withTenant`, which scopes by tenant and **not** by property, so a tenant
  running two businesses got one blended funnel with each diluting the other.
  The audit found the same defect across the whole reporting file, so all
  twelve order- and cart-based reports now take an optional `propertyId`
  (`undefined` = every site, matching `revenueTimeseries`'s existing contract):
  `revenueSummary`, `topProducts`, `topCustomers`, `conversionFunnel`,
  `abandonedCarts`, `discountPerformance`, `channelBreakdown`,
  `attributionBreakdown`, `emailCampaignRevenue`, `channelComparison`,
  `channelRevenue`, `channelTopProducts`.
  The `property` query param moved from `TimeseriesQuery` up to the base
  `RangeQuery`, and every report route now resolves it through
  `resolveListScope` — so a report defaults to the ACTIVE site and reads
  tenant-wide only on an explicit `?property=all` from a caller allowed to.

  **The MCP half, and a claim corrected.** `restrictToPropertyId` is the site
  CEILING carried by a site-scoped `sk_live_` credential, and the nine commerce
  report MCP tools now honor it; unrestricted callers are unchanged.
  This was first written up here as a data leak. **It was not.** `server.ts`
  already refuses any tool outside `SITE_SCOPABLE_TOOL_NAMES` when the credential
  carries a site, loudly and by name, so those tools were refused rather than
  served another business's numbers. Honoring the ceiling is what makes them
  eligible to stop being refused — see A2b.

  _Deliberately NOT changed:_ `api-rest/src/lib/analytics/metrics/commerce-sales.ts`
  stays `scope: 'tenant'`. Its own comment records that as a tracked decision
  pending the per-site revenue rollup in docs/130 §2.4, and the dashboard labels
  it as tenant-wide. Changing it here would have contradicted a documented plan.

  _Subscriptions are not scopeable:_ `Subscription` carries no `property_id`, so
  `subscriptionMetrics` stays tenant-wide until it does.

  _Verified:_ commerce typecheck + eslint clean, 98/98 tests green; api-rest
  typecheck + eslint clean; prettier clean.

- ☑ **A4 — Site-scope the public search.** _(2026-08-25)_
  `search_products` and `search_site` on a site's MCP endpoint, and the storefront
  search box, both hit `/v1/public/search`, which filtered on **tenant alone**. A
  shopper searching the fishing store also got the machine shop's products and
  pages. Every other public read already scoped; this one did not.
  The filter is applied during **hydration**, not in Typesense, and deliberately:
  the universal `entities` collection carries no property field at all (unlike
  `products`, which has `property_ids`, and `customers`/`orders`, which have
  `property_id`), so an index-level filter would need a schema change AND a full
  reindex before it could be switched on — and between deploy and reindex every
  un-backfilled doc would silently vanish from search. Hydration already re-reads
  each hit from Postgres to build its URL and drop stale rows, so the authoritative
  `productSiteVisibilityWhere` / `collectionSiteVisibilityWhere` predicates cost
  nothing extra there. CMS pages carry `property_id` directly, with NULL meaning
  every site.
  _Known cost, documented in the route header rather than left quietly wrong:_
  `total` is Typesense's pre-filter count, so it OVERSTATES on a multi-site
  tenant.

- ⃠ **A4b — Move the search filter into the index.** Adds `property_id` to the
  `entities` schema + projection so `total` is exact and pagination is correct.
  **Gated on a reindex**, which is an operational action: deploy the projection
  first, rebuild, then enable the filter. Enabling it before the backfill lands
  makes search return nothing.

- ☑ **A2b — Commerce report tools become site-scopable.** _(2026-08-25)_
  A correction to an earlier claim in this log's history: the commerce report MCP
  tools were **not** leaking cross-site data to a site-scoped key. `server.ts`
  already refuses any tool outside `SITE_SCOPABLE_TOOL_NAMES` when the credential
  carries a site, loudly and by name. They were refused, not served.
  A2 made them site-aware, which is the prerequisite the registry comment
  describes ("each moves onto this list as its services become site-aware"), so
  the nine of them now join that set and a site-scoped key gets scoped numbers
  instead of a refusal. Listed BY NAME rather than derived from the commerce
  array, because only commerce's reporting half is site-aware — adding the array
  would falsely declare products, carts and fitment scopable too.
  A by-name list is exactly what rots silently, so `site-scopable.test.ts` asserts
  the join in both directions: every name is real and registered, the list is not
  empty, and the rest of commerce is still refused.

- ☑ **A3 — A capture step on 34 tool pages.** _All 17 sparx tools and all 17
  piggles tools report a result; both apps wired end to end._

  **Done and verified:**
  - `tool-result` email template composing the atomic components, registered at
    all **seven** points a template needs: the component, `templates/index.ts`,
    `send.tsx` (id union, props union, render case), `template-ids.ts`,
    `template-fixtures.ts`, the events union, and the email-worker **delivery
    gate**. That last one is the silent killer: a template missing from
    `TemplateSendSchema` is parsed to null, acked, and the mail is gone with the
    publisher seeing success. `template-coverage.test.ts` green, 40/40.
  - `POST /v1/public/tools/deliver`. Two independent effects: it always SENDS
    (the visitor asked for it, so a module flag must not swallow it) and it
    records the lead best-effort, gated on CRM. Unlike `/v1/public/newsletter`
    it does not 404 when CRM is off, because there the list IS the point and here
    the email is.
  - **Brand is resolved, never passed.** The first cut of the endpoint took a
    `brand` parameter and held a per-brand table of names and site URLs. That is
    a brand conditional in shared code and a product name in a user-facing
    string, both of which RULE #0 in `wizeworks/CLAUDE.md` forbids — and it is
    the exact thing that would need editing the day a third brand launches.
    Replaced with `platformBrandIdentity(tenant.platformBrand)`, the resolution
    path shared code is required to use when it has no request host to read.
    `siteUrl` is env-derived and may be unset, so `toolUrl` is optional through
    the template and the delivery gate: the results still arrive, without an
    invented link. `check:boundaries` does not yet catch this class under
    `wizeworks/` — the rule is real, the script is not there yet.
  - Abuse hardening, since it is an unauthenticated send-to-any-address route:
    the subject and link are derived from a server-side tool table (the client
    sends only a slug), the body is a fixed template so no markup survives,
    `lines` is capped in count and length, and it is per-IP rate limited at the
    same ceiling the storefront auth routes use.
  - sparx web: `sendToolResult` server action (forwards the visitor IP as opt-in
    proof, honeypot, calls api-rest server-to-server so the browser never touches
    it), `ToolResultProvider` / `useReportToolResult` channel, the
    `ToolEmailCapture` card, and `ToolShell` wiring so all 17 pages get it at
    once.
  - **All 17 sparx tools reporting.** `document-tool` covers two of them (invoice
    and quote), so it is 16 components.
  - **The whole piggles side, built separately by rule.** `piggles/apps/web` may
    not import from `sparx/`, so it has its own `app/tools/actions.ts`,
    `tool-result-context.tsx` and `tool-email-capture.tsx`, wired into its own
    `ToolShell`, with all 17 of its tools reporting. The shared half — the
    endpoint, the template, the delivery gate — already lives in `wizeworks/`,
    which is where sharing belongs. `check:boundaries` and `check:deletability`
    both green afterwards.

  **Two things the wiring turned up that were not on the plan:**
  - **The reassurance copy on both brands had become untrue.** sparx's trust row
    said "No account, no email, no watermark on the way out"; piggles' band said
    "No sign-up, no email address, no trial that turns into a bill", and its
    other assurance said "Nothing you type is uploaded". An offer to email you
    your results makes all three false. Nothing is gated and nobody is asked for
    an address to USE a tool, so both now say the address is taken only if you
    ask — which is accurate and is also the thing somebody wants to know before
    typing it in. A reassurance row that is not true is worse than no row, and
    the sparx one carries a comment saying not to shorten it back.
  - **A Wi-Fi QR code carries its password in clear text, and that does not go
    in an email.** An inbox outlives the code and gets forwarded without much
    thought. Both QR tools describe the network — name, security, hidden or not,
    which is everything needed to rebuild it — and say plainly in the note that
    the password was deliberately left out. The same judgment drops multi-line
    payloads (vCards): email collapses the line breaks that make them work, so
    the fields go instead of a file that would arrive broken.

  **The channel re-reports on disagreement, not once per change** _(found by
  clicking, 2026-08-25)_. Driving both sites in a browser showed a capture card
  stuck on "fill in the tool first" while the tool's results sat on screen beside
  it. Console instrumentation proved the plumbing itself was fine — a clean mount
  goes `provider lines=-1` → `provider lines=5` → `card lines=5` — and that what
  I was reading was the DOM after a **Fast Refresh remount** had reset the
  provider's `useState` while the tool, whose inputs had not changed, had nothing
  new to say. It never recovered until a keystroke.

  Dev-only in its cause, but a real fragility: a lost update leaves the card
  offering to send nothing next to a screen full of results. `useReportToolResult`
  now also watches the channel's own value and re-reports whenever the two
  disagree. The tool is already a context consumer, so a reset re-renders it, the
  comparison fails, and it says its piece again — self-correcting rather than
  fire-and-forget. Verified afterwards on both brands: the card reads its ready
  state on arrival, with no interaction, and holds it.

  _Separately, worth knowing:_ `sparx/apps/web`'s dev server was in a **Fast
  Refresh rebuild loop**, reconnecting and rebuilding about once a second with no
  edits happening. It is what made the first reading look like a defect. Not
  investigated here; it is the running dev process, not the code.

  **`MAX_LINE_VALUE`, and why it is repeated in the client.** The endpoint and
  the delivery gate both cap a value at 4000 characters. The tool components
  carry the same number so a tool whose output can genuinely run long — a long
  FAQ's structured-data block, a signature, a palette's CSS — decides for itself
  and SAYS SO in the note, rather than the visitor getting "something went wrong"
  from a 400 they had no way to see coming. Nothing is ever truncated to fit:
  half a block of generated markup looks perfectly valid and is useless.

  **Long documents are summarized with the remainder counted.** The gate takes
  fifty lines total, so an invoice past 30 items sends the first 30 and states
  how many were left off — never a silent cut, which would have somebody
  reconciling a partial list against a full total.

  **The rule that governs what may be sent, confirmed 2026-08-25:** the email
  carries only values the tool **computed**. Never a file the visitor supplied,
  never bytes derived from one. Several pages promise "100% in your browser,
  nothing uploaded" — the favicon generator says it in its meta description — and
  that promise stays true because neither the card, the channel, the endpoint nor
  the template schema can express a file. For a tool whose real output is a
  browser-assembled binary, the useful half to keep is the markup and settings,
  and that is what gets sent, with a link back to rebuild the file locally.

  sparx.works and piggles each ship 17 free tools (invoice, quote, margin
  calculator, QR code, domain checker, email deliverability, privacy policy, UTM
  builder, and the rest). Someone who uses the margin calculator has told us what
  business they run, through an action rather than a form, and then leaves. Add
  "email this to me" to each tool's output.

  **The design, settled while reading the code:**
  - The lead half needs no new spine. `POST /v1/public/newsletter` already takes
    a `list` slug, a free-text `note` and the client IP as opt-in proof, gates on
    CRM, scopes the contact to a site, and never reveals whether an address was
    already on file. `/early` already posts there. Tool capture joins the same
    path with `list: 'tools'`.
  - The delivery half is new: one `POST /v1/public/tools/deliver` that subscribes
    AND publishes `email.send` with the result, so it is one round trip and one
    consent moment.
  - `ToolShell` is the single shared frame for all 17 pages, so the capture card
    is added once per app. Each tool reports its output through a small
    `ToolResultProvider` context.

  **The privacy rule, now settled and enforced by shape.** Several tool pages
  advertise "100% in your browser, nothing uploaded" — the favicon generator says
  it in its own meta description. **The email carries only the text and values
  the tool COMPUTED, never a file the visitor supplied or anything derived from
  one.** The favicon tools send the generated markup and manifest (genuinely the
  part worth keeping) plus the settings and a link back; the sparx signature tool
  withholds its HTML entirely when a photo or logo is embedded, because a data
  URL in that markup IS the visitor's file wearing markup. Nothing in the card,
  the channel, the endpoint or the template schema can express a file.

  **A note for the piggles side specifically.** `piggles/CLAUDE.md` RULE #0.5
  caps a file at 250 lines and a comment at 3. The additions here are within
  both, and `margin-tool` / `og-tool` — the two files this change would have
  pushed past 250 — had their line-building lifted into
  `lib/margin-email.ts` and `lib/share-card-email.ts` instead. That second move
  also killed a duplicated `og:image` snippet that existed in two places, one
  edit away from telling somebody two different things. **Eleven other piggles
  tool files were already over 250 before this change** (`structured-data` 574,
  `qr` 520, `document` 511, `ui-kit` 470, and the rest); bringing those into line
  is its own piece of work and was not folded into this one.

## 3. Phase B — the spine

Needs decisions 1 and 2 (both settled).

- ☑ **B1 — Schema + migration.** _(2026-08-25)_ `92-funnels.prisma` with
  `Funnel`, `FunnelStageEvent`, `RollupFunnelDaily`, and
  `20270420000000_a_campaign_says_whether_it_worked`. Files only: nothing ran
  `migrate`, `db push` or `generate` against the shared instance.

  **The privacy line is enforced by the shape of the tables, not by a rule
  somebody has to remember.** `rollup_funnel_daily` counts people and identifies
  nobody; `funnel_stage_events` holds one row per KNOWN person, with a CHECK
  requiring `num_nonnulls(customer_id, subject_email) = 1` so an anonymous row
  cannot be written even by mistake. There is no visitor-hash column anywhere in
  the module, and both files say in as many words that adding one is the change
  that puts a consent banner on every tenant's site.

  **Decisions worth not re-deriving:**
  - `funnels.property_id` is **NOT NULL**, unlike `automations.property_id`. A
    rule can sensibly span every business a tenant runs; a campaign cannot.
    CASCADE, so deleting a site narrows reach instead of promoting a funnel to
    tenant-wide.
  - `goal_value_cents` is nullable AND has a `> 0` CHECK. Not-priced and
    priced-at-zero are different facts, and the constraint keeps "not set" the
    only way to say the first.
  - `funnel_stage_events.customer_id` cascades from `customers`. That is not a
    convenience: this is per-person history, so an erasure request has to take it
    along, and `SET NULL` would both keep the history after the person was erased
    and leave a row with neither subject — which the CHECK forbids. Rows held by
    `subject_email` have no key to cascade from, so erasing one is a delete by
    (tenant, email) in the erasure path. That is the half a reader must remember,
    and it is written in both files.
  - The two subject indexes are deliberately **not** partial. Prisma cannot
    express a predicate, so a partial index lives only in SQL and the next
    `migrate dev` proposes dropping it as drift. These are declared on the model,
    so they stay expressible and schema and database keep agreeing.
  - `refs` is JSON and carries no foreign keys. A stage can convert onto anything
    the platform sells, and a new outcome must not be a migration; a dangling
    pointer renders as "no longer available".

  **The migration name had to move, and the reason generalizes.** §8 said to sort
  after the newest migration ON DISK (check the listing, not the last commit — another session may hold untracked ones), which was the
  newest **tracked** migration and not the newest on disk: another session in
  this same checkout had two UNTRACKED migrations at `20270418000000` and
  `20270419000000`. `20270418000000_a_campaign…` would have sorted before
  `20270418000000_a_customers…` on the suffix. Renamed to `20270420000000` so
  the order holds whichever session commits first. **Check the directory listing,
  not the last commit** — `check-migration-order` compares against git and
  reports "no migrations added" for work that is only on disk.

  **Applied and PROVEN against docker Postgres**, not merely authored — Brandon
  stopped the dev server and cleared the Prisma work for this session.
  `migrate deploy` applied it (plus the other session's two, which were pending
  on the same local database), `prisma generate` ran, and the client exposes
  `funnel`, `funnelStageEvent` and `rollupFunnelDaily`.

  Each guard was then shown to go RED, because a constraint nobody has seen fail
  is a constraint nobody knows is wired up:

  | Probe                                           | Result                                       |
  | ----------------------------------------------- | -------------------------------------------- |
  | Insert a funnel with no tenant context          | refused by the RLS policy                    |
  | Insert under the right tenant                   | lands, and the tenant sees 1 row             |
  | Read the same table as a DIFFERENT tenant       | 0 rows                                       |
  | Stage event naming BOTH a customer and an email | refused, `one_subject_check`                 |
  | Stage event naming NEITHER — the anonymous row  | refused, `one_subject_check`                 |
  | `goal_value_cents = 0`                          | refused, `goal_value_positive_check`         |
  | Delete the customer a stage event points at     | the stage event goes with them (rolled back) |

  All three tables report `relrowsecurity` AND `relforcerowsecurity` true with a
  `tenant_isolation` policy reading `current_tenant_id()` on both `USING` and
  `WITH CHECK`. The repo's own `db:rls-audit` passes: 436 tables audited, 403
  tenant-scoped, no findings. The probe rows were deleted; the erasure test ran
  inside a transaction that was rolled back, so no real customer was touched.

  _Also verified:_ `prisma validate` clean; `check:events`, `check:routes`,
  `check:docker`, `check:boundaries`, `check:deletability` and
  `check-migration-order` all green.

  _One clean-up worth knowing about:_ `prisma format` reflows every `/** */` doc
  comment in the schema directory, so it rewrote three files this change never
  touched (`03-auth`, `30-commerce-products`, `91-announcements`) and 1,406 lines
  of `02-tenant`. All reverted; the Tenant relations were re-added by hand. The
  schema diff is 25 added lines and 3 changed ones. Do not run `prisma format`
  here without checking what else it moved.

- ☑ **B2 — `@wizeworks/funnels`.** _(2026-08-25)_ Service layer, stage recording,
  goal evaluation, the daily reconcile and the ladder read model. Deps are
  `@wizeworks/db` + `@wizeworks/automation-schemas` + zod only, so the
  event-worker can run the reconcile without React; the client-safe `./schemas`
  subpath is zod-only for the workbench editor.

  **It re-implements nothing.** `evaluateFunnelGoal` is one call into
  `evaluateConditions`, so a funnel goal, an automation condition, a report
  filter and a scoring rule cannot drift apart. Writing a second evaluator is
  exactly how `contains` comes to mean two different things in two places.

  **The invariants that are code rather than prose**, each because it fails
  silently otherwise:
  - `FunnelStages` refuses duplicate keys (two rungs would merge in every
    report), more than one `convert` (attributed value counted twice), no
    `convert` (the goal becomes unmeasurable while the funnel looks configured),
    and a rung below the conversion.
  - `updateFunnel` refuses to activate a funnel with no goal, and refuses to drop
    a stage key from a LIVE ladder — renaming is fine because the key is the
    identity, restructuring strands the history recorded under the old key.
  - `recordStage` refuses an unknown stage key (it would write history nothing
    can read back), a value on a non-converting rung (it would inflate revenue),
    and any write to a funnel that is not `active`.
  - `buildLadder` returns `null`, never `0`, for a rate with an empty
    denominator. Same rule as A1: "nobody reached the stage above" and "everyone
    who reached it dropped out" are opposite facts.

  **The ladder reads RAW events, not the rollup, and that is load-bearing.** The
  rollup is a per-day aggregate, so somebody who entered Monday and converted
  Thursday is one subject in the funnel and two rows in the rollup — summing days
  produces rates above 100%. The rollup is for the chart; the ladder needs
  window-unique subjects. Verified: four `captured` events for three addresses
  (one repeat) reported `captured=3`.

  **A defect found by running it, not by reading it.** The probe created a
  funnel, reconciled, deleted it — and its two `rollup_funnel_daily` rows were
  still standing. `rollup_funnel_daily` shipped with FKs to `tenants` and
  `properties` but none to `funnels`, matching the other rollups. That match was
  wrong: the others aggregate a STREAM that outlives any one rule, so a missing
  source row is ordinary, whereas this table is keyed BY the campaign and a
  deleted funnel's counts are garbage every all-funnels total would keep adding
  in. The reconcile's delete-then-insert only self-heals its trailing window, so
  anything older would sit there permanently.
  Fixed by `20270421000000_a_deleted_campaign_takes_its_numbers_with_it` — a
  SECOND migration rather than an edit to the first, because a name is the key in
  `_prisma_migrations` and editing an applied file changes its checksum. Re-run
  afterwards: `rollup=2 events=2` before the delete, `0` and `0` after, zero
  orphans platform-wide.

  _Verified against the real database:_ every gate above was made to fire (goal,
  draft, unknown key, value-on-wrong-rung), the reconcile SQL ran and produced
  `captured entered=3 converted=0` / `converted entered=1 converted=1
value=12500`, and the cascade was proven. 16/16 schema tests, tsc and eslint
  clean. Probe rows cleaned up.

  _Two things the run caught that reading would not have:_ a backtick inside a
  SQL comment in a `$executeRaw` template literal silently ended the string
  (tsc caught it as a syntax error two lines later), and zod 4 validates UUID
  version/variant nibbles while Postgres does not — so `1111…-1111-1111` is
  accepted by the database and rejected by the schema. Both were in my own test
  fixtures, not in shipped code.

- ☑ **B3 — Stage ingestion + the capture stitch.** _(2026-08-26)_

  **The design doc was wrong about the anonymous half, and the build corrected
  it.** docs/151 §4 said "the beacon increments `rollup_funnel_daily` at
  ingestion". That cannot stand beside a delete-then-insert reconcile: the first
  nightly run over the window erases every incremented count and nothing says so.
  It also contradicts the table's own claim to be recomputable from source — an
  incremented counter IS the source. So **both halves are derived**, each from
  where its facts already live: stage events below the capture line, and
  `site_analytics_events` above it, counted as `COUNT(DISTINCT visitor_hash)` on
  the rung's page. That is the table the rotating hash was designed to expire
  inside, and the count is the one `rollup_site_daily.visitors` already carries.
  Nothing new is stored to make it work. docs/151 is corrected in place.

  That decision needed a way for a `view` rung to say WHICH page, so
  `FunnelStage` gained an optional **`path`** (view rungs only, exact match
  against the beacon's normalized path), defaulting to the funnel's entry page
  via a single `pathForSlug` the reconcile, the ladder and the activation check
  all read. Three copies of the home-page-is-a-null-slug convention is how two of
  them go stale.

  **Three gaps in B2 that only appeared once the two halves had to coexist:**
  `recordStage` now **refuses a `view` rung** (the schema said view rungs are
  never rowed; nothing enforced it, and a row would have collided with the
  derived rollup row for the same funnel/stage/day). `updateFunnel` now **refuses
  to activate** a funnel whose view rung has no resolvable page, for the same
  reason a goal is required — a rung that counts nothing reports zero visitors,
  and zero is a measurement. And `LadderRung.entered` became **`number | null`**,
  because `entry_page_id` is SetNull and a deleted landing page is a reachable
  state; every rate off a null rung is null too.

  **The stitch itself**, `api-rest/src/lib/funnel-entry.ts`, mirrors
  `resolveOrderAttribution` pointed at a person: recompute the visitor hash
  in-request via `deriveVisitor`, read that visitor's EARLIEST pageview today,
  copy the derived source / landing path / campaign onto the row, discard the
  hash. Non-throwing throughout — a funnel is a report and the lead is the
  business, so the worst outcome is a row with no source, which reads honestly as
  "we do not know where they came from".

  **Two public write paths, and the second one was not in the plan.** The
  planned one is `/v1/public/site/collect` with `type: 'funnel_stage'`. The other
  is the one that matters: B1 shipped `entry_page_id` + `entry_form_node_id`, and
  without a stitch in `/v1/public/forms/submit` nothing on earth would ever write
  them — columns that exist and no code fills. A submission at a funnel's entry
  form now records its capture rung, after the inbox row and the `form.submitted`
  publish, self-guarded.

  **What a public body may name, and why it is short.** Only an email address.
  Not a `customerId` — an unauthenticated route that accepted one would let a
  script file invented history against a real contact chosen by id. Not a
  `valueCents` — that would let a visitor declare what their own conversion was
  worth, straight into the tenant's revenue reporting. Both come from the server
  side in the flows that know them. The funnel must also belong to the posting
  site, not merely the tenant, or one leaked funnel id could be sprayed at from
  every other site the tenant runs.

  **Do-Not-Track is deliberately NOT honored for a funnel stage**, and that is
  not a loophole. DNT suppresses tracking; somebody typing their address into a
  form and pressing send is not being tracked, and discarding it would cost the
  tenant a lead the visitor meant to give them. The attribution lookup still
  finds nothing for a DNT visitor, because the beacon never recorded their
  pageviews — DNT working one layer down, with no special case needed.

  The nightly `/internal/site/analytics-rollup` cron now reconciles funnels over
  the same window, separately guarded so a tenant whose funnels fail still gets
  its site rollup. `ReconcileResult` gained **`skipped`** (funnels whose stored
  ladder did not parse) and the cron reports it per tenant: a funnel silently
  missing from every report is exactly the failure this module exists to stop.

  _Verified against the real database:_ 28/28 in a throwaway probe covering both
  halves counted from their own sources, the rate that crosses the capture line
  (2 of 5 = 0.4), rollup idempotency, view and capture rows not colliding, the
  deleted-landing-page path returning null rather than zero, first-touch beating
  last-touch, a visitor with no traffic learning nothing, the form-to-rung
  resolution, and **the written row not containing the visitor hash anywhere**.
  29/29 schema tests, tsc + eslint clean, `check:events` / `check:routes` /
  `check:boundaries` / `check:migration-order` all green.

  _Two bugs the probe caught that reading did not:_ `property_id IN (...)` with
  bound parameters is `uuid = text`, which has no operator in Postgres (fixed by
  casting each id, not the column — casting the column compiles and quietly stops
  using the index); and **a backtick inside a SQL comment ended the template
  literal again**, the identical trap as B2. It is not a one-off: any `$queryRaw`
  comment that names a column or type in backticks breaks the string. Write those
  comments without them.

- ☑ **B4 — API, events, MCP.** _(2026-08-26)_

  `/v1/funnels` (list / create / get / patch / delete), `/:id/ladder` for the
  report, and `/:id/stages` to record one person on one rung. Module-gated on
  `funnels`: free to run is not the same as ungated, and a tenant who never
  turned it on should get a clean MODULE_DISABLED rather than an empty list that
  reads like a campaign nobody built.

  **The staff stage route deliberately does NOT run the attribution lookup,** and
  that is a correctness rule rather than a saving. The lookup derives entry facts
  from the REQUEST's IP and user-agent, so running it on an authenticated call
  would attribute a lead to whichever staff member typed it in, using their own
  browsing. It also ACCEPTS `valueCents` and `customerId`, both of which the
  public route refuses — the difference is that this call carries the tenant's own
  key. The asymmetry is documented in both files.

  **The three events, and the one that needed a schema change.** `funnel.entered`
  fires on the `capture` rung and `funnel.converted` on `convert`; a `qualify` or
  `engage` rung publishes nothing, because there is no event type for it and
  inventing one so every rung emits something would put three events on the bus
  for one person's afternoon. `funnel.entered` can never fire on a page view:
  above the capture line there is no person for an event to be about.

  `funnel.abandoned` is the only one with nobody behind it, and it could not be
  published at all without knowing when standing still becomes giving up. That
  judgment cannot be a platform constant (a cart left four hours is abandoned; a
  B2B quote left four hours is Tuesday afternoon), so it is a per-funnel
  `stall_after_hours` with a per-KIND default — **migration
  `20270422000000_a_campaign_says_when_to_give_up`**, plus the
  `(tenant_id, funnel_id, occurred_at DESC)` index the sweep needs. NULL means
  "use the kind's default", never "never": a funnel that never gives up never
  fires the follow-up that recovers the sale.

  **The sweep is stateless, and the cost is written down rather than hidden.** It
  announces only subjects whose patience ran out SINCE THE LAST RUN (a 25-hour
  window against a daily job), so each person is seen once with no table to
  remember them. A missed run therefore skips those subjects permanently. That is
  the right trade for a notification trigger and the wrong one for anything that
  must not be lost, so `abandon.ts` says so, and says nothing here should grow
  into a billing path. The cron manifest repeats it, because the schedule and
  `DEFAULT_SWEEP_WINDOW_HOURS` have to change together.

  **Two cron endpoints, not one, and NOT folded into the site-analytics rollup.**
  Folding the funnel rollup in there looked obviously right — same window, same
  table — and would have been wrong: that job enumerates tenants by the `builder`
  JSON flag, so every funnels-only tenant would have been skipped while the job
  reported success. `listTenantsWithModule('funnels')` DERIVES availability
  instead. `k8s/cronjobs/funnels-rollup.yaml` at 10:00 UTC (after site-analytics
  at 09:00, because it reads what that beacon wrote) and
  `funnels-abandonment-sweep.yaml` at 10:30.

  **`announceStage` lives in the funnels package, on its own `./announce`
  subpath.** It was written in api-rest first, then moved: the MCP write tool has
  to announce identically, and "did it come in through MCP?" must not be
  something anyone has to know. The subpath split is load-bearing — `./index`
  stays backend-safe with only the database behind it, which is what lets the
  event-worker run the reconcile without api-core's closure.

  **MCP: three read tools and four write.** `get_funnel_report` returns the whole
  assembled ladder rather than a row count, because A1 recorded that the
  conversion funnel was reachable ONLY by asking an AI — a bad reason to build an
  agent tool, and a good reason to make sure the one an agent gets is the real
  answer. Registered with `read:funnels` / `write:funnels`, mapped to the module
  gate in `server.ts`, added to `WRITE_SCOPES`, **and added to
  `MCP_SCOPE_CATALOG` in the same change** — the three notes already in that file
  all record the same defect from the other direction, a tool registry requiring
  a scope the consent catalog had never heard of, which makes the surface
  unreachable on both auth paths while everything typechecks.

  **The three events are registered as automation triggers in BOTH workbench
  catalogs.** An event a tenant cannot pick from a list may as well not be
  published, which is the lesson `staff-cron.ts` already wrote down.

  _Verified against the real database:_ 27/27 in a throwaway probe — the patience
  column and its per-kind fallback, the migration's CHECK refusing a patience of
  zero, and the sweep's four cases (somebody who just went quiet is found;
  somebody who crossed the line on an earlier night is NOT re-announced, which is
  what proves the stateless window; somebody still moving is not abandoned;
  somebody who converted is not abandoned). A paused campaign stops chasing
  people. An `engage` rung announces nothing and a `convert` rung announces
  `funnel.converted` carrying the value, the stage KEY rather than its label, the
  rung kind, and **no visitor hash anywhere in the payload**. All seven MCP tools
  publish under a funnels scope, the destructive two ask first, the report tool
  returns the whole ladder including a null rate, and every scope they require is
  present in `MCP_SCOPE_CATALOG`. The B3 probe was re-run after the schema change
  and still passes.

  _A latent bug this slice exposed:_ `check-event-topics.mjs` strips comments
  with `//.*$`, and `.` does not match a CR — so on a CRLF file no comment is
  stripped, the union scan breaks at the first comment containing a semicolon,
  and the check reports **green having read about a dozen of 300+ names**. The
  repo is LF by `.gitattributes`, but any tool that writes CRLF locally silences
  the guard instead of failing it. Fixed by stripping CR first. This is
  [[feedback_structural_checks_go_blind]] exactly, and the guard was made to go
  RED for the right reason before the topics were added.

- ☑ **B6 — Module registration.** _(2026-08-26, done before B4 because B4's gate
  needs the slug to exist.)_

  `funnels` added to `ModuleSlug` + `ALL_MODULES`, with no `MODULE_MONTHLY_CENTS`
  entry, no `REQUIRES` and no `BUNDLED_FREE`. Free for a different reason than
  social's: social is free because it is cross-cutting, funnels because every
  part it measures is already paid for, and charging again to find out whether
  they worked prices the answer out of reach of the businesses that most need it.
  Both reasons are now written where the prices are.

  **The wine token, in both theme files.** `#881337` with white ink, light and
  dark, plus the `[data-module='funnels']` mapping, the plugin `colors:`
  registration in all three `globals.css` files, `MODULE_HEX` for the edge OG
  routes, and `WORKBENCH_MODULES` in both apps. Piggles groups it into `web`,
  because a campaign starts on a page.

  **Two more hardcoded copies of the module list, found and deleted.** The build
  log warned about "api-rest's second copy"; there were three. `module-toggle.ts`
  had already been fixed to spread `ALL_MODULES`, but `routes/v1/dashboard.ts`
  and `lib/email-data.ts` each still carried a hand-maintained array — so a new
  module would have been absent from the home grid and from every email merge
  tag, silently, while everything typechecked. Both now read `ALL_MODULES`.

- ☑ **B5 — Workbench surfaces, in BOTH apps.** _(2026-08-26)_

  Two surfaces per app and no more: **Campaigns** is the module landing, and
  **Campaign** is where one is set up AND where its report is read. Splitting
  those would mean two panes open to answer one question. Creating is the same
  pane with `{ id: 'new' }`, which is the house rule for anything where create
  has the shape of edit.

  **The report sits ABOVE the setup**, because a campaign is configured once and
  looked at for months — putting the form first would make the common visit
  scroll past a form nobody is editing. A draft has no report, so the order
  inverts itself and the setup becomes the top of the pane.

  **The ladder is drawn as narrowing bars, on silica's `<Progress>`.** The SHAPE
  of a funnel is the finding, so a table of numbers makes the reader do the
  arithmetic and a chart library makes them learn a legend. `<Progress>` was the
  right primitive rather than a styled div for two reasons: it carries the ARIA
  progressbar role, so the shape is announced as well as drawn, and it took a
  `value` — **the first draft used `style={{ width }}`, which is the banned
  inline-style prop.** A dynamic width looked like the one case that had to break
  that rule, and it was not.

  **Nothing anywhere in these surfaces prints 0% for a null.** `rateLabel` and
  `countLabel` own that, an uncounted rung draws NO bar rather than an empty one
  (a zero-length bar is indistinguishable from "nobody got here"), and the
  activation button is disabled with the REASON in its tooltip rather than
  letting a 400 teach the two rules the server enforces.

  **The A1 gap is closed, in both apps.** `conversionFunnel()` had been computed,
  exposed over REST and offered as an MCP tool for its whole life with nothing
  drawing it, so a tenant could see their own conversion rate only by asking
  their AI. It is now a section on the Reports surface, drawn the same way as a
  campaign ladder and honouring the same null rule — which matters most here,
  because a business selling through wholesale, the counter or the phone has no
  web sessions at all.

  **Piggles is a real fork, not a copy.** Fifteen files instead of five, because
  RULE #0.5 caps a file at 250 lines and a method at 50: the draft state, the
  toolbar, the setup form, the report panel and the row all became their own
  units. It uses piggles' own idioms throughout — FontAwesome glyphs through
  `<Icon>`, `PaneEmpty` / `PaneLoadError` / `PaneWaiting`, `<Card>`-wrapped
  states, and the slot-based `PaneToolbar` (`search` / `filters` / `primaryAction`
  / `refresh`) rather than sparx's `wrap` children. Touching piggles'
  `reports.tsx` meant applying the rule to it too, so it went from 327 lines to
  225 with `revenue-bars.tsx` and `report-sections.tsx` extracted.

  _A gap `check:routes` caught:_ both surfaces were registered and neither had an
  address, so a deep link or an MCP `open` could not reach them. Added
  `/campaigns` and `/campaigns/:id` to `@wizeworks/links`. That check exists
  because a surface that is registered and unreachable typechecks green.

  _Verified:_ tsc + eslint clean on both workbench apps, `check:routes` (340
  surfaces, all addressed), `check:boundaries`, `check:deletability`, prettier.
  **Not verified by clicking**, because the surfaces have never been opened in a
  browser — see the note at the end of §9.

## 4. Phase C — capture

- ☑ **C1 — Node triggers + client-local frequency caps.** _(2026-08-26)_

  **One behavior, not four.** `data-sx-reveal` joins the closed behavior
  vocabulary alongside `dismiss`, `carousel` and the rest. The builder already
  had every SHAPE an offer takes — a dialog, a lightbox, an announcement bar, a
  popover — and no way to say WHEN one should appear, so every offer was a block
  sitting in the page hoping to be scrolled past. Five triggers: `load`, `delay`,
  `scroll`, `exit`, `return`.

  **Exit intent is desktop-only and stays that way.** It reads a `mouseout` to a
  null `relatedTarget` above the viewport, which is the address bar and the close
  button. Pointer-coarse devices never fire it, and the usual mobile substitutes
  (a back-button trap, a scroll-up guess) interrupt somebody who was not leaving.

  **The element starts `hidden` in the MARKUP, and the behavior removes it.**
  Hiding from script instead would flash the offer on every page load before the
  timer it is waiting for, and would leave a no-JS visitor an offer they can see
  and cannot dismiss. `hidden` was already a global allowed attribute for exactly
  this reason — the element.ts comment describes the case.

  **The frequency cap fails OPEN.** A blocked or unreadable localStorage means
  the offer shows, because an offer nobody ever sees is a worse failure than one
  somebody sees twice, and a private-mode visitor must not silently lose the
  site's promotion. The `return` trigger resolves the other way — uncertainty
  means stay quiet, since showing a "welcome back" to a first-timer is the more
  intrusive mistake. Both are one bit in storage, never a visit count or a
  first-seen date, which would accumulate into the persistent anonymous identity
  docs/151 §4 refuses.

  **Each offer is two behaviors on two nodes**, because a node carries one: the
  outer frame is `dismiss` (closing it is remembered, so somebody who says no is
  not asked again) and the inner card is `reveal`.

  **The modal opens by clicking its own trigger.** A centered modal cannot be a
  plain hidden element — `fixed inset-0` is denied by the compile allowlist as a
  clickjacking guard, and weakening that for a promotion would be a poor trade.
  So `opens` clicks the Dialog island's trigger and leaves the host hidden, which
  gives a timed modal with no second dialog implementation, no new prop on the
  island, and no stray trigger button left on the page. It clicks THROUGH the
  wrapper the walker puts around a registry atom, because `part(node,'trigger')`
  on a Dialog marks the wrapper rather than the button.

  _The gap this turned up, which was not in the builder:_ **`/v1/public/signup`
  had no funnel stitch.** That is the endpoint the Signup block posts to and the
  one in the default starter, so a slide-in built from this catalog would have
  captured addresses into CRM all week while its campaign reported nobody. It now
  takes an optional `formNodeId` and runs the same
  `findFormCaptureTarget` → `captureFunnelStage` pair the contact-form path got
  in B3, after the subscribe and never inside it — the contact and its consent
  record are the tenant's business, and a reporting nicety must not cost them a
  subscriber. The node id is threaded from the walker (which already hands it to
  `ContactForm`) through the island, the runtime and the fetch; the silica path
  reads it off `data-sui-id` exactly as its contact branch already did.

  _Files:_ `builder-render/src/behaviors/{reveal.ts,reveal.test.ts}` + registration
  in `types.ts`/`index.ts`/`attrs.ts`, the mirror in `builder-schemas/catalog/_kit.ts`,
  three entries in `catalog/marketing.ts`, and the signup chain across
  `render-leaf.tsx`, `signup.tsx`, `runtime-context.tsx`,
  `apps/site/lib/signup-client.ts`, `apps/site/components/{silica-behaviors,site-builder-runtime}.tsx`
  and `api-rest/routes/v1/public/signup.ts`.

  _Verified:_ 22 new behavior tests (98 in builder-render, 331 in builder-schemas,
  including the cross-package drift test that pins the two behavior-name mirrors);
  tsc + eslint clean on builder-render, builder-schemas, api-rest and apps/site;
  every class the three entries author checked against the compile allowlist; and
  **the cap test was made to go red** by removing the cap before it was trusted
  green. `check:routes`, `check:boundaries`, prettier.

  _Not clicked:_ no offer has been placed on a real page in a browser.

- ☑ **C2 — Multi-step forms, with partial capture.** _(2026-08-26)_

  **The steps come from the DOM, not from a config toggle.** Fields in a builder
  form are author-composed nodes; by the time the island sees them they are React
  children it cannot inspect. So a step is declared the way every structural part
  in this system is — `part(node, 'item')`, lowered to `data-sx-item` — and read
  back off the rendered form. `toc` already works this way. The consequence worth
  knowing: **a form with no marked steps has one step**, which is the plain form
  that already existed, so nothing about single-step forms changed.

  **Hidden, not unmounted.** Going Back and forward again has to find what you
  already typed still there, and unmounted inputs would have thrown it away. It
  also means `new FormData(form)` on the final submit still sees every answer —
  which is why the submit path needed no changes at all.

  **Only the visible step is validated.** Validating the whole form would refuse
  to advance because of a required field three screens ahead that nobody has been
  shown, with no visible explanation for the refusal.

  **The identity of an unfinished form is (tenant, form, email) — there is no
  client-side id anywhere in it.** That was a deliberate choice over a draft
  token: a durable per-visitor identifier is exactly what docs/151 §4 refuses,
  and it is not needed, because the address they typed IS the identity. A reload
  resumes the same row. A partial unique index enforces one row per unfinished
  form (`WHERE status = 'partial'` — completed submissions may legitimately
  repeat, and a plain unique index would forbid the same person contacting a
  business twice). Prisma cannot express a `WHERE` on an index, so it is
  hand-authored SQL like the RLS policies, with find-then-write and the index as
  the race backstop.

  **A partial NEVER mirrors to CRM, notifies, or autoresponds.** Somebody typed
  an address and pressed Next: a real disclosure to that site, which is why the
  row may exist — but not consent to be marketed to, and a feature that quietly
  treats it as one is how lead capture becomes a complaint. It DOES enter its
  funnel, because that is the tenant measuring their own site rather than
  contacting a stranger. Reaching out is a deliberate act from the inbox.

  **Partials are kept out of the default inbox and out of `total`.** An
  unfiltered list returns finished submissions only; a half-filled form sitting
  there looking like a message somebody sent is worse than not recording it,
  because the tenant replies to something nobody sent. `submissionCounts` reports
  `partial` separately so no "you have N enquiries" figure is silently inflated.

  **The capture fires and is not awaited**, and `keepalive: true` — this is the
  moment somebody abandons a form, and a normal fetch is cancelled on unload. It
  never surfaces an error: a dropped partial costs the tenant one row, a visible
  error costs them the lead.

  _Files:_ `builder-render/src/{form-steps.ts,form-steps.test.ts}`, the island +
  runtime, `builder/src/services/form-submit-service.ts` (`capturePartialSubmission`,
  and `createFormSubmission` now PROMOTES a matching partial rather than landing
  beside it), `POST /v1/public/forms/partial`, the site fetch + bridge, and a
  `form_multi_step` catalog entry whose email field is on step ONE — ask for the
  address last and there is nothing to keep.

  _Verified:_ 16 new tests over the pure DOM functions (the island only
  server-renders in tests, so the logic was factored out to be testable at all),
  and **one was made to go red** by removing the forward-reach bound before it
  was trusted green.

- ☑ **C3 — Quiz + calculator, writing a real CRM score.** _(2026-08-26)_

  **The weights are server-only, and that is the whole security of it.** A quiz
  that decides somebody is a strong lead cannot let that somebody edit the
  arithmetic. They ride in `FormDefinition.config` beside the recipient
  addresses, and `scoring` was added to `CONTACT_FORM_SECRET_PROPS` so publish
  strips it from the tree the browser gets — otherwise a visitor could read which
  answers are worth what, and the "hot lead" handed to sales would be somebody
  who read the source.

  **The result is a real CRM score, never a private number.** `applyQuizPoints`
  is a sibling of `adjust` rather than a caller of it, for two reasons that both
  matter: a **zero-point result is still recorded** (`adjust` refuses a change
  that would not move the number — right for a person pressing +10, wrong here,
  because "they took it and matched nothing" is exactly what sales needs, and
  recording silence makes an answered quiz indistinguishable from an unopened
  one), and there is **no actor** (a visitor scored themselves; stamping a staff
  id would attribute a judgement to somebody who never made one). It shows up in
  `explain_crm_score` beside every other reason.

  **It lives in the ACTION layer, not in CRM.** The first cut put it in
  `@wizeworks/crm`'s lead-service and the typecheck refused it: CRM does not
  depend on the builder's schemas, and it should not start. Reading a form
  definition to write a CRM score is cross-module orchestration, which is what
  the action layer is for — and `automation-actions` already depends on both
  sides. Idempotent on a new `quizScoredAt` stamp written in the same
  transaction as the score, because the action is retried and points added twice
  would drift a lead upward every time a worker hiccuped.

  **The arithmetic runs ONCE, on the server, for both audiences.** The submit
  route returns the matched band (or the calculator's quantity) and the island
  shows it instead of a generic thank-you — computed from the same weights that
  set the CRM score, because two implementations of one calculation is how a
  visitor comes to be shown one result while the sales team sees another.

  **A calculator is the same machine with a multiplier**, deliberately not an
  expression language: an author-written formula means shipping a parser and an
  evaluator that run on submitted input, which is a lot of risk to buy a feature
  nobody asked for, and every real "how much could you save" is a weighted sum
  times a rate anyway. A zero rate reads as NO multiplier rather than "$0", so a
  calculator whose rate was never filled in does not confidently report nothing
  as if it were a measurement.

  _Verified:_ 20 new tests on the pure scoring module, including that an
  unanswered quiz scores 0 and still lands in a band, that a multi-select scores
  every option it names, and that a config which drifted degrades to
  not-a-quiz rather than throwing on a live submit. One test failure during the
  run was MY arithmetic, not the code's.

- ☑ **C4 — Gated delivery (signed, expiring link to a private asset).** _(2026-08-26)_

  The mirror image of the form-upload token, as §7 said it would be: that one
  lets an anonymous visitor PUT bytes we have not seen, this one lets a named
  visitor GET bytes we already hold. Same signing secret, same format, and a
  **distinct `typ`** so a delivery link can never be replayed as an upload URL or
  the reverse — there is a test for exactly that, because both are validly signed
  by the same key and only the type check separates them.

  **The token carries the storage key inside its own signature.** Nothing in the
  URL a visitor can edit names an object, so the bucket cannot be walked and a
  token minted for one asset cannot be pointed at another without invalidating
  itself.

  **The file is EMAILED, never linked from the thank-you page.** That is the
  difference between a gate and a formality: a download button on the success
  page hands the file to anyone who types anything, and the business ends up
  hosting a public file that also collects addresses.

  **Seven days, and the email says so.** A link that never expires is a public
  URL that takes one extra step to find; one that silently stops working reads as
  a broken site. Saying "seven days" in the body makes the expiry a thing the
  link did as promised, with an obvious remedy. `expired` is reported separately
  from `bad-signature` for the same reason — one deserves "that ran out, ask
  again" and the other deserves nothing at all.

  **The base URL is required, not defaulted.** An email is read somewhere else
  entirely, so a relative link in one is simply broken — and sending a broken
  download is worse than sending nothing, because the visitor has already paid
  with their address and now believes they were given something. Unset logs
  loudly instead of sending.

  _A gap the package's own CLAUDE.md caught:_ a new email template has **six**
  sync points and I had done five. The missing one was
  `events/src/types.ts`'s `EmailSendPayload.template` union. Also corrected: the
  fixture URL hardcoded a brand domain, which passed only because the
  brand-leak assertion strips URLs before comparing.

  _Verified:_ 8 new token tests (tamper, wrong secret, expiry boundary,
  cross-type replay, malformed, weak secret), 213 in `@wizeworks/email` including the
  every-template coverage gate whose hardcoded count fired correctly and was
  bumped 38 → 39, and 41 in the worker.

- ☑ **D1 — `sms.send`, built safe and shipped dark.** _(2026-08-26)_

  All four of §8's non-optional parts, because each of them is what makes the
  rest honest.

  **Shipped dark is a COLUMN, not an absence.** `sms_settings.enabled` defaults
  false and the guard checks it before anything else, so a tenant who has not
  asked for texting cannot be billed for one even if a provider credential
  appears. Relying on the credential being absent would have made "safe" a
  property of the deployment rather than of the code.

  **Five ways not to send, and they are not collapsed.** `disabled`,
  `suppressed`, `held`, `capped`, `failed` — each has a different fix, and a
  single "not sent" sends an owner hunting for the wrong one. **Every one writes
  a ledger row**: "we did not text them, and here is why" is an answer, and
  silence is what makes somebody think the feature is broken when it is
  protecting them.

  **The ceiling is counted from the ledger and trips BEFORE the provider call**,
  so a runaway automation costs nothing rather than costing whatever it sent
  before somebody read the invoice. Only actual sends count against it — counting
  refusals would let a misconfigured automation lock a tenant out of texting
  without ever sending one.

  **Quiet hours are the RECIPIENT's.** A shop in London texting Sydney at 10am is
  reaching somebody at 9pm, so an unusable timezone returns null and is treated
  as "cannot tell" rather than as the sender's clock. `nextSendableAt` walks
  forward an hour at a time rather than doing local-clock arithmetic, which is
  what makes it right across a DST boundary.

  **A STOP outranks everything, including a transactional send**, because the
  person told the CARRIER to stop rather than told our marketing department.
  `marketing` scope exists for the softer case, where someone unticked a box and
  a booking confirmation they asked for should still reach them.

  _The part that made it real:_ **every existing SMS send was routed through the
  guard.** Booking reminders and waitlist offers were calling the provider
  directly, so a suppression table they ignored would have been a table with a
  hole in it — worse than not having one, because everybody stops looking. Both
  are now `transactional` sends through `sendTenantSms`, which does not make them
  wait for quiet hours and does make them obey a STOP.

  _Two things the segment counter taught me, both by failing:_ carriers bill per
  UCS-2 **code unit**, so an astral emoji is two of the 70 and counting code
  points undercounts exactly the messages most likely to be long; and `ò` is in
  GSM 03.38 while `ô` is not, which is the kind of difference nobody can eyeball
  — two versions of that test were wrong before the function was.

  _Verified:_ 26 tests on the pure policy (wrapping quiet-hour windows, whose
  clock, segment counting), tsc + eslint clean.

- ☑ **D2 — The lead response clock.** _(2026-08-26)_

  **The first task was the check, and it had an answer.** Do the existing CRM SLA
  policies reach an inbound web lead? **Only if that lead opens a support
  request.** `crm_ticket_sla_policies` relates to tickets, its targets key on
  `Ticket.priority`, and a lead that becomes a contact or a deal has no clock —
  which is the common case and the expensive one, because the lead nobody
  answered is a sale rather than a support query.

  So: **extend, not duplicate.** Those policies already own the hard part — a
  timezone, a weekly pattern, holidays, an amber threshold, and a pure engine
  that counts BUSINESS minutes correctly across a clock change. Standing up a
  second clock would have meant a second implementation of business-hours
  arithmetic for the two to disagree about. One new number on the policy that
  already owns the calendar (`leadResponseMinutes`), two instants on the person.

  **Stored, not derived on read.** "Who is about to go unanswered" has to be an
  index scan rather than a calendar computation per row — and a policy edited in
  March must not silently move what was promised in February.

  **The clock stops on a RESPONSE, and a note is not one.** `email.sent`,
  `email.replied`, `call`, `call.logged`, `meeting`, `meeting.booked`,
  `ticket.replied` — never `note` (writing something down about a person is not
  answering them), never `email.opened` (that is the customer acting), never
  `email.received` (that STARTS a clock), never `call.missed`. A clock that
  stopped on internal activity would measure how busy the desk looks.

  **Null is never overdue.** A business that has published no promise about
  response times is in a normal state, and writing a due date it never agreed to
  would put every contact in a queue nobody asked for.

  Exposed at `GET /v1/crm/reports/lead-response` as two numbers and a queue,
  because "12 waiting" and "12 waiting, 4 of them late" are different mornings.

- ☑ **D3 — The shipped funnel library.** _(2026-08-26)_

  Seven recipes, forked on install, installed on module activation through the
  same signal `seedSystemAutomations` rides — so a tenant who turns commerce on
  later gets basket recovery then rather than never.

  **Each recipe declares its owning module**, exactly like `SYSTEM_AUTOMATIONS`.
  A commerce tenant gets basket recovery; a CMS-only publisher never sees a
  campaign about baskets. A campaign about an event the tenant cannot emit is not
  a partial campaign, it is a wrong one.

  **No recipe starts with an anonymous `view` rung, and that is deliberate.** A
  view rung has to be told which page counts, and a funnel with an unresolved one
  is refused activation (B3). Seven campaigns that all landed saying "say which
  page counts as 'Looked at the shop' before you turn it on" would have made the
  library homework. Every recipe starts at the CAPTURE line, which needs no
  configuration and works the moment it installs.

  **A re-run never touches a campaign that already exists.** Not its name, its
  steps, its goal, or whether it is running. A tenant who renamed "Basket
  recovery" to "Chase the trolley" and turned it on has made it theirs, and a
  seed that reconciled it back on a schedule nobody can see would undo their
  work.

  **Installed PER SITE**, because a funnel is scoped to one business and an owner
  running two shops wants basket recovery measured separately for each rather
  than pooled into a number that describes neither.

  _Verified:_ 11 tests, including that every recipe passes the same stage
  validator a tenant's own campaign is held to, and that no recipe names a module
  slug the platform does not have — asserted against the REAL `ALL_MODULES`
  rather than a copy in the test file, which would go stale and stop catching it.
  The design pass ran first (2026-08-26) and is written up as
  [docs/151 §12](151-funnels-module.md). It changed the shape of the slice, so its
  finding is worth repeating here: **the two halves are very different problems
  wearing one name.**

- ☑ **E1 — Order bump.** _(2026-08-26)_

  **It is not payment work at all.** A bump is shown DURING checkout, before
  anything is charged, and taking it is `cart.addItem` — so pricing, discounts,
  tax, inventory commitment and the eventual refund are all the cart's, exactly
  as they are for anything else in the basket. The decision recorded it as
  touching payment capture at the same time as everything else; checking that
  against the code is what shortened it.

  **The offer carries no price.** It is read from the variant every time. A price
  on the offer would be a second place a product costs something, and the two
  would disagree the first time somebody edited the product.

  **Accepting takes an `impressionId`, never a variant id.** What is being
  accepted is a SHOWING — and an endpoint that added any variant a caller named
  would be a checkout that sells things at prices the shop never offered.

  **One offer, never a stack.** The limit lives in the selector rather than being
  left to whoever builds the screen: a checkout that asks four times is the
  pattern this feature is known for and the reason people distrust it.

- ☑ **E2 — Post-purchase upsell.** _(2026-08-26)_

  **A SECOND ORDER, not an amendment**, and this is the call the whole slice
  turns on. Appending a line to the completed order would mean re-running tax on
  a document the customer already has a receipt for, changing a total they have
  already seen, and a refund path that has to unpick which lines belonged to
  which capture. A second order gets its own tax, its own inventory commitment,
  its own receipt and its own refund — the two refund independently because they
  always were two.

  **It reuses the ordinary checkout path**: cart → session → charge → complete,
  the same four steps every other order takes. A bespoke create-an-order function
  would have been a second order-creation path, and the first thing to diverge
  would be something nobody notices until a tax quarter closes.

  **"One click" means the card is already on file**, nothing more. The customer
  still presses the button, the charge is off-session through
  `chargeStoredMethod` with the stored-credential chain (a merchant-initiated
  charge that does not name the establishing transaction is soft-declined on a
  perfectly good card), and the idempotency key is the SHOWING — so a double-tap
  cannot become two charges.

  **A decline leaves NO order behind.** The customer's real purchase is already
  done, and a pending order for the merchant to chase is worse than an upsell
  that simply did not happen. Each failure is its own outcome, because "your bank
  declined it" and "we have no card saved" send a person to different places.

  _A guard that caught something real:_ `merge-covers-every-customer-table`
  failed on the two new SMS tables. A merge has to say what happens to a
  suppression, and the answer matters — it is keyed on the phone number so the
  STOP keeps binding either way, but the `customerId` pointer has to follow the
  survivor, or their screen shows a person with no record of opting out while the
  sends keep being refused.

## 7. Phase F — experiments

- ⃠ **F1 — Split testing.** Deferred on purpose, gated on B4 reporting real stage
  counts across a representative set of tenants. Rationale in
  [docs/151 §10](151-funnels-module.md).

## 8. Known footguns for this build

Recorded up front because each has already cost this repo an incident.

1. **Storing the visitor hash.** It is the obvious way to make anonymous
   multi-session progress work, it looks like a small pragmatic column, and it
   silently converts sparx into a product needing a consent banner everywhere.
   The schema comment must say why the column is absent — an absent column reads
   identically to an oversight.
2. **The module slug landing in one list and not the other.** `inventory` and
   `finance` both did it. Everything typechecks, and the module cannot be
   activated because the toggle rejects the slug as a validation failure.
3. **The piggles half never getting built.** Packages are shared; surfaces are
   not. It is entirely possible to finish every platform slice and leave piggles
   with a flag that opens onto nothing.
4. **An event type shipping without its topic.** Publishing to a missing topic
   throws a not-found that every publisher catches and logs, so the failure is
   invisible in production: the funnel converts and the event silently does not
   fire. Four separate incidents already. `check:events` catches it at push time.

## 9. Session handoff — 2026-08-26

Everything above is the state of the work. This section is the state of the
WORKING TREE, which no other file records.

### Nothing is committed

Phase A, B1, B2 and B3 all live in the working tree. The changed files, so
staging is unambiguous:

**Funnels module (B1 + B2, all new)**

- `wizeworks/packages/db/prisma/schema/92-funnels.prisma`
- `wizeworks/packages/db/prisma/migrations/20270420000000_a_campaign_says_whether_it_worked/`
- `wizeworks/packages/db/prisma/migrations/20270421000000_a_deleted_campaign_takes_its_numbers_with_it/`
- `wizeworks/packages/funnels/` — `package.json`, `tsconfig.json`,
  `src/{index,schemas,ladder,reconcile,schemas.test}.ts`
- The five schema files that grew a back-relation, 25 added lines between them:
  `02-tenant`, `08-property`, `51-builder`, `71-automation`, `88-email-sequences`
- `pnpm-lock.yaml` — from `pnpm install` linking the new workspace package

**API, events, MCP, module registration (B4 + B6)**

- `wizeworks/packages/db/prisma/migrations/20270422000000_a_campaign_says_when_to_give_up/`
  plus the `stall_after_hours` column and the sweep index in `92-funnels.prisma`
- `wizeworks/packages/funnels/src/{abandon,announce,mcp}.ts` _(new)_ +
  `package.json` (the `./announce` and `./mcp` subpaths, and the api-core / events
  deps that only those subpaths pull)
- `wizeworks/packages/events/src/{types,index}.ts` — the three events and
  `FunnelStageEventPayload`
- `terraform/envs/prod/main.tf` — the three topics
- `scripts/check-event-topics.mjs` — the CRLF blindness fix
- `wizeworks/services/api-rest/src/routes/v1/funnels/index.ts` _(new)_,
  `routes/internal/funnels-cron.ts` _(new)_, `src/app.ts`
- `wizeworks/services/api-mcp/src/{tool-registry,server}.ts` + `package.json`
- `wizeworks/packages/auth/src/mcp-scopes.ts` — the two consent-catalog entries
- `wizeworks/packages/modules/src/index.ts`,
  `wizeworks/packages/billing/src/price-catalog.ts` — the slug, and why it is free
- `wizeworks/services/api-rest/src/routes/v1/dashboard.ts`, `src/lib/email-data.ts`
  — the two hardcoded module lists, now reading `ALL_MODULES`
- `k8s/cronjobs/funnels-rollup.yaml`, `funnels-abandonment-sweep.yaml` _(new)_ +
  `kustomization.yaml`
- `sparx/packages/brand/src/{theme.css,marks.ts}`,
  `piggles/packages/brand/src/theme/groups.css`, three `globals.css`, both
  `components/module-scope.tsx`, both `surfaces/automations/automations-catalog.ts`

**Workbench surfaces (B5)**

- `sparx/apps/workbench/surfaces/funnels/{data,ladder,campaigns,campaign,stage-editor}.tsx`
  _(new)_ + `lib/surfaces/catalog/funnels.ts` _(new)_
- `piggles/apps/workbench/surfaces/funnels/*` _(new, 15 files — RULE #0.5)_ +
  its own `lib/surfaces/catalog/funnels.ts`
- Both apps' `lib/surfaces/catalog/index.ts` and `lib/surfaces/nav.ts` (the rail
  slot, the label, the icon)
- `wizeworks/packages/links/src/routes.ts` — `/campaigns` and `/campaigns/:id`
- The A1 gap, in both apps: `surfaces/commerce/conversion-funnel.tsx` _(new)_,
  plus `reports.tsx` and `reports-data.ts`. Piggles' `reports.tsx` was split
  under RULE #0.5, which added `revenue-bars.tsx` and `report-sections.tsx`.

**Ingestion + the capture stitch (B3)**

- `wizeworks/services/api-rest/src/lib/funnel-entry.ts` _(new)_ — the stitch
- `wizeworks/services/api-rest/src/routes/v1/public/site-analytics.ts` —
  `type: 'funnel_stage'`, the DNT carve-out, the rate limit, the two things a
  public body may not name
- `wizeworks/services/api-rest/src/routes/v1/public/forms.ts` — the form-submit
  stitch, which is the path that actually fires
- `wizeworks/services/api-rest/src/routes/internal/site-analytics-cron.ts` — the
  nightly funnel reconcile, separately guarded, reporting `skipped`
- `wizeworks/services/api-rest/package.json` — the `@wizeworks/funnels` dep, and
  a second `pnpm install` to link it
- `wizeworks/packages/funnels/src/{schemas,index,ladder,reconcile,schemas.test}.ts`
  — the `path` field, the two new refusals, the nullable rung, the derived view
  half. **Every file in the package changed**, so B2 and B3 are not separable in
  this tree.

**Platform (`wizeworks/`)**

- `packages/commerce/src/services/reporting-service.ts` — A1 + A2
- `packages/commerce/src/mcp/read-tools.ts` — the site ceiling on report tools
- `packages/email/src/templates/tool-result.tsx` _(new)_
- `packages/email/src/templates/index.ts`, `send.tsx`, `template-ids.ts`,
  `template-fixtures.ts` — the four in-package registration points
- `packages/email-worker/src/template-schema.ts` — the delivery gate
- `packages/events/src/types.ts` — the template literal in the events union
- `services/api-mcp/src/tool-registry.ts` + `src/site-scopable.test.ts` _(new)_
- `services/api-rest/src/routes/v1/public/tools.ts` _(new)_ + `src/app.ts`
- `services/api-rest/src/routes/v1/public/search.ts` — A4
- `services/api-rest/src/routes/v1/commerce/site.ts` — the report routes

**sparx marketing site**

- `app/tools/actions.ts` _(new)_
- `components/marketing/tools/tool-result-context.tsx` _(new)_
- `components/marketing/tools/tool-email-capture.tsx` _(new)_
- `components/marketing/tools/tool-shell.tsx`
- `components/marketing/tools/trust-row.tsx` — the reassurance copy that the
  capture offer made untrue
- All 16 tool components under `components/marketing/tools/` (17 tools:
  `document-tool` is both invoice and quote)

**piggles marketing site** — its own copy of everything, by RULE #0

- `app/tools/actions.ts` _(new)_
- `components/marketing/tools/tool-result-context.tsx` _(new)_
- `components/marketing/tools/tool-email-capture.tsx` _(new)_
- `components/marketing/tools/lib/{document,margin,share-card}-email.ts` _(new)_
- `components/marketing/tools/tool-shell.tsx` — provider + card + the two
  assurance lines
- All 16 tool components under `components/marketing/tools/`

**Docs**: `docs/151-funnels-module.md`, `docs/152-funnels-build-log.md` (both new)

### Dirty files that belong to ANOTHER session — do not stage

**Stage by path from the list above, never `git add -A`.** Other sessions are
working in the same checkout and their dirty files come and go, so an enumerated
list here goes stale within hours — it already did once. Anything not named
above is somebody else's.

As of this writing that included `piggles/apps/workbench/{lib,surfaces}/studio/*`,
`piggles/docs/personas/*`, `wizeworks/packages/builder/src/services/*`,
`wizeworks/services/api-rest/src/routes/v1/builder/pages.ts`,
`wizeworks/apps/site/components/checkout/*`, `wizeworks/packages/silica-catalog/*`,
`wizeworks/packages/db/src/sample-data/engine/clear.ts`,
`wizeworks/packages/commerce{,-schemas}/src/{events,returns}.ts` and two
`terraform/` files.

**Two of their migrations are also untracked and are NOT ours:**
`20270418000000_a_customers_lifetime_spend_agrees_with_their_orders` and
`20270419000000_new_customers_are_the_people_who_just_arrived`. Ours are
`20270420000000` and `20270421000000`, named to sort after both so the order
holds whichever session commits first.

### The local database is AHEAD of the repo

This is the unusual bit, and it is easy to trip over. Brandon stopped the dev
server and cleared the Prisma work, so against docker Postgres on `:5544`:

- All five pending migrations are **applied**, including the other session's two
  — `migrate deploy` applies everything pending, not just yours.
- `prisma generate` has run **twice** (once after B1, once after B2's cascade
  relation), so the client in `node_modules` knows `funnel`, `funnelStageEvent`
  and `rollupFunnelDaily`.

Consequences worth knowing: a `migrate status` will look clean while git shows
those migrations as untracked, and a teammate pulling this branch has an empty
database by comparison. B3 added no migration, so this is unchanged from B2. Probe rows were all cleaned up (`orphans platform-wide:
0`), and the customer-erasure test ran inside a rolled-back transaction, so no
real tenant data was touched.

### What has NOT been clicked

The surfaces have never been opened in a browser. Everything under them is
exercised — the service layer, the ingestion, the events and the report all have
probe coverage against the real database — but no one has looked at the pane.

That is the exact gap [[feedback_test_as_a_business_owner]] describes, and the
things it usually catches are the things a typecheck cannot: whether the ladder
reads as a shape at pane width, whether "Nothing to compare yet" is the right
sentence in the place it lands, and whether the activation tooltip is discovered
before the disabled button frustrates somebody. Worth a pass with the dev server
up and a seeded campaign.

### B5a — the patience field, found by counting files _(2026-08-26)_

Brandon noticed after committing B5 that the sparx surface is 5 files against
piggles' 17, and asked whether they were at parity. **The file count was not the
defect** — the two sets are 1449 and 1567 lines, the exports map one to one, and
the split is piggles' RULE #0.5 (250 lines a file, 50 a method) doing exactly
what it is for, against sparx's explicit "there is no line-count target."

Checking the question properly turned up a real gap, and it was in BOTH consoles:
**`stallAfterHours` was in the `Funnel` type, in `UpdateFunnelBody`, accepted by
the API and read by the abandonment sweep, and no surface anywhere rendered or
edited it.** [[feedback_fetched_but_never_rendered]] again, and this time the
value was already typed in the component's own hand.

It matters more than a missing field usually would: that column is the ONLY
thing deciding when `funnel.abandoned` fires for a given campaign. Without the
control, every campaign silently runs on its kind's default and a B2B quote on a
30-day cycle has no way to say so — the per-funnel column added in B4 was
decoration.

**The API sends `defaultStallHours`, not the resolved patience.** The first cut
sent the resolved value and it was wrong: once a campaign has an override the
resolved value IS the override, so the editor would have labelled its
"use the usual" option with the number the owner had just chosen. What the
editor needs is the kind's default, which is also the thing it must not mirror
locally — `DEFAULT_STALL_HOURS` keeps one home and the client is told.

**Hours are stored and never shown.** The sweep works in hours; nobody describes
a fortnight's patience as 336 of them. `hoursLabel()` renders the span the way a
person says it and the control offers a fixed set of spans, because the
alternative — a number box — invites `0`, and a campaign that gives up instantly
is not a thing anyone means.

_Verified:_ tsc + eslint clean on `@sparx/workbench`, `@piggles/console`,
`@wizeworks/funnels`, `@wizeworks/api-rest`; `check:routes` (340 surfaces),
`check:events`, `check:boundaries`; and a 12/12 probe against the real database
whose load-bearing assertion is that with an override of 720h set, the reported
default is still 336h rather than an echo of the override.

_Still not clicked_ — see below. This closed a gap a typecheck could not see;
it did not close the one a browser would.

### Verification that was run, and how

- `wizeworks/packages/commerce` — tsc + eslint clean, 98/98
- `wizeworks/services/api-mcp` — tsc clean, 13/13
- `wizeworks/packages/email-worker` — 40/40 (this is the delivery-gate coverage
  test; it is the one that proves the new template will not be silently dropped)
- `wizeworks/packages/email`, `wizeworks/services/api-rest`, `sparx/apps/web` — tsc clean
- `piggles/apps/web` — tsc clean, eslint clean over `components/marketing/tools`
  and `app/tools`
- `node scripts/check-boundaries.mjs` — green (`@sparx/*` under `piggles/`: 0)
- `node scripts/check-deletability.mjs` — green (8 Piggles packages reach 44
  workspace packages, none of them sparx's)
- `wizeworks/packages/funnels` — tsc + eslint clean, **29/29** (13 added in B3
  for the view rung, `stagePath` and `pathForSlug`)
- `wizeworks/services/api-rest` — tsc + eslint clean after B3
- **The B3 probe — 28/28 against the real database.** Not a committed test: a
  throwaway script that built a funnel, a landing page and fake pageviews, then
  deleted them. Kept out of the repo on purpose (no automated UI/integration
  suites here), but it is the only thing that caught either of B3's two bugs.
- `prisma validate`, `check:events`, `check:routes`, `check:docker`,
  `check-migration-order` — green
- `pnpm --filter @wizeworks/db db:rls-audit` — 436 tables audited, 403
  tenant-scoped, no findings
- prettier — clean. **It has no parser for `.prisma`** — use
  `prisma format --schema prisma/schema` for those, and read the next paragraph
  before you do.

**`prisma format` reflows every `/** \*/`doc comment in the whole schema
directory**, not just the file you edited. On this change it rewrote three files
the work never touched and 1,406 lines of`02-tenant.prisma`. Revert what you did
not mean to touch and re-apply your own edit by hand; the funnels schema diff is
25 added lines and 3 changed ones once that is done.

**`api-rest` and `sparx/apps/web` need a bigger heap than the default**, or `tsc`
dies with "Ineffective mark-compacts near heap limit" and exits in a way that can
be mistaken for success:
`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.json`.

### The two planning artifacts

The analysis and the build plan were published as artifacts before this doc
existed. They hold the funnel-pattern research (with sources) and the
phase/slice reasoning in fuller form than the summaries here:

- Analysis: https://claude.ai/code/artifact/d65b906d-0ecf-497a-858f-4e4d201af753
- Build plan: https://claude.ai/code/artifact/9fc77430-8253-426d-b8fd-df3d8800dcb6

### Immediate next step

**Phase A and B1-B6 are finished.** Next is **B5**, the workbench surfaces in
both apps — see the RESUME HERE pointer at the top.

All 309 migrations are applied to the local database and the client is
regenerated; `prisma migrate status` reads "Database schema is up to date".

Things worth carrying forward from this session:

- **The root `postinstall` runs `prisma generate`.** So `pnpm install` is a
  DB-adjacent command here, not a neutral one: adding a workspace dependency
  regenerates the client for the whole running stack, and for a while that left
  the client one migration ahead of the database. If the dev server is up, adding
  a dependency needs the same care as a migration.
- **A guard can be blind and still print green.** `check-event-topics.mjs` strips
  comments with `//.*$`, and `.` does not match a CR, so on a CRLF file it strips
  nothing, stops at the first comment containing a semicolon, and validates about
  a dozen of 300+ event names. Nothing about the output says so. Fixed by
  stripping CR first, and the fix was verified by making the check go RED for a
  real missing topic before the topics were added.
- **Prettier writes LF; a Python round-trip on Windows writes CRLF.** Two files
  were converted before this was noticed. `.gitattributes` normalizes on commit,
  so the diff stays clean and the damage is invisible in `git diff` — it shows up
  only in tools that read the working file, like the checker above.

- Edit `.ts`/`.tsx` here with the file-editing tools, never shell heredocs or
  `node -e`. Template literals and backticks in these sources get mangled by
  shell quoting, which silently produced a broken `value:` in one file before it
  was caught by reading it back. The same hazard bit once more from the other
  direction: a **backtick inside a SQL comment** in a `$executeRaw` template
  literal ends the string, and tsc reports it as a syntax error two lines later.
- **zod 4 validates UUID version and variant nibbles; Postgres does not.** A
  fixture like `11111111-1111-1111-1111-111111111111` is accepted by the database
  and rejected by the schema, so a test can fail for a reason that has nothing to
  do with what it is testing. Use a real v4 shape:
  `11111111-1111-4111-8111-111111111111`.
- **Verify by running it, not by reading it.** B2's missing cascade typechecked,
  linted, passed 16 unit tests and read correctly — and was only found by
  creating a funnel, deleting it, and looking at what was left behind.
- **Two decisions in A3 are still untested against a real inbox**, because
  nothing has been sent: whether a multi-line value (generated markup, a
  manifest) reads acceptably as one `EmailParagraph`, and whether the 4000-char
  cap is generous or mean in practice. Both are cheap to check the first time
  the email-worker runs against the console provider in dev, and both are
  cosmetic rather than structural.
- The card itself IS now verified in a browser on both brands (§2 A3). What is
  not verified is anything past the submit button: no address has been entered,
  so `/v1/public/tools/deliver`, the CRM contact write and the rendered email
  have not run end to end even once.
