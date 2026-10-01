# 908 — A yes-or-no scoring rule could never add a point

**Status:** fixed
**Severity:** **major** — the rule the screen itself suggests ("has bought
before: +20") saved and then scored nobody, with nothing on screen to say so
**Found by:** P03 · act 321
**Surface:** `crm.scoring` (both consoles)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** walked on screen; the rule stores `"value": true`, "Try it on
somebody" scores Rowan Ellery 20, and Re-score everyone moved 7 of 41

## What she saw

"They have bought something", then **is**, then an empty box hinting
**e.g. 500**. A yes-or-no fact, asking for a number.

## Why it could never fire

Whatever she typed was saved as text: "yes", or "true". The engine's `eq`
(`automation-schemas/src/evaluate.ts`, `looseEq`) matches equal values or two
numbers, so the stored text never equals a real `true`. Save also accepted a
rule with nothing typed at all.

## The fix

- A yes-or-no fact gets a **Yes / No** choice that stores a real yes or no.
  Picking such a fact starts it on Yes; leaving one drops the yes.
- The choice shows only what is stored. An older rule holding the text "true"
  reads **Pick yes or no**, not a Yes it does not mean.
- A date gets a date picker, and the hint fits the kind (no "e.g. 500" under a
  job title).
- Save refuses a rule with no answer: "Rule 1 does not say what it should be
  yet."
