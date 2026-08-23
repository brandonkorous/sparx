# 128 — The check that was supposed to catch the brand leak does not look for it

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 9
**Surface:** `pnpm check:boundaries`
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** a red run and a green one, below

## What happened

[122](122-every-email-her-salon-sends-is-signed-with-another-companys-name.md) put
one brand's name and marketing link into the footer of every email the other brand's
tenants send. `wizeworks/CLAUDE.md` says a guard exists for exactly that, and lists
it among the four things `check:boundaries` fails on:

> - a brand name literal in a user-facing string under `wizeworks/**`

It did not check that. [scripts/check-boundaries.mjs](../../../../scripts/check-boundaries.mjs)
had three rules — imports crossing between the trees, imports from a banned package,
and a ratchet on `@sparx/*` usage counts — and no string rule at all. There was no
hex-literal rule either, which the same paragraph also claimed.

The check ran green. It had always run green on this.

## Why it matters

A documented guard that does not exist is worse than no guard, because the next
person to add a literal reads the paragraph, sees the check pass, and concludes they
are inside the rules. That is how "Sent with sparx" survived a documented sweep of
110 brand literals across 29 files.

It is also the shape already recorded as a running theme in this repo: a structural
check whose scope is asserted in prose rather than proven by a red run.

**It was not one leak, it was eighty-one.** The first run of the finished rule found
81 sentences in shared platform code with a product's name inside them, and every one
of them reaches somebody: "sparx cannot read balances from Xero yet" in an accounting
error, "How's your experience with sparx so far?" in the survey the console pops at
14 days, "The sparx team replied to your feedback" as a notification title, "Brings
orders into sparx" in the bullet list under every sales channel, and a testimonial
about another company's software sitting in the catalog block a salon owner stamps
onto her own homepage.

## What it should do

Fail on a brand name in a **sentence** under `wizeworks/**`. Not on every string —
that is 3,131 hits and almost all of them are identifiers (`sparx.works`,
`sparx_owner`, `/sparx/tenants`, `x-sparx-internal-cron-token`, `sparx.navbar`,
`sparx-pay`), where renaming is a migration rather than a fix, and a check that fires
on all of them gets switched off on the second afternoon.

## Where it lives

- [scripts/check-boundaries.mjs](../../../../scripts/check-boundaries.mjs) — the guard
- [wizeworks/CLAUDE.md](../../../../wizeworks/CLAUDE.md) §check:boundaries — the prose

## The fix

**RULE 3, `checkBrandProse()`.** A brand token standing as its own word inside a
string of four or more words, comments stripped as the other rules already do.
Word-standing means not glued into an identifier by a leading word char, `@`, slash,
dot, hyphen or backtick, and not the head of a dotted path — so `sparx.works` and
`` `sparx` `` (an identifier being named) pass, and "a newer version of sparx." does
not. Tests and fixtures are exempt, because a test asserting brand-resolved output
has to name a brand; `package.json` is exempt by extension, being registry metadata.
Everything else is a `RULE_3_EXCEPTIONS` entry with a written reason, and there are
three: the dev seed, sparx's own Stripe provisioning script, and a developer verify
script that prints a fixture row's name to a terminal.

**The 81 sentences, cleared.** Three shapes of fix, chosen by what the sentence had
in scope:

- **`{platform}` + `fillPlatformName`**, for data declared at module scope — the
  channel and social catalogs, the BYOK AI descriptors. This machinery already
  existed for payments; the other categories had never been moved onto it. The
  integrations route's `brandDescriptor` was also filling five fields and not
  `capabilities`, which is why "Publish posts from sparx" and "Brings orders into
  sparx" were sitting unresolved under every entry on that shelf.
- **`platformBrandIdentity(brand).name`**, where a tenant was in scope and the name
  is the point: the pulse survey question, the Search Console instruction (she has to
  find the app by name in a list on Google's site), the feedback-reply notice, the
  CRM signup note.
- **Say it without a name**, where the name was never carrying anything: "sparx
  cannot post journals to Xero yet" → "We cannot post journals to Xero yet"; "the
  records sparx ships" → "the records this software ships"; "Stock value in sparx" →
  "Stock value here".

**Three email templates came off an exemption list.** `partner-welcome`,
`partner-application-received` and `partner-earnings` were listed in
`SPARX_OWN_PRODUCTS` in `every-template.test.ts` — the set the second-brand assertion
skips — on the argument that there is no Piggles partner programme, so naming sparx
is naming the truth. The programme runs out of shared platform code
(`services/api-rest/src/lib/partners/`), so that argument describes today's marketing
rather than the software; in the meantime the exemption was holding three subject
lines, two footer reasons and a hardcoded `sparx.works/partners` link out of the
sweep that fixed 110 others. They now resolve through `usePlatformName()`, which
renders byte-identically for a sparx partner, and the test asserts them.

**The hex rule is withdrawn rather than written**, and `wizeworks/CLAUDE.md` now says
so. The inventory is the reason: 1,049 literal hexes live under `wizeworks/`, nearly
all of them the theme system defining its own tokens, `brand-core`'s email palette (a
mail client cannot resolve a custom property) and the PDF/HTML document renderers —
places where a hex is the only thing that can be written. What the paragraph was
reaching for is root RULE #1, which is about feature code painting a control, and
that lives in the ESLint rule and in review. Two real brand hexes turned up while
taking the inventory and are filed separately as
[157](157-a-salons-social-card-and-error-page-were-painted-in-another-companys-color.md).

**A line-number bug in `code()`, fixed on the way past.** Block comments were being
deleted outright, taking their newlines with them, so every rule in this file had been
reporting line numbers shifted by however many lines of header comment sat above the
hit. Blanked in place now.

## Confirmed by

**Red first.** Restored the exact leak from [122] — `frame.ts`'s credit line back to
"Sent with sparx, the content and commerce OS":

> ✖ a brand's name in the shared platform's own words — 1:
>
> wizeworks/packages/email/src/silica/frame.ts:199: …>Sent with sparx, the content and commerce OS

Line 199 is where it actually sits. Reverted, and:

> ✓ boundaries hold

Green with `check:events`, `check:routes`, `check:docker`, `check:brand`,
`check:brand-wordmark`, `check:migration-order`. `tsc --noEmit` clean on api-rest,
api-mcp, apps/site, apps/admin and every touched package. `eslint --max-warnings=0`
clean on all 68 changed source files. Tests: 189 email, 339 inventory, 81 payments,
73 site-themes, 37 brand-core, 18 platform-crm — all passing, including the 109 in
`every-template.test.ts` now that three more templates are asserted rather than
skipped.

## Left standing, deliberately

- **The identifiers.** `sparx.works`, `sparx_owner`, `/sparx/*` in the staff console,
  `sparx.navbar` in the block catalog, the `sparx_market` channel slug, the
  `sparx.brand-palette` wire format. Renaming any of them is a migration with a
  compatibility story, not a copy fix. The rule is built not to fire on them.
- **`name: 'sparx.market'`** on the first-party sales channel, and `source: 'sparx'`
  as an enum value in the GL reconciliation report. Both are one word, so the rule
  does not see them, and both are really the same open product question: whether the
  second brand has a marketplace at all.
- **`pnpm install` is required before this pushes.** Three packages gained a
  `@wizeworks/brand-core` workspace dependency (`channels`, `social`, `platform-crm`)
  and the lockfile has not been regenerated — the pre-push guard runs
  `--frozen-lockfile`. Typecheck was verified locally against hand-made symlinks.
