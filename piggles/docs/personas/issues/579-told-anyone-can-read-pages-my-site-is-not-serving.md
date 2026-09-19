# 579 — Told anyone can read pages my site is not serving

**Status:** fixed and proven on screen
**Severity:** high
**Found by:** Devi, on Content → Legal pages
**Surface:** `piggles|sparx/apps/workbench/surfaces/cms/{data,legal-data}.ts` · `piggles|sparx/apps/workbench/lib/billing/site-live.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_a_promise_in_copy_is_a_contract]] · [[feedback_never_present_absence_as_measurement]]

## What she saw

A red banner across the top of the console:

> **Your site is offline. It comes back as soon as a payment goes through.**

And three inches below it, on Content → Legal pages, four rows:

> **Privacy Policy** `Published`
> Tells visitors what personal information you collect about them and how you use it.
> **Live on your site. Anyone can read it.**

Four times. The same sentence sits on every published article in the Content
list and on every content detail pane.

## Measured

I did not take the banner's word for it either. The tenant site, fetched
directly:

```
$ curl -s -o /dev/null -w "%{http_code}" "http://localhost:3004/?tenant=juniper-row"
200
$ curl -s "http://localhost:3004/?tenant=juniper-row" | strip-tags | head
Temporarily unavailable   Back soon
This site is taking a short break. Thanks for your patience…
```

So the suspension is real and enforced — the site answers, and what it answers
with is an overlay. `gate.ts` says so in as many words:

> _`suspended` — past grace with no active subscription: the public site serves
> the "unavailable" overlay. The dashboard stays open to fix billing._

How many businesses are in that state right now:

```sql
select subscription_status, count(*), count(*) filter (where trial_ends_at < now())
from tenants group by 1;
```

| subscription_status | tenants | trial already over |
| ------------------- | ------- | ------------------ |
| `trialing`          | 32      | **32**             |
| (null)              | 81      | 0                  |

Trials that ended on 2026-09-06, a 7-day grace window, and today is the 16th.
**32 of the 113 tenants on the platform are past grace**, and every one of them
is told a stranger can read pages nobody can reach.

## Why it happened

Both helpers are pure functions of one column:

```ts
export function entryStatusState(status: EntryStatus) {
  switch (status) {
    case 'published':
      return { label: 'Published', tone: 'success',
               detail: 'This is live on your site. Anyone can read it now.' };
```

"Published" is a fact about the page and it is true. "Anyone can read it" is a
claim about a **stranger's browser**, and nothing in the function's reach knows
whether the site is being served. The same shape as every other empty-queue
defect this week: the sentence needs a fact from outside the view's own lens.

## The fix

`site-live.ts`, one small pure predicate plus a hook:

```ts
export function siteIsDark(billing: BillingPhaseView | undefined): boolean {
  return billing?.phase === 'suspended';
}
```

**Only `suspended`.** `grace` exists precisely to keep the site live for its
whole window, and `trialing` is fully served, so neither may suppress the
sentence. An `undefined` billing view means the answer has not arrived, and a
page is not declared unreachable on a guess.

`useSiteIsDark()` reads `useBill()`, which the billing banner in the chrome
already fetches, so it costs nothing extra.

**The label and its color do not move.** The page IS published, that is the state
the owner controls and can change, and turning twenty green badges amber would
report twenty problems where there is one. Only the reachability claim changes.

Now, verified in the browser:

> **Privacy Policy** `Published`
> Tells visitors what personal information you collect about them and how you use it.
> **Published, and it goes back on your site as soon as your site is online again.**

## Proven

**`published-while-dark.test.ts`** — 11 tests, both consoles, including two
properties: the "anyone can read" phrase appears exactly when the site is being
served, and draft / scheduled / archived come back **identical** dark or lit,
because those states are already about what nobody can see.

The grace case earns its own test. Making `siteIsDark` true for grace would pass
every other assertion in the file while telling a business whose site is
demonstrably up that nobody can reach it.

Ignoring the flag in both helpers:

```
× stops saying so once the site is dark
    expected 'This is live on your site. Anyone can…' not to contain 'Anyone can read it'
× stops saying so once the site is dark
    expected 'Live on your site. Anyone can read it.' not to contain 'Anyone can read it'
× never promises a reader while the site is withholding every page
    dark=true: "This is live on your site. Anyone can read it now.": expected true to be false
```

**3 of 11 red.**

|                 |                         |
| --------------- | ----------------------- |
| piggles console | **448 pass** (53 files) |
| sparx console   | **360 pass** (44 files) |
| typecheck       | both exit 0             |
| lint / prettier | clean                   |

## What I checked and did not change

- **The `Published` badge stays green.** See above: one site-level fact, already
  stated twice in the chrome, should not be restated on every row as a per-row
  problem.
- **Home's "Everything else is fine".** It is scoped by "else" to the queues it
  lists, and the offline state is carried by the red banner and the sidebar's
  Action needed card, both above it. A judgement call, and it went the other way.
- **The blueprint refresh banner's "Nothing of yours is overwritten."** Read the
  merge rather than trusting it: `const take = opts.resolve?.(path) ?? 'mine'`,
  and the console posts `take_theirs: []`, so a conflict resolves to the tenant's
  value every time. The promise is kept.
