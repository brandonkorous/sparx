# P09 — Rosalind Pike · The Marrow Review

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

**Status:** not started
**Run:** —
**Trade:** Something else (`generic`) · **Rail groups:** web · people

## Account

| Field         | Value                       |
| ------------- | --------------------------- |
| Email         | `p09.rosalind@piggles.test` |
| Tenant id     | —                           |
| Subdomain     | —                           |
| Published URL | —                           |

## The person

Rosalind Pike, 58, she/her. A former food editor who now runs a small independent
journal about farming and food supply with two regular contributors and a
freelance photographer.

She writes, edits and publishes. **She sells nothing.** The journal is funded by
a foundation grant and 40 paying supporters who give monthly through a service
she is happy with and has no intention of moving.

She is the hardest reader in this roster: she notices bad typography, she will
not tolerate her essays being called "content entries" on a screen she uses
daily, and she reads the words on every button.

**What made her look:** her site's publishing tool was acquired and shut down
with 90 days' notice.

## The business

**The Marrow Review** — a journal. Published weekly.

- **Articles** with a headline, standfirst, body, hero image, credited author and
  photographer, and a publish date
- **Contributors** as real records — bio, photo, the pieces they wrote
- Three **sections**: Field, Table, Ledger
- Pieces are **written ahead and scheduled** — Thursdays at 06:00
- A **weekly newsletter** to 1,900 subscribers, sent Friday morning
- Findability matters more than anything: her readers arrive from search and from
  other people's links

## Why she is here today

1. "Publish a piece on Thursday morning without being awake."
2. "The archive is searchable and the old links still work."
3. "The newsletter goes to the list without a second tool."

## Onboarding answers

| Question       | Answer                                   |
| -------------- | ---------------------------------------- |
| Business name  | `The Marrow Review`                      |
| Trade          | Something else                           |
| What do you do | I need a website · I deal with customers |
| Look           | first content-shelf option; record which |

She does not tick selling or invoicing. **Nothing in this run may require the
commerce module.** If a screen makes her create a product, a price or a shipping
rule to publish an article, that is the finding this persona exists for.

## The data

### Content structure

An **Article**: headline · standfirst · body · hero image · section · author ·
photographer · publish date · tags.

A **Contributor**: name · role · one-paragraph bio · portrait · their pieces.

### The pieces to publish

| Headline                                             | Section | Author           | State                         |
| ---------------------------------------------------- | ------- | ---------------- | ----------------------------- |
| The last mill on the Nene                            | Field   | Rosalind Pike    | published                     |
| What a wet June does to a wheat contract             | Ledger  | Tobias Frankland | published                     |
| Nine kitchens, one supplier: how a city eats         | Table   | Amara Boateng    | published                     |
| The seed library that outlived its village           | Field   | Rosalind Pike    | published                     |
| Price, weather, war: reading a commodity chart badly | Ledger  | Tobias Frankland | **scheduled**, Thursday 06:00 |
| Notes on a failed harvest                            | Field   | Rosalind Pike    | **draft**                     |

Every published piece needs a real hero image with a caption and a credit — an
uncredited photograph in a journal about provenance is its own joke.

### Contributors

- **Rosalind Pike** — editor
- **Tobias Frankland** — commodities correspondent
- **Amara Boateng** — reporter
- **Jean-Luc Marchetti-Owusu** — photographer (a name long enough to break a byline)

### Subscribers

At least 40, imported from a CSV, with a real unsubscribe path. Include one
already-unsubscribed address to prove suppression is honoured.

## The run

### Act 1 — Sign up and onboard

Spine at speed. Note carefully what "Something else" installs — the generic
starter and generic pack are the fallback path, and this is the roster's first
look at it.

**Done when:** in the console, `industry` recorded (`generic` or absent — say
which).

### Act 2 — The console as a non-seller sees it

Before any work: how much of this console assumes she sells things? Home, the
first-run checklist, the rail, the empty states. Root CLAUDE.md says a CMS-only
publisher is first-class; this act is where that is true or is not.

**Done when:** every commerce assumption is either absent or filed. A first-run
checklist that tells her to add something to sell is at minimum a `major`.

