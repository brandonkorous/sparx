# 863 — The words were stored in the rows, so the rewrite reached one business of sixteen

**Status:** fixed
**Severity:** **major** — the SEO scorecard's whole vocabulary was frozen into each
stored row, so the plain-English rewrite of all thirteen checks reached the code and
**one** of the sixteen businesses on the platform. The other fifteen were still
reading "Listed in sitemap.xml", "Canonical & readable slug" and "Structured data
(JSON-LD)"
**Found by:** P03 · act 306, opening Get Found because a page's advice said "Add a
single H1" on a console whose own heading for that check reads "One main heading"
**Surface:** mypiggles › Get Found › Things worth fixing, in both consoles
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** her own pane, refreshed and **not** rescanned, plus the database

## The two sentences on one list

Her page list, read from the live DOM:

```
Fix first: Give the page one big heading at the top. It is how a search engine
           works out what the page is about.
Fix first: Add a single H1 — it tells search engines the page’s main topic.
```

One problem. Two sentences. The second says **H1**, which is markup vocabulary on a
product built for people who have never written any, and carries an **em dash**,
which this platform bans in copy. The em-dash guard was green over it, because the
sentence is not in a file: it is in a database column.

## Where the words actually lived

`seo_audits.card` stores the whole scorecard, and every check inside it stores its
own `label` and `tip`. So the sentences were a snapshot of the code as it stood the
day that page was scanned.

```sql
SELECT chk->>'id', count(DISTINCT chk->>'label')
  FROM seo_audits a, jsonb_array_elements(a.card->'checks') chk GROUP BY 1;
```

**All thirteen checks came back with two names.** The split:

| the old name                      | the name the product uses                       | rows      |
| --------------------------------- | ----------------------------------------------- | --------- |
| Listed in sitemap.xml             | It is on the list we give search engines        | 226 / 144 |
| Canonical & readable slug         | The web address is tidy                         | 226 / 144 |
| Structured data (JSON-LD)         | Extra detail search engines can read            | 226 / 144 |
| Meta description is set           | The page has a short summary                    | 226 / 144 |
| Heading structure                 | One main heading                                | 226 / 144 |
| Image alt text                    | Every picture is described                      | 226 / 144 |
| Page is indexable                 | Search engines are allowed to list it           | 226 / 144 |
| Social share image                | The picture shown when it is shared             | 226 / 144 |
| Content depth & internal links    | Enough to read, and somewhere to go next        | 226 / 144 |
| Title length · Description length | How long the title is · How long the summary is | 226 / 144 |
| Meta title is set                 | The page has a title                            | 226 / 144 |
| Discoverable by AI engines        | AI assistants can find it                       | 226 / 144 |

**226 of 370 stored scorecards on the old set.** And by business:

```
WizeWorks LLC        131 of 131 on the old words
Wildroot Flowers      28 of 28
Thistle & Rye         23 of 23
Halo & Hem            10 of 10
…and eleven more, every one of them 100%
Juniper Row            4 of 148
```

**Fifteen of the sixteen businesses, entirely.** A card is rewritten only when its
page is saved or somebody runs a scan, and only Juniper Row had been scanned since
the rewrite. Every word of a rewrite that was correct, tested and shipped was
sitting one rescan away from anybody seeing it.

## The patch that was already here is the lesson

The site-wide band had hit this and been fixed, and the fix's own comment is the
thing to read:

> A stored card is a SNAPSHOT: it keeps the label the checks carried on the day
> that page was scored… Grouping by (id, label, category) made every rewording
> split one check into two rows… one live site showed all THIRTEEN checks twice —
> "Title length, 33 of 37" directly above "How long the title is, 52 of 93".
>
> The `id` is the check's real identity and has never changed, so it is what
> groups; the words and the category are taken from **the most recently scored
> card, which is the wording the product uses today.**

Grouping by `id` was exactly right. The last clause is false. The newest row is the
current wording only on a site somebody has rescanned — which is one site in
sixteen, so on the other fifteen the newest row is the **oldest** wording, and the
band confidently rendered it as today's.
[[feedback_never_present_absence_as_measurement]]

A guess that is usually right is still a guess, and this one had already been
written down as a fact.

## What it does now

**The words come from the code. Always. For a card scored a second ago or in June.**

A new module, `check-copy.ts`, is the one place the thirteen labels and every tip
live. Two things read it:

```
the engine          finalize() fills every label and every tip from it
every read path     refreshCard() re-says a stored card in today's words
```

The engine reading it is the part that makes it safe. A tip is not stored, it is
**derived** from what the check found — and six of the thirteen say different
things depending on what they found (a title too short or too long, a heading
missing or duplicated). Those variants are recoverable from the `status` and the
`value` the row already keeps, plus the row's own `entity_type`:

