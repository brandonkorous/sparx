# 094 — The blocks for "how to reach us" shipped a stranger's phone number

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** mypiggles › My Site › Page › Add — and the published site
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · Nia · on screen and on the live site 2026-08-22

## What happened

Nia filled in the console's own **How customers reach you** panel, which promises:

> Your phone, email and address, shown on this site's contact page and footer.

Phone `(916) 555-0146`, email `hello@haloandhem.com`, address `214 Bower Street,
Suite B, Sacramento, CA 95811`. Saved.

Then she added a **Contact strip** to her homepage — the palette describes it as
"Phone, email and hours in one row" — and got this:

| Column  | What landed on her page |
| ------- | ----------------------- |
| Call us | **(555) 123-4567**      |
| Email   | **hello@example.com**   |
| Open    | Mon–Fri 8–5, Sat 9–1    |

**Find us** did the same, and added a street:

> The Old Mill, 24 Mill Lane · Millbrook, OR · 97005 · (555) 123-4567 ·
> hello@example.com

None of it is hers. All of it renders on a published page as though it were.

## The part that makes it a defect rather than a placeholder

**The platform already binds these three fields, and says so out loud.** The
contact page her starter site shipped carries the same phone number, bound — and
selecting it in the console explains the whole mechanism in her language:

> These words come from Your site, under Phone number. Change them there and every
> page that shows them follows.

So the console has a binding, an explanation, and a screen to type into. The
blocks she can **add herself** were the only ones that ignored all three. Two
copies of one component, one of which quietly disagrees with the product's own
promise.

Clearing the words did not fall back, either: emptying the phone made the number
**vanish**, rather than resolve from Site identity. There was no binding to fall
back to.

## Why it matters

A wrong phone number on a business's own website is not a cosmetic placeholder.
`(555) 123-4567` reads as a real number, sits under the word "Call us", and is a
`tel:` link a client will press. The address is worse again — it is a real-looking
street in a different state.

And it is invisible to the person who typed the right answer ten minutes earlier:
she filled in the panel that said these details would show on her site, then added
the block whose whole job is showing them, and got somebody else's.

## Where it lives

[wizeworks/packages/silica-catalog/src/sections/place.ts](../../../../wizeworks/packages/silica-catalog/src/sections/place.ts)
and
[wizeworks/packages/silica-catalog/src/sections/layout.ts](../../../../wizeworks/packages/silica-catalog/src/sections/layout.ts)
— the palette's `findUs()` and `contactStrip()`, both authored as flat literals:

```ts
el('a', '…', { attrs: { href: 'tel:+15551234567' }, text: '(555) 123-4567' }),
el('a', '…', { attrs: { href: 'mailto:hello@example.com' }, text: 'hello@example.com' }),
```

The pattern they should have used was already in the tree, in
[marketplace-catalog/\_gen/shared/contact-section.ts](../../../../marketplace-catalog/_gen/shared/contact-section.ts):
a `visibleWhen` wrapper, a `bindAttr` on the `href`, a `bind` on the words, and a
`REF` table naming `site.identity.phone` / `phoneHref` / `email` / `emailHref` /
`address`. That file is why the starter's contact page is right. Nothing carried
it across to the shelf.

## The fix

**One helper, used by both blocks** —
[wizeworks/packages/silica-catalog/src/sections/\_contact-fields.ts](../../../../wizeworks/packages/silica-catalog/src/sections/_contact-fields.ts):

- `boundAddress(cls, sample)` — one `<address>` with `whitespace-pre-line`, bound
  to `site.identity.address`. One node, not one per line: a binding fills a node's
  whole content, so the lines arrive as a single string and the owner's own breaks
  survive.
- `boundContactLink('phone' | 'email', cls, sample)` — the words bound to the
  value and the `href` bound to its `…Href` companion, so the number a visitor
  reads and the number their phone dials can never drift apart.
- Both wrap in `visibleWhen`, so a business that has not filled a field in yet
  renders **nothing** there rather than a plausible fake
  ([[feedback_never_present_absence_as_measurement]]).

The authored sample stays as the text of the bound node — that is what shows on
the builder canvas, and it is what the binding replaces on the live site.

**Two smaller things went with it:**

- **`findUs`'s "Call us" button is gone.** It repeated the pressable number
  directly above it and its `href` was a second literal nobody could reach.
- **The contact strip's third column was opening hours**, typed into the block and
  true of nobody. Hours have their own block in the same palette; the address is
  the third thing Site identity holds, so the column is now the address and every
  part of the strip follows the business. Its palette hint says so.

## Confirmed by

Re-run as Nia on 2026-08-22, with nothing typed into either block:

| Block         | What it inserted                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Contact strip | Call us **(916) 555-0146** · Email **hello@haloandhem.com** · Find us **214 Bower Street, Suite B / Sacramento, CA 95811** |
| Find us       | the same three, plus `Get directions`                                                                                      |

`tel:9165550146` and `mailto:hello@haloandhem.com` on the links. Published, and
read back from the live homepage and from the footer on `/about`.

## Rating effect

The Add palette and the published site are scored in [rating.md](../rating.md).
