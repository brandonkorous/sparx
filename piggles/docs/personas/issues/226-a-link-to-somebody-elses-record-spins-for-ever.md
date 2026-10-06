# 226 — A link to somebody else's record spins for ever

**Severity:** minor
**Found by:** P03 · Juniper Row · act 7 — the RULE #7 neighbour check
**Surface:** mypiggles, any detail pane reached by address
**Filed:** 2026-08-25
**Status:** fixed (act 323). The fitment API should still answer a 404, see below
**Blocked on:** —

## What happened

The standing check: paste another business's record id into the address bar and
confirm nothing comes back.

Nothing came back — and nothing else did either. `mypiggles.com/commerce/returns/a71e43c0…`,
an id belonging to **Threadline**, opened a pane that showed the mascot and
**"Just a moment…"**, and went on showing it. Thirty seconds. A minute.

The same for another tenant's ORDER (`0c6f80e7…`, Halo & Hem) and for an id that
belongs to nobody at all (`00000000-0000-4000-8000-000000000000`).

## The part that matters is fine

**There is no leak.** api-rest answers all three with a clean refusal:

```
404  {"success":false,"error":{"code":"NOT_FOUND",
     "message":"ReturnRequest a71e43c0-… not found", …}}
```

Row Level Security holds. Devi cannot see Threadline's returns, Halo & Hem's
orders, or anything else that is not hers, and the run continues.

## What should have happened

The console already owns the right answer and shows it beautifully elsewhere:

> **Could not load this return**
> This is a problem reaching the server. The return itself is unaffected —
> nothing has been changed or lost. **[ Try again ]**

That, or a plainer "there is nothing here". Either is a way onward. A spinner
that never stops is a dead end, and the person is left deciding whether to keep
waiting.

## What was ruled out

- Not the deep link mechanism. An order of Devi's own that had **never been
  opened in this browser** (`cca38202…`, O-000002, Tessa Wren, $101.95) resolved
  from the address bar immediately and completely.
- Not a slow retry. The shared query client is `retry: 2` with the default
  backoff, which settles in about three seconds.
- Not the server. All three ids answer 404 in milliseconds when asked directly
  from the same page with the same token.
- Not a crash. The pane error boundary has its own screen and it never appeared,
  and the browser console is clean apart from an unrelated React warning about a
  `value` prop with no `onChange`.

Both `OrderDetailSurface` and `ReturnDetailSurface` test `isError` **before**
`isPending`, so an errored query should reach `PaneLoadError`. It does not, and
`PaneWaiting` is also the `<Suspense>` fallback in
[surface-mount.tsx](../../../../piggles/apps/workbench/components/surface-mount.tsx),
so the two are indistinguishable on screen — which is itself part of why this is
hard to place.

**The cause is not isolated.** Recording that rather than guessing (CLAUDE.md
RULE #4).

## What changed (act 323)

The original spinner was already gone for orders and returns: the shared
`PaneLoadError` reads a 404 as "That order is no longer here". So the act swept
**every** detail address in the console (99 routes with a required id, from
`@wizeworks/links`) with an id that belongs to nobody, and read what each pane
said. Most were right. These were not, and are fixed in both consoles:

**Spun for ever** (the API answered an empty 200, which the pane cannot tell
from "still loading"):

- Integrations: `providerService.getInstallation` returned null. It now throws
  not found; the pane also treats an empty answer as missing.

**Drew a fake, live screen for a record that does not exist:**

- Report builder (a blank new report with Save), dashboards ("Nothing on this
  board yet"), custom records (the server's own words above Remove and Save),
  shelves (an editable shelf form), report schedules (Send now, Delete, Save),
  the invoice editor (a blank invoice with Save), sequence enrollments
  ("Enroll someone"), the template preview ("Drawing the page…" for ever).
- The stock item: `/v1/inventory?variant_id=` now answers 404 for an item that
  is not this business's. Empty stays the answer for a real item nobody has
  counted, which is why the two had to be told apart on the server.
- Form settings: `getSilicaForm` answered any id with defaults ("On your home
  page", Save). It now refuses a form that has no settings and sits on no
  published or draft page. 4 tests; removing the check reddens 1.
- Count schedules (an empty form).

**Said "a problem reaching the server" about a record that is gone:**
shipment notices, supplier bills, supplier returns (each said "not a statement
that it is gone"), the gift card, and the hedged "may be gone, or the server
could not be reached" on workflows, templates, pick walks and planning. All now
pass the error to `PaneLoadError`, which tells the two apart.

Proof: re-read live, each of these now says "That … is no longer here". The
connection lookup test reddens when the not-found check is removed. Both
consoles typecheck, lint clean, 2151 and 1856 tests green.

The fitment list pane spun on a missing id for the same reason as integrations:
`fitmentService.getDomain` returns null into a 200, and the pane read "no data"
as "still loading". The pane now tells the two apart and says the list is no
longer here, in both consoles. The API should also answer a 404; the service and
route are mid-edit in another change in this working tree, so that half waits
for it to land.

**The last addresses, re-read live.** Right first time: the fitment list
("That list is no longer here"), price tiers, booking rules, the dropship
supplier and order, both chat addresses, AI instructions and analytics. Four
were not, and are fixed in both consoles:

- The invoice preview never read an error, so a missing invoice said
  "Preparing preview…" for ever. It now says the invoice is no longer here.
- Automation runs said only "Could not load this rule's results." in a line of
  bare text. The pane now asks after the rule first, and a missing rule says so.
- Site checks hedged ("or the page no longer exists"). The error now goes to
  `PaneLoadError`; in sparx the red alert box that stood in for the load screen
  is gone too.
- A partner address (a screen Piggles does not have) printed the screen's
  code name, "partner.bootcamp.detail", at Devi. It now says back the address
  she used. 1 test; the old code reddens it.

Proof: the preview, the runs pane and the partner address were re-read live
after the fix. The site check error was not: the bare address carries no page
type, so it rightly stops earlier, at "No page to show".

## Rating effect

Not scored — it is a state no pane currently escapes from, so it belongs to the
chassis rather than to any one surface. Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
