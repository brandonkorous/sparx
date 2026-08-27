# 265 — A contact page whose button emailed somebody else

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — building the Contact page
**Surface:** mypiggles › My Site › Page (the Contact starter, and the Enquiry form block)
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Devi typed "Contact" into **Name a new page** and pressed Add page. The platform
recognised the name and built her a real contact page: a heading, a sentence,
and one button.

The button's destination:

```
Goes to    mailto:hello@example.com
```

Then she added the **Enquiry form** block, and beside the fields it printed, in
ordinary prose:

```
Or call (555) 123-4567, Monday to Friday, 8am to 5pm.
```

She has no phone line and no office hours. She works alone in a studio that opens
on Thursdays.

## What should have happened

A contact page reaches the business. If the platform does not know how, it says
nothing rather than inventing an answer.

## Why it matters

- **These do not read as placeholders.** The heading and the paragraph on the
  same page announce themselves — _"Tell visitors the best way to reach you"_ is
  obviously an instruction to the owner. An email address and a phone number are
  the exact shape of a finished contact page. That is the difference between
  copy you replace and copy you never see.
- **The button is the whole page.** A contact page whose only action composes a
  mail to a domain she does not own is a broken contact route that looks like a
  working one. Nobody gets a bounce; the message simply goes to whoever owns
  `example.com`.
- **The invented hours are a second claim.** "Monday to Friday, 8am to 5pm" is
  not a placeholder for anything — there is no hours field behind it. It is a
  promise about a business, made up.
- She is a sole trader. "Or call" and "Email us" both describe staff she does not
  have, which is the same failure as [260]'s "Added by your team".

## Where it lives, and why it is a regression

[\_contact-fields.ts](../../../../wizeworks/packages/silica-catalog/src/sections/_contact-fields.ts)
exists to stop precisely this, and its own header says so:

> "The gap this closes: the palette's "Find us" and "Contact strip" shipped a
> real-looking phone number and street, so a business that placed one and did not
> notice published somebody else's details. The starter sites bound the same
> three fields and told the author so on the canvas; **only the blocks they could
> ADD did not.**"

That was fixed for those two blocks. Two others were never converted:

| where                                                                                                  | what it shipped                                                    |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [site.ts](../../../../wizeworks/packages/silica-catalog/src/site.ts) — the starter Contact page        | `href: 'mailto:hello@example.com'`                                 |
| [convert.ts](../../../../wizeworks/packages/silica-catalog/src/sections/convert.ts) — the enquiry form | `caption('Or call (555) 123-4567, Monday to Friday, 8am to 5pm.')` |

Both sit in files that import from the same directory as the helper. Nothing
pointed at them, so a closed gap re-opened in two places and stayed open.

## The fix

**Both bind to `site.identity`, and both disappear when it is empty.**

- `boundContactAction` — a call to action whose WORDS stay the author's and whose
  destination is the business's. `boundContactLink` prints the address as its own
  label, which is right in a footer and wrong on a button: "Email us" has to go
  on saying "Email us".
- `boundPhoneLine` — a sentence with the number inside it, hidden entirely when
  there is no phone, because half a sentence reads worse than none. The invented
  hours are gone rather than bound: there is no hours field, so there was nothing
  to make them true.

**And a guard, because this is the second time.**
[starter-contact.test.ts](../../../../wizeworks/packages/silica-catalog/src/starter-contact.test.ts)
walks every string the starter would render or link to — text and attributes
both — across a commerce tenant and a content-only one, and fails on an email
address, a phone-shaped number, or a `mailto:`/`tel:` literal.

Proved red by putting the original line back:

```
page "Contact" installs an email address: "mailto:hello@example.com"
  — bind it to site.identity instead, so it is the owner's or it is absent
```

The starter is the strict case deliberately: it is the one thing that lands on a
live site without the owner choosing it, which is [263]'s whole lesson.

## Left alone deliberately

`offer.ts`'s stockist list and `place.ts`'s multi-branch list keep their sample
rows — four fictional shop names with four identical numbers. Those are lists an
author replaces wholesale, and the fake shop names alongside announce them as
samples. The line the codebase already drew holds: **"this is us" binds, "here
are some rows to replace" does not.** `place.ts`'s single-location block is
already on the bound side.

## Confirmed

Her `/contact` is live and carries `hello@juniperrow.com`, her studio hours, her
street — and no trace of `hello@example.com` or `(555) 123-4567`. 1,193 catalog
tests pass and the package typechecks.

## Related

[[feedback_never_present_absence_as_measurement]] — an invented phone number and
invented opening hours are absence rendered as fact, on the page where a customer
goes when something has gone wrong.

Same family as [263]: content COPIED into a site at install, which no later fix
reaches. The difference is that [263]'s leftovers looked unfinished and these
looked done.

## Rating effect

The page editor and the Insert palette, in [rating.md](../rating.md). Recorded in
the run log of [03-juniper-row.md](../03-juniper-row.md).
