# 810 — Sentences assembled from parts, and put back together wrong

**Status:** fixed
**Severity:** copy
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `crm.settings`, `crm.mailboxes.list`, `ai.prompts.edit`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi; new guard `check:copy-key-sentences` proved red
**Blocked on:** —

Three sentences on three panes, each one built out of pieces and each one
glued back together wrong. None of them typechecks wrong. None of them lints.
Every one is visible the moment somebody reads the screen.

## 1. An email address welded to the next word

On **How this app behaves**:

> Add someone at jo@northgatedental.com**and** we'll ask whether they belong
> under Northgate Dental Group…

`northgatedental.comand`. It reads as a malformed address, in the one sentence
explaining what the setting does.

The source had the space:

```jsx
Add someone at <Text as="span">jo@northgatedental.com</Text> and we&rsquo;ll
```

Two things had to be true at once for this to happen.

**The wrapper did nothing.** Measured in the DOM: `<Text as="span">` rendered a
`<span>` with `className=""`, `display: inline`, no margin. No styling of any
kind. It was pure noise around a piece of text.

**And it ate the space.** The text node after it began at `a`, not at a space —
the JSX transform dropped it.

Writing `{' '}` to put the space back does not survive: **Prettier removes it**
and restores exactly the form that loses the space. So the wrapper had to go
rather than be worked around, which is the right answer anyway for a component
that was doing nothing.

Swept: `</Text> [a-z]` matches **2 files, one per console**, and both were this
sentence. The other 88 `<Text as="span">` uses are standalone labels, or sit in
a flex row where the spacing comes from `gap`, so none of them can show this.

## 2. Copy keys holding half a sentence

On **Mailboxes**, along the bottom:

> We look for new email every few minutes. The refresh button on a row checks
> that one right now, if you cannot wait. **one right now.**

The key held a fragment:

```jsx
{productCopy('crm.mailbox.checkNote',
  'Piggles checks connected mailboxes every few minutes. Use the refresh button on a row to check'
)}{' '}
one right now.
```

The fallback stops at "to check" and the JSX supplies the tail. That works —
until somebody writes the brand override, and **whoever writes an override
writes a whole sentence, because a whole sentence is what a copy key looks
like.** The override in `copy.ts` ends at "if you cannot wait." and the
leftover tail glued onto the end of it.

The **AI prompt editor** had the same shape and no `{' '}` at all, so its two
sentences would run together with no space:

> …needs an owner or an admin.**Ask** one of them if something here needs changing.

Both now hold their whole message in the key, and in the fallback.

## The guard

`piggles/scripts/check-copy-key-sentences.mjs` (new, wired into `package.json`
and `.githooks/pre-push`) flags any `productCopy(…)` followed by bare prose. A
JSX element after the call is fine — a link, a badge, a name in bold. Only
prose is flagged, because prose is the thing an override duplicates.

**Proved red:** putting the mailbox fragment back gives

```
✗ check:copy-key-sentences — a copy key holds half a sentence
  piggles/apps/workbench/surfaces/crm/mailboxes-list.tsx:266
    prose after the key: "one right now."
1 of 175 productCopy call(s) are followed by prose a brand override would duplicate.
```

Green it reads: **175 productCopy calls across 1,483 files each hold their whole
message.** The scan refuses to pass if it finds zero files or zero calls, so it
cannot go blind [[feedback_structural_checks_go_blind]].

## Files

- `piggles|sparx/apps/workbench/surfaces/crm/crm-settings.tsx`
- `piggles/apps/workbench/surfaces/crm/mailboxes-list.tsx`
- `piggles/apps/workbench/surfaces/ai/prompt-editor.tsx`
- `piggles/apps/workbench/lib/console/copy.ts`
- `piggles/scripts/check-copy-key-sentences.mjs` — NEW
- `package.json`, `.githooks/pre-push`

## Checked, and true

"We look for new email every few minutes" is a promise, so it was tested
against the code: `POST /internal/crm/mailbox-sync → syncTenantMailboxes` is a
real cron tick over `listSyncable`. The sentence is kept.
[[feedback_a_promise_in_copy_is_a_contract]]
