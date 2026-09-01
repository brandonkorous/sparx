# 355 — She could not say who should be told when somebody writes to her

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · after [353], asking how she would ever name her form
**Surface:** mypiggles › My Site › Form settings — a surface that did not exist
**Filed:** 2026-08-31
**Fixed:** 2026-08-31
**Confirmed by:** her own form, named, routed to her address, and replying to the sender

## What happened

Every silica form carries settings: what it is called, who is emailed when somebody
fills it in, whether the sender gets a confirmation and what it says, and whether they
are captured as a customer.

**All of it was built. None of it had a screen.**

| Layer                                                        | State             |
| ------------------------------------------------------------ | ----------------- |
| `SilicaFormConfig` (name, notify, recipients, autoresponder) | shipped           |
| `FormDefinition` row + server-only recipients column         | shipped           |
| `formDefinitionService` get / save / list                    | shipped           |
| `GET`/`PUT /v1/forms/definitions/:formNodeId`, editor-gated  | shipped           |
| The automation actions that honour it                        | shipped           |
| **Anything in the console that opens it**                    | **nothing, ever** |

So on every site, every form was unnamed, emailed whoever the account fallback happened
to be, and could never send a confirmation. The submissions inbox printed "Untitled
form" on every row ([353]) and its own code blamed the owner for it — describing an
unnamed form as one _"whose settings panel was never opened"_, when there was no panel
to open. The service said the same thing in its own comment. Two confident descriptions
of a screen nobody had built.

## Nothing here was silicaui's to fix, and that is worth being exact about

The naming invites the opposite conclusion — `SilicaFormConfig`, `forms-silica.ts`,
`SILICA_FORM_ACTION` — so, precisely:

**silicaui contributes two things to a form.** A real `<form>` carrying its `form`
behavior (validation, `FormData`, the busy/success/error states), and the ACTION REF
that behavior hands to its host on submit. Then it stops. That is a design system
behaving correctly: it does not know what an enquiry is, who should be emailed about
one, or what a confirmation should say, and it must not.

**Everything on this screen is ours.** `SilicaFormConfig` is in
`@wizeworks/builder-schemas`. The addresses are a `FormDefinition` column in our
database. The sending is the automation engine's `form.notify` and `form.autoreply`
actions. The "Silica" in the type name means "the form engine we build on", not "the
design system owns this".

**So no change to silicaui is needed, requested, or justified.** The seam it left is
the right seam; we had simply never built the host side of it.

## The chicken and egg, which is why this was never noticed

`listForms` — the picker behind both this panel and the campaign picker — read
`FormDefinition` ROWS. A row is written the first time somebody **saves settings**. So
the list contained exactly the forms that had already been configured, and nothing
could configure one.

Its own comment claimed otherwise:

> **Every form on this site**, for a picker. … the moment you want to point a campaign
> at a form is before anyone has used it.

True as an intention, false as a description. On a real site the picker was empty, and
Devi's first sight of the new panel was **"No forms on this site yet"** on a site whose
contact form had just taken three messages.

It now reads the PUBLISHED SITE — walking every page and the frame for live form nodes
via a new `collectSilicaFormIds` — and joins the rows only for names. The frame is
walked because a footer newsletter or a header enquiry form submits from every route,
exactly as `resolveContactForm` already allows.

`getSilicaForm` gained the same fix, for a smaller reason with a lasting cost: a form
with no row has no page either, so the panel would have SAVED that null and permanently
lost which page the form is on. It asks the site instead. Caught by looking — the first
save wrote `page_slug = (empty)` for a form sitting on `/contact`.

## The surface

Four cards, one centred `max-w-3xl` column, explicit save with the leave-guard — the
same skeleton as every other editor here, copied rather than invented.

1. **What this form is called** — with the page as the placeholder, so the empty state
   shows what the fallback will be.