### Act 3 — Define what an article is

Build the Article and Contributor structures with the fields above. Watch the
vocabulary as you go: RULE #3 says she should never be made to understand "CMS",
"content type", "collection" or "schema" to do this.

**Done when:** both structures exist and can hold a real piece.

### Act 4 — Write and publish

Enter all six pieces with real body text of at least 600 words each — not lorem,
not three sentences. A journal's layout only fails at length.

- Four published
- One scheduled for Thursday 06:00
- One left as a draft

**Done when:** the four are live and the other two are in the right state.

### Act 5 — Contributors and bylines

Create all four contributors and attach them to their pieces. Confirm a
contributor page lists what they wrote, and that the photographer is credited on
the pieces they shot without being an author.

**Done when:** bylines and credits are right on the live site, including the long
name.

### Act 6 — The site

Build the journal: a front page that leads with the newest piece, the three
sections as real navigable places, an archive that can be browsed, an About page,
and a working search.

**Done when:** published, and a reader can get from the front page to any of the
four pieces in two clicks.

### Act 7 — Be the reader

Clean browser, published site, and read it as a reader would:

1. Read a full piece on a phone width. Is the body type at least 16px, is the
   measure sane, are the images not enormous?
2. Find something via search.
3. Browse the Field section.
4. Share a piece — check the link preview card is real (title, image, excerpt).
5. Confirm the scheduled piece is **not** visible yet.

**Done when:** all five, with the reading experience honestly assessed.

### Act 8 — Getting found

For one published piece: set its title and description for search, confirm it is
in the sitemap, and check whatever structured data the site emits.

Then the harder check: does the software explain this in her language, or does it
say "meta description" and "canonical URL" and leave her to it? Get Found is the
app name; the words inside it must match.

**Done when:** the piece is properly described for search, and the jargon
question is answered.

### Act 9 — Thursday at six

Verify the scheduled piece publishes at its time. If nothing can move the clock
safely, verify the schedule exists and say plainly that firing was **not
checked** — do not publish it by hand and call that a pass.

**Done when:** either the schedule fired and is recorded, or its unverified state
is written down.

### Act 10 — The newsletter

Import 40 subscribers. Build Friday's edition — three pieces with images and
standfirsts — preview it, and send it.

- Confirm merge tags resolve against real subscribers
- Confirm the already-unsubscribed address is excluded
- Record what dev actually does with `email.send` rather than claiming delivery

**Done when:** the edition is built, previewed with real values, suppression
honoured.

### Act 11 — Correction and archive

She got a fact wrong. Edit a published piece, fix it, republish, and check:

- The URL did not change
- The old version is recoverable
- The correction is visible in the history with a date

**Done when:** the edit round-trips without breaking the link.

## What only this persona proves

A business that **never touches commerce**. No product, no price, no order, no
shipping rule — and the console must not require one. Plus scheduled publishing,
structured content with contributors and credits, an archive with stable URLs,
search description in plain words, a newsletter with suppression honoured, and a
correction that does not break a link.

It is also the roster's first run through the **`generic` fallback**, which is
what every trade the picker does not list will get.

## Verification

| Check                                                          | Result |
| -------------------------------------------------------------- | ------ |
| No screen required a product, price or shipping rule           | —      |
| First-run guidance makes sense for a publisher                 | —      |
| Article and Contributor structures built without jargon        | —      |
| Six pieces in three correct states                             | —      |
| Bylines and photo credits correct, long name intact            | —      |
| Scheduled piece invisible before its time                      | —      |
| Link preview card renders with title, image and excerpt        | —      |
| Body type ≥16px and readable at 390px                          | —      |
| Search finds a piece by a word in its body                     | —      |
| Newsletter merge tags resolve; unsubscribed address excluded   | —      |
| Edit republishes without changing the URL; history recoverable | —      |

## Run log

| Date | Act | What happened |
| ---- | --- | ------------- |
| —    | —   | —             |

## Issues found

| #   | Severity | What |
| --- | -------- | ---- |
| —   | —        | —    |
