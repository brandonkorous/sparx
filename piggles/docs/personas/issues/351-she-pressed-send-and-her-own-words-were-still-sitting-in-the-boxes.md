# 351 — She pressed Send and her own words were still sitting in the boxes

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · sending a sizing question through her own Contact form, as a shopper
**Surface:** the published site › every form on the section shelf, on every tenant site
**Filed:** 2026-08-30
**Fixed:** 2026-08-30
**Confirmed by:** eight tests over the RENDERED html, both halves proved red

## What happened

Found alongside [350] and separate from it. [350] is that the message was destroyed.
This is that the visitor could not have known either way.

After pressing **Send it to Devi**, what a shopper sees:

- the button re-enables;
- the four boxes still hold everything they typed;
- no line of text anywhere on the page.

Read off the DOM, the only thing that changed was `data-sui-state="success"` on the
`<form>` element. Nothing renders from it: there is no CSS anywhere in silicaui for
`data-sui-state`, and nothing in the storefront reads it.

## Where the confirmation went

The behavior settles every submit into its `status` part. A form that authors none gets
one BUILT for it:

```js
live.style.position = 'absolute';
live.style.width = '1px';
live.style.height = '1px';
live.style.clipPath = 'inset(50%)';
```

A one-pixel clipped live region. That is correct and useful for a screen reader, and it
is **rendered to literally nobody else.** So the answer to "did that send?" was in the
DOM, one pixel wide.

`commerce.ts` hit exactly this on the buy box and wrote it up at the time — a shopper
clicking Add to cart on a sold-out item "watched the button depress and nothing else
happen, with the real answer sitting in the DOM one pixel wide". The buy box authors a
visible `status` part. The four forms on the section shelf never did.

## Why it matters on its own

**A visitor who gets no acknowledgement sends the message again.** Her page promises a
same-day reply from one person; the natural thing to do when nothing appears to have
happened is to press the button twice more and then email as well. Even with [350]
fixed, that turns one question into three rows in her inbox and one customer who is not
sure she has been heard.

And the fallback sentence is not one either. Absent a `data-success-message`, the
behavior announces the built-in **"Submitted."** — which names no business, promises no
reply, and does not say a person will read it.

## The fix

Every form on the shelf authors a real status line, and carries its own success
sentence:

```ts
function formStatus(): Node {
  return el('p', 'text-base text-base-content empty:hidden', {
    attrs: { 'data-sui-part': 'status', 'aria-live': 'polite' },
  });
}
```

`empty:hidden` keeps it out of the form's `gap-5` at rest — the behavior writes
`textContent`, so before a submit the element is `:empty` and the form is
pixel-identical to what it was.

| Section             | What it now says                                                |
| ------------------- | --------------------------------------------------------------- |
| `enquiry_form`      | Thank you. Your message is with us and we will get back to you. |
| `callback_form`     | Thank you. We have your number and will call you back.          |
| `quote_request`     | Thank you. Your request is with us and your quote will follow.  |
| `newsletter_signup` | Thank you. You are on the list.                                 |

## One element carries both outcomes, and that is stated rather than hidden

The behavior writes success AND failure into the same node, so there is no
state-conditional class to author: nothing in silicaui emits CSS for `data-sui-state`,
and an arbitrary-value variant (`group-data-[sui-state=error]:text-error`) is precisely
what the catalog's vocabulary check bans, for the good reason that an authored tree is
never scanned and the class would compile to nothing.

So the **words** do the distinguishing, and the success sentences are specific for that
reason. A colored success-versus-error treatment needs a `data-sui-state` variant in
the design system, which is Brandon's call and outside this issue. Recorded rather than
worked around.

## Asserted on the rendered HTML, deliberately

`toHtml` sanitises to an attribute allowlist and drops anything outside it **in
silence** — which is exactly how `fetchpriority` was lost in [345]. A status part the
projection strips is the same defect wearing a fix, so both assertions run over the
output of `resolveTree` + `toHtml` rather than over the node tree.

## The stored pages

The same 29-page cohort as [350], repaired in the same pass: a healed form gets the
status line and the success sentence as well as the routing, because fixing only the ref
would repair the owner's inbox and leave the customer exactly as confused.

Two rules guard it, both proved red: an existing status part is never duplicated (the
behavior takes the first one it finds, so a second is dead markup), and a success
sentence the owner wrote is never overwritten.

## Noticed, not acted on

**`SilicaFormConfig.successMessage` is documented as "Shown in place of the form after a
successful submit" and nothing on the silica path reads it.** The only consumer is
`builder-render`'s legacy React `ContactForm`. So the sentence an owner sets in her form
settings does not reach her page; the tree's `data-success-message` does. Closing that
means the storefront fetching the form's config at render, which is a bigger change than
this issue and wants a decision about whether the sentence belongs in the tree or the
row. Raised for Brandon.

## Confirmed by

`silica-catalog`: 1350 tests across 37 files. Eight new here (four forms × two
assertions), plus two on the heal. Removing the status part turns four red; falling back
to the built-in "Submitted." turns the other four red.

## Rating effect

Against `P03 site — Juniper Row`, the Contact page, and every tenant site with a form.
