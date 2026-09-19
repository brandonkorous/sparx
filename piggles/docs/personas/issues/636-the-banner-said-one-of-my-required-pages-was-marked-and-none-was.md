# 636 — The banner said one of my required pages was marked, and none was

**Status:** fixed
**Severity:** low
**Found by:** P03 · Juniper Row · act 217
**Surface:** mypiggles › Content › Legal pages
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 217 (seen on screen, before and after)

## What happened

Content › Legal pages, green banner at the top:

> **Your required pages are all set**
> Every page you are expected to have is published, up to date, and linked in
> your footer. **1 of them still says things we guessed about your business. They
> are marked below.**

Below it, **Pages you should have**: Privacy Policy, Terms of Service, Cookie
Policy, Return Policy. All four Published. **None of them is marked.**

The marked one is two sections further down, under **Optional pages** — my Refund
Policy, which carries "Still our wording" and this, which is very good:

> Nobody has changed this page, so it still says:
> · that a refund is paid within five to ten working days of being approved
> · that you keep the original delivery charge unless something arrived wrong
>
> We had to write something, and we guessed. Change anything that is not how you
> work.

So the fact is right and the sentence pointing at it is wrong about where to look.

## Why it happened

```ts
const requiredItems = items.filter((item) => item.required);
const optionalItems = items.filter((item) => !item.required);

// Published pages still carrying a sentence the starter guessed for her.
const guessingCount = items.filter((item) => (item.stillGuessing ?? []).length > 0).length;
```

The two groups are separated on the line above and the count is taken over
`items` ([[feedback_a_fix_leaves_its_neighbour_behind]]). The server does not make
the same mistake — its `completeness` is required-only — so the banner's title is
right and only the sentence after it is wrong.

The word "them" in that sentence refers to "every page you are expected to have",
which is exactly the group the count does not respect.

Measured 2026-09-17:

|                                                    |              |
| :------------------------------------------------- | -----------: |
| tenants with a Shipping Policy and a Refund Policy | **90 of 90** |
| Refund Policy pages never content-edited           |           87 |
| Shipping Policy pages never content-edited         |           87 |
| **required** pages still guessing, on her account  |        **0** |
| optional pages still guessing, on her account      |        **1** |

So every commerce business on this platform has two optional pages, and almost
none of them has changed the wording — which makes this the ordinary case rather
than an edge one.

## The fix

The two counts are taken separately and never added into one noun
(`legal-guessing-words.ts`):

| required | optional | the sentence                                                                                           |
| -------: | -------: | :----------------------------------------------------------------------------------------------------- |
|        0 |        0 | (nothing)                                                                                              |
|        0 |        1 | 1 of **your optional pages** still says things we guessed about your business. **It** is marked below. |
|        1 |        0 | 1 of **them** still says things we guessed about your business. **It** is marked below.                |
|        3 |        0 | 3 of them still **say** things we guessed about your business. **They** are marked below.              |
|        2 |        1 | 2 of them **and 1 of your optional pages** still say things we guessed about your business.            |

A second, smaller thing went with it: the singular used to read "**They** are
marked below" over a single row.

On screen now:

> Every page you are expected to have is published, up to date, and linked in
> your footer. **1 of your optional pages still says things we guessed about your
> business. It is marked below.**

sparx's legal screen carries no such sentence, so there was nothing to mirror.

## Guard

`legal-guessing-words.test.ts`, **6 tests**. The one that is a rule:

```ts
it('does not claim it is one of the required ones', …)
  expect(line).not.toContain('of them');
```

Proven red by pointing the optional branch back at "them": **1 of 6** fails, and
it is that one.
