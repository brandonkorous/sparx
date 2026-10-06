# 004 — Doty typed what his business is, and setup called it "a business"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › Your story › the business-type menu
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — "diesel parts and repair" found Auto parts and was kept verbatim through a reload
**Blocked on:** —

## What happened

None of the five examples is a diesel shop, so Doty opened the business-type
menu and typed what Gillett is: **diesel parts and repair**. Two things went wrong.

1. **Nothing matched.** The list emptied to one option, even though "Auto parts &
   accessories / a parts store" was in the full list. The match needed the whole
   phrase inside one starter's name.
2. **His words were thrown away.** The one option read **Use “diesel parts and
   repair”** · "starts from the generic kit". He pressed it, and the sentence
   became **"I run a business for businesses"**. The button promised to use his
   words and used none of them.

## What should have happened

His words find the parts-store starter, and when he chooses his own words the
story says them, everywhere it names the business.

## How to reproduce

1. On "So, what's your story?", open the business-type chip.
2. Type `diesel parts and repair`.
3. Only "Use “diesel parts and repair”" shows. Press it: the sentence says "a
   business". Every time.

## Why it matters

Gillett is not a salon, grocer, consultancy, gym or distributor. Most real
businesses are not one of five examples, and the free-text box is their way in.
It told him it would use his words and then wrote "a business" into the story
that is saved as the record of what he told us. The button that promises
something and does something else is the worst kind of defect: it is false.

## Where it lives

- `IndustryMenu` in `surfaces/onboarding/story/story-menus.tsx` (both consoles):
  `${name} ${noun}`.includes(wholeQuery), and the fallback called
  `onPick('generic')` with the typed text dropped.
- `StoryState` (`@wizeworks/story-schemas`) had nowhere to keep the words.
- The business noun was read in five places per console (`story-canvas`,
  `story-composer` build button, `story-get-paid`, `story-go-live`, `toProse`).

## The fix

- `@wizeworks/story-schemas`
  - `StoryState.industryLabel?`: the owner's own words, verbatim.
  - `storyNoun()` / `storySubject()`: the ONE reader of what the business is
    called (own words, else the starter's noun, else "a business").
  - `matchIndustries()`: word-by-word match, filler words ignored, so "parts" in
    "diesel parts and repair" finds Auto parts.
  - `own-words.test.ts`: 5 tests.
- api-rest `routes/v1/tenant.ts`: the story schema is `.strict()`, so it now
  accepts `industryLabel` (max 80). Without this the draft save would be refused.
- Both consoles (sparx and Piggles, same shape):
  - the menu shows the word matches AND always offers "Use “…”", which now keeps
    the words on the best-matching starter's setup ("your words, with the auto
    parts & accessories setup"), or the general setup when nothing matches;
  - all five noun readers call `storyNoun` / `storySubject`;
  - `setIndustry(slug, label?)` stores the words, and picking a starter from the
    list clears them;
  - `PersistedStory`, `storyFromPersisted` and `toPersistPayload` carry the field.

Brandon confirmed during the run: "the story should support custom words."

## Confirmed by

> Re-ran P01 act 1. Typed `diesel parts and repair`: the menu listed **Auto parts & accessories** and **Use “diesel parts and repair” — your words, with the auto parts & accessories setup**. Pressed it: "I run **diesel parts and repair** for businesses", truck icon, button "Build my diesel parts and repair". Reloaded: unchanged. Database: `settings.onboarding.story.industryLabel` = `diesel parts and repair`, `industry` = `auto-parts`, saved prose "I run diesel parts and repair for businesses, …".

Checks: story-schemas tests 9/9; sparx and Piggles workbench and api-rest `tsc --noEmit` exit 0.

## Rating effect

—
