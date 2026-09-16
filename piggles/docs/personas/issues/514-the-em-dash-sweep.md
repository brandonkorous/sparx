# 514 — The em-dash sweep

**Status:** done
**Severity:** minor each, large in aggregate
**Found by:** a standing rule the shipped copy had never been held to
**Surface:** every console, both marketing sites, the account app, the staff
console, the shared packages and the services
**Filed:** 2026-09-15

## What was wrong

The house rule is that copy never carries an em-dash, and the reason is that a
dash between two clauses is the single most reliable tell that a machine wrote
the sentence. It had been followed for new copy and never applied backwards.

Measured before starting, counting only text a PERSON READS (string literals,
template literal chunks and JSX text, never comments):

| tree                     |     before |
| ------------------------ | ---------: |
| `wizeworks/packages`     |      2,756 |
| `piggles/apps/workbench` |      2,097 |
| `sparx/apps/workbench`   |      2,032 |
| `sparx/apps/web`         |      1,572 |
| `piggles/apps/web`       |        556 |
| `wizeworks/services`     |       ~250 |
| `wizeworks/apps/admin`   |         93 |
| `wizeworks/apps/site`    |         51 |
| `piggles/apps/account`   |         36 |
| `sparx/apps/market`      |         26 |
| **total**                | **~9,500** |

About 7,800 sentences were rewritten. What is left is listed at the bottom, and
every one of it is there on purpose.

## How it was done, and why not with a regex

A regex cannot tell `// the turn — not a feature list` from
`<p>the turn — not a feature list</p>`, and only the second is copy. So the
sweep walks the real TypeScript AST and touches only string literals, template
literal chunks and JSX text. Comments are not AST nodes, so they are excluded by
construction rather than by a pattern that could be fooled.

**A dash is not one thing, so one replacement was never going to work.** Every
sentence was sorted by the shape it takes, and the shape decides the mark:

| shape                              | becomes | example                                      |
| ---------------------------------- | ------- | -------------------------------------------- |
| two whole sentences                | `.`     | `Thanks. We got your message.`               |
| a label and the thing it names     | `:`     | `Pin: keep this open`                        |
| two halves of one sentence         | `,`     | `Not payroll, we hand the hours over`        |
| a short aside fenced by two dashes | `( )`   | `A long job (an import, an export) finishes` |

Every proposal was read before it was applied, and the machine **refused** on
anything it could not place. Roughly 900 of those refusals were written out one
at a time.

## Seven rules that had to be corrected, each found by reading

None of these were caught by a test. Each was caught by reading the output.

1. **`.ts` was being parsed as `.tsx`.** `<T>(x) => x` is a type assertion in one
   and the start of a JSX element in the other, so whole runs of source came back
   as bogus "strings" and code turned up in a list that holds only copy.
2. **`if` goes both ways and cannot be told apart by shape.** "This cannot be
   undone — if you need access again you will make a new key" wants a full stop;
   "ask whether they belong under Northgate — if you have told us that domain
   belongs to them" wants a comma. Both are `if` plus a clause with no comma. So
   every `if` was written by hand.
3. **A JSX text node is a fragment, not a sentence.** `Added — you are charged `
   looks like a short unpunctuated label and is the front half of a full
   sentence. Treating it as a label put a colon in the middle of one.
4. **A second colon in one short string stutters.** `channel-sync: connection has
no stored token: skipping`. Where the left half already carries one, the dash
   was doing a comma's job.
5. **The fence rule swallowed paragraphs.** Two dashes in a paragraph are usually
   two separate marks in two different sentences. Bracketing between them
   produced `...in front of your work (themes, pages, a custom domain, all
handled. Pick a theme, edit it, publish. The same builder serves a portfolio,
a blog, or a 50,000-product catalog) selling is optional.` Six paragraphs were
   mangled this way and repaired; the rule now refuses an inside that is long, or
   that ends a sentence, or that is already inside a bracket.
6. **The applier flattened multi-line documents.** The table is keyed on the
   whitespace-collapsed body of a string, and writing that back over a template
   literal holding markdown destroys the line breaks, which ARE the content. An
   llms.txt heading came out as `# sparx (full platform reference > sparx (by
WizeWorks) is ...` on one line. Eight files were restored and redone with an
   applier that edits the source in place and **refuses** when the region it would
   touch contains a line break.
7. **An unspaced dash is not punctuation.** A quick helper written late in the
   sweep skipped that check and turned `{{customer.fullName ?? "—"}}` into
   `{{customer.fullName ?? ", "}}`, changing what a merge tag falls back to.

## Three tests it broke, and what each one says

The sweep rewrites test files on the way through, so a test asserting a piece of
copy changes with it. Three still went red, and each is worth keeping:

- **A regex assertion.** `toMatch(/12 digits — this one has 11/)` is a RegExp
  literal, not a string, so the AST walk never saw it.
- **A test whose OWN format string changed.** `blueprint-sweep.test.ts` builds a
  line as `` `${rule} — ${evidence}` `` and then filters for
  `endsWith('page-unreachable — /collections')`. The shared template chunk was
  swept; the filter, which exists only in that file, was not. **Its count went
  from 56 to 0 and it went red rather than passing over nothing**, which is what
  that check was written to do.
