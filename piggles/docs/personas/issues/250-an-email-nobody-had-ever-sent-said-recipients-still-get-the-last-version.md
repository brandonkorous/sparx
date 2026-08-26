# 250 — An email nobody had ever sent said "recipients still get the last published version"

**Status:** fixed and confirmed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 10 — the first save of a brand new email
**Surface:** mypiggles › Messages › Design emails › the email editor (and the same line in My Site › pages and layouts)
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 10 — a new email reads "Saved, but never published — there is nothing here to send yet"

## What happened

Devi created "Autumn drop", wrote it, and pressed Save for the first time. The
status line under the editor said:

```
Saved. Recipients still get the last published version.
```

There were no recipients. There was no last published version. The email was
four minutes old and had never left the console.

## What should have happened

An email nobody has ever published says so, and does not describe a version of
itself that does not exist.

## Why it matters

The sentence is not merely unhelpful, it is false in a way that changes what she
does next. "Recipients still get the last published version" says two things to
a shop owner: that an earlier version of this exists, and that it is currently
going to people. Neither is true. The natural readings are "I have already sent
something I did not mean to send" or "my edits are not the ones going out" —
both alarming, both wrong, and both about email, which is the one thing in this
console that reaches customers directly and cannot be pulled back.

It is also the platform's own rule about never presenting absence as
measurement, on a smaller scale: nothing was published, and the screen reported
that as a published thing.

The same sentence appears where the stakes read differently but the fault is
identical — a page whose visitors "still see the last published version" when
there has never been one, and a layout the same.

## Where it lives

Three panes, one shape. `unpublished` is derived as "the saved document is ahead
of the published one", which is true both for a document edited since its last
publish AND for a document that has never been published at all. One boolean,
two situations, one sentence — and the sentence was written for the first
situation.

- [email-pane.tsx](../../../apps/workbench/surfaces/studio/email-pane.tsx)
- [page-pane.tsx](../../../apps/workbench/surfaces/studio/page-pane.tsx)
- [layout-pane.tsx](../../../apps/workbench/surfaces/studio/layout-pane.tsx)

The value that distinguishes them was already on the document and already passed
into these components for other purposes. `publishedAt === null` is "never
published", exactly. Another instance of the commonest defect shape here: the
answer already in the component's hand, unused.

## The fix

Each pane splits the state, and each says what the absence means in the terms of
that surface — what is at stake for an email is not what is at stake for a page:

| Pane   | Never published                                                     |
| ------ | ------------------------------------------------------------------- |
| Email  | Saved, but never published — there is nothing here to send yet.     |
| Page   | Saved, but never published — your visitors can't see this page yet. |
| Layout | Saved, but never published — visitors still see the starter header. |

The published-then-edited sentence stays as it was, because for that state it
was already correct.

The layout wording is the one worth noticing: "visitors can't see it" would be
false there, since a site without a published layout serves the starter header
rather than nothing. Saying which one they are seeing is the difference between
telling her something is missing and telling her what is in its place.

## What it looked like once fixed

```
Autumn drop
Saved, but never published — there is nothing here to send yet.
```

Then, after Publish, and after an edit on top of that:

```
Saved. This is what recipients get.
Saved. Recipients still get the last published version.
```

Three states, three sentences, each of them true.

## Related

Same act, same failure mode at a different scale:
[246](246-delivered-nothing-a-minute-after-twenty-three-emails-went-out.md),
where a zero meant "not confirmed yet" and rendered as "nothing was delivered".

## Rating effect

`Messages › Design emails` and `My Site › Pages` in [rating.md](../rating.md).
Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md).
