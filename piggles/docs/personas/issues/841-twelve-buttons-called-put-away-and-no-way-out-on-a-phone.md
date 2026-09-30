# 841 — Twelve buttons called Put away, and no way out on a phone

**Status:** fixed
**Severity:** a dozen controls that could not be told apart, and a dialog a phone could not close
**Found by:** P03 · Juniper Row · act 287
**Surface:** All apps dialog
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** driven both ways on `localhost:3022`, and at 390px in a narrow frame

## What this screen is for

Onboarding asks what the business does and puts the matching apps on the rail.
That answer is a **preference, not a purchase** — Piggles is one plan with
everything in it — and this dialog is the only thing standing between "a
sensible starting point" and "a paywall you cannot see the far side of."

It is well built. Everything below is about the three places it stops short.

## Twelve buttons, one name

Devi has thirteen of the sixteen apps on her rail. Each of those thirteen cards
carries a button. Every one of them said, and was called, **Put away**.

```
duplicate button names: [["Put away", 12]]
```

The three apps she has put away carry the other half of the same control, and
that half has always named its app: **Add Campaigns**, **Add Automations**,
**Add Connections**. So the control that ADDS something says what it adds, and
the control that TAKES something away does not.

For anybody reading the screen, the card heading above the button says which app
it belongs to. For anybody who cannot read the screen, a button's name has to
stand on its own — and twelve identical ones is a list of twelve chances to put
away the wrong app.

```tsx
aria-label={`Put away ${entry.label}`}
```

The visible words come FIRST in the name rather than being wrapped inside it, so
somebody driving the console by voice can still say "put away" and be understood
(WCAG 2.5.3). "Put Stock away" would have read better and broken that.

**Measured after:** sixteen cards, zero duplicate names, `Put away My Site`,
`Put away Content`, `Put away Get Found`, `Add Campaigns`, `Put away Sell`…

## The app's name was not a heading

Every card led with the app's name in a bold `<span>`. The dialog had exactly
one heading in it: its own title.

```
headings in dialog: ["H2:All apps"]
```

So sixteen cards, and no way to move between them by name. It is now an `<h3>`
under the dialog's `<h2>` — the same words, at the same size, in the tag they
already were.

```
headings in dialog: ["H2:All apps", "H3:Home", "H3:My Site", "H3:Content", …]  ×16
```

## On a phone there was no way out

The dialog has no footer and no close control. On a desktop that is fine: Escape
closes it, and the backdrop is most of the screen.

**On a phone there is no Escape key.** At 390px the dialog is 340px wide, which
leaves the backdrop as a strip **16px** down each side — under half the 44px tap
floor this console sets for itself, and which its own nav bar's comment cites as
"the floor, not a preference."

Every other dialog in this console carries a way out, because they are forms and
a form has a Cancel. This one is a **browse** dialog: each change lands the
moment it is pressed, so there is nothing to cancel, and it was given nothing at
all instead.

```tsx
<DialogFooter sticky>
  <DialogClose>
    <Button variant="outline">Done</Button>
  </DialogClose>
</DialogFooter>
```

**Done**, not Cancel. Nothing is being abandoned, and offering to cancel a change
that already happened is a lie about what the button does. Sticky, because the
list is every app and it scrolls.

**Measured at 390px:** the button renders 294 × 46px — over the tap floor — and
closes the dialog.

## What it gets right, driven both ways

Not assumed. Pressed, and read back.

|                    |                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Add Campaigns**  | rail gained Campaigns · card flipped to "On your rail" · toast: _"Campaigns is on your rail — It was always here. Now it is where you can see it."_                |
| **Put away**       | rail lost it again · card flipped back to "Add Campaigns" · toast: _"Campaigns is put away — Nothing was switched off or deleted. Add it back whenever you like."_ |
| **The open panes** | unchanged by either, exactly as the toast promises                                                                                                                 |

That last row matters more than it looks. Devi had a Campaigns pane open while
Campaigns was off her rail. Putting an app away is a decision about the RAIL and
it touched nothing else, which is the difference between a preference and a
switch.

Also right:

- **Home has no control at all**, because Home is where the checklist and the
  way back live. It is not greyed out with a tooltip; there is simply nothing to
  press.
- The description says what is actually on the screen: _"Everything Piggles
  does. Every one of them is included and working. This only decides which are
  on your rail, and it never changes what you pay."_
- Sixteen cards, one column at 390px, **no horizontal overflow**.
- The glyphs carry their app's own hue and the cards stay neutral, which is the
  documented call and the right one for sixteen cards.

## Another false alarm, caught by looking twice

The first screenshot at 390px showed the dialog and the apps sheet behind it
**interleaved** — two sets of app names overlapping into an unreadable mess. It
looked like a backdrop with no opacity.

It was the open animation, caught mid-fade. The settled screenshot is clean.
That is the fourth time this session that a reading taken too early or from the
DOM described something that was not on the screen. The rule stands: **settle,
then read the pixels.** [[feedback_no_arguing_without_proof]]

## The app count, again

Two comments in this file still counted the apps at fifteen while the file
renders sixteen cards. Both now drop the number rather than correcting it, for
the reason issue 839 gave: a number in a comment is a copy of a fact that lives
in the registry, and a corrected copy is the same defect one release later.

`check:app-count` does not cover this and **deliberately does not** — its own
header says comments are stripped because "a comment explaining why the old
wording went is a note to us, not a sentence on a screen." That is a reasonable
line. It does mean the count in a comment is on whoever is reading the file.

## Measured, not swept

Two things seen at 390px that belong to the compact console rather than to this
dialog, recorded so they are not lost:

- The bottom bar's **Open** tab shows a badge (374 on this account) and its
  `aria-label` is just `"Open"`. The count sits outside the button, so it is not
  hidden the way the rail badge was in issue 839, but it is not part of the
  control's name either.
- The phone's app grid draws the same waiting counts the rail does (Invoices 9),
  on tiles whose names may have the same gap.

Both are row 584's surface and will be measured there.

## Files

- `piggles/apps/workbench/components/all-apps-dialog.tsx`

The compact console reuses this same dialog rather than reimplementing it, so
all three fixes land on the phone and the desktop at once.

## The thing to remember

**The half of a control that undoes something gets written second and checked
less.** Add named its app from the first day. Put away never did, and the two
sat side by side in one file for as long as the file has existed, because the
screen makes them look identical and only the name tells them apart.
