# 826 — Her own reply came back from a team she does not have

**Status:** fixed
**Severity:** copy + correctness (a nav badge counting the wrong set)
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `chat.inbox.thread`, and the Messages badge on the rail
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** a real conversation, started from her own site as a shopper
**Blocked on:** —

## How it was tested

Devi had no conversations at all, so one was made the way a real one arrives:
opened **juniper-row** as a shopper, used the chat bubble in the corner, and
asked

> Is the Ash Overshirt true to size? I am usually a medium.

then answered it from the console as Devi. The round trip works. The widget
sends, the thread appears in the inbox within seconds, the reply goes back, and
the pane has everything it needs: the state as a chip, Resolve, a **Visitor**
badge, which site it came from, who it is assigned to, a reply box with quick
replies beside it.

Three things were wrong, and one of them appeared one second after she pressed
Send.

## "Your team"

Her own sentence, in her own shop's inbox, labelled as coming from a team she
does not have.

```ts
case 'staff':
  return 'Your team';
```

`senderLabel` had no idea who was reading. The row carries `senderId` and the
pane already knows the viewer — it uses `viewer.userId` sixty lines below to
offer "assign this to me". It says **You** for your own message now, and keeps
"Your team" for a colleague's, which is the only case it was ever right for.

Both consoles. sparx has the same one-person tenants.

## A conversation that is not there is not an unreachable server

Opening a conversation belonging to another business:

> **Could not load this conversation**
> This is a problem reaching the server. The conversation itself is unaffected.
> **[Try again]**

The server answered perfectly well. Try again will fail every time.
[[feedback_one_outcome_two_causes]]

The Piggles copy used `PaneLoadError` but passed it neither `error` nor `noun`,
so the component could not do the one thing it exists for. **sparx did not use
the component at all** — a hand-rolled `<Alert color="error">` with its own
retry button, in a console that has `PaneLoadError` sitting in `components/`.

Both read this now, and neither offers a retry that cannot work:

> **That conversation is no longer here**
> It has been deleted, or the address points at something that is not in this
> business. Nothing of yours has been lost.

## The badge that said somebody needed her

The rail's **Messages** row wore a `1` while the thread sat answered, and went
on wearing it.

```ts
messages: { path: '/v1/chat/conversations', query: { status: 'open', … } },
```

`open` is a stored word meaning "not resolved". A conversation you answered an
hour ago is open because the CUSTOMER has not come back — it is waiting on them,
not on you. `home-counts.ts` opens by stating the rule it serves in capitals:

> WHAT IS WAITING FOR A PERSON, as a list of queries.

and its own header records this exact mistake once already, on the row above:

> The invoices count asked `status=overdue` — a stored word nothing rewrites
> when a date passes — so Home told a shop owed $986.50 across eight late
> invoices that "nothing is overdue" (issues 522, 530).

Same shape, same file, one line down: a filter naming a stored word rather than
the question being asked. A badge that is on when nothing needs you is how a
person learns to stop looking at badges.

`GET /v1/chat/conversations` takes `?unread=true` now, filtering on
`unreadStaff > 0` — the counter the thread already clears on open. The badge
asks for it, and the guard beside the invoice one asserts both halves:

```ts
expect(q.unread).toBe(true);
// As an absence too: `status` narrows first, so adding `unread` beside it
// would still have counted answered threads that happened to be open.
expect(q).not.toHaveProperty('status');
```

The absence half matters. The invoice fix needed the same assertion for the same
reason, and it is written down in the test above it.

## Files

- `piggles|sparx/apps/workbench/surfaces/chat/data.ts` — `senderLabel` takes the viewer
- `piggles|sparx/apps/workbench/surfaces/chat/thread.tsx`
- `piggles/apps/workbench/lib/console/home-counts.ts` + `.test.ts`
- `wizeworks/services/api-rest/src/lib/chat/conversation-service.ts` — `unreadOnly`
- `wizeworks/services/api-rest/src/routes/v1/chat/conversations.ts` — `?unread=`

## Records kept

The conversation and both messages are left in place, as test data for the next
pass through this app. Nothing was deleted.

## Noted, not fixed

**"Assigned to: Unassigned"** on a one-person shop. The picker offers exactly one
person and assigning a conversation to yourself changes nothing, so the control
is asking a question with one answer. It is correct for a shop with staff, and
the fix is to hide it when the roster is one — which is a rule that would want
applying in several places at once rather than here alone.