```
heading-h1     value "no main heading"      → "Give the page one big heading…"
               value "3 main headings"      → "Keep one big heading and make the others…"
title-length   value "84 characters"        → "A long title gets cut off…"
content-depth  value "1,240 words · 0 links" → "Add a few links to your other pages…"
```

Because the ENGINE derives its tips the same way, all 30 existing audit tests
exercise that parsing on every fresh card. A `value` format that stopped matching
fails immediately, instead of failing quietly on old rows only.
[[feedback_a_test_that_cannot_go_red]]

**A refresh is not a rescan.** `score`, `grade`, `status`, `value`, `earned` and
`weight` are the scan's findings and are untouched. Only the sentences move. A test
asserts a refreshed card equals a fresh one field for field, on all four entity
types.

Also fixed, riding along: the `indexable` check authored a tip
("If that was not deliberate, turn it back on") in the one state — `info` — where
`finalize` strips advice off, so the sentence could never reach anybody. It is
`null` in the new module by construction rather than written somewhere it cannot be
read from.

## On screen, refreshed and NOT rescanned

That distinction is the whole proof: a rescan would have rewritten the rows and
hidden the bug.

```
before   Add a single H1 — it tells search engines the page’s main topic.
         A branded card is generated automatically. Upload a custom image for a stronger share.

after    Give the page one big heading at the top. It is how a search engine works out what the page is about.
         Keep one big heading and make the others a size smaller, so it is clear which one the page is about.
         We make one for you in your colors. Your own photograph will always do better.
```

Both old sentences are gone from rows last scored on **2026-08-29**. And the third
line is new: it is the _several headings_ variant, derived correctly out of a
two-month-old row's stored `value`.

The band is unchanged on her screen, and that is the expected result — hers is the
one tenant whose newest row was already current, so the old guess and the new
certainty agree. The band fix is proved by the code (`RawCheckRow` no longer has a
`label` field and the SQL no longer selects one) and by the pinned-vocabulary test.

## Proved

**17 tests**, and **proved red three ways**:

```
change one label in the table          → 1 of 17 fails (the pinned vocabulary)
stop refreshCard replacing labels      → 2 of 17 fail
remove a label entry                   → the every-check-has-a-label test fails
```

The first of those matters most, and it is a correction: the first draft tested for
markup words with a regex, and **"Heading structure" sailed through it** — it is not
jargon, it is just somebody else's vocabulary, and it is the exact label the rewrite
replaced. A test that could not go red on the real regression was replaced with the
thirteen labels pinned exactly. A label edit now lands on all 370 stored rows at
once, so having to come to the test and change it deliberately is the right cost.

**Checks:** typecheck 0 on `seo-audit` and `api-rest`. Tests: seo-audit 3 files / 47
(was 2 / 30), api-rest 33 / 269. Guards `em-dashes`, `plain-words`,
`american-spelling`, `boundaries` green. ESLint and prettier clean.

## Files

- `wizeworks/packages/seo-audit/src/check-copy.ts` (new, the one place)
- `wizeworks/packages/seo-audit/src/check-copy.test.ts` (new)
- `wizeworks/packages/seo-audit/src/audit.ts` (the engine reads it; drops 13 labels and 12 tips)
- `wizeworks/packages/seo-audit/src/index.ts`
- `wizeworks/services/api-rest/src/routes/v1/seo/audit.ts` (the page list re-says fix-first)
- `wizeworks/services/api-rest/src/routes/v1/seo/reports.ts` (the band takes labels from the code)

## The thing to remember

**Copy in a row is copy you cannot edit.** Every other sentence on this platform
lives in a module a rewrite reaches instantly. These thirteen lived in 370 JSON
blobs, so a correct, tested, shipped rewrite was invisible to fifteen of sixteen
businesses and nobody could tell, because each individual screen was internally
consistent — old labels beside old tips, reading like a product that had simply
never been rewritten.

And the sharper one: **the earlier patch made the bug harder to see.** Taking the
label from the newest card is a real improvement — it stopped thirteen checks
appearing twice — and it moved the failure from "obviously broken" to "quietly
wrong on most tenants". It also wrote the guess down as a fact in a comment, which
is how the next person reads it and stops looking. A fix that narrows a symptom is
worth checking for what it now hides.

## Not a bug, checked and dropped

"How long the title is — 43 of 49 pages to fix" sits above pages graded
**Excellent**, which looked like a contradiction and is not: the check is worth 8
points of about 92 scored, so a page can lose all of them and still clear 90. 7 of
her 29 excellent pages are in that position, the failing row is visible on each
one, and the grade is honest. Recorded rather than filed.
