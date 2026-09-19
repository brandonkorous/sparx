# 607 — The ready-made lists talked to me in the word the screen was renamed to avoid

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 205
**Surface:** mypiggles › Sell › What fits what
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 205 (seen on screen, 0 of 14)

## What happened

I sell coats in sizes, so **What fits what** is a screen I use. I opened
**Start from a ready-made list** to see what else was on offer, and read this:

> **Vehicle** — Automotive fitment. Make → Model → Engine, narrowable by model
> year.
> **Apparel sizes** — Clothing fitment: a single Size axis (alpha + numeric), no
> sub-levels.
> **Footwear** — Shoe fitment: Department → Width, narrowable by US shoe size.
> **Device** — Phone & tablet fitment: Brand → Model, for cases, screens, and
> accessories.
> **Pet** — Pet fitment: Species → Breed, narrowable by body weight.

Five of the fourteen visible without scrolling, every one of them saying
**fitment** — on a screen this console is called **What fits what** precisely so
that word never reaches me. Plus "axis", "narrowable", "sub-levels", and
`W×H×D`.

The same sentence is stamped onto my own record when I install a list. Mine
reads:

> **Note** — _Optional. Only your team sees this._
> Clothing fitment — a single Size axis (alpha + numeric), no sub-levels.

So a note supposedly written by my team is a developer's shorthand, with an
em-dash in it.

## Why the sentence was wrong even apart from the word

Look at what sits directly underneath each one:

```
Vehicle
Automotive fitment. Make → Model → Engine, narrowable by model year.
[ Make → Model → Engine · Year ]   4 makes
```

The chip already draws the chain. The sentence was spending itself repeating a
picture, in worse words, and had nothing left for the half the chip cannot
carry: **what the list is for, and what a shopper actually does with it.**

**Fixed:** all fourteen rewritten to say that.

> **Vehicle** — For parts that only fit certain cars and trucks. A shopper picks
> their make, model and engine, and you can narrow it further by year.
>
> **Apparel sizes** — For clothing sold by size. One plain list of sizes, with
> letters and numbers together, and nothing underneath them.
>
> **Pet** — For collars, beds, coats and harnesses. A shopper picks the animal,
> then the breed, and you can narrow it further by weight.

Seen live: zero hits for fitment, axis, narrowable or sub-level anywhere in the
picker.

## Two more of the same word, on screens I had not opened

Once the guard could see the word (below), it named two the walk had not reached:

- `collection-rules.tsx` — "**Fitment conditions**", badge "**Set up in
  Fitment**". The paragraph under them already said "the What fits what screen",
  correctly. Only the heading and the badge leaked.
- `product-fitment.tsx` — the toolbar's accessible name, `"Fitment actions"`.
  Invisible unless you are using a screen reader, which is exactly the reader
  who cannot see the renamed tab above it for context.

Both now read in the console's own words.

## Why the guard did not catch any of it

`check:piggles-nav` exists for this and reported **clean**. Three separate
reasons, each worth fixing:

**1. It only read files under `apps/workbench`.** The ready-made lists are a
shared package, so the strings were invisible to it. The scan now takes a repo
root as well, with the fitment dictionaries declared as a catalog like the three
console ones.

Scanning a package needs care: these files are mostly TREES of real-world names,
every make, model and engine carrying a `name` three and five levels deep.
Scanning those would flag "Ford" as a competitor and get the whole check
switched off. So the entry declares `indent: 2` — the dictionary's own fields and
nothing below them. 111 catalog strings became 139, which is exactly the 14 names
and 14 descriptions.

**2. `fitment` was not a banned word.** The console renamed a whole surface to
avoid it and the lexicon never learned. Added, with the reason.

**3. The checker's banned list was a HAND-TYPED COPY** of the lexicon's, under a
comment saying it came from there. It did not, and they had drifted. That is the
third time today the same shape has turned up: a list written in one place,
copied into another, and a comment promising they are kept in step.

It now parses `BANNED_IN_PRODUCT_COPY` out of the lexicon, throws by name if the
declaration moves, and floors the word count so a shape change fails instead of
checking every screen against an empty list.

## One more thing the file was hiding

`check-nav-vocabulary.mjs` contained a **literal NUL byte** — a separator in a
composite map key, typed as the character instead of the escape.

A single NUL makes a file BINARY to grep and ripgrep. **Every repo-wide text
search silently skipped the vocabulary guard**, including a search for the rule
you are looking for when you are looking for it, and including three of mine
during this act. Replaced with the six-character escape for it, which is the same value; the guard
reports the same 12,559 strings before and after, so the change is provably
behavior-preserving.

## Guard

The existing `pnpm check:piggles-nav`, now able to see the strings.

Proven red by putting one old description back:

```
✗ sparx vocabulary in the Piggles nav
  [fitment] catalog  "Clothing fitment: a single Size axis (alpha + numeric), no sub-levels."
```

That red run is what found the two console leaks above — it reported three, not
the one I planted.

Proven red **blind** twice: pointing the lexicon at a file that does not exist
fails by name rather than by stack trace, and the word-count floor fails if the
list is emptied.

And the red run found a bug in my own parser on the way: every hit printed
twice, because the lexicon entry explaining why a word is banned **quotes that
word**, and the scan was reading comments. Comments are stripped first now.

## Still open

Nothing from this issue.

Noted, not filed: the four rows already stamped into tenants keep the old
sentence, and they should. A stamped list is the tenant's own copy from the
moment it is installed — overwriting it on a later deploy is the opposite of
what [604](604-the-words-on-the-built-in-product-kinds-were-fixed-in-the-repo-and-nowhere-else.md)
asks for, because that one is platform-owned and this one is not. Every install
from here gets the new words.
