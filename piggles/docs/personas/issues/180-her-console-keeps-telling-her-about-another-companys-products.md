# 180 — Her console keeps telling her about another company's products

**Status:** open — guarded, removals to sequence
**Severity:** major (a customer is reading a competitor-shaped product name in her own console)
**Found by:** P03 · Juniper Row · while confirming [120](120-her-two-stylists-are-staff-in-bookings-and-nobody-in-my-team.md)
**Surface:** mypiggles — 49 sentences across ~30 screens
**Filed:** 2026-08-24
**Fixed:** the guard, 2026-08-24. The 49 sentences: not yet.
**Blocked on:** a product decision on the excluded surfaces — see below

## What happened

Reading Bookings › People and equipment to check something else, the form said:

> Say what kind of thing this is and give it a name your team will **recognise**.

Chased the spelling and found the other thing. `surfaces/modules/data.ts`, the copy
under **My Team** in the module list:

> Keep hours, pay rates, shifts, time off and licence renewals, so you know what an
> hour of work really costs. Not payroll — **sparx** hands the hours to whoever runs
> yours.

Devi has never heard of sparx. She bought Piggles.

**49 sentences** name it, measured with the same rule the boundary guard uses (the
brand standing as its own word inside a string of four words or more). Among them:

| Screen               | What she reads                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Payments             | "Choose the service that takes your customers' payments. **sparx Pay** is the fastest to start"             |
| Product › Channels   | "Listed on the **sparx marketplace**" · "A shared marketplace of products from every business on **sparx**" |
| Market               | "Across every sale on **sparx.market**. **sparx** takes its share from each sale and pays you the rest"     |
| Automations          | "Set up by **sparx**" · "An automation **sparx** set up for you."                                           |
| Money › Subscription | "Opens **sparx**'s secure payment page in a new tab to add your card."                                      |
| Stock › Setup        | "Getting your stock into **sparx**" · "What **sparx** can already see"                                      |
| Email › Domains      | "Lists **sparx** as allowed to send email on your behalf."                                                  |

## Why nothing caught it

This is [128](128-the-check-that-was-supposed-to-catch-the-brand-leak-does-not-look-for-it.md)
again, one tree over. `checkBrandProse` in
[check-boundaries.mjs](../../../../scripts/check-boundaries.mjs) does exactly the right
thing — and walks `wizeworks/` only:

```js
for (const file of walk(path.join(ROOT, 'wizeworks'))) {
```

So a sparx sentence inside **Piggles' own console** has never been read by anything.
The rule was written when the leak being chased was in the shared platform, and the
other direction was simply never added.

## Two halves, and only one is a rename

**Half one — wording.** "Getting your stock into sparx", "sparx's secure payment page",
"Set up by sparx". These take Piggles' own words, or `{platform}`.

**Half two is not.** sparx Pay, sparx.market and the sparx marketplace are sparx
PRODUCTS. [piggles/CLAUDE.md](../../../CLAUDE.md) is explicit and this issue does not
reopen it:

> **sparx.market, sparx Pay, sparx Commerce, the sparx partner directory — these do
> not exist in Piggles. Exclude them. Do not rename them, and do not ask.**
>
> Renaming is the worst of the three ways to get this wrong: "Piggles Pay" is a
> product nobody can sign up for, and a brand-name swap makes the sentence
> grammatical, on-voice, and false.

So those screens come OUT, through `hiddenSurfaces` / `hiddenFeatures` in
[lib/product.ts](../../../apps/workbench/lib/product.ts). That is a scoped piece of
work with its own decisions about which surfaces go, and it is not a string edit.

## What was done today

A **ratchet**, not a ban: `checkOtherBrandProse` counts sparx sentences under
`piggles/` against `piggles/docs/migration/sparx-prose-baseline.txt`, currently **49**.
The number may only fall.

A hard failure would have priced the surface-removal work into every unrelated push
until somebody switched the check off — which is how a guard dies. A ratchet means
nothing NEW leaks in while the removals are sequenced, and the count is the todo list.

Shown red before it was trusted green: adding one leak sentence takes it to 50 and
fails; removing it passes.

## Also fixed today: the spelling that led here

`recognise` is not how it is spelled here. Nine files under 250 lines took their
corrections directly — Favorites, licenses, recognize, organized. The rest are in
files over Piggles' 250-line limit, where touching them obliges a split
([RULE #0.5](../../../CLAUDE.md)), so they are listed here rather than half-done:

`lib/console/copy.ts` (645) · `lib/dock/pane-tab.tsx` (292, plus the `Favourite*`
identifier family) · `surfaces/crm/companies-list.tsx` (280) ·
`surfaces/crm/crm-settings.tsx` (328) · `surfaces/modules/data.ts` (328) ·
`surfaces/staff/people.tsx` (395) · `surfaces/builder/saved-piece-detail.tsx` (484) ·
`surfaces/inventory/report-schedule-detail.tsx` (677) ·
`surfaces/scheduling/resource-detail.tsx` (687) ·
`surfaces/inventory/stock-import.tsx` (1100) ·
`surfaces/automations/automations-catalog.ts` (1114)

Wider count across `piggles/`, including comments and identifiers: ~180 British
spellings (`behaviour` 35, `recognise` 66, `licence` 25, `favourite` 43).

## How to reproduce

1. Any Piggles console. Sell › Payments, or Money › Subscription, or Stock › Setup.
2. Read it.
