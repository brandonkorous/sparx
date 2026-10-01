# 911 — A deal could not be with a business, and its close date wiped itself

**Status:** fixed
**Severity:** **major** — the saved close date showed empty when the deal was
reopened, and the next save sent the empty box back over it
**Found by:** P03 · act 321, adding "Thornbury spring linen order"
**Surface:** `crm.deals` and the deal form (both consoles); the shared date box
`components/day-input.tsx`; `wizeworks/packages/crm/src/services/deal-service.ts`
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** walked on screen; `lib/today.test.ts` (4 new, red when the
helper does nothing) and `surfaces/crm/deals-data.test.ts` (5, red when a
company-only deal loses its name)

## What she hit

1. **No company.** Thornbury Haberdashery is a wholesale customer with no
   contact person on file. The form's "Who and where from" asked only for a
   person. `deals.company_id`, the API and the list's filter all handle a
   company; the form never wrote one.
2. **The date that wiped itself.** She typed 11/15/2026 and saved. The database
   held 2026-11-15. The form reopened with the box empty: the API sends
   `2026-11-15T00:00:00.000Z` and a native date box shows nothing for that.
   Saving anything else on the deal would then have sent the empty box and
   cleared the date.
3. **A card that did not say who.** The board card showed only a person, so a
   deal with a company and nobody at it said nothing about who it was with.
4. Smaller: the title hint read "Fleet servicing contract" in a dress shop;
   the error under the **Step** box said "Choose a stage."; the board's hint
   said "Drag a deal to another stage" over columns that say "step".

## The fix

- A **Company** box beside **Customer**, on new and existing deals.
- The date box reads a stored timestamp as its day (`storedDayText` in
  `lib/today.ts`, the same UTC reading as `dayFromStored`). That covers every
  form built on the date box, not only this one; the deal form also trims the
  day itself.
- The server sends the company's name with each deal, and the card and the
  list say who it is with: the person, the company, or both.
- "Spring wholesale order", "Choose a step.", "another column".

## On the screen

Thornbury spring linen order, $1,200, 60%, closing 2026-11-15, with Thornbury
Haberdashery. The card names Thornbury, and the date shows when reopened. The
deal stays, as Devi's own data.
