# 123 — Editing one paragraph of an email silently overwrites a different one

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 9
**Surface:** mypiggles › My Site › Email designs › the email editor
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** see below

## What happened

Nia was putting the booking reminder into her own words. She rewrote the heading,
then clicked the paragraph under it to rewrite that. The **Copy** box on the right
still held the heading's words — "Your chair is booked" — while the layer list, the
weight, the size and the line spacing had all switched to the paragraph.

So she clicked into the box, went to the end, and typed two more words.

The paragraph she was editing was **replaced** by the heading's text plus those two
words. Its own sentence was gone. Nothing warned her, nothing highlighted, and the
email now said the same thing twice with the reschedule instructions deleted.

Reproduced exactly, on purpose:

1. Select the heading. Rewrite it. Tab out.
2. Select the closing paragraph ("Need to reschedule or cancel? …").
3. Click at the end of the Copy box and type " Thank you."
4. The closing paragraph now reads "Hi Alex, this is a note about your appointment
   at Halo & Hem… Thank you." Every time.

## What should have happened

The box shows the words of the block that is selected.

## Why it matters

It is silent, undoable-only-if-noticed data loss on the most ordinary action in the
editor — click a block, add a word. The email is a document with maybe eight text
blocks; the wrong one is destroyed and the right one is unchanged, so nothing on
screen looks broken until somebody reads the whole email again. ⌘Z does recover it,
which only helps the author who realised.

The blast radius is every email design a tenant has, which is 44 of them.

## Where it lives

- [packages/studio/src/react/email/inspector/inspector.tsx](../../../../wizeworks/packages/studio/src/react/email/inspector/inspector.tsx) — `EmailInspector`
- [packages/studio/src/react/email/inspector/fields.tsx](../../../../wizeworks/packages/studio/src/react/email/inspector/fields.tsx) — `TextRow` / `AreaRow` / `NumberRow`

## The cause

`fields.tsx` commits on BLUR, deliberately, so ⌘Z does not walk backwards through
an author's typing one letter at a time. A field that commits on blur cannot also
be controlled, so every text row is `defaultValue` — read once, at mount. The
remount is what makes it follow the selection.

Its own header comment said so, and said whose job it was:

> Every field is `key`ed by the node id at the call site, so selecting a different
> block re-mounts the row with that block's value rather than leaving the previous
> one in an uncontrolled input.

**None of the call sites did.** `NameRow` and `DocumentFields` key their fields —
which is why the layer-name box, alone on that panel, was always correct. Every row
inside `panels-content.tsx` and `panels-layout.tsx` had no key at all, so moving
between two blocks of the same kind reused one `<Textarea>` and one stale value.

`ColorRow`, `SelectRow` and `SwitchRow` are controlled and were always right, which
is why Weight and Color updated while Copy did not — the panel looked like it was
following the selection.

The site/page inspector next door does it correctly, with a `fieldKey(id, …)` helper
on every uncontrolled input. Only the email side forgot.

## The fix

The key moved to where the invariant lives. `EmailInspector` keys the whole panel on
the selected node:

```tsx
<BlockPanel key={node.id} node={node} />
```

One key, at the one place that knows the selection changed, instead of forty at the
rows — a contract that must be remembered at every call site is a contract that will
be forgotten at one of them, and was, at all of them. The header comment in
`fields.tsx` now describes what actually happens rather than what was intended.

One narrower instance of the same shape, fixed alongside: the social-links rows were
keyed by `platform-index`, so deleting the first of two Instagram links left the
deleted address sitting in the surviving row's box. Keyed by the row's own data now.

## Confirmed by

> Re-ran P02 act 9 as Nia. Selected the heading, rewrote it, then selected the
> paragraph: the Copy box now holds the PARAGRAPH's own text
> (`Hi {{customer.greeting}} — a friendly reminder…`), at its own size and weight.
> Rewrote all four text blocks of the reminder in sequence, saved and published;
> each landed on its own block and nothing else moved.
