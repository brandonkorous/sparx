# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## RULE #0 — finish the whole surface; never explain a gap you could close

**The unit of work is the entire surface, not its hardest or most interesting part.** A site is
ALL of its pages; a module is every screen and state; a committed capability is its whole surface.
"Done" means every part is built to production quality — not a representative slice with the rest
left as the generic base, a stub, or a "later." Shipping the headline part and reporting done while
the boring parts are still stock is an **unfinished** deliverable that reads as finished, which is
worse than an obviously partial one because it hides the gap.

**Before you start:** enumerate the parts (list every page/screen/state). That list is the
definition of done. **Before you say done:** re-check the list — if any part is still stock/base/TODO,
it is not done, so keep going.

**Never substitute an explanation for the work.** If you know what needs doing and doing it is
available, DO IT — do not narrate why it isn't done, do not ask permission for the obvious
continuation, do not deliver a slice plus a note describing the gap. Explaining a gap costs more
than closing it. The reliable tell that you are about to under-deliver: you're writing a paragraph
about scope instead of building. Stop writing, start building.

This rule sits above the others because monochrome-minimum output satisfies every _prohibition_ at
once (RULE #4 makes the same point about color); completeness is the thing nothing else forces.

## RULE #1 — silicaui first, Tailwind second, everything else needs approval

**Build every UI on silicaui.** Reach for a `@wizeworks/silicaui-react` component and its
`color × variant × size × shape` props before anything else. **Tailwind utility classes are also
allowed** — layout, spacing, sizing, positioning, one-off chrome. That is the whole sanctioned
toolbox.

**Why this rule exists — the single point of change.** silicaui is the design system; feature code
**chooses**, it does not **paint**. Change `--color-primary` once and every button, badge, tab, link
and focus ring across workbench, web and market follows. Change `--radius-field` and every input
re-shapes. Add a hover treatment to `.btn` and the whole platform gets it — no hunting, no sweep, no
migration PR. **That propagation is the entire reason silicaui was built, and it holds only where
nothing downstream has painted over it.** Every local override is a place the change stops and a
place someone has to find later. The test on any UI you write: _if a token or a component changed
tomorrow, would this screen follow with zero edits here?_

**This is not "never improve" — it is "improve where it propagates."** When a silica default is
genuinely wrong: (1) check for a prop (`get_component` — there usually is one); (2) if it's a value,
change the token in `@sparx/brand/theme.css`; (3) if it's a missing variant or component, add it to
silicaui or a composition to `@sparx/ui`; (4) only then, with approval, a local exception documented
as debt. **A call-site patch is not a fix — it is a deferred fix everyone else pays interest on.**
Full contract + ownership table: [DESIGN.md](DESIGN.md).

**Anything that is not silicaui or Tailwind requires Brandon's explicit approval, asked for
up front — not shipped and explained afterwards.** That includes: a new dependency or component
library, a hand-rolled replacement for something silicaui already provides, a bespoke CSS file,
and any inline `style` that paints a control.

**If you are touching a file that does it the old way, migrate it** — don't match the surrounding
mistake. And never "re-skin" a silicaui component:

```tsx
// NEVER — an inline hex fill on a control. Stays black inside a dark themed
// island, ignores the token system, and is exactly what this rule exists to stop.
<Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>Start free</Button>

// ALWAYS — props resolve to the plugin's real classes: `btn btn-neutral btn-lg`.
<Button color="neutral" size="lg">Start free</Button>
<Button color="module-commerce" size="xl">Start selling</Button>   // module hues are registered colors
<Button variant="outline" size="lg">Talk to sales</Button>         // inside <Section surface="dark">, the
                                                                   // theme island resolves border + ink
```

Colors come from tokens, never hex: `--color-neutral`, `--color-primary`, `--color-module-<slug>`
(all registered with the plugin in each app's `globals.css`). A hardcoded hex cannot respond to
light/dark, so it is wrong even when it looks right on the screen you tested. There are exactly
**two** sanctioned literal-hex contexts, both because a token genuinely cannot express the value:

1. **Edge-runtime OG images** — Satori can't resolve CSS custom properties; those read `MODULE_HEX`
   from `@sparx/brand`.
2. **Other companies' brand marks** — Pinterest red, Facebook blue. They are not ours, mean nothing
   else, and have no light/dark variant to respond with. Confined to
   [apps/workbench/components/platform-mark.tsx](apps/workbench/components/platform-mark.tsx)
   (approved 2026-07-28); the glyph on them is fixed white, which is theme-independent by
   construction. Do not let this spread — a third-party logo is the only thing it covers.

Detail: [packages/ui/CLAUDE.md](packages/ui/CLAUDE.md), [docs/35-ui-variant-system.md](docs/35-ui-variant-system.md).

## RULE #2 — no eyebrows, no eyebrow badges, no editorial formatting

**Nothing sits above a heading to introduce it.** No kicker, no label, no category chip, no
`01 / 02 / 03` step marker, no uppercase-mono micro-caps — and **no `<Badge>` used as one either.**
Swapping an uppercase `<span>` for a `<Badge>` in the same slot is the same anti-pattern wearing a
component; the ban is on the _slot_, not the markup.

```tsx
// NEVER — all four are the same eyebrow.
<span className="font-mono text-xs uppercase tracking-wide">Confident</span><h3>…</h3>
<Badge color="success" variant="soft">Confident</Badge><h3>…</h3>
<span>01</span><h3>…</h3>
<p className="uppercase">How it works</p><h2>…</h2>

// ALWAYS — the heading carries itself; hierarchy comes from scale, weight, and color.
<h3>…</h3>
```

**No editorial formatting** either: no pull quotes, no drop caps, no rules/dividers used as
decoration, no magazine-style label columns. This is product marketing, not a magazine spread.
A `<Badge>` is for **state on a thing** (`<Badge color={statusTone(s)}>` on a row, a card, a
record) — never a decorative label introducing a section.

## RULE #3 — soft/muted/transparent is a deliberate signal, not a default

**Text:** never `soft`, `muted`, `/opacity`, or a `color-mix(… , transparent)` ink on anything a
person is meant to READ. Readable text gets a real ink token (`--color-base-content`, or the
surface's `-content`). Faded text is reserved for text deliberately not meant to be read —
decorative watermarks, disabled controls, a de-emphasized duplicate.

**This is not an instruction to write `text-base-content`.** On a component, that ink token is
already resolved for you from `color × variant` — reach for the component's `color` prop, never a
text-color utility on top of it (RULE #4). For bare prose it is inherited from `body`. If a silica
component genuinely renders readable text too faint at rest, that is a silica-level issue to raise,
**not** something to patch per call site — patching it is how `<TabsTab className="text-base-content">`
spread to 5+ workbench call sites.

**Backgrounds:** the same. `bg-soft` is **not** part of the primary theme — it is an accent applied
on purpose, to the ONE thing that earns it. Applying `soft` everywhere drains the exact power it
exists for and flattens the design system into mush. **If everything were meant to be soft, soft
would be the theme color.** It isn't.

Practical test before typing `soft`/`muted`/`/opacity`: _what is this de-emphasized relative to,
and is that contrast actually doing work on this screen?_ If the answer is "nothing in particular,
it just looked nicer," use the real token. Hierarchy comes from **scale, weight, and color** —
not from fading things out. Related: [DESIGN.md](DESIGN.md), and the
base font floor of 16px for body text.

## RULE #4 — neutral has to be earned

**A screen where everything is the same color is a design failure**, with the same weight as a
gradient hero. Rules #1–#3 are prohibitions, and monochrome is the one output that satisfies every
prohibition at once — so grey is what gets built unless something requires otherwise. This rule
requires otherwise.

`color="neutral"` is a decision, not a default. It is earned by the chassis (backgrounds, borders,
dividers), bare prose you authored yourself, the dismiss half of a decision pair, or a genuinely
untyped value — **nothing else.** If an element distinguishes A from B, its color carries the
distinction; two badges that mean different things and render the same grey are wrong, not safe.

**"Readable ink" does NOT mean `text-base-content`.** A silica color class only sets CSS variables
(`--btn-fg`, `--tabs-accent-content`, …); the component paints itself from them, so its foreground is
already resolved from `color × variant` and stays correct on fills, soft tints, outlines and dark
islands. Writing a text color onto a component overrides that and is a RULE #1 re-skin — set its
`color` prop instead. Bare prose needs nothing: `body` sets `color: var(--color-base-content)`, so it
inherits. Write a text color only to deliberately color bare text (`text-module`, `text-success`).

There are **27 registered colors** (10 semantic + 18 module identities), but `SilicaColor` is
`… | (string & {})`, so autocomplete shows 8 and TypeScript catches nothing. Pick from the real
list, not the one the editor offers.

**The positive form — color IS the design, not decoration on it.** A filled tab says _you are here_
faster than a label can be read; a solid button says _this is the point_ before the eye reaches the
word. So: **selection is a filled shape, not a 2px underline** (`<Tabs variant="pills">`); **the
action a surface exists for is solid and colored**, never `outline`/`ghost`; and **if every row in a
list says it, it cannot be the headline** — lead with what differs, demote the repeat to a badge.
The test: _when the color is right, the explanation becomes redundant._ **If adding color didn't let
you delete any words, you decorated rather than designed.** Worked before/after: [DESIGN.md](DESIGN.md) §5.

Full palette, the per-element assignment table, the ship gate, and a worked example:
[DESIGN.md](DESIGN.md).

## Repository status

The repo is **substantially built out**. Alongside the design docs under [docs/](docs/), the platform ships **5 Next.js apps** (`workbench`, `site`, `market`, `web`, `admin`; only `b2b-portal` is still an empty placeholder — `dashboard` has been **removed**, superseded by `workbench`), **~18 services** (`api-rest`, `api-graphql`, `api-mcp`, `mcp-site`, + a worker fleet), **~60 packages**, and a Prisma schema of **~277 models across 164 migrations**.

`apps/admin` is the **WizeWorks-staff console** (not a tenant surface): ~72 components under `(auth)` + `(console)/sparx/*` covering tenants, users, sites, domains, billing, partners, bootcamps, feedback, support and metrics. It is also **the only remaining consumer of `@sparx/ui`** (71 files; `apps/web` 14, `apps/site` 2). `apps/workbench` — the flagship — depends on `@sparx/ui` **not at all** and imports silicaui directly.

`@sparx/ui` is **not** a general component library and must not be treated as one: it is a small set of sparx-specific compositions over silicaui. Anything silicaui already ships has been deleted from it (see [packages/ui/CLAUDE.md](packages/ui/CLAUDE.md)) — reach for `@wizeworks/silicaui-react` first, always.

> **Start at the knowledge brain — [docs/brain/README.md](docs/brain/README.md).** It is the canonical, grounded, interlinked map of everything below (design, architecture, data, modules, infra, integrations, conventions…) with a task-router that tells you which nodes to read before a given kind of work. This file is the binding summary; the brain is the navigable detail, and its notes hard-link the real source-of-truth files.

Don't claim builds/tests pass without actually running them.

### Pre-push guard

`pnpm install` wires `git config core.hooksPath .githooks` (via the root `prepare` script), which enables [.githooks/pre-push](.githooks/pre-push). Every `git push` first runs `pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (plus the `@sparx/db` RLS audit) against the working tree. The test step runs with `CI=true`, so it excludes the DB-backed integration suites CI also excludes — the guard is never stricter than CI, which is what keeps it from being bypassed. A red local check blocks the push — this is intentional: CI on `main` is the production tripwire, not a debugging surface. Fix the failing check before pushing — `--no-verify` is not an acceptable bypass.

### File & function size

**There is no line-count target.** Cohesion is the only rule: one file, one responsibility; one function, one job. **Split when a unit takes on a second responsibility — never to hit a number.** Three files that only call each other read worse than one, and a form split across components so each piece stays "small" is how a field ends up owned by two different components at once.

A single coherent unit is easier to hold in one piece than to reassemble from fragments, so prefer keeping it whole. This is self-governed, not ESLint-enforced — `max-lines`/`max-lines-per-function` are deliberately absent from [eslint.config.js](eslint.config.js).

## What this product is

sparx (sparx.works) is WizeWorks' modular content and commerce OS — a single platform combining site building, commerce, CRM, CMS, email, B2B/wholesale, dropship, and MCP/AI integration. It serves content, commerce, or both: a CMS-only publisher, a CRM-only team, and a B2B distributor are all equally first-class — selling is one capability, never the assumption. Modules activate independently; a tenant pays only for what they use. The first Enterprise client driving the initial feature set is **Gillett Diesel Service** (B2B + fleet + MCP requirements), but the platform is not commerce- or industry-specific.

Read [docs/00-README.md](docs/00-README.md) first — it is the table of contents for everything else.

## Documentation map (read these to make any non-trivial decision)

Numbered docs are intended to be read in order. Group them by what you're doing:

- **Orienting / "why":** [01-platform-vision.md](docs/01-platform-vision.md), [02-architecture-overview.md](docs/02-architecture-overview.md)
- **Infra & ops:** [03-infrastructure-deployment.md](docs/03-infrastructure-deployment.md), [04-domain-ssl-automation.md](docs/04-domain-ssl-automation.md), [20-operational-runbook.md](docs/20-operational-runbook.md), [21-cost-scaling-guide.md](docs/21-cost-scaling-guide.md)
- **Data & APIs:** [05-data-model.md](docs/05-data-model.md), [06-api-specification.md](docs/06-api-specification.md), [07-mcp-server-spec.md](docs/07-mcp-server-spec.md), [22-typesense-search-spec.md](docs/22-typesense-search-spec.md)
- **Per-module PRDs:** 08 (site builder), 09 (e-commerce), 10 (B2B), 11 (CRM), 12 (CMS), 13 (email), 14 (dropship), 15 (onboarding)
- **Cross-cutting:** [16-auth-security.md](docs/16-auth-security.md), [17-billing-subscriptions.md](docs/17-billing-subscriptions.md), [18-frontend-architecture.md](docs/18-frontend-architecture.md), [19-testing-strategy.md](docs/19-testing-strategy.md)
- **Design:** [sparx-brand-guide.md](docs/sparx-brand-guide.md), [sparx-design-tokens.css](docs/sparx-design-tokens.css)

## Non-obvious conventions that will bind future code

These are architectural commitments that won't be obvious from reading individual files — they cut across modules, so flag any change that violates them:

- **Multi-tenancy is enforced at the database level via PostgreSQL Row Level Security.** Every tenant-scoped table has `tenant_id`; RLS policies are the backstop against application bugs. Do not assume application-tier filtering is sufficient.
- **Auth is Better Auth, self-hosted — not Auth0, Clerk, or any SaaS.** Better Auth organizations map 1:1 to sparx tenants (the tenant Prisma model _is_ the Better Auth `organization`). There are **two instances**: staff (Layer 1, globally-unique email) and shopper (Layer 2, per-`(tenant,email)`). Use Better Auth's **org-membership** primitives rather than building a parallel system — but note **API keys are a custom implementation** (`packages/auth/src/api-keys.ts`, `sk_live_*`, SHA-256) and **MFA is not yet implemented** (no `twoFactor` plugin). Detail: [docs/brain/architecture/better-auth.md](docs/brain/architecture/better-auth.md).
- **Modules are feature-flagged, not separately deployed.** A disabled module returns 404 with a clear error, runs no workers, and stores no rows. Activation is event-driven (`module.activated` on Pub/Sub) — never gate features by checking subscription rows inline.
- **Event-driven side effects via Google Pub/Sub.** Business events are published and consumed by workers; don't inline side effects in request handlers. The catalog is the `EventType` union in [packages/events/src/types.ts](packages/events/src/types.ts) and **topic name == event type** — use the real names (e.g. `order.placed` / `order.paid` / `email.send` / `email.domain.verified` / `search.entity.changed`). There is **no** `order.created` or `customer.updated`. Detail: [docs/brain/api-events/event-catalog.md](docs/brain/api-events/event-catalog.md).
- **Infra is phased — start cheap.** Phase 1 uses Redis in a GKE pod (not Memorystore). Two original Phase-1 substitutions have since been deliberately superseded: **Typesense is live** (not Postgres full-text search — a documented deviation for fitment-faceted search; Elasticsearch remains Phase 3), and email runs on **Mailgun** (not Postal, now decommissioned; still not SendGrid). [docs/03-infrastructure-deployment.md](docs/03-infrastructure-deployment.md) §3 + [docs/brain/infrastructure/phased-infra.md](docs/brain/infrastructure/phased-infra.md) track the triggers + deviations. Don't propose Phase 2/3 services without a stated revenue/scale trigger.
- **Email sends via Mailgun on `sparx.email`.** Not SendGrid, Postmark, or SES. (Self-hosted **Postal** was the original Phase-1 choice and is now **decommissioned** — its code + `k8s/postal/*` linger as a fallback/cleanup candidate.) `sparx.mx` was the original domain plan; it was already registered to someone else, so `sparx.email` is both the sending domain and the merchant-facing transactional address. Detail: [docs/brain/integrations/mailgun.md](docs/brain/integrations/mailgun.md).
- **Outbound email defaults to publishing `email.send` to Pub/Sub.** `email-worker` ([services/email-worker/](services/email-worker/)) consumes events, renders via `@sparx/email`'s React Email templates, and POSTs to the configured provider (console in dev, Mailgun in prod). New callers MUST publish events — direct calls to `sendTemplate()` / `sendEmail()` from `@sparx/email` are an escape hatch reserved for synchronous-required flows only (OTP codes, future 2FA). Adding a non-OTP direct send requires justification in the PR description.
- **Email templates compose atomic components.** All email templates live in [packages/email/src/templates/](packages/email/src/templates/) inside `<EmailLayout>`, composed from the atomic components in [packages/email/src/components/](packages/email/src/components/) (`EmailHeading`, `EmailParagraph`, `EmailButton`, `EmailLink`, `EmailMuted`, `EmailCallout`, `EmailWordmark`). Templates MUST NOT inline raw `style={...}` props — extend a component instead, or add a new token in `components/tokens.ts`. Plain-text bodies are auto-generated by React Email's `render({plainText: true})` — never hand-write them.
- **MCP server is a first-class service**, not a plugin or afterthought — [docs/07-mcp-server-spec.md](docs/07-mcp-server-spec.md).
- **API-first.** Every UI feature must exist as an API endpoint first; the dashboard is one consumer among many.
- **The builder's component list IS the data-driven catalog — not hardcoded types.** Common/comprehensive components are composed `BuilderNode` trees in [packages/builder-schemas/src/catalog/](packages/builder-schemas/src/catalog/) (data-as-code; authoring contract in `catalog/CONTRACT.md` + `_kit.ts`), surfaced directly in the Add palette and **stamped (forked)** into the page — never new registry types or renderer branches. daisyUI is a breadth/naming reference (no competitor names ship), and where a component pattern has well-known descriptive class names we adopt them: the **navbar is a real component** — a `<nav class="navbar">` with `navbar-start`/`navbar-center`/`navbar-end` zones whose CSS is verbatim daisyUI (side zones `width:50%`, center `flex-shrink:0`), defined in [packages/surface-compile/src/theme.ts](packages/surface-compile/src/theme.ts) `@layer components`. There is ONE navbar primitive (not a "centered" variant) — centering the brand is moving the Wordmark into `navbar-center`. The common/comprehensive split follows: the catalog's bare `navbar` (common) is JUST the bar + three EMPTY zones; a pre-filled `navbar_brand` (brand + nav + action) is a separate **comprehensive** entry — the bare navbar never carries content. The seed factory `navbar()` in [packages/builder-schemas/src/site-chrome.ts](packages/builder-schemas/src/site-chrome.ts) (used by the starter + every blueprint) emits the same classes, populated, so the default ships a real header. A site "header" is just a navbar at the top of the layout — placement, never a type. `PLATFORM_ARCHETYPES` is removed; the catalog is the platform library, `BuilderArchetype` is purely tenant-authored. A **site layout is a free canvas** whose only required node is the `Outlet` (`pinned` — never deletable or draggable); header/footer/sidebars are author-composed and fully deletable. See [docs/98-builder-customization-rebuild.md](docs/98-builder-customization-rebuild.md) §5 + §3.7.
- **Builder node ids must be globally unique, not a from-zero counter.** `makeId` in [apps/dashboard/app/(dashboard)/builder/\_builder/model.ts](<apps/dashboard/app/(dashboard)/builder/_builder/model.ts>) carries a random base (not just a session counter): ids are **persisted** with the tree AND used as React keys + dnd-kit sortable ids, so a counter that resets every page-load/HMR re-mints the same id and collides with already-saved nodes — which trips React's duplicate-key guard and **silently disables layer drag-reorder** (dnd-kit requires unique ids). Any new id minting (stamp/add/paste/clone) must preserve global uniqueness.
- **Onboarding goal: live store in under 5 minutes.** Any onboarding-flow change that adds steps or friction needs justification — see [docs/15-merchant-onboarding-prd.md](docs/15-merchant-onboarding-prd.md).
- **Migrations go through the pipeline, not your laptop** — every managed instance is private-IP/VNet only, so the only thing that can reach one is already inside the cluster. Author against docker Postgres, push to `main`, and [release.yml](.github/workflows/release.yml)'s **data** stage applies it before the containers roll. RLS/`current_tenant_id()` are hand-edited SQL, not Prisma-generated. **Migration directory names must be MONOTONIC**: Prisma orders migrations lexicographically by name, and this repo's hand-authored timestamp prefixes run ~6 months ahead of the real clock (`20270131…` was committed 2026-07-31), so `prisma migrate dev` stamps a name that sorts BEFORE 241 applied migrations and `migrate deploy` refuses the release. The drift cannot be renamed away — the name is the key in `_prisma_migrations` on every deployed database — so a new migration must simply sort after the newest existing one. CI enforces it ([scripts/check-migration-order.mjs](scripts/check-migration-order.mjs)). Full mechanics + the FORCE-RLS backfill footgun in [packages/db/CLAUDE.md](packages/db/CLAUDE.md).
- **There is ONE release pipeline, and its stages are the deployment.** [release.yml](.github/workflows/release.yml) runs **infrastructure → data → containers → cleanup** on every push to `main`, and that order is load-bearing: Terraform applies first, then schema AND rows, then the images, then the pruning. Data before containers is the point — if the seed fails, the old containers are still serving. **The destination is a variable, never a filename**: resource group / cluster / namespace / overlay / terraform dir are resolved once by the `target` job from environment variables, so adding an environment is setting variables rather than forking a file. This replaced 20 workflows (an eight-file provider-doubled set — `deploy-azure`/`deploy-gcp`, `db-migrate-azure`/`db-migrate-gcp`, …) whose only real variance was three strings. **Never put a task name in the release** — `ingest`, `purge-themes`, `crm-backfill` and anything like them belong in the manual [ops.yml](.github/workflows/ops.yml), or the pipeline stops describing how the platform ships and becomes a list of chores. GCP is deleted as workflows; `terraform/envs/prod` stays as code and stays `validate`-clean. Map: [.github/workflows/README.md](.github/workflows/README.md).
- **Releases are automated via tags, not PRs — and the tag is cut LAST.** Tagging is the `tag` job inside [release.yml](.github/workflows/release.yml), gated on the stages, so a `v*` tag means the version actually shipped rather than merely that someone pushed a `feat:`. It was its own workflow on the same push trigger, which is how `v1.195.0` came to sit on a commit whose build and deploy both failed. Bumps: `feat:` → minor, `fix:` / `perf:` → patch, `feat!:` or `BREAKING CHANGE:` footer → major; `chore / docs / refactor / ci / build / test / style` don't bump. Force one with the `bump` input, or suppress it with `bump: none`. `contents: write` is scoped to that job alone — the rest of the release runs on `contents: read`. **Tagging dispatches nothing.** No bot ever opens a PR; code-change PRs remain a human gate as normal.

## Brand & design (binding for any UI work)

- **The dashboard design system runs on silicaui (`@wizeworks/silicaui*`).** Styled primitives (`Button`/`Badge`/`Card`/`Input`/`Select`/`Table`/`Tabs`/`Dialog`/`Alert`/…) come from **`@wizeworks/silicaui-react`**; the `@wizeworks/silicaui` Tailwind plugin (wired per app in `globals.css`) emits the color + component classes (`btn-*`, `badge-*`, `bg-primary`, `bg-soft`, …); color tokens live in **`@sparx/brand/theme.css`**. **`@sparx/ui` is down to 22 modules / a 32-name surface and must not be grown back into a component library** — `cn`/`cva`, `ModuleProvider`, `useTheme`/`useMediaQuery`, the brand wrappers, five kept primitives (`Button`/`Badge`/`Heading`/`Text`/`Spinner`), `Card`, `Stack`, `PageHeader`, `SidebarAppShell`, `Tooltip`, `ConfirmProvider`/`useConfirm`, `toast`/`Toaster`, `TopProgress`, `Table`. Everything silicaui ships was deleted from it, and so was the whole `apps/dashboard` composition set (`SurfaceFrame`, `ListToolbar`, `ListPageShell`, `SelectionList`, `BulkActionBar`, `FilterBar`, `ActionTile`, `DataTable`, `Modal`, the chart wrappers, …) — orphaned by the workbench cutover, which rebuilt each concept in its own idiom. The hand-rolled `.sx-c-*` role-var recipe + the `--sparx-*` / `--color-bg-*` / `--color-surface-*` token set are **gone**; `packages/ui/src/tokens.css` keeps only non-color tokens (type/space/radius/shadow/motion) + `--chart-*`. Detail: [packages/ui/CLAUDE.md](packages/ui/CLAUDE.md) + the [[project_silicaui_migration]] memory.
- **A component's _appearance_ lives in the component library; feature code never re-skins a control — but it may compose layout with utilities.** Feature code in `apps/*` uses named component variants (`<Button color="primary" variant="soft">`). Layout/positioning/spacing/sizing utilities and one-off chrome (e.g. an `absolute top-0 right-0` indicator) are fine in feature code. The banned pattern is **re-skinning a control**: a background fill paired with a foreground text color (or hand-built `hover:`/`focus:`/`disabled:` states) = recreating a `<Button>`/`<Input>`/`<Badge>` — use the silicaui primitive/variant instead, or add a composition to `@sparx/ui`. ESLint flags exactly that fill+foreground fingerprint (a warning), not raw utilities in general — **a warning is NOT the enforcement mechanism; RULE #1 at the top of this file is.** 54 re-skinned `<Button style={{ backgroundColor: '#0A0A0A' }}>` call sites accumulated across `apps/web` under that warning before being migrated on 2026-07-18. See [docs/23-frontend-component-architecture.md](docs/23-frontend-component-architecture.md) §1 and §15, plus the multi-axis variant system in [docs/35-ui-variant-system.md](docs/35-ui-variant-system.md).
- Controls are still **four-axis `color × variant × size × shape`** (never a flat enum), but resolution is now silicaui's plugin-emitted classes — `<Button color variant size>` → `btn btn-<color> btn-<variant> btn-<size>` (silica spells `dashed` as `btn-dash`) — not the old `.sx-c-*` role vars. Every variant references a silica token CSS var (`--color-*`, never a hardcoded color). Module color shifts automatically via `<ModuleProvider module="…">`, which sets `--color-module` (+ `-content`) on its subtree. The sparx wordmark keeps the **"x" in sparx Ember `#e04631`** (the brand primary — `--color-primary`; note this SPLIT from the Builder module hue, which stays Indigo `#6366F1`). Build mechanics, the silica-class mapping, tints-via-`soft`, and house decisions live in [packages/ui/CLAUDE.md](packages/ui/CLAUDE.md). **Brand marks are centralized in `@sparx/brand`** — the spark/wordmark/mascot geometry + `BRAND` color constants in [packages/brand/src/marks.ts](packages/brand/src/marks.ts), the React components (`Spark`, `Wordmark`, `SparkMascot`) at `@sparx/brand/react`. `@sparx/ui`, market, and the marketing site all re-export from there; edge OG routes import the constants. Change the art in ONE place — never re-inline SVG paths or the wordmark's "x" hex in a component or OG route.
- Per-module colors (Builder=Indigo, Commerce=Orange, CMS=Teal, CRM=Cyan, etc.) live in `@sparx/brand/theme.css` as `--color-module-<name>` and appear identically across the module's marketing site, its sidebar nav item, and the subtle module-tint background on `<Card variant="module">` cards (`bg-module bg-soft` — a theme-aware `color-mix` into the surface via silica's universal `soft` treatment, formerly a 3px top stripe; there are no baked tint tokens). Full list in [docs/sparx-brand-guide.md](docs/sparx-brand-guide.md).
- **Color follows functionality, not the page — there is NO "one hue per screen" rule** (the earlier DESIGN.md framing, "the active module's color is the only brand color on screen," was wrong and is corrected). The active route tints the chrome + page-level primary action; any panel/badge/action that surfaces _another_ module's functionality wears THAT module's hue via a **nested `<ModuleProvider module="…">`** (a product page's inventory panel is amber, its SEO panel yellow, a linked customer cyan). One screen legibly carries several module hues — carried by the _signals_ (module-tinted cards, primaries, key badges/icons) while the chassis (page background + non-primary cards) stays neutral. A module-tint background IS now a sanctioned signal, but a disciplined one: on a dense cross-module page tint only the **one "primary" card per module hue** and leave the rest plain (`<Card variant="module">` is the tint; `OverviewCard`'s `plain` prop is the neutral opt-out) — a wall of tinted cards is competing washes, not wayfinding. And a **single-module working surface** (create/edit form, wizard, editor) keeps its **card backgrounds** neutral — the tint differentiates nothing there, so identity rides the chrome + Save button (read-only detail/transaction views may keep one tinted KPI accent card). **This clause is about `<Card>` tint and NOTHING else** — it does not reach badges, tabs, buttons, icons, alerts or metrics, and it has never meant "this surface is monochrome" (misreading it that way is what produced the all-grey builder History rail; see RULE #4). Orthogonally, **state is its own color axis**: resolve status with `statusTone()` and render `<Badge color={statusTone(s)} variant="soft">`, and reach for soft semantic callouts (info/success/warning/danger) to break a wall of black-on-white into something scannable. The only banned use of color is decoration (a second brand hue for flavor, or a module color as a decorative background wash on the chassis). Detail in [DESIGN.md](DESIGN.md) (the palette, the three color axes, the per-element assignment table), [docs/35-ui-variant-system.md](docs/35-ui-variant-system.md) §9, and the `surface-review` skill's cross-module wayfinding heuristic.
- Tenant site themes override `:root` tokens via `--st-*` CSS custom properties (bridged to silica base tokens in `site-themes/tokens.ts`) — never edit `@sparx/brand/theme.css` for a tenant-specific change.
- **Detail surfaces show identity once + lifecycle in the header.** An entity's name/slug is its editable field, never ALSO a read-only heading atop the body; status + lifecycle actions (Publish/Archive/Preview/…) belong in the surface's own header chrome, never a bespoke in-body "Status" card — secondary actions go icon-only with a tooltip. Read-only/transaction details (orders, quotes, inventory ops) keep their identity heading (no editable name field). This is a **design rule that outlived its implementation**: `SurfaceFrame` / `DetailHeaderSlot` / `DetailPageShell` were `apps/dashboard`'s and are deleted, so the live expression is workbench's panes — see [docs/123-workbench.md](docs/123-workbench.md) and [apps/workbench/CLAUDE.md](apps/workbench/CLAUDE.md). [docs/86](docs/86-surface-frame-pattern.md) is retained as the rationale but is marked superseded. Also [DESIGN.md](DESIGN.md). **CMS editors are explicit-save only** — one Save button, last-write-wins, like every other editor. Autosave + ETag conflict detection were **removed** platform-wide (they were never consistent with the rest of the platform); an unsaved edit registers the leave-guard so closing/navigating away confirms before discarding.

## Document style

Every doc starts with a `Version`, `Author`, and `Last Updated` header. When editing a doc materially, bump the version and update the date. The author is Brandon Korous. Dates are absolute ISO (`2026-05-27`).
