# 566 — Told I was charging no tax, while charging tax in Colorado

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, on Sell → Tax
**Surface:** `piggles|sparx/apps/workbench/surfaces/commerce/tax.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_one_outcome_two_causes]] · [[feedback_a_promise_in_copy_is_a_contract]] · [[feedback_never_present_absence_as_measurement]]

## What she saw

> ⚠ **Set up, but charging nothing**
> Tax is worked out and added at checkout. **Every place starts switched off, so
> nothing is charged before you have looked at it.** Open each place you are
> registered to collect in, check its rate, then switch it on.

and four lines below it, in the list the banner sits on top of:

| place                                    |                         |
| ---------------------------------------- | ----------------------- |
| California · Nothing is charged here yet | 1 rate · Off            |
| **Colorado · You have a presence here**  | 1 rate · **Collecting** |
| New York · Nothing is charged here yet   | 1 rate · Off            |
| Texas · Nothing is charged here yet      | 1 rate · Off            |

She is charging tax in Colorado. She switched it on herself.

## The cause

The gate is right and the sentence is not:

```ts
const setUpButSilent = rows.some((zone) => zone.rateCount > 0 && !zoneIsCollecting(zone));
```

`.some()` is true the moment **any** place with a rate is switched off, which is
the right thing to notice. The title then reports that as **nothing**.

Two states need two sentences, because they call for opposite actions:

| state                  | what it means                   | what to do                        |
| ---------------------- | ------------------------------- | --------------------------------- |
| nothing anywhere is on | no tax is reaching any checkout | urgent                            |
| some on, some off      | tax **is** being charged        | only decide about the silent ones |

Telling the second shop it charges nothing invites the worst available reading:
that the Colorado tax she can see on her screen is not really being collected,
and does not need remitting.

## Measured

Every tenant with a tax place that has a rate on it:

|                                            | tenants             | the banner was |
| ------------------------------------------ | ------------------- | -------------- |
| collecting nowhere                         | **9**               | true           |
| collecting somewhere, and silent somewhere | **1** (Juniper Row) | **false**      |

One tenant, and it is the only one who has switched anything on. The sentence
was wrong for exactly the shop that had done what it asked, and every other
tenant inherits the same wrong sentence the moment they comply.

## The fix

Two counts instead of one boolean, and the sentence built in `tax-notice.ts` so
it has a test. Places with **no rate at all** stay counted in neither: a new shop
is seeded one empty country place, and warning its owner that their tax is not
working would be a warning about nothing (the reason the original gate keyed on
`rateCount > 0`, kept).

Her screen now reads:

> ⚠ **3 places set up but switched off**
> You are charging tax in 1 place, so tax is reaching your checkout. 3 other
> places have a rate set and are not collecting. Open each one you are registered
> in, check its rate, then switch it on. If you are not sure where you have to
> collect, ask an accountant.

The urgent sentence is unchanged for a shop that genuinely charges nowhere.

## Proven

5 guards per console, **proven red** by restoring the single-sentence version:

|                                                              |                                                                             |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| "does not say 'charging nothing' when something is charging" | `expected 'Set up, but charging nothing' not to contain 'charging nothing'` |
| "counts Juniper Row's places the way her screen shows them"  | `expected … to be '3 places set up but switched off'`                       |
| "reads correctly with one of each"                           | `expected … to be '1 place set up but switched off'`                        |

Verified on her live screen against her four real places. Both consoles
typecheck.
