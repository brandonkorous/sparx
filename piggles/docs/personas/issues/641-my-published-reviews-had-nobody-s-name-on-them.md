# 641 — My published reviews had nobody's name on them

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 221
**Surface:** the tenant website's product page, and mypiggles › Sell › Reviews / Questions people ask
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 221 — the console half on screen; the
website half **not checked on screen**, for the reason below

## What happened

Two cards sit side by side on a product page, written the same way, in the same
folder, by the same hand. One of them names the person and one of them does not.

The question card:

```tsx
{
  question.displayName ? (
    <span className="font-semibold">{question.displayName}</span>
  ) : (
    <span className="font-semibold">A customer asked</span>
  );
}
```

The review card, its neighbour:

```tsx
{
  review.author ? <span className="font-semibold">{review.author}</span> : null;
}
```

So a review with no signed name renders as stars, a Verified purchase badge and a
date, with **nobody attached to it**. A shopper reading it cannot tell whether it
came from a person or from the shop.

Measured 2026-09-18, across every business on the platform:

|                                      |                                     |
| :----------------------------------- | ----------------------------------: |
| reviews published on a live website  |                                 111 |
| of those, showing **no name at all** |                              **85** |
| businesses affected                  |                               **8** |
| questions published                  |                                  54 |
| of those, with no signed name        |                                  34 |
| how many of those 34 read badly      | **0** — they say "A customer asked" |

The same absence, on the same page, one card apart: handled on one, dropped on
the other. [[feedback_a_fix_leaves_its_neighbour_behind]].

## Why the name is missing so often

A review carries both a **customer account** and a **signed name**, and the signed
name is the one the website publishes. The service's own schema says what the
field is for:

```ts
displayName: z.string().max(63).nullish(), // overrides customer name
```

"Overrides" says there is something to override. Nothing anywhere falls back to
it. The public storefront form happens to require a name, so a review typed on
the website always has one — but every other way in (an import from the platform
a shop is moving off, the MCP tools, a staff-side entry) may leave it null, and
85 of the 111 published reviews came in that way.

**The fix is NOT to publish the account holder's real name.** Somebody who did not
choose a name to sign with did not agree to their full name appearing under their
words. So the review card now says what the question card already says: a plain
**"A customer"**.

## The second thing, on her own row

Her one customer question is signed **Tomas Villalobos** on her website. Her
console called it **Marguerite Adeyemi** — the account it was asked from.

```ts
// account name, then the name they SIGNED with, then a fallback
export function customerLabel(customer, signedAs) { … }
```

That order was set to stop a guest reading as "A guest". It does, but it also
means that where both exist, **the console shows the one name her customers never
see**. If a shopper writes in about the question they asked, she searches her
console for the name they used and finds nothing.

The console now leads with the name her website publishes, and says whose account
it came from underneath, so neither is lost:

> **Tomas Villalobos**
> from Marguerite Adeyemi's account

That second line only appears when the two differ. A guest reads exactly as
before.

## Guard

Two files, because the two halves live in two places.

`review-author-words.test.ts` on the website, **5 tests**:

```ts
it('never leaves a review with nobody attached', …)
it('answers the same absence the review card does', …)
```

`product-reviews-view` and `product-questions-view` now take their fallback from
that one module, so the pair cannot drift apart again. Proved red by dropping the
review card's fallback: **3 of 5** fail.

`moderation-names.test.ts` in each console, **7 tests**:

```ts
it('leads with the name her website publishes', …)
it('still names the account underneath, so nothing is lost', …)
it('never leaves two signed reviews reading the same', …)
```

Proved red by putting the account-first order back and dropping the note:
**2 of 7** fail.

## What was NOT checked on screen, and why

The console half was driven as Devi and read back from her own Questions screen:
her row now says **Tomas Villalobos** with **from Marguerite Adeyemi's account**
under it.

The website half was **not** seen rendered. Every business holding a published
review with no signed name is billing-suspended, so its site serves the "Back
soon" overlay; the one exempt business has reviews but its product page does not
place the reviews block, which is an author's choice by design (the host node is
deliberately unpinned: "Put it on your product page"). So there was no reachable
page to look at.

What IS checked: the public endpoint returns `"author": null` for those reviews,
and the card used to render `null` for that. The swap is covered by the unit
test, and both cards now take the word from one module.

## Left open, and said rather than hidden

The two card QUEUES still show the signed name only, with no account underneath:
their endpoint (`/pending`) does not return the customer at all, so there is
nothing on hand to name. They show what the website shows, which is the important
half, but they cannot yet answer "whose account was that". Closing it is an API
change rather than a screen one.
