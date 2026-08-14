# CLAUDE.md — Piggles

Guidance for Claude Code when working anywhere under `piggles/`. This file is
**binding** for Piggles work and takes precedence over the root
[CLAUDE.md](../CLAUDE.md) wherever the two disagree. Where it is silent, the root
file still applies.

Piggles is WizeWorks' second brand: the same platform, a different product. Not
"sparx Lite", not a reskin, not a fork.

## RULE #0 — the boundary. Break this and there is no point to any of it.

**`piggles/` owns brand, apps, components, copy, and design language. It CONSUMES
the shared platform and contributes nothing back into it.**

| Layer                                             | Owner           | Piggles may                            |
| ------------------------------------------------- | --------------- | -------------------------------------- |
| `packages/*`, `services/*`, `packages/db`         | shared platform | import, never modify for brand reasons |
| `apps/site` (tenant sites)                        | shared platform | nothing — that is the tenant's brand   |
| workbench **surfaces** (the ~500 panels)          | shared platform | mount them, never fork them            |
| workbench **shell** (chrome, nav, theme, lexicon) | Piggles         | own outright                           |
| marketing + account apps                          | Piggles         | own outright                           |

Both brands run on **one database and one tenant pool**. A tenant belongs to the
brand it signed up under, recorded on `Tenant.brand`, and never changes brands.

**The rule that keeps this from rotting: feature code never branches on brand.**
No `if (brand === 'piggles')` in a shared package, service, or surface. Brand
reaches the UI through tokens, the app registry, and the lexicon — never a
conditional. The moment a brand check lands in shared code you have rebuilt the
fork somewhere it is harder to see. The source pack says the same thing in its own
words: _"avoid scattered product checks in UI code"_
([SHARED_PLATFORM_STRATEGY.md](docs/initial/docs/architecture/SHARED_PLATFORM_STRATEGY.md)).

**Shell forks; surfaces do not.** Piggles gets its own chrome, navigation,
theming, onboarding and vocabulary. It does not get its own products panel. If a
Piggles need can only be met by editing a shared surface, the fix is a prop, a
registry entry, or a token — not a copy.

## RULE #1 — Piggles is not a smaller product

Every capability sparx has, Piggles has. Simplification comes from **terminology,
hierarchy, defaults, onboarding, progressive disclosure, and intent-based
actions** — never from removing capability.

A user is never blocked from an ordinary business capability because of what they
bought. Enabling an app changes the **workspace**, not the **price**.

## RULE #2 — no module pricing

sparx charges per active module. **Piggles does not, and must never grow tiers.**
One flat plan, every app included, capacity limits protecting the economics:

- $49/month, 1 business, 1 location, 1 primary site, 3 users included
- capacity metered on storage, email volume, contacts, and seats
- no Basic/Pro/Enterprise unless product strategy changes explicitly

Three consequences that are easy to miss:

1. **Meter from day one, even before you bill on it.** Usage tiers set later need
   historical data to be priced, and that data cannot be backfilled.
2. **Every app ships enabled, so the nav is full on day one.** sparx uses module
   activation as progressive disclosure and Piggles cannot. Onboarding asks _what
   do you do?_ and uses the answer to **hide**, never to gate — everything stays
   one click from discoverable.
3. **A capacity limit never stops work in progress, and never degrades what
   already exists.** The action in flight completes; only new additions of that
   one kind pause afterwards. Exceeding storage does not unpublish a site;
   exceeding contacts does not hide contacts; transactional mail is never
   capacity-gated. Full posture:
   [BILLING_RULES.md](docs/initial/docs/commercial/BILLING_RULES.md).

**Expansion is one tap, in place, with the price on the button** — never a trip to
Settings and never a redirect to another domain. Get Piggles owns capacity
_management_ (the full dashboard, payment methods, invoices, reducing capacity);
My Piggles carries the _quick path_ — one meter's state at the point of friction
and the one-tap action for that meter. Reading "don't duplicate billing logic" as
"redirect to billing" is the specific mistake to avoid.

The testable version of that boundary: **the console never knows a price.** A
narrow account-service endpoint returns the priced option and executes it; My
Piggles renders the label it is handed. A price computed or hardcoded in console
code means billing logic has leaked, however thin it looks. Split table:
[BILLING_RULES.md](docs/initial/docs/commercial/BILLING_RULES.md).

One-tap purchase is only honest if removing the block is equally self-serve.

