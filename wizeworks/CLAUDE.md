# CLAUDE.md — WizeWorks shared platform

Guidance for Claude Code when working anywhere under `wizeworks/`. This file is
**binding** for shared-layer work. It sits between the root [CLAUDE.md](../CLAUDE.md)
(ownership model + universal rules) and the two brand files
([sparx/CLAUDE.md](../sparx/CLAUDE.md), [piggles/CLAUDE.md](../piggles/CLAUDE.md)).

This is the platform: everything both products run on and neither product owns.
It is the largest tree in the repo and the only one where a mistake is paid for
twice.

## RULE #0 — the dependency invariant

Three rules. They are the whole architecture, and everything else here follows
from them.

1. **`wizeworks/` may never import from `sparx/` or `piggles/`.**
2. **`sparx/` may never import from `piggles/`.**
3. **`piggles/` may never import from `sparx/`.**

The brands depend on the platform. The platform depends on nothing above it, and
the brands never see each other.

**Corollaries that are the same rule wearing different clothes:**

- **No brand conditionals.** `if (brand === 'piggles')` anywhere under
  `wizeworks/` is a boundary violation, not a shortcut. Brand-varying behaviour
  arrives as a **token**, a **registry entry**, a **lexicon lookup**, or a
  **policy object supplied by the caller** — never a branch.
- **No brand hexes.** Not one. Colours are tokens; the values live in each
  brand's theme package.
- **No product names in user-facing strings.** No "sparx", no "Piggles", no
  "Workbench". Anything a person reads comes from the brand's lexicon.
- **No brand vocabulary in identifiers.** A shared package called
  `@wizeworks/workbench-data` is already wrong — "Workbench" is sparx's word for
  it and Piggles calls it Home.

This is mechanically checkable, so it is checked: see **`check:boundaries`**
below. A boundary that exists only in prose is the one that erodes, and this is
the boundary the entire two-product model rests on.

## RULE #1 — the brand-blindness test

When deciding whether something belongs here, ask one question:

> **Would this file need editing if a third brand launched tomorrow?**

If yes, it does not belong in `wizeworks/`. That is the whole test, and it
resolves the cases people argue about:

- A pane's markup → **brand**. It expresses a design language.
- The query that pane runs → **shared**. It expresses a business rule.
- The list of which modules exist → **shared**. Every brand has the same ones.
- What those modules are _called_ → **brand**. sparx says CRM, Piggles says
  Customers.
- Which tokens exist → **shared**. What they equal → **brand**.
- Whether a capability is gated → **shared** mechanism. Whether _this_ brand
  gates it → **brand** policy.

The failure mode is always the same shape: something brand-specific gets written
here because it was convenient, and the second brand then needs a conditional to
undo it. If you find yourself about to write that conditional, the thing you are
undoing is in the wrong tree.

## What lives here

| Area            | Contents                                                                                |
| --------------- | --------------------------------------------------------------------------------------- |
| Data            | `db` (Prisma schema, migrations, RLS), `search`                                         |
| Identity        | `auth` (Better Auth, both instances, API keys), `entitlements`                          |
| Messaging       | `events` (the `EventType` catalog), `email` (templates + delivery)                      |
| Modules         | `commerce`, `crm`, `cms`, `inventory`, `b2b`, `finance`, `scheduling`, `dropship`, …    |
| Design contract | `brand-core` — which tokens exist, the attribute vocabulary, the module list            |
| Integrations    | `integration-framework` and every adapter                                               |
| Services        | all ~18 — `api-rest`, `api-graphql`, `api-mcp`, `mcp-site`, the worker fleet            |
| Apps            | `admin` (the WizeWorks staff console — ours by name), `site` (the tenant site renderer) |

