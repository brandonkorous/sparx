# 571 — Told to add a chat box that was already on my site

**Status:** fixed and proven by reading the mount condition
**Severity:** medium
**Found by:** Devi, on Messages → Live chat
**Surface:** `piggles|sparx/apps/workbench/surfaces/chat/inbox.tsx` · `piggles|sparx/apps/workbench/components/list-pagination.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_a_promise_in_copy_is_a_contract]] · [[feedback_verify_capability_in_code_not_docs]]

## What she saw

Messages → Live chat, an empty inbox:

> **No conversations yet**
> When someone starts a chat on your site, it shows up here so you can reply.
> **Add the chat box to your site from Chat settings.**

So she opened Chat settings. It has four sections — The chat box, What it says,
When you're available, AI first responder — and **no control that adds anything
to a site.** Nothing on that screen does what she was sent there to do.

## Measured

The chat box is not something a person adds. `wizeworks/apps/site/app/layout.tsx`
mounts it on every page of every site:

```tsx
const chatEnabled = Boolean(site?.settings?.modules?.chat?.enabled);
…
{chatEnabled && chatApiUrl ? <SiteChatWidget … /> : null}
```

One condition: the Live chat app is on. And every route behind this inbox is
gated the same way — `requireModule('chat')` on conversations, quick replies and
settings alike.

**So the sentence can never be true.** To see the inbox at all, the app must be
on; the app being on is exactly what puts the box on the site. There has never
been a reader of that sentence for whom the box was missing.

|                                     |        |
| ----------------------------------- | ------ |
| tenants with Live chat on           | **14** |
| of those, with no conversations yet | **11** |

Eleven businesses were sent looking for a control that does not exist, to do a
thing already done. Juniper Row is one: her `modules.chat.enabled` is `true`, so
her box has been live the whole time.

## The fix

Say what is true, and point at Chat settings for what Chat settings is actually
for:

> **No conversations yet**
> The chat box is already on your site: it sits in the corner of every page while
> Live chat is on. When someone starts a chat, it shows up here so you can reply.
> Change how it looks and what it says in Chat settings.

"the corner" rather than "the bottom right", because which corner is a setting on
that very screen. Ported to both consoles, verified in the browser.

**No guard on this one, deliberately.** The copy is a single static string with
no branches, so a test would assert a string against itself. What makes it true
is the mount condition in `layout.tsx` and the module gate on the chat routes,
both read rather than assumed, and both quoted above. A test that cannot go red
for the right reason is worse than none ([[feedback_a_test_that_cannot_go_red]]).

## A control over nothing, on the same screens

The footer of an empty list read:

> Nothing to show&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`50 per page ▾`

`ListPagination` already guards against exactly this shape a few lines above,
with its own comment:

> _`shown > 0` guards the empty case: with no rows, lastRow is firstRow − 1, so
> an empty result set reported `−1 < 0` and offered "Load 1 more" beside the words
> "Nothing to show"._

The rows-per-page picker is the same thing and was missed — the neighbour left
behind ([[feedback_a_fix_leaves_its_neighbour_behind]]). It now renders only when
there are rows. The pager above it still renders whenever there are pages, so
somebody who has stepped past the end can still step back.

Seen on Trade → Orders, Quotes, Invoices, Live chat and Ship-direct suppliers in
one sitting, and it is one shared component, so every list in both consoles is
fixed at once.

## Still open

Nothing. The one item that was here is now **fixed** and filed on its own as
issue 592.

**`RowOpenHint` rendered on an empty list** — "Click to open, Shift-click
alongside, Alt-click in a new window", instructions for rows that are not there.
Surveyed with the TypeScript parser on 2026-09-16, because the first estimate
("86 call sites") counted the tag rather than the problem: 87 sites in piggles,
of which **18 already hid themselves** and 61 did not.

It was left open here for one act, on purpose, because the obvious fix was
wrong. A codemod that resolved the count from "the array this component maps
over most often" answered 47 of the 61, and one of the two answers read back by
hand was wrong: `cms/authors-list.tsx` maps `authors` but hands its table
`matches`, so that guard would have kept the hint up over an empty search. The
failure mode is silent, so it was not run.

What closed it was finding a count that is not a guess. Where a pane pages its
rows, `<ListPagination shown={X}>` already answers "rows currently on screen".
Where it does not, the array its own empty state tests is the array on screen.
Between them those cover 105 of the 123 unguarded sites across both consoles;
the remaining 18 were read one at a time. Both consoles are now at zero
unguarded, with a parser-driven guard that treats "cannot classify" as a
failure.

Full account, including the two sites that needed a judgement and a
piggles/sparx divergence found along the way, in
[592](592-it-tells-me-to-click-a-row-when-there-are-no-rows.md).
