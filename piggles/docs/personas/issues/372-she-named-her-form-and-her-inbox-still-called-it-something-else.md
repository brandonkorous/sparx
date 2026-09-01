# 372 — She named her form, and her inbox still called it something else

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · reading her own inbox after sending herself a message
**Surface:** mypiggles › My Site › Form replies
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** her four messages, all four now under the name she chose

## What happened

Devi has one form on her whole site: the contact form. She named it, in Form
settings, **Messages from my website**.

Her inbox listed it as two forms:

| From             | Form                     |
| ---------------- | ------------------------ |
| Rosalind Achebe  | Messages from my website |
| Hanne Sorensen   | Messages from my website |
| Tomas Ferreira   | **/contact**             |
| Marguerite Okoye | **/contact**             |

All four came through the same form. The two at the bottom arrived before she
named it, so they wear the address of the page instead — which is not a name, and
not a word she would use for anything.

An owner reading that has one form and is being shown two, one of them apparently
called after a URL. The obvious readings are all wrong: that she has a second form
somewhere, that half her messages came from a different place, that naming it did
not work.

## Why it happened

`FormSubmission.formName` is a **snapshot** taken at submit time, and the inbox
read it off each row.

That is the right thing for the stored row to hold. A submission is a record of
something that happened, and what the form was called at that moment is part of
what happened. It is the wrong thing to put in a column, because the column is
answering "which form is this?" and the answer to that is a fact about the form,
not about the message.

So renaming a form only ever applied going forward, and the split is permanent:
every message that arrived before the rename keeps the old label for as long as it
is in the inbox.

The picker had a quieter version of the same fault. `submissionForms` grouped by
`formNodeId` and took `_max: { formName }` — the alphabetically largest snapshot
in the group. One label per form, so no visible split, but still a historical
value: rename a form and the picker keeps showing the old name until somebody
submits again.

**The code said this could not happen.** `formName`'s doc comment read:

> The name is snapshotted from `FormDefinition.config.name` at submit, and NOTHING
> in the console can set it, so in practice this is null everywhere (measured: 0 of
> 4 stored submissions carry one).

That measurement was true when it was written and stopped being true when issue
355 gave form settings a screen. Two of the same four submissions carry a name
now. A comment stating a measurement needs a date on it or it becomes a claim.

## The fix

**The name is resolved from the form, once, on the server.** `submissionForms`
now reads the current `config.name` for every form node in the response
(`liveFormNames`), through the same normalizer `listForms` and the settings panel
use, so "unnamed" means one thing in all three. Tenant-scoped rather than
property-scoped, because the inbox spans every site the tenant owns and a
submission outlives the site it came from.

**The rows are named from that same list.** `formNamer(forms)` builds the lookup
once and the table asks it, so the column and the picker cannot disagree — not
because both happen to be right, but because there is one answer. A form since
deleted from its page is not in `forms` at all, so its messages fall back to their
own snapshot and then to the page, which is the only case where the old behavior
is still the best available.

The stored column is untouched. It is still the record of what the form was called
when each message arrived; it is simply no longer what the screen reads.

`form-submissions-data.ts` was 378 lines, over Piggles RULE #0.5's 250, and this
touched it — so it split three ways along what the parts actually do: the data
layer keeps the wire shapes, the query keys and the reads and writes (193 lines);
`form-submissions-words.ts` holds what things are called and how values are
written out; `form-submissions-csv.ts` holds the export. The existing test moved
to sit beside the module it covers.

## Confirming it

Sent a real enquiry through her live contact form as a shopper — a sizing question
about the Ash Overshirt, with a `+1` phone number — then opened her inbox.

| Check                             | Result                                                       |
| --------------------------------- | ------------------------------------------------------------ |
| It arrives                        | top of her inbox, `status: new`, all four fields intact      |
| It is hers                        | her tenant, her form node, `page_slug: contact`              |
| All four rows agree               | **every one now reads "Messages from my website"**           |
| The two older ones were relabeled | they still carry `form_name = ''` in the database, untouched |

Seven tests on the naming rule, three of them new and specific to this: a row that
predates the name gets it, every row of one form gets the same answer, and a form
deleted from its page still says where its messages came from.

## What else this confirmed

This is also the **end-to-end proof that was owed** for issues 350, 351 and 352.
Those were fixed with api-rest down, so the rating file recorded that no message
had yet been watched landing in an inbox. One has now:

- the form's `data-sui-action` is `contact`, not the dead `submit` ref ([350])
- the visible confirmation renders — "Thank you. Your message is with us and we
  will get back to you." — rather than a 1x1px clipped live region ([351])
- her stored page carries the repaired ref, so `upgradePageBody` ran ([352])

## Still open

- **Two forms on the same unnamed page still collide**, which was already noted
  under issue 353 and is unchanged. The fallback is the page address, so two
  unnamed forms on `/contact` are one label. Naming them is the remedy and it is
  now reachable, which is most of the answer.
- **The launcher cannot find a form by its name.** Searching "Messages from my
  website" — the name she typed — returns "Nothing matches that", because the
  launcher searches surfaces plus orders, customers and products. Whether a form
  should be findable by name is a scope question about what the launcher indexes,
  not a bug in this surface.
