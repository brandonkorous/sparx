# 013 — Her gruyère baguette got a web address with a hole in it

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 6
**Surface:** mypiggles › Sell › Products › Add a product (and every other screen that suggests a web address)
**Filed:** 2026-08-19
**Fixed:** 2026-08-19
**Confirmed by:** re-ran act 6 on the same form with the same product name — the Web address now reads `ham-gruyere-and-mustard-baguette` and the code `HAM-GRUYERE-AND-MUST-1`; Marisol's saved product was corrected on the screen and the database agrees
**Blocked on:** —

## What happened

Marisol types her lunch item into **Add a product**:

> Ham, gruyère and mustard baguette

The Web address fills itself in underneath, and the helper line spells out where
the page will live:

> **ham-gruy-re-and-mustard-baguette**
> The end of this product's page address on your website —
> yoursite.com/products/ham-gruy-re-and-mustard-baguette

The **è** did not become an **e**. It became a **hyphen**, so the word "gruyère"
came out as `gruy-re` — a word with a hole in it, in the public address of a
product she sells every lunchtime. The suggested product code did the same:
`HAM-GRUY-RE-AND-MUST-1`.

Nine of her ten products were fine. The one with an accent in it was not, and
that is the one she would have noticed a week later on her own website.

## What should have happened

`ham-gruyere-and-mustard-baguette`. Accents fold onto their base letters — that
is what every other product catalogue on the internet does, and what the platform
itself does one layer down.

## How to reproduce

Every time, no setup:

1. Sell → Products → **+**.
2. Type any name containing an accented letter — `Ham, gruyère and mustard baguette`,
   `Tomás`, `crème pâtissière`, `jalapeño`.
3. Watch the Web address and Product code fields fill in. Each accented letter is
   a hyphen.

## Why it matters

It is her public web address, and it is wrong in a way that looks like a typo she
made. Piggles' own persona rules exist for exactly this: **"an accent in Tomás"**
is named in RULE #2 as one of the things real data finds and placeholder data
hides. A catalogue of items called Test would never have shown it.

The product code is a smaller version of the same — internal, but it is what she
would read out to a supplier.

## Where it lives

The console's own copy of the rule, in
`piggles/apps/workbench/surfaces/commerce/products-data.ts`:

```ts
export function slugifyHandle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')   // ← è is not in a-z, so it becomes a separator
    …
```

**The server gets this right.** `slugify` in `@wizeworks/commerce`'s
product-service normalises to NFKD and strips the combining marks first, so the
API would have produced `ham-gruyere-and-mustard-baguette` on its own. It never
got the chance: the console fills the Web address field as you type and **sends
that value**, so the client's answer wins. A careful server behind a careless
client is a careless client.

The comment above the function even claimed the two matched —
_"matching what api-rest derives from a title"_ — which is how it survived.

**Thirteen surfaces had their own copy of those three lines**: the product
handle, category and collection handles, fitment domains and nodes, a meeting
link, a segment key, a workflow stage, a site slug, a studio page path, an AI
prompt key, a form-submission filename. Every one of them dropped accents the
same way.

## The fix

One helper, `piggles/apps/workbench/lib/slugify.ts`, matching the server's rule
exactly — NFKD, then strip the combining diacritical block, then the alphabet:

```ts
function foldAccents(value: string): string {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}
```

Three exports, because the copies were doing three different jobs and flattening
them into one would have changed behaviour: `slugify` (web-address segments,
hyphens), `slugifyUpper` (product codes, uppercase) and `slugifyKey`
(underscore machine keys, which are read as one token rather than as words).

Eight files now call it; the rest of the thirteen use the underscore form and
are unchanged in behaviour. Each takes its own length cap, because a product
handle allows 127 characters, a site slug 63, and a code 20 — the caps were the
only thing the copies genuinely differed on.

## Confirmed by

> Re-ran P01 act 6 on the real form with the real product name. Typing
> **Ham, gruyère and mustard baguette** now fills:
>
> | Field        | Before                             | After                              |
> | ------------ | ---------------------------------- | ---------------------------------- |
> | Web address  | `ham-gruy-re-and-mustard-baguette` | `ham-gruyere-and-mustard-baguette` |
> | Product code | `HAM-GRUY-RE-AND-MUST-1`           | `HAM-GRUYERE-AND-MUST-1`           |
>
> Then fixed the one already saved, as Marisol would: opened the baguette,
> corrected the Web address field, pressed Save. The database confirms
> `ham-gruyere-and-mustard-baguette`. Her other nine products were unaffected.

## Rating effect

mypiggles › Sell › Add a product — Design 8, Ease 7 → 8. The form is otherwise
good: it derives the address and the code for her, says plainly that both can be
changed, and the whole thing is name-plus-price. (Recorded in
[rating.md](../rating.md).)
