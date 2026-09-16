# 466 — Thirty sentences still speaking the other product's language

**Status:** fixed
**Severity:** major
**Found by:** the empty state on "Money paid to you" reading "No payouts yet" under a tab named "Money paid to you"
**Surface:** twelve Piggles screens, plus the command palette
**Filed:** 2026-09-09

## What set it off

Devi's payouts pane is renamed. `vocabulary.ts` calls it **"Money paid to you"**,
because "payouts" is the accountant's word. The tab said so. The screen inside
said **"No payouts yet"**.

One rename, two places, and only one of them had been done. So I asked how many
others were like it.

## What was wrong

`check:piggles-nav` exists precisely to stop sparx's words reaching a Piggles
screen. It had four seams and it was green. All four read a string that passes
through SOMETHING — a catalog entry, a copy key, a title slot.

**A sentence typed straight into JSX passes through nothing, and nothing was
reading it.** Thirty were live:

| screen                     | said                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| the command palette (⌘K)   | "Type to search across every **module** — or pick a screen to open." |
| Add a site                 | "Adding another site needs the Builder **module**"                   |
| Customer settings          | "Your changes to how the **CRM** behaves have not been saved."       |
| Customer settings          | "**CRM** behavior actions" (the toolbar's screen-reader name)        |
| Filing a product           | fourteen sentences about **collections**                             |
| Choosing photos            | five about media **collections**                                     |
| Record types               | "once the customers **module** is switched on"                       |
| Bookings reports           | "once the scheduling **module** is enabled for this account"         |
| First-run, choosing a site | "or build **headless** against our API"                              |
| Wholesale pricing          | "Only certain **collections**"                                       |

`module`, `CRM` and `collection` are all on the banned list. `collection` is
named in piggles/CLAUDE.md RULE #3 outright, as a term a person must never be
made to learn.

Devi has SEVEN sites. She has met the Builder-module sentence.

## The one that proves the shape

The customer-settings pane is where the fourth seam came from. Issue 458 took the
`ctx.setTitle('How the CRM behaves')` out of it — and the leave-guard **five
lines below** went on asking whether to discard "your changes to how the CRM
behaves". Same file, same word, same fix, left behind because the check that
caught the first one could not see the second.

## The fix

A fifth seam. It reads JSX text nodes, the props that render text, and whole
sentences in string literals — the last of those because the command palette's
placeholder lives in a ternary, which is neither of the first two and is read by
everyone who presses ⌘K.

**624 rendered strings before. 12,335 now.**

It stays narrow on purpose, because a checker that flags `className="bg-module"`
is a checker somebody switches off. Class lists, copy keys, and `productCopy`
fallbacks (seam 2 owns those) are all excluded.

Two kinds of exemption, both written down and both self-destructing:

- **Blocks Piggles does not render.** The sparx marketplace card and the sparx Pay
  form are wrapped in `productHidesFeature(...)` at their call sites, so their
  words are sparx's on purpose. The exemption is keyed on the FEATURE and checked
  against the real `hiddenFeatures` set — the day either block becomes visible in
  Piggles, the check throws rather than quietly going on.
- **Words a person must meet, defined inline.** Three of them: "API key" on the
  screen where you paste one (the provider's own page calls it that), the
  gateway's "webhook signing secret", and the automation that says "an outside web
  address (a webhook)" in the same breath it uses the word. Exact strings, so a
  NEW sentence carrying the same word is still caught.

## The words themselves

Piggles already had answers for most of these, sitting in `vocabulary.ts`
unapplied to the prose: a collection of products is a **group** (the nav says
"Groups of products"), a module is an **app**, the CRM is the **Customers** app.
Media collections had no word, so they are **albums**, which is what everyone
calls a set of photos.

| breaking                                | reddens                          |
| --------------------------------------- | -------------------------------- |
| putting "needs the Builder module" back | 1, naming the file and the word  |
| un-hiding `commerce.channels.market`    | throws, with the exemption named |

## Not fixed, and why

`ai-connections` says "API key" three times. That is the one term the provider's
own screen uses, and renaming it would leave somebody hunting a settings page for
a word we invented. It is on the defined-inline list with that reason attached.