**Accounts flagged `system` are never metered, warned, or blocked** — an explicit
auditable flag, never inferred from an email domain or a plan value, and never
settable from a tenant-facing surface.

## RULE #3 — speak like a person

The vocabulary is a product adapter, not decoration. Canonical map:
[config/terminology.yaml](docs/initial/config/terminology.yaml).

| sparx         | Piggles   |
| ------------- | --------- |
| Workbench     | Home      |
| module        | App       |
| enable module | Add app   |
| tenant        | Business  |
| Site Builder  | My Site   |
| CMS           | Content   |
| SEO           | Get Found |
| Commerce      | Sell      |
| Inventory     | Stock     |
| CRM           | Customers |
| Email         | Messages  |
| Scheduling    | Bookings  |
| Finance       | Money     |
| RBAC          | Access    |
| MDI           | Workspace |

The generating rule: **sparx names things by category, Piggles names them by what
you are doing.** A shop owner does not have a CRM; they have customers.

Never make a user understand CMS, CRM, headless, MDI, RBAC, collections, price
books, or GraphQL outside an explicitly advanced or developer context.

**Playful, never childish.** Capable, friendly, mildly mischievous — and never
silly during serious work. Money, tax, payroll and deletion are plain and calm.
**Do not rename features into pig puns.** The mascot earns its keep in empty
states, onboarding and success moments, not in the nav.

## The three surfaces

| Domain            | App                      | What it is                                            |
| ----------------- | ------------------------ | ----------------------------------------------------- |
| `meetpiggles.com` | `piggles/apps/web`       | discover and understand                               |
| `getpiggles.com`  | `piggles/apps/account`   | authenticate, sign up, onboard, provision, **pay us** |
| `mypiggles.com`   | `piggles/apps/workbench` | operate the business                                  |

The `getpiggles` / `mypiggles` split is deliberate and load-bearing: **the money
a customer pays WizeWorks** and **the money a customer's own customers pay them**
are different concerns, and merging them is what made this confusing in sparx.
Keep platform billing out of the operating console.

**Cross-domain auth.** Three registrable domains cannot share a cookie, so
`getpiggles.com` is the auth authority and `mypiggles.com` has no sign-in UI at
all. Unauthenticated hits bounce to the account app, which mints a single-use,
origin-bound, short-TTL exchange token and redirects to
`mypiggles.com/auth/callback`; that route exchanges it server-side and sets its own
cookie on its own domain. Both cookies address **one Better Auth session row**, so
logout, expiry and revocation stay consistent for free. No third-party cookies —
nothing to break in Safari.

Attribution cannot ride a cookie across those domains either: `meetpiggles.com`
serialises the first-touch payload into the signup link at click time, and the
account app captures it first-party.

## Where things live

```
piggles/
  apps/          web (meet) · account (get) · workbench (my)
  packages/      brand · config · ui compositions
  docs/initial/  the approved source pack — brand board, PRD, architecture
  CLAUDE.md      this file
  DESIGN.md      the design contract
```

[docs/initial/](docs/initial/) is the **approved source pack** and outranks
anything inferred from sparx. Read [00_START_HERE.md](docs/initial/00_START_HERE.md)
and the relevant `docs/` node before non-trivial work. Note
[BRAND_CORRECTION.md](docs/initial/BRAND_CORRECTION.md): the canonical accent is
**pink/coral**; every yellow reference is superseded.

## Which root rules still apply

**Still binding** — root RULE #1 (silicaui first, Tailwind second; feature code
chooses, never paints), RULE #2 (no eyebrows), RULE #4 (neutral must be earned),
the no-gradients rule, the 16px body floor, the no-inline-`style` rule, explicit-
save editors, destructive actions behind `useConfirm`, and every architectural
convention in the root file (RLS, Better Auth, Pub/Sub events, the release
pipeline, migration monotonicity).

**Superseded for Piggles** — the visual restraint clauses. Roundness, warmth, the
mascot, and silica's `--depth: 1` elevation are Piggles' identity, not drift. The
specifics are in [DESIGN.md](DESIGN.md); do not import sparx's flat, cool, sharp-
edged defaults into a Piggles surface just because they are the repo's habit. Note
what that does and does not license: `--depth: 1` is one token that turns on
silica's own Card and Button elevation. A `shadow-*` utility in feature code is
still a re-skin and still banned.

## Environment

Same as the root file: **never** run `prisma migrate` / `db push` / `generate`
against shared docker, never start or restart the dev server, and never commit or
push — leave work in the tree and report the changed files.
