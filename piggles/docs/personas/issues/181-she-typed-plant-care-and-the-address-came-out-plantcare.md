# 181 — She typed "plant-care" and the address came out "plantcare"

**Status:** fixed — confirmed
**Severity:** major (a permanent web address is not the one she typed)
**Found by:** P03 · Juniper Row · confirming [010](010-her-bakerys-web-address-is-quiet-haven-3783.md)
**Surface:** mypiggles › Settings › Sites › New site — and six other fields like it
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Devi Raman

## What happened

Adding a second site for the repotting workshops, at 360px. Typed a web address:

    repotting-workshops-and-classes

The field showed:

    repottingworkshopsandclasses

Every hyphen was gone. Not rejected, not flagged — silently absent, letter by
letter, while she was still typing. And the line underneath confirmed the wrong
one back to her as if it were her answer:

> Your site will be at **repottingworkshopsandclasses**.juniper-row.piggles.site.
> It cannot be changed afterwards.

The hyphen is the only separator a web address has. A field that will not accept
one leaves her with a single run-on word she has to read twice, permanently.

## Why it happened

`slugify` is applied on every keystroke, and it ends with:

```ts
.replace(/^-+|-+$/g, '')
…
.replace(/-+$/, '');
```

Both are right for a FINISHED string. They are wrong for one somebody is still
typing, because **a hyphen is always trailing at the moment it is typed**. She
presses `-`, the value becomes `repotting-`, the rule deletes it, and the next
letter lands against `repotting`. There is no sequence of keystrokes that gets a
hyphen into that field.

Typing a SPACE works, because a space is not yet a hyphen when it arrives — it
only becomes one once a letter follows it. So `repotting workshops` does produce
`repotting-workshops`, and the field is not broken so much as it accepts exactly
one of the two ways a person would try. Which one they reach for is a coin toss,
and the one that fails fails silently.

## Why it hid

The rule was written for the SUBMIT path, where it is correct, and then reused as
the onChange handler in seven places without the difference being noticed. Nothing
static could see it: `slugify('a-b')` is `'a-b'`, and every unit test that could
exist passes. It only appears when the string is fed in one character at a time,
which is what a keyboard does and what no test does.

It is also the shape [that hides best](../rating.md): what she gets back is a
valid, plausible, working web address. It is simply not hers.

## The fix

One rule, two moments — in [lib/slugify.ts](../../../apps/workbench/lib/slugify.ts),
which is the single point of change all ten fields already go through:

```ts
export function slugifyTyping(value: string, max = 127): string;
```

Keeps ONE trailing hyphen while a separator is the last thing typed, and is
otherwise `slugify` exactly. The finished value still goes through `slugify` on
save, so a field left ending in a hyphen is tidied then rather than mid-word.

Applied at the SEVEN `onChange` handlers a person types an address into: the new
site's, a product's on both the add and the overview forms, a category's, a
collection's, a booking link's, and an invoicing workflow's reference name. The
three derive-from-a-name paths keep plain `slugify` — nobody is typing into
those, and a name arriving one letter at a time should not leave a hyphen hanging
off the end of the address it suggests.

Each of those seven then tidies with `slugify` on the way OUT, so a field left
ending in a hyphen is cleaned at save rather than mid-word. That half matters as
much as the first: without it the typed-in hyphen would reach the database.

Onboarding's address field is the same rule in the account app
([lib/address-rules.ts](../../../apps/account/lib/address-rules.ts)), which needs
its own copy because that one runs in the browser and on the server both.

**Six of the seven files were over Piggles' 250-line limit**, so
[RULE #0.5](../../../CLAUDE.md) obliged splitting each rather than patching it in
place. That is most of the change: `category-detail` 835 → 81 + five files,
`collection-detail` 763 → 76 + six, `meeting-links` 557 → 224 + four,
`product-overview` 499 → 183 + four, `workflow-editor` 385 → 247 + three.

## Confirmed

Re-typed `repotting-workshops-and-classes` into the new-site address at 360px in
dark. The field holds every hyphen, and the line underneath now reads
`repotting-workshops-and-classes.juniper-row.piggles.site`.

Re-checked the product web address on Sell › Products › Add a product, which is a
different file and the same rule: typed `hoya-carnosa-tricolor` and got it back
whole, with `yoursite.com/products/hoya-carnosa-tricolor` underneath it.

Neither record was created — the bug is in the field, so the field is where it
was proved.

## How to reproduce (before the fix)

1. Settings › Sites › New site — or any product, category, collection or
   meeting-link handle field.
2. Type any two words joined by a hyphen.
3. The hyphen never appears. Type a space instead and it does.
