# 899 — The jargon check could not see a one-word label, a sentence with a value in it, or a plural

**Status:** fixed
**Severity:** **major** — `check:plain-words` is the guard that keeps platform
vocabulary off a shop owner's screen. It read 1,337 files and passed, with nine
banned words live on the screens it had just read
**Found by:** P03 · act 319, while fixing issue 898
**Surface:** `piggles/scripts/check-plain-words.mjs`, and the nine screens it
could not see
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** five probes, each turning the check red on the exact shape it
used to miss

## How it came up

Adding "pipeline" to the lexicon for issue 898 found three strings and missed
`noun="pipeline"` in the same file. That is a renderer prop: it prints **"That
pipeline is no longer here"** when a process has been removed. The check read
the string, and threw it away.

## Three blind spots

**1. A one-word prop value.** The prose filter demands two words, to reject code
that happened to sit between a `>` and a `<`:

```
=> api.get(          ← what the filter exists to throw out
"pipeline"           ← what it threw out with it
```

A string assigned to `noun` or `confirmLabel` did not get there by accident. A
named copy prop is prose by virtue of its name, and the two-word rule never
belonged on it.

**2. A sentence with a value in the middle of it.** The check reaches named
props and runs of JSX text. The losing half of a ternary is neither:

```tsx
{
  unknownIds.length === 1
    ? 'This product is also in one group that is no longer in your list.'
    : `This product is also in ${String(n)} collections that are no longer …`;
}
```

The singular branch had already been reworded to "one group". The plural one,
directly beneath it, kept the word. [[feedback_a_fix_leaves_its_neighbour_behind]]

**3. The plural.** `\bcollection\b` does not match "collections" — the `s` is a
word character, so the boundary fails. That is the form the word is most often
written in. The evidence that somebody had met this before and worked around it
one word at a time: the ALLOWED list already carried `'API key'` AND
`'API keys'` as two separate entries.

## What that hid

With all three closed, twelve findings on screens the check had just read:

```
  [collection]  commerce/product-filing.tsx    "Collections"        a section heading
  [collection]  commerce/product-filing.tsx    noun="collection"
  [collection]  commerce/product-filing.tsx    "… N collections that are no longer …"
  [collection]  sample-data/data.ts            "Collections"
  [collection]  seo/audits-list.tsx            "Collections"
  [collection]  cms/media-picker.tsx           "Save … to a collection"
  [module]      migration/migration-run.tsx    "the … module is switched off."
  [module]      sites/site-create.tsx          "Turn on Builder from Modules …"
  [module]      sites/site-manage-scope.tsx    "no modules switched on …"
  [module]      finance/subscription.tsx       "not paying for any paid modules"
  [module]      modules/modules-list.tsx       six strings
  [API]         inventory/source-detail.tsx    "X-API-Key"
```

"Collection" and "module" are the first two words `piggles/CLAUDE.md` RULE #3
names as terms a person must never be made to learn.

Two are worth calling out on their own:

**The product filing pane was headed "Collections"** and its own button, six
lines below, said "Open groups of products".

**Site create said "Turn on Builder from Modules"** — an instruction to visit a
screen the Piggles console deliberately does not have (see below). Its own title
beside it already said "needs the My Site app". [[feedback_a_promise_in_copy_is_a_contract]]

**The media picker said "collection" only where a screen reader hears it.** All
seven of that pane's visible labels say "album": New album, Save to album, No
albums yet, Album name. The aria-label said "Save … to a collection".

## A fourth thing: work nobody can act on

Seven of the twelve were on two screens the Piggles console hides on purpose —
`finance.subscription` and `platform.settings.modules` — because they are about
a sparx PRODUCT: what a business pays WizeWorks, and turning priced modules on
and off. Their files sit in this tree because both consoles share a surface set,
and their copy is sparx's copy for sparx's reader.

A check that reports work nobody can act on is a check that gets switched off,
so it now skips them, reading the hidden set from the same file the app reads it
from. Un-hiding one of those screens turns the check red rather than quietly
leaving its file unscanned.

## What was reworded

```
product-filing    "Collections"  →  "Groups of products"       the section heading
                  noun/plural    →  "group" / "groups"
                  "N collections that are …"  →  "N groups that are …"
sample-data       "Collections"  →  "Groups of products"
seo/audits-list   "Collections"  →  "Groups of products"
media-picker      "to a collection"  →  "to an album"
migration-run     "the {slug} module"  →  "the {app name} app"   through moduleLabel()
site-create       "Turn on Builder from Modules"  →  "Turn My Site on from All apps"
site-manage-scope "no modules switched on beyond the site builder"
                     →  "no other apps switched on beyond My Site"
```

`X-API-Key` is now on ALLOWED with its reason: it is the name of a header her
supplier's system asks for, typed into their system, and a plainer name would
not be the one that works. That is the list's one stated reason — the word is on
somebody else's screen.

## Proved

Five probes, each restoring one of the shapes:

```
noun="pipeline"                         →  red   (one-word prop)
aria-label={`… to a collection`}        →  red   (a value in a sentence)
"… N collections that are …"            →  red   (plural)
un-hide finance.subscription            →  red   (the skip list rots)
all restored                            →  green
```

A blanket template-literal pass would have been unusable: measured over 1,264
files it reported 57 findings, 55 of them addresses and class strings. Two
rejections carry it — one that starts with a slash is an address, one with no
capital letter and hyphens through it is a list of classes — and with them the
same pass reports 2, both real.

## Checks

`check:plain-words` — 1,335 files read, 2 skipped as screens this brand hides,
0 debt, 24 words watched. All ten Piggles copy checks green. Piggles console 175
files / 1642 tests. Typecheck 0.

## Files

- `piggles/scripts/check-plain-words.mjs`
- `piggles/packages/config/src/lexicon.ts`
- the seven surfaces listed above

## The thing to remember

**A guard that filters for quality has a shape it is blind to, and the blind
shape is where the defect lives.** This one threw away single words to avoid
reporting `api.get`, and single words are exactly what a label is. It passed
green over nine live strings for as long as it has existed, and the only reason
it was ever looked at is that a fourth word was added to its list and the
count that came back did not add up.
