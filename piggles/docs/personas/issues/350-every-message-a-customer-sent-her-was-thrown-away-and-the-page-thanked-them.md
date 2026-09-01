# 350 — Every message a customer sent her was thrown away, and the page thanked them for it

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · sending a sizing question through her own Contact form, as a shopper
**Surface:** the published site › Contact — and every form on the section shelf, on every tenant site
**Filed:** 2026-08-30
**Fixed:** 2026-08-30
**Confirmed by:** a sweep over the whole section library, proved red on all four forms

## What happened

Her Contact page says, in her own words:

> **Talk to me, not a help desk**
> Every message here comes straight to me, and I answer them myself. Most get a reply
> the same day, and none take longer than two working days.

I filled it in as a shopper and pressed **Send it to Devi**.

Nothing happened. The button depressed, the four boxes still held everything I had
typed, and no line of text appeared anywhere on the page.

Read off the form afterwards, from a clean page load with the network hooked before a
single keystroke:

```
fetch / XHR / native submits   0
data-sui-state                 "success"
message still in the box       150 characters
words on the page saying anything happened   none
```

**Nothing was sent. The form recorded a success. `form_submissions` held three rows,
all another tenant's, all from July.**

## What should have happened

The message reaches her Form submissions inbox — which is what the palette entry she
dragged onto the page promises, verbatim:

> Name, email, phone and room to explain. **Submissions land in your Form submissions
> inbox.**

## Why an unroutable form reports success

A silica `<form>` does its own client half — validation, `FormData`, the busy/success/
error states — and then stops at a seam: it hands the ref in `data-sui-action` to the
host's `onAction`. The storefront's handler is a chain of `if (ref === …)`.

**A ref no branch matches is not an error anywhere.** The handler falls through every
branch and returns; the behavior settles from the promise:

```js
if (result && typeof result.then === 'function') {
  result.then(
    () => settle('success'),
    () => settle('error')
  );
}
```

An `async` function that matched nothing resolves. So the form settles to `success`,
re-enables its button, and announces "Submitted." — for a message it never sent.

Her form carried `data-sui-action="submit"`. The storefront routes `contact`,
`email-signup`, `newsletter`, `signup`, `add-to-cart` and `buy-now`. **`submit` is not
one of them, and never was.**

## Where it came from, and it is one shared line

`sections/convert.ts` builds all four of its forms through one helper:

```ts
function form(children: Node[], submitLabel: string): Node {
  return action(behave(el('form', …), { type: 'form' }), 'submit');
}
```

`'submit'` is the second argument to `action()` — the host ref, not the button type.
The name reads exactly like the thing it is not.

**The contract it should have used is a declared constant** in
`@wizeworks/builder-schemas`:

```ts
export const SILICA_FORM_ACTION = 'contact' as const;
```

and `commerce.ts`'s buy box, written by the same hand in the same package, passes
`'add-to-cart'` correctly. This one file guessed.

## The file's own header asserted the opposite

> EVERY FORM HERE IS A REAL `<form>` with the `form` behaviour, so a submit reaches the
> host's action handler and lands in the tenant's Form submissions inbox — **not a
> decorative arrangement of inputs that swallows an enquiry silently.**

That sentence stood, untrue, for as long as the file has existed. It is the exact thing
the code did. A comment can go on claiming the opposite forever, because nothing in the
chain ever raises: not the behavior, not the host, not the server, not the browser.

## What was affected

All four forms on the shelf, everywhere they have ever been dropped:

| Section             | What a visitor was doing            | Where it went |
| ------------------- | ----------------------------------- | ------------- |
| `enquiry_form`      | writing to the business             | nowhere       |
| `callback_form`     | asking to be called back            | nowhere       |
| `quote_request`     | requesting a priced quote for a job | nowhere       |
| `newsletter_signup` | subscribing to the email list       | nowhere       |

The buy box was never affected — it passes its own ref.

## The fix

`form()` takes its destination as an argument, and the four callers name it:

```ts
type FormAction = 'contact' | 'email-signup';
function form(children: Node[], submitLabel: string, success: string, to: FormAction = 'contact');
```

The sign-up goes to `email-signup` and the other three to `contact`. Routing the
sign-up as a contact would file every subscriber as an enquiry and never add the
address to anything — a quieter failure than this one, and worth not trading for.

**The guard is a SWEEP, not a list of four.** Every `<form>` in the whole section
library is rendered and its ref checked against the routed set, so a form added
tomorrow is covered without anybody remembering to edit a test.

## The stored pages, and they are a cohort

A stamped section is frozen at publish, so the factory fix reaches nobody who already
has one. Measured across the database before writing any repair:

|                                          |                              |
| ---------------------------------------- | ---------------------------- |
| Stored pages carrying `"ref": "submit"`  | **29**                       |
| Of those, already **published and live** | **11**                       |
| Distinct sites                           | 29                           |
| What kind of page                        | contact / enquiry, every one |

Against `upgrade-page.ts`'s four stated conditions: broken on published sites (a live
shop's contact form is a black hole), the platform stamped it (no author types an
action ref), the replacement is known, and the cohort is measured and dated. It earns
a heal, where [344]'s one-page-in-419 did not.

**The recognizer requires the dead REF, not just the form behavior.** The buy box is a
`<form>` with the same behavior; a recognizer keyed on the behavior alone would have
rewritten every product page's Add to cart into a contact form. That is the assertion
the repair rests on, and loosening it turns two tests red.

**Which destination a stored form gets is decided by what it ASKS FOR** — the only
thing left in a frozen tree that still says what it is for. A form whose single
question is an email address is a sign-up; anything that also asks a name, a phone
number or a message is somebody writing to the business. That reproduces exactly what
the factory emits now, and the fallback is `contact` on purpose: filing a sign-up as an
enquiry puts a real address in front of a real person, while routing an enquiry to the
mailing list drops a customer's question and subscribes them instead.

## And the heal did not run, which is [352]

Wiring this repair is how it came out that `upgradePageBody` **was called by nothing at
all** — see [352]. Everything in that file, including [345]'s hero repair from earlier
the same day, was inert on every tenant. This issue is not fixed on a single stored page
without that one.

## Confirmed by

`silica-catalog`: **1350 tests across 37 files** (was 1328). The sweep was proved red
and named all four forms by key; the two recognizer decisions were each proved red
separately.

Typecheck, eslint and prettier clean; `site-lint` 388, `sitebuilder` 46,
`builder-schemas` 349 all still passing.

## Rating effect

Against `P03 site — Juniper Row`, the Contact page, and against every tenant site with
a form on it.
