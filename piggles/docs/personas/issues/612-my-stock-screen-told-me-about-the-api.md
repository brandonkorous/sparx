# 612 — My stock screen told me about the API

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Stock › Your own columns, and Sell › Settings
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (seen on screen)

## What happened

**Stock › Your own columns**, in the blue notice at the top:

> Anything you add here appears on the record straight away, **in the API**, and
> to any assistant connected to your account.

I make shirts. I do not know what an API is, and nothing on the screen said.
The same phrase was in the description under each of the four kinds of column,
so it was on the screen **five times**.

It was not even carrying anything. The clause right beside it, "to any
assistant connected to your account", is the part I can picture.

And on **Sell › Settings**, in the list of what to do when a card fails:

> Custom schedule (**set through the API**)

That one is worse in a small way. It only appears when somebody has set a
schedule this screen cannot show, so it exists to tell me where the setting came
from, and it tells me in the one word that cannot.

## The fix

Say the thing instead of naming the mechanism.

| was                                                                         | now                                                                                 |
| :-------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| on every item, over the API, and to any assistant connected to your account | on every item, and to any app or assistant you have connected                       |
| appears on the record straight away, in the API, and to any assistant…      | appears on the record straight away, and to any app or assistant you have connected |
| Custom schedule (set through the API)                                       | Custom schedule (set somewhere other than this screen)                              |

"Any app or assistant you have connected" is also **wider** than what it
replaced: it covers her accounts package and her till, which "the API" meant and
"assistant" did not.

Both consoles, because the audience rule is not a Piggles rule.

## Why it survived

`check-nav-vocabulary` reads **names**: the rail, the screen titles, the section
headings, a handful of named catalogs. It is exhaustive over those and it never
looks at the sentences on the screens. That is roughly four thousand sentences
nothing was reading.

The word list did not have `API` on it either. `API key` is in
`BANNED_IN_PRODUCT_COPY`, so a reviewer grepping for the banned words found
"API key" and not "in the API", which is the same trap that let `fitment` reach
five places on one pane in 607.

## Guard

**`piggles/scripts/check-plain-words.mjs`**, wired as
`pnpm check:piggles-plain-words` and a line in `.githooks/pre-push`.

It reads what a person reads: text between JSX tags, and the props that carry a
sentence (`title`, `description`, `label`, `placeholder`, `detail`, `blurb`,
`body`, `help`, `message`, `summary`, `tagline`). Words come from the lexicon,
**parsed not copied**, plus seven technical terms that are not vocabulary
choices because there is no Piggles word for JSON.

Two things it had to learn before it was usable:

- **`className` is not copy.** Scanning every string literal made "module" fire
  ninety times on `text-module size-5` and buried the four real ones. A check
  that prints ninety false positives gets switched off, so it reads only the
  copy-carrying props.
- **`=>` is a `>`.** The JSX-text pattern matched `=> api.get(` as text between
  tags and reported **1,040** findings, almost all of them `api.get`. A prose
  test (whitespace, no code punctuation, two real words) cut it to 11 real ones.

All 11 were real, and all 11 are fixed rather than banked:

| where               | was                                                        | now                                                                   |
| :------------------ | :--------------------------------------------------------- | :-------------------------------------------------------------------- |
| Apps list           | Module list controls                                       | App list controls                                                     |
| Onboarding story ×2 | switches on the **module** it needs                        | switches on the **app** it needs                                      |
| Onboarding launch   | an AI-native **API** so it can all be run in plain English | you can point an AI assistant at it and run the whole thing by asking |
| Partner bootcamp    | becomes a lead in your **CRM**                             | lands in your customer list                                           |
| Automations ×2      | Advanced: any extra data to include, as JSON               | …written as JSON. **For example {"source": "piggles"}.**              |
| Stock, Sell         | the three above                                            | the three above                                                       |

The debt file is **empty**. Four strings are on ALLOWED, and they all have the
same single reason: **the word is on somebody else's screen.** Connecting Stripe
means finding "Webhooks → Add endpoint" in Stripe's own menu and pasting into a
field Stripe calls the webhook signing secret. Translating those would leave her
reading our plain sentence and looking at a menu containing none of it, which is
a worse failure than the jargon because then she cannot finish. "It was too hard
to reword" is not a reason and the file says so.

Proven red by putting "Module list controls" back. Proven not-blind twice: a
moved `surfaces` directory exits 1, and a renamed `BANNED_IN_PRODUCT_COPY` exits
1 rather than watching zero words.

## Still open

Nothing from this issue.

Noted: the check reads Piggles only. sparx has no banned-word lexicon, so there
is nothing for it to enforce there. The two copy fixes were applied to both
consoles anyway, because a plainer sentence is not a brand decision.
