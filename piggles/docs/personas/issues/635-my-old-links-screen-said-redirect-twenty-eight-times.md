# 635 — My "Old links" screen said "redirect" twenty-eight times

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 216
**Surface:** mypiggles › Content › Old links, Tell other software, and Domains
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 216 (seen on screen, before and after)

## What happened

Content › Old links. Eleven rows, the top one `/gift-cards → /gifts`. The screen
is called **Old links** in the rail and on the tab. Then:

```
Column header            Redirect
Button                   Add redirect
Under the list           11 redirects
Empty state              No redirects yet
When something breaks    Could not load your redirects
```

I run a clothes shop. I know what an old link is; the screen just told me. I do
not know what a redirect is, and nothing here says.

## Why it happened

The decision was already made, and written down in the console's own vocabulary
file:

> // "Redirects" is **infrastructure**. What it means to a shop owner is that a
> // link they printed on a flyer two years ago still works.
> `'cms.redirects.list': 'Old links',`

And three lines further down the same file, the same author catches the exact
failure this is:

> // Unlisted, so it is never a nav row — but it is the **PANE TAB** once one is
> // open, and a tab reading "Webhook" is the jargon the list title avoids.
> `'cms.webhooks.detail': 'Telling other software',`

So the thinking was done, the rename reached past the nav row for webhooks, and
did not for redirects ([[feedback_a_fix_leaves_its_neighbour_behind]]).

Measured 2026-09-17:

| where                              | strings |
| :--------------------------------- | ------: |
| the Old links screen               |      24 |
| Tell other software (event picker) |       4 |
| Domains (making one the main one)  |       1 |
| **total**                          |  **29** |
| plus the route's own refusals      |       3 |

The last row is the one that could not be fixed by renaming: the routes are
shared with sparx, where "redirect" is the right word, and their 4xx sentences
are shown verbatim. Adding the same old address twice answered:

> A redirect from "/sale" already exists.

## The fix

The concept is **an old link**, the name the console already chose. All 29
strings, plus the pane tab for the import screen (`'cms.redirects.import':
'Import old links'`), which `check-nav-vocabulary` caught.

The three route sentences are translated on arrival in `redirectErrorMessage`,
sentence by sentence rather than by swapping the word, because two need more:

| the route says                          | the screen says                               |
| :-------------------------------------- | :-------------------------------------------- |
| A redirect from "/sale" already exists. | There is already an old link from "/sale".    |
| A redirect cannot point to itself.      | An old link cannot point at itself.           |
| Redirect would create a loop via …      | That would send visitors round in a circle: … |

"Loop" is its own piece of jargon, which is why that one is not a swap. An
unrecognised sentence still gets the word swapped out, because a new refusal
tomorrow is the likely future and half-translated beats reintroducing the word.

### The trap inside the fix

`isDuplicateRedirectError` decides whether to offer **Change the existing one** —
the only one of the three refusals that has somewhere to send a person. It
decides by looking for "already exists" in the sentence, and it read that
sentence through `redirectErrorMessage`.

The plain version contains neither "already exists" nor "redirect". Translating
in place would have switched that button off on every duplicate: the one case it
exists for. It now reads the raw sentence, and a test says why.

Confirmed on screen:

> **Could not add that old link**
> There is already an old link from "/sale". [ **Change the existing one** ]

## The guard, and what it caught

`redirect` joins `BANNED_IN_PRODUCT_COPY`. That is the real fix: the word cannot
come back.

Adding it turned `check:plain-words` red on **17** strings, which is not 29 — and
the gap is a second blind spot in that check, found the same way 633's was.

### `isProse` could not see a short phrase

Its "two real words" test was `/[A-Za-z]{2,}\s+[A-Za-z]{2,}/` — two ADJACENT
words of two letters or more. **"Add a redirect"** has three words and no two
long ones side by side, so the button saying it was invisible to the check that
exists to catch exactly that.

Loosening it alone re-admits the noise the rule was written for:

|                                  | strings gained | new findings |               of those real |
| :------------------------------- | -------------: | -----------: | --------------------------: |
| looser word test alone           |            286 |           29 | **1** (28 were `api .list`) |
| plus two tighter code rejections |            212 |        **1** |                       **1** |

The two rejections: a run containing whitespace-then-dot (`api\n  .list`
collapsed), and requiring a LETTER before the full stop in the
sentence-escape-hatch, so `id ? api.patch` stops reading as prose. With those,
the looser test **loses nothing** and gains the one real string.

### `check-nav-vocabulary` was reading test files

With the sweep done, it reported `"That redirect is not allowed here."` as screen
copy — a fixture in the test pinning the translation. A test that pins how a word
is translated has to quote the untranslated one, so reporting it makes the honest
fixture the thing that fails the build. `check-plain-words` has excluded tests
since it was written; this did not. Now it does.

It then caught the one thing the sweep had missed: the pane tab for the import
screen, still reading **"Import redirects"**.

| check                  | before | after      |
| :--------------------- | -----: | :--------- |
| words watched          |     21 | **22**     |
| findings when red      |      — | 17, then 1 |
| nav-vocabulary strings | 12,448 | 12,448     |

Both are green, and both were red on real code first.

## Noted, not a defect

The "Code N" badge for an unrecognised redirect type carries `tone: 'neutral'`,
which RULE #4 says needs asking about every time. Pre-existing, on a branch that
only renders for a status code nobody on this platform has set.
