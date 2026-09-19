# 631 — Two emails called Welcome, and no way to tell them apart

**Status:** fixed
**Severity:** low
**Found by:** P03 · Juniper Row · act 213
**Surface:** mypiggles › My Site › Email designs
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 213 (seen on screen, before and after)

## What happened

My Site › Email designs, rows one and two:

```
Email      Subject                    Used by          Status
Welcome    Welcome to {{site.name}}   All your sites   Live
Welcome    Welcome to {{site.name}}   All your sites   Not sending yet
```

Same name, same subject, same scope, made the same day. If I open one to change
the words my customers read, I have no way of knowing whether I am editing the
one that actually goes out.

"Used by" does not help: it answers which SITES, and both say all of them.

## Why it happened

Two mechanisms write a tenant's emails and neither knows about the other:
`provisionDefaultEmails` writes the keyed platform set, and a blueprint install
writes its own copies. Both legitimately ship a "Welcome".

**This was already found, and half-fixed.** `nextFreeName` in `email-service`
renames a colliding email as it is written, and its test opens with this exact
story:

> the switcher is one flat list of NAMES, so a tenant that installed a single
> blueprint had two rows reading "Welcome" and no way to tell which one an
> automation actually sends.

It works — four rows further down her own list reads **Welcome (Fashion Boutique
(Minimal))**. But a rename on the write path cannot repair rows already written.
Measured 2026-09-17:

|                                          |        |
| :--------------------------------------- | -----: |
| tenants holding two emails with one name | **13** |
| Juniper Row's duplicate names            |      1 |

And the list already held the fact that tells them apart. `EmailSummary.key` is
documented right there as "the built-in identity of a provisioned default, or
null for a custom one", and the row drew none of it
([[feedback_fetched_but_never_rendered]]).

```
Welcome  key: welcome-customer   published      ← the one that goes out
Welcome  key: (none)             never published ← a stray copy
```

## The fix

A line under the name, from `email-origin.ts`:

```
Welcome                       Live
Comes with Piggles

Welcome                       Not sending yet
A copy on your account
```

Two decisions in it are deliberate:

- **Only where a name is shared.** On a tidy account every row is already
  distinct, and a provenance note under all of them is noise. A signal used
  everywhere stops being a signal.

- **It states an ORIGIN, not a behavior.** "Piggles sends this one for you" would
  be a promise about what happens next, and a keyed email whose automation is
  paused sends nothing ([[feedback_a_promise_in_copy_is_a_contract]]). Where it
  came from stays true whatever anybody does with it afterwards.

On screen, her list now reads:

| row                                  | note                       | status          |
| :----------------------------------- | :------------------------- | :-------------- |
| Welcome                              | **Comes with Piggles**     | Live            |
| Welcome                              | **A copy on your account** | Not sending yet |
| Win-back                             | (none — name is unique)    | Live            |
| Welcome (Fashion Boutique (Minimal)) | (none — already renamed)   | Not sending yet |

## Guard

`email-origin.test.ts`, **6 tests**. Two are rules rather than examples:

```ts
it('gives them DIFFERENT lines, which is the entire job', …)
it('never promises that anything will be sent', …)
```

The first is the one that matters: a note reading the same on both rows would
look like a fix and be decoration. The second asserts the output matches none of
`/send|will|automatic/i`, so a later "more helpful" wording goes red.

## Noted, not a defect

`{{site.name}}` shows raw in the Subject column. That is a merge tag, it is what
the author typed in the editor, and the column is a preview of the subject she
wrote rather than of a rendered send. A resolved preview would be a different
feature with its own question (whose site name, on a design shared across seven).
