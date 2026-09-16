# 456 — The sparx console could not see what it was about to send

**Status:** fixed
**Severity:** major
**Found by:** measuring which broadcast endpoints each console calls, while fixing [455]
**Surface:** Marketing › Email campaigns › a broadcast (sparx console)
**Filed:** 2026-09-09

## What was wrong

On the sparx console a shop could name a broadcast, pick an audience, pick a
designed email and **send it to her entire customer list without once seeing
it.** There was no preview, anywhere in the flow.

Not a missing capability — a missing CALLER. `GET /v1/email/broadcasts/:id/preview`
has existed and been served all along. One console asked for it and the other
never did:

```
/preview     piggles:1 sparx:0
/stats       piggles:1 sparx:1
/send        piggles:1 sparx:1
/schedule    piggles:1 sparx:1
/cancel      piggles:1 sparx:1
```

Four of five endpoints in both. The fifth — the only one that shows a person
what they are about to do — in one.

This is [449] again: a fix that landed on one console and was reported as done.
[248] ("nothing could be previewed and Send asked nothing") was closed against
piggles. Nothing looked at the twin.

## The second half

`senderDisplay` on the sparx console **re-derived the sending identity in the
browser**:

```ts
if (!settings?.fromAddress) return 'noreply@sparx.email';
```

A bare address, no name, and a guess at what the server would do. That is the
defect [245] fixed in piggles, whose replacement carries a comment saying so:
_"a console that re-derived the unconfigured fallback for itself named a domain
the platform does not send from, and dropped the sender NAME entirely."_ The
same words, still true of the other console, a month later.

Both now read the server's `resolvedFrom` — the literal `From` header the send
will carry. There is one implementation of "who is this from", and no console
gets an opinion about it.

## Where the code changed

- `sparx/apps/workbench/surfaces/email/broadcast-preview.tsx` (NEW)
- `sparx/apps/workbench/surfaces/email/broadcasts-data.ts` — the `BroadcastPreview`
  type, its query key, `useBroadcastPreview`, and `senderDisplay` reading
  `resolvedFrom`
- `sparx/apps/workbench/surfaces/email/settings-data.ts` — `resolvedFrom`
- `sparx/apps/workbench/surfaces/email/broadcast-detail.tsx` — **What it looks
  like** in the composer, **What was sent** on a sent or scheduled broadcast

The preview is its own request rather than a field on the broadcast: it renders
the whole email, and a list of drafts has no business paying for that. It is
never cached — the audience, the design and the sender can all move between
looking and sending, and a stale preview is a preview of the wrong email.

## Verification

Driven on the sparx console. The composer now carries:

> **What it looks like** · Exactly what lands in your customer's inbox, shown for
> one real person out of your audience.
> _Nobody is in this audience yet, so there is no one to preview it for._

Which is the right answer for that draft, and names WHICH piece is missing
rather than showing a blank frame. The sender card read `noreply@sparx.email`
before and `WizeWorks <noreply@sparx.email>` after.

sparx console 115 across 13 files, piggles console 190 across 21. Typecheck,
lint and prettier clean; `check:console-parity` passes.

## Noticed, not filed

Reaching Broadcasts on a tenant whose Email module is **off** shows _"Could not
load your broadcasts · Something went wrong reaching the server · try again in a
moment"_ with a **Try again** button. The 404 is correct — the module is off —
but the console flattens it into a server error and offers a remedy that can
never work. Same shape as [[feedback_one_outcome_two_causes]]. Not filed here
because it is not specific to this pane and the class needs measuring first:
how many surfaces turn a module 404 into "something went wrong"?

## Rating effect

`Marketing › Email campaigns` (sparx) — recorded in [rating.md](../rating.md).