- **An expected rendered output.** `'New arrival — Aurora Down Jacket'` is what
  the template `'New arrival — {{announce.title}}'` renders to, and no table
  entry could reach it because the two halves differ.

## What is deliberately left

**The bare `—` that means "no value" stays: 581 of them.** It is not prose with a
dash in it, it is a glyph standing in for a figure nobody measured, and the
product explains itself in exactly those words on the page-results screen:

> That is why Bought and Sales read `“—”` rather than zero: nothing was measured,
> so there is nothing to report.

Swapping it would contradict a sentence we ship and would undo
[[feedback_never_present_absence_as_measurement]]. The four places that name the
glyph (two that explain it in copy, a merge tag whose fallback IS the glyph, and
the SQL comment that says why a row with no cost price prints it) are left with
it for the same reason.

**Test names stay: 667 of them.** A test name is developer text, the same
category as the roughly 7,000 em-dashes still sitting in `//` comments across
the repo. The rule this sweep serves is about the words a customer reads.

## Checks

109 test suites pass. Every console and app typechecks. Prettier clean repo-wide,
eslint clean, and all fifteen structural checks pass, including
`check:blueprint-versions` and `check:blueprint-journal`. All 376 catalog
generators parse, all 1,136 catalog JSON files parse, and the blueprint sweep
test walks every shipped bundle and passes (388 tests).

Verified on screen, which is the only reason the three surfaces above were found
at all: the Piggles marketing home, /apps, /pricing and /how-it-works each render
zero em-dashes now, and the sparx console renders six, all of them stale seeded
ROWS whose source measures zero.

`check:brand` went red twice and both times it was right: five strings banked in
`scripts/platform-brand-debt.txt` and `scripts/foreign-brand-debt.txt` are banked
by their EXACT text, and rewording one makes it read as a new violation. Each was
re-recorded with its new punctuation, which is the same debt and not a new
allowance.

## Three surfaces the source sweep could not reach

All three were found by opening the home page and reading it. None of them is in
a `.ts` string, so no amount of scanning source would have turned them up.

### 1. `&mdash;`, the entity

Fourteen sentences on live marketing pages wrote the dash as an HTML entity. The
AST walk reads string literals and looks for the CHARACTER; an entity is six
ASCII letters. `What you pick changes what you see first &mdash; never what you
are allowed to have` sat on the Piggles home page through the entire sweep.

Also checked and clear: `&#8212;`, `&#x2014;`, and `—` escapes (three, all
in JSDoc). `&ndash;` is left alone: an en-dash in a range is correct typography.

### 2. Copy that ships as ROWS

The banner reading `...for as long as they stay — ask us how` is not in any file.
It is a row in `platform_announcements`, written by a migration. **5,421 rows
across 79 columns** carried a dash, which is the whole seeded surface: automation
names, product titles, demo CRM activity, page SEO.

Almost all of it is a STALE COPY of source this sweep already fixed, and every
seed source now measures zero: `sample-data` 0, `marketplace-catalog/blueprints` 0. A fresh seed or install carries the corrected text. The banner is the
exception, because a migration wrote it and only a migration can change it:
`20270505000000_announcement_drops_its_em_dash`, matched on the exact old text so
an announcement already reworded by hand is left as it is.

### 3. The blueprint catalog: 191 of 191 bundles

**8,408 dashes in the shipped bundles and 9,248 in the generators that author
them**, in copy that is COPIED into a tenant's site at install. Swept with
Brandon's go-ahead, because the fix has an outward-facing consequence.

**A regen was not available.** `gen-template-*.ts` assigns node ids from a random
base, so running one rewrites every id in its `site.json`, and those ids are
persisted with the tree and used as React and dnd keys. So the generator and the
JSON it emitted were edited IN LOCKSTEP and no generator was run. Both halves go
through one `rewrite()` function for exactly that reason: the catalog holds each
sentence twice and the two must not drift.

**13,504 replacements, 880 JSON files, 364 generators, 191 bundles.** Proven: 0
files where added lines differ from removed, **0 changed lines touching an `id`,
`nodeId` or `key`**, and all 1,136 JSON files still parse. The JSON was spliced as
TEXT, not re-serialized, because a round-trip is not byte-identical and would
have reformatted every file.

**Then 191 version bumps, in four places each.** A content change with no bump
reaches nobody: the update machinery decides there is something to offer by
comparing versions. The number lives in the bundle's `sparx.json`, its
`blueprint.ts` (the loader cross-checks the pair), the shared harness
`BUNDLE_VERSION` that emits most of them, and two standalone generators. Miss
either of the last two and the next regen quietly puts the old number back. 191
manifests + 191 payloads + 5 generators; every pair verified to agree.

## Worth keeping in mind

**A sweep is done when its diff has been read, not when it compiles.** Every one
of the seven rule corrections above passed typecheck, lint and 109 test suites
before it was caught, because none of them is a type error. They are sentences
that read wrong.

**And reading the diff is still not reading the screen.** The source sweep was
finished, green on every check, and written up as done. Then the home page was
opened and the very first paragraph carried a dash, because it was spelled
`&mdash;`. That one sentence led to the entity family, to 5,421 rows of seeded
copy, and to 8,408 dashes in the starter sites every tenant installs: three
surfaces, none of them reachable by scanning source, all of them found by
looking.
