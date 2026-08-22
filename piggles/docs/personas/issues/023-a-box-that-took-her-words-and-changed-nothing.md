# 023 — A box that took her words and changed nothing

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 7 — rewriting the Contact page
**Surface:** mypiggles › My Site › Page — the canvas and the Inspector
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** P01 · act 7, on the screen

## What happened

The Contact page the café template installed carries somebody's invented details:

> **Call us** (555) 123-4567
> **Email us** hello@yourbusiness.com

Marisol double-clicks the email to change it. Nothing happens — no caret, no
message. She goes the long way round instead: select the layer, Inspector →
**Settings** → **Words**, type her own address, click away. It accepts it. The
page still says `hello@yourbusiness.com`.

Both are BOUND values. In the blueprint the node is:

```json
{
  "kind": "element",
  "tag": "span",
  "children": ["hello@yourbusiness.com"],
  "data": { "kind": "value", "ref": "site.identity.email" }
}
```

The words in the tree are only a fallback; what draws is whatever
`site.identity.email` resolves to. That design is _right_ — it is what lets a
starter site carry the owner's real details the moment she types them once,
which the code says in as many words:

> "…which is what lets a starter site's Contact page carry the owner's REAL
> details the moment they type them here — rather than shipping an invented
> number nobody ever replaces."

The screen just never said any of it.

## What should have happened

The bound value should say where it lives, on the two surfaces she actually
touches.

## How to reproduce

Every time, on any starter site:

1. **My Site → Page → Contact**.
2. Double-click `hello@yourbusiness.com`. Nothing.
3. Select the layer → **Settings** → **Words**, type a real address, click away.
4. The page is unchanged, and nothing says why.

## Why it matters

**An edit that is accepted and does nothing is worse than one that is refused.**
She has no way to tell whether she typed in the wrong box, whether it saves
later, or whether the builder is broken — and the value she is trying to replace
is the one a customer uses to reach her. Meanwhile the fix is one screen away and
would have filled in her phone, her email and her address across every page at
once, which is the good behaviour the binding exists for.

It also blocked the inline editing built in
[019](019-the-only-way-to-change-a-word-is-a-box-on-the-far-side-of-the-screen.md):
the new double-click correctly refuses a bound node — but a silent refusal reads
exactly like the "nothing happens" that #019 was filed about.

## The fix

**1. A bound node says where its words live.** `StudioHost` gains
`describeBinding(ref)`, because the ENGINE knows the ref and only the APP knows
what its own screen is called. Piggles answers with its own words:

```ts
const BINDING_HOMES: Record<string, string> = {
  'site.identity.name': 'your site details, under Name',
  'site.identity.email': 'your site details, under Email address',
  'site.identity.phone': 'your site details, under Phone number',
  …
};
```

The Inspector then replaces the Words box with a read-only field and the
sentence — no box that lies about what it will do:

> **Words** · `hello@yourbusiness.com`
> These words come from your site details, under Email address. Change them
> there and every page that shows them follows.

**2. Double-clicking a bound node SELECTS it** rather than doing nothing, so the
gesture she already tried is what puts that sentence in front of her.

## Where the fix lives

- `wizeworks/packages/studio/src/react/host.ts` — `describeBinding`
- `wizeworks/packages/studio/src/react/inspector/settings-tab.tsx` — `BoundWords`
- `wizeworks/packages/studio/src/react/canvas/use-inline-text.ts` — select, don't ignore
- `piggles/apps/workbench/lib/studio/host.tsx` — `BINDING_HOMES`, Piggles' words