**`apps/site` is here on purpose.** It paints the _tenant's_ brand, never ours,
so it is indifferent to whether the tenant signed up through sparx or Piggles.
A tenant site must render identically under either. This is also why the sparx
design restraints (no shadows, no gradients, RULE #3) do **not** reach it —
builder output is tenant content with full design freedom.

**`apps/admin` is here because it is literally the WizeWorks staff console**, not
a tenant surface. It administers both brands and belongs to neither.

### Scope rename in flight

Platform packages currently published as `@sparx/*` are being renamed to
`@wizeworks/*`. They were always brand-neutral in fact and never in name, which
is exactly the confusion this tree exists to end. Until the rename completes,
treat an `@sparx/*` import inside `wizeworks/` as a rename pending — not as a
boundary violation. New packages take `@wizeworks/*` from the start.

The scope is the boundary, self-documenting: **`@wizeworks/*` is brand-blind,
`@sparx/*` and `@piggles/*` are brand expression.**

## The design contract this layer owns

`brand-core` owns **existence**; each brand's theme package owns **values**.
Getting this split wrong in either direction is expensive, so it is spelled out:

**Shared — a brand must not redefine these:**

- Which semantic colours are registered (`primary`, `secondary`, `accent`,
  `neutral`, `info`, `success`, `warning`, `error`, `danger`) and the fact that
  every one is a `--color-{name}` / `--color-{name}-content` **pair**.
  `danger` is the N-th registered colour and exists because `statusTone()`
  returns it — drop the pair and `.badge-danger` renders colourless.
- The module list, and the fact that every module owns a `--color-module-<name>`
  / `-content` pair.
- The attribute vocabulary: `data-theme`, `data-module`, and the
  `--color-module` / `--color-module-content` indirection that `ModuleProvider`
  compiles to.
- The shape/type token _names_: `--radius-box`, `--radius-field`,
  `--radius-selector`, `--border`, `--depth`, `--font-sans`, `--font-heading`,
  `--font-mono`.
- `statusTone()`'s vocabulary — which states map to which semantic name.
- The surface-address contract: surface ids, addresses, deep-link shape. The
  API and MCP server address surfaces by id, so both consoles must satisfy the
  same contract or deep links and MCP addressing need a second scheme.

**Brand — never stated here:**

- Every colour _value_, including the module wheel. sparx gives each module its
  own hue; Piggles groups them. Both are valid because this layer only says the
  pairs must exist.
- Radius, type, and density _values_.
- Marks, wordmark, mascot geometry.
- The lexicon.

**Why `--color-module` matters more than it looks.** It is the indirection that
lets a shared surface emit `data-module="commerce"` and get the right hue under
either brand with zero brand awareness. A shared surface must always go through
it. Reading a module colour any other way — a JS colour table, an inline style —
is how sparx once ended up with white text at 2.80:1 on Commerce orange: the
inline style beat the selector, and the drifted copy won.

## How brand reaches the code

Both brands share one database and one tenant pool, so brand is a **runtime**
value, never a build-time constant. Two resolution paths, and shared code needs
both:

- **Hostname → brand**, for anything serving a request. The console and
  marketing sites resolve from the host.
- **`Tenant.brand` → brand**, for everything with no request context: the
  `email.send` worker consuming off Pub/Sub, OG image routes, invoices,
  receipts, and the Stripe webhook. `Tenant` is the non-RLS dispatch row, so a
  webhook can resolve brand before any tenant context is set — the same reason
  `stripeCustomerId` lives there.

A tenant belongs to the brand it signed up under and never changes brands.

## Entitlements are a mechanism here and a policy there

The two brands price differently — sparx charges per active module, Piggles
charges one flat rate with capacity limits — and they will diverge further. So:

- **Shared:** the entitlement service, the metering counters, the enforcement
  points, the Stripe integration.
- **Brand:** the plan shape. Whether a capability is gated, what a seat costs,
  what the capacity ceilings are.

The entitlement service takes a policy; it does not contain one. Concretely,
this means **never gate a feature by reading a subscription row inline** — that
was already the rule for modules and it is now load-bearing for a second reason.

Note the asymmetry this creates and do not "fix" it: sparx starts a tenant with
**zero** modules on, Piggles starts with **all** of them on. Both are correct.
The platform supplies the flag and the `module.activated` event; the default is
the brand's call.

## Architectural conventions

These moved here from the root file because none of them are brand-specific, and
leaving them in a file that will read as sparx's would have been misleading.

- **Multi-tenancy is enforced at the database level via PostgreSQL RLS.** Every
  tenant-scoped table has `tenant_id`; policies are the backstop against
  application bugs. Application-tier filtering is never sufficient on its own.
- **Auth is Better Auth, self-hosted.** Organizations map 1:1 to tenants (the
  tenant model _is_ the Better Auth `organization`). Two instances: staff
  (Layer 1, globally-unique email) and shopper (Layer 2, per-`(tenant,email)`).
  Use the org-membership primitives rather than building a parallel system.
  **API keys are a custom implementation** (`sk_live_*`, SHA-256) and **MFA is
  not yet implemented**.
- **Modules are feature-flagged, not separately deployed.** A disabled module
  returns 404 with a clear error, runs no workers, stores no rows. Activation is
  event-driven via `module.activated`.
- **Event-driven side effects via Pub/Sub.** Don't inline side effects in
  request handlers. The catalog is the `EventType` union in
  `packages/events/src/types.ts` and **topic name == event type**. Use the real
  names (`order.placed`, `order.paid`, `email.send`, `email.domain.verified`,
  `search.entity.changed`). There is **no** `order.created` and no
  `customer.updated`.
- **The worker fleet is THREE Deployments, and a new handler is a package — not
  a service.** `services/event-worker` runs every broker subscription in one
  process; each handler lives in `packages/<name>-worker` and exports
  `createSubscription(logger)`. Only `media-worker` and `import-worker` keep
  their own pods. A handler's JetStream `durable` name is **permanent once
  shipped** — changing it restarts the cursor.
- **Outbound email defaults to publishing `email.send`.** Direct calls to
  `sendTemplate()` / `sendEmail()` are an escape hatch for synchronous-required
  flows only (OTP, future 2FA). Templates compose the atomic components and
  never inline raw `style`; plain-text bodies are generated, never hand-written.
- **Migrations go through the pipeline, not your laptop.** Every managed
  instance is private-IP only. Author against docker Postgres, push to `main`,
  and the release's **data** stage applies it. RLS / `current_tenant_id()` are
  hand-edited SQL. **Migration directory names must be MONOTONIC** — Prisma
  orders lexicographically, and this repo's hand-authored timestamp prefixes run
  ahead of the real clock, so a new migration must sort after the newest
  existing one. Enforced by `scripts/check-migration-order.mjs`.
- **There is ONE release pipeline and its stages are the deployment:**
  infrastructure → data → containers → cleanup, on every push to `main`. That
  order is load-bearing — if the seed fails, the old containers are still
  serving. **The destination is a variable, never a filename**; adding an
  environment is setting variables. Never put a task name in the release —
  chores belong in the manual ops workflow. The tag is cut **last**, gated on
  the stages, so a `v*` tag means the version actually shipped.
- **API-first.** Every UI feature exists as an API endpoint first; a console is
  one consumer among several. This matters more now than it did with one brand —
  two consoles and an MCP server all consume the same contracts.
- **The MCP server is a first-class service**, not a plugin.
- **Infra is phased — start cheap.** Don't propose Phase 2/3 services without a
  stated revenue or scale trigger.

## check:boundaries

The three RULE #0 rules ship as a pure-Node structural check alongside
`check:events`, `check:routes`, and `check:docker`, running in CI and in the
pre-push guard. It fails on:

- an import from `wizeworks/**` reaching into `sparx/**` or `piggles/**`
- an import crossing between `sparx/**` and `piggles/**`
- a literal hex colour under `wizeworks/**` outside the two sanctioned
  exceptions (edge-runtime OG images, which cannot resolve custom properties;
  and third-party brand marks)
- a brand name literal in a user-facing string under `wizeworks/**`

A red check blocks the push. That is intentional — `--no-verify` is not an
acceptable bypass.

## Environment

- **Never** run `prisma migrate` / `db push` / **`generate`** against shared
  docker. Author the migration and dependent code as **files only** and hand off.
  `generate` rewrites the client the running stack imports.
- **Never** start or restart the dev server — the user owns that lifecycle, and
  a background `pnpm dev` collides with theirs and with parallel agents.
- **Never** commit or push. Leave work in the tree, run format/lint/typecheck,
  and report the changed files.
- **Never** `git stash`. When the pre-push guard blocks on formatting, run
  `pnpm format`.

## File & function size

There is no line-count target. Cohesion is the only rule: one file, one
responsibility; one function, one job. Split when a unit takes on a second
responsibility — never to hit a number.