2. **Who hears about a message** — a switch and one address per line. It says plainly
   that messages are kept either way, because the fear that turning it off loses
   something is what stops people turning it off.
3. **What they hear back** — the confirmation, its subject and its message, revealed
   only when it is on.
4. **Keep track of who wrote in** — the CRM actions, with "start a sale" implying "add
   the person", since a sale needs somebody to attach to.

Reachable three ways: the launcher, the command bar, and a **Form settings** action in
the Form replies toolbar — which is where an owner notices the problem, so it is where
the way to fix it belongs. It sits in `actions`, not `primary`: settings are not this
surface's commit action, and the toolbar guard enforces that distinction.

Addresses stay server-only. The panel writes them through the authenticated,
editor-role, module-gated route that parses them as real addresses at the trust
boundary; they never enter the published tree, so the submit endpoint reads them and no
address can originate from a visitor.

## Confirmed by, end to end on her real site

Devi named her form **"Messages from my website"**, pointed it at
`devi@juniperrow.com`, and turned the confirmation on. A shopper then sent a message
through the live page:

|                  | Before                               | After                                                |
| ---------------- | ------------------------------------ | ---------------------------------------------------- |
| `form.notify`    | `{"enqueued": 1}` — account fallback | `{"enqueued": 1, "recipients": 1}` — **her address** |
| `form.autoreply` | `{"skipped": "autoresponder_off"}`   | `{"enqueued": true, "suppressed": false}`            |
| Inbox row        | `/contact`                           | **Messages from my website**                         |

The two older messages still read `/contact`, correctly: they were sent before she named
it, and `form_name` is snapshotted at submit.

**None of this could have been tested before [354]** — the automation that performs
these actions never advanced outside Kubernetes.

## The picker needed BOTH halves, not the other one

Walking the published site fixed the chicken and egg and introduced its mirror
image, which an integration test caught two days later — one CI does not run
(`test/integration/**` is excluded, so neither the pipeline nor the pre-push guard
would ever have said a word).

`listForms` had gone from "the rows" to "the site", when the answer is the union:

- **The site** is what makes a form offerable before anyone has touched its
  settings. Rows alone held exactly the forms already configured, and nothing
  could configure one.
- **The rows** are what keeps a form offerable before the site is published. An
  owner who adds a contact form, names it, and has not pressed Publish yet has a
  row and no published tree — and the picker was empty for her. The same chicken
  and egg wearing different clothes.

The site wins on which page a form is on: it is where the form IS, while the row
records where it was when the settings were last saved.

`forms-definitions-list.test.ts` 3/3, and it is the test that found this.

## Tests, and where they are not

`collectSilicaFormIds` is pinned by six tests in `@wizeworks/builder-schemas`, both
rules proved red: dropping the action-ref check makes it claim a newsletter sign-up is
a contact form, and collecting nodes without ids puts an unaddressable option in the
picker.

The pane itself is not unit-tested. `@piggles/console` declares no `test` script and no
vitest — the gap recorded in [346] and again in [353] — and adding a test framework to
an app is a house-convention decision rather than a bug fix. It was verified by using it
as her.

The absence is now a recorded phase rather than a recurring surprise:
[FOLLOW_UPS.md](../../FOLLOW_UPS.md) #8 measures it across all eight Piggles workspaces
and lays out the two shapes the fix could take.

## Confirmed by

`builder-schemas` **355 tests across 33 files** (was 349), `builder` 141,
`silica-catalog` 1350. Typecheck clean on `@piggles/console`, `@wizeworks/builder` and
`@wizeworks/builder-schemas`; eslint, prettier, `check-boundaries`,
`check-surface-routes` (343 surfaces, all addressed), `check-deletability` and the
piggles toolbar guard all pass. Every new file is inside RULE #0.5's 250 lines.

## Rating effect

A new pane, `builder.form-settings` / `builder.form-setting`. Closes gap (1) on
`builder.forms`.
