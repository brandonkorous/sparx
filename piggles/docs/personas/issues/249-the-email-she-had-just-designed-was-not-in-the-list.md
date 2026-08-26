# 249 — She wrote the email, published it, came back, and it was not in the list

**Status:** fixed and confirmed
**Severity:** high
**Found by:** P03 · Juniper Row · act 10 — choosing what the broadcast sends
**Surface:** mypiggles › Messages › Broadcasts › the composer
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 10 — designed "Autumn drop", published it, reopened the picker and it was there

## What happened

Devi opened her broadcast, found she had nothing written yet, and took the route
the screen offers: **Design emails**, right there above the picker. She wrote
"Autumn drop", published it, and came back to the broadcast.

The picker offered the same list it had offered before. "Autumn drop" was not in
it.

## What should have happened

The button on this screen sent her to write an email so she could send it from
this screen. When she returns, it is there.

## Why it matters

There is nothing to try next. The email exists — she wrote it, she published it,
she can see it in Design emails — and the list that is supposed to offer it does
not. Nothing on screen says why, so the only readings available to her are "the
publish did not work" or "these two screens are not connected", and both send
her back to redo work that was already done.

The first thing a person does here is publish it again. That produces the same
list, because the list was never asking.

It is worse for being the FIRST thing she does. This is the path the surface
recommends to somebody with an empty picker, which makes it the path every new
owner takes on their first broadcast, and it dead-ends on the first attempt.

## Where it lives

[broadcasts-data.ts](../../../apps/workbench/surfaces/email/broadcasts-data.ts).
The picker's list came from a plain query:

```ts
export function useDesignedEmails() {
  return useQuery({
    queryKey: emailKeys.designed,
    queryFn: () => api.get('/v1/builder/emails').then((d) => d.emails),
  });
}
```

The shared client sets `staleTime: 60_000` — a sensible default for a console
full of lists, and exactly wrong here. Her round trip through the designer took
well under a minute, so on return the cached list was still considered fresh and
no request went out.

The designer is its own pane with its own data layer, and publishing there
invalidates its own caches. It does not know a broadcast composer exists, and it
should not have to: coupling every writer to every reader's cache keys is how
that kind of bug multiplies.

## The fix

The reader states its own requirement instead:

```ts
    refetchOnMount: 'always',
    staleTime: 0,
```

This list is read at exactly one moment — when a pane opens and an owner is
about to choose from it — and it is read immediately after the user has been
sent somewhere else to add to it. There is no version of that where a
minute-old answer is right, and one request per pane open is not a cost worth
caching against.

Chosen over invalidating from the designer because it holds no matter how the
email got written: from another window, from a different pane, from a blueprint
install, or from the MCP tools.

## What it looked like once fixed

```
Choose an email…
Welcome (draft — not published)
Welcome — day 3 (draft — not published)
Monthly newsletter
Sale announcement
Welcome (Fashion Boutique (Minimal)) (draft — not published)
We saved your spot (draft — not published)
Autumn drop                          ← the one she had just written
```

Sent to 23 people from that same screen a minute later.

## Related

Same picker, same afternoon:
[247](247-the-newsletter-picker-offered-to-send-a-payment-failure.md) is what it
offered that it should not have, this is what it did not offer that it should,
and [248](248-nothing-could-be-previewed-from-the-surface-that-sends.md) is why
neither would have been caught before the send.

## Rating effect

`Messages › Broadcasts` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
