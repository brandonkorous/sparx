# 062 — The chat bubble took the taps meant for her cart

**Status:** fixed
**Severity:** **major** (a phone tap on "View cart" opened a chat instead; every tenant storefront)
**Found by:** P01 · Thistle & Rye · act 8's outstanding 390px pass — adding a bun to the cart
**Surface:** the tenant's live site — the mini-cart drawer
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · same drawer, same width — see **Confirmed by**

## What happened

Added a Morning bun at 390px. The cart drawer slid in with **Checkout** and
**View cart** stacked at the bottom — and the red chat bubble sitting on top of the
right-hand end of **View cart**.

Not near it. On it:

|               | left    | right   |
| ------------- | ------- | ------- |
| View cart     | 52      | **370** |
| chat launcher | **314** | 370     |

`document.elementFromPoint` 30px inside the button's right edge returned the chat
launcher's SVG. **The last 56 pixels of a 318-pixel button opened a conversation.**

Two more things wrong in the same drawer:

- The product **thumbnail covered the first letter of the product's name** — the cart
  read `⁄utter croissant`.
- **View cart was `color="neutral"`.**

## What should have happened

A floating launcher gets out of the way of a modal surface's own controls. And a cart
line shows the name of the thing in it.

## How to reproduce

1. Published site at 390px. Add anything to the cart.
2. Tap the right-hand third of **View cart**. Chat opens.
3. Look at the product name: its first letter is under the thumbnail.

Every time.

## Why it matters

This is the two-tap path from "I want this" to "let me look at my basket", on the
device most shoppers use, on **every** tenant site. It fails silently — the shopper
gets a chat window and has no idea why.

## Where it lives

- **`wizeworks/packages/chat-widget/src/ChatWidget.tsx:294`** — the launcher is
  `fixed bottom-5` at **`z-index: 2147483000`**, which outranks everything on the page
  including a `z-[60]` modal drawer. Nothing told it a modal was open.
- **`wizeworks/apps/site/components/mini-cart.tsx`** — the line row is
  `grid-cols-[88px_1fr_auto] … max-[520px]:grid-cols-[64px_1fr]`, but the thumbnail is
  `h-[88px] w-[88px] shrink-0`. **The column shrank to 64px and the image did not**, so
  it overhung by 24px onto the name.

## The fix

**The widget already had the prop.** `hideLauncher` hides the bubble while leaving an
open conversation alone — so nothing in the shared package changed. A small client
wrapper, `wizeworks/apps/site/components/site-chat-widget.tsx`, reads
`useCart().drawerOpen` (the widget is already mounted inside `CartProvider`) and passes
it through. Checked first for a prop, found one — no CSS override, no z-index war.

In `mini-cart.tsx`: the thumbnail follows its column (`size-[88px] max-[520px]:size-16`,
with `sizes` to match), **nine inline `style={{…}}` props** became utilities, and
**View cart lost `color="neutral"`** — the untyped half of a pair beside a solid
Checkout is colorless, not grey.

## Confirmed by

Re-added Butter croissant at 390px. `elementFromPoint` 30px inside the right edge of
**View cart** now returns `A btn btn-outline w-full` — the button itself. The chat root
renders with **0 children and 0 width** while the drawer is open, and the bubble returns
when it closes. The cart line reads **Butter croissant** in full, thumbnail clear of it.

## Rating effect

The cart drawer at phone width — its own buttons are its own again.
