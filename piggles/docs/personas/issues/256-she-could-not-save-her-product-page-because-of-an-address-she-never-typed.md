# 256 — She could not save her product page, because of an address she never typed

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 11 — putting a reviews section on the product page
**Surface:** mypiggles › My Site › Page › Each product (and every other record template)
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Devi added a section to her product page and pressed Save.

```
That didn't save
That didn't save. Check what you entered and try again.
```

She had not entered anything. She had clicked one thing in a palette.

Pressing Save again gave the same message. It gives it every time, for every
record template — **Each product, Each blog post, Each collection, Each
category** — and it always has.

## The worst part

**Half of it saved.** The editor makes two calls, and only the second failed:

| call                                           | result                       |
| ---------------------------------------------- | ---------------------------- |
| `PUT  /v1/builder/pages/:id/silica` (the page) | **succeeded** — tree written |
| `PATCH /v1/builder/pages/:id` (the settings)   | 400                          |

So the screen said the work was lost while the work was on disk, and the pane
stayed marked unsaved. An owner who believes the message does it again, or gives
up and redoes it later on top of a copy that already has it.

## What should have happened

Save saves. And a message about what somebody entered should only appear when
they entered something.

## Why it matters

- **Nobody could publish a record template.** Publish is downstream of Save, and
  Save always reported failure, so every one of her record pages still reads
  "Not live yet". That is not six pages she has not got to yet; it is six pages
  she could not have finished.
- It is not an edge case. It is **every save of every record template**, which
  is where the product page, the blog post page and the collection page live —
  the most-edited pages on a shop.
- The message sends her to look at her own typing, which is the one place the
  fault is not. Related in shape to [issue 173] — one outcome, wrong remedy.

## Where it lives

`toSettings` in
[use-page-document.ts](../../../apps/workbench/surfaces/studio/use-page-document.ts)
sends the whole settings block on every save, the page's `slug` included. For a
record template that slug is the platform's **record address**:

```
Each product   → /products/:handle
Each collection→ /collections/:handle
Each category  → /category/:handle
```

`UpdatePageInput.slug` validates with `PageSlugInput`, whose pattern is
`^[a-z0-9]+(?:[-/][a-z0-9]+)*$`. A leading `/` and a `:` both fail it:

```
invalid_format · path: ["slug"] · "Use lowercase letters, numbers, and hyphens."
```

**And that refusal is CORRECT.** `site-service.ts` says so in as many words:
`PageSlug`'s regex "guards the _authoring_ inputs, where a `:` must be impossible
to type in the first place", because `RECORD_ADDRESSES` is a closed platform-owned
set of five and every reader of one is an exact string comparison. Record
addresses are minted by the platform (migration
`20270203000000_record_page_addresses`) and are not a tenant's to write.

So the schema is right and the caller is wrong: the editor was **echoing back a
value it is not allowed to send**, on a field the UI does not even let her edit —
the page list shows "One page per record" where a singleton shows an address.

## The fix

`toSettings` omits `slug` for a record template. Its address is the platform's,
it is not editable, and the write schema is designed to refuse it; there was
never anything to send.

```ts
function isRecordTemplate(doc: PageDoc): boolean {
  return doc.pageKind === 'collection' && !!doc.recordType;
}
```

Chosen over widening `PageSlugInput` to accept a `:`, which would have undone the
guard the whole record-address design rests on, and over "ignore an unchanged
slug", which fixes this call and leaves the next echoing caller to find it again.

## Confirmed

Re-ran the exact step as Devi: My Site › Page › **Each product** › Add & layers ›
Insert › "Reviews and ratings" › **Save**.

The error line under the pane changed from "Request validation failed." to
**"Saved, but never published — your visitors can't see this page yet."**, the
Save button went disabled, and the unsaved marker cleared. **Publish** then
answered "Published. Your site catches up within a few minutes.", and the section
is live on the shop — which is [255]'s confirmation and this one's too, since
neither could happen without the other.

## Related

Found while fixing [255]; [255] could not have been confirmed without this. The
"check what you entered" wording is the same family as [173] and
[[feedback_one_outcome_two_causes]] — a message that names the wrong cause sends
the owner to redo work that was never the problem.

## Rating effect

The page editor, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
