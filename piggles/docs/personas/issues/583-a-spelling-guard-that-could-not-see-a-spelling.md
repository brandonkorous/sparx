# 583 — A spelling guard that could not see a spelling

**Status:** fixed and proven red
**Severity:** medium
**Found by:** breaking my own guard to check it worked
**Surface:** `piggles|sparx/apps/workbench/lib/console/american-spelling.test.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_a_test_that_cannot_go_red]] · [[feedback_structural_checks_go_blind]] · [[feedback_american_spelling]]

## The drift

The two consoles had come apart on spelling. Piggles said "Tickets and
licenses"; sparx said **"Tickets and licences"** — in a pane title, a section
heading, a field description and a nav entry, plus "fulfilment" in an inventory
hint. Four screens an owner reads, in British English, on an American product.

Corrected. That part took a minute.

## The part worth writing down

I wrote a guard so it could not come back, ran it, and it was green. I did not
believe it, so I put the drift back in and ran it again.

**Still green.**

The test had been written through a shell heredoc, and the heredoc ate a
backslash:

```ts
const found = new RegExp(`\b(${words})\b`, 'gi').exec(line);
```

`\b` inside a template literal is a **backspace character**, not a word
boundary. The pattern was `<BS>(licence|colour|…)<BS>`, which matches nothing at
all. The guard scanned 686 files, found nothing, and reported that everything was
spelled correctly — while `person.tsx:603` said "licences" three lines from where
it was looking.

This is the exact trap already recorded twice in this run's notes, and it went in
anyway. The only thing that caught it was the rule about proving a guard red
before believing it.

## What the fixed guard does

- `String.raw` for every pattern, so no escape can be eaten again, and a comment
  at the top of the file saying to edit it with an editor rather than a heredoc.
- **A test of the matcher itself**, before anything trusts what it reports:
  `britishIn('Tickets and licences')` must be `'licences'` and
  `britishIn('Tickets and licenses')` must be `null`. A guard whose matcher is
  broken now fails on the matcher, loudly, rather than passing on the tree.
- **String literals only**, which is what the header always claimed. Scanning
  whole lines flagged `const { data: catalogue } = useMigrationVendors()` three
  times — an identifier nobody reads. (Renamed anyway, for the house rule.)
- **Two denominators asserted**: more than 200 files and more than 2,000 string
  literals, so a scan whose roots moved fails instead of passing silently.

## The exemption, and why it has to exist

A British spelling is allowed where it is a **deliberate alias**: a bare word in
an array, in a file that also carries the American spelling.

```ts
keywords: ['certifications', 'licences', 'licenses', 'tickets', …]
company: ['company name', 'business', 'organisation', 'organization', 'account']
```

The first keeps the pane findable for an owner who types "licences". The second
matches a column heading in a spreadsheet somebody else wrote — deleting the
British form silently stops matching their file, which is
[[feedback_a_copy_edit_breaks_identity_lookups]] exactly. A sentence is never a
bare word, so the exemption cannot swallow copy.

The same reasoning left `FAVOURITES_LIST = '~favourites'` alone: it is a
persisted id, not something anybody reads.

## Proven

With the drift reinstated, the rewritten guard reports **exactly one hit** and
nothing else:

```
× are spelled the American way, unless the word is a deliberate alias
    AssertionError: British spelling in copy: expected [ Array(1) ] to deeply equal []
    +   "staff/person.tsx:603  licences  Tickets and licences"
```

One hit, the right one, no false positives. Before the tightening the same run
reported five, three of them the `catalogue` identifier and one the keyword alias.

|                 |                         |
| --------------- | ----------------------- |
| piggles console | **474 pass** (56 files) |
| sparx console   | **376 pass** (47 files) |
| typecheck       | both exit 0             |
| console parity  | PASS                    |
