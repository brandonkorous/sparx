# 890 — One sentence of advice for six different failures

**Status:** **part fixed** — the false claim is gone; storing the real reason
needs a column on the supplier and is the one thing waiting on Brandon
**Severity:** **moderate** — the screen named a single cause as fact. When it
was the wrong one it sent her to re-check an address that was perfectly correct,
about a file the platform had never tried to fetch
**Found by:** P03 · act 316, while fixing issue 889 on the same pane
**Surface:** mypiggles › Partners › Ship-direct suppliers › a supplier's own
pane, in both consoles
**Filed:** 2026-09-30

## What she saw

Highline Knitwear, flagged **Needs attention**:

> _"We could not read this supplier's file. Check the address is right and that
> the file opens for anybody, not just for people signed in to their system."_

Two assertions, both stated as fact: that the file was read and failed, and that
the address or its permissions are the reason.

## Six failures, one sentence

Every adapter throws a different thing, and the worker catches all of them:

```ts
} catch (err: unknown) {
  const errMsg = err instanceof Error ? err.message : String(err);
  log.error({ supplierId, err: errMsg }, 'dropship sync failed');
  await withTenant({ tenantId }, async (tx) => {
    await tx.dropshipSupplier.update({
      where: { id: supplierId },
      data: { status: 'error' },      // ← and nothing else
    });
  });
```

What reaches that catch, measured across the five adapters:

```
CSV column mapping is incomplete       thrown BEFORE any network call
CSV fetch failed: 404 Not Found        the address
CSV fetch failed: 403 Forbidden        the permissions
a timeout                              AbortSignal.timeout(60_000) - their server is slow
a network error                        DNS, refused, TLS - their server is down
Printify account has no shops          a setup step at the supplier's end
```

Six causes with six different answers, and one of them - the mapping - fails
without the file being touched at all. The sentence "we could not read this
supplier's file. Check the address is right" is then **false in both halves**.
[[feedback_one_outcome_two_causes]]

## The reason is known, and thrown away

`errMsg` is in scope. It is logged. It is even published:

```ts
await publishEvent(
  publisher,
  'dropship.supplier.error',
  tenantId,
  null,
  { supplierId, error: errMsg },
  log
);
```

And then it is gone. `dropship.supplier.error` has **no subscriber anywhere in
the repo** - it appears at the publish site and in the `EventType` union and
nowhere else - so nothing stores it, and `dropship_suppliers` has no column that
could hold it. The platform works out the answer and drops it one line before
the row it writes. [[feedback_fetched_but_never_rendered]]

## What is fixed now

Both sentences stopped asserting a cause. They say what is actually known - that
the last attempt failed - and name more than one way in:

> _"We could not read this supplier's file the last time we tried. Usually the
> address has changed, or the file only opens for people signed in to their
> system. Check the address below opens for anybody, then try again."_

> _"We could not reach this supplier the last time we tried. Usually the key
> below has been changed or turned off at their end, though their system being
> down looks the same from here. Get a new key from them if it has changed, then
> try again."_

Separately, **issue 889** closed the one cause a person could reach from this
screen: a required column could be emptied and saved, which produced exactly the
mapping failure the advice described worst. The form now blocks it.

## What is left, and why it is Brandon's

The honest fix is to keep the reason. That needs a column on
`dropship_suppliers`, which means a migration, which is applied by the release
pipeline and not from here.

**The shape I would build**, for a yes:

- `last_error_code varchar(40)` — a small set, never the raw message. A thrown
  error can carry a URL with a token in its query string, so nothing raw should
  reach a browser. The codes the six failures above sort into:
  `mapping_incomplete`, `not_found`, `denied`, `timed_out`, `unreachable`,
  `supplier_setup`, `unknown`.
- The worker classifies once, in a pure function with its own tests, and writes
  the code beside `status: 'error'`; a successful sync clears it.
- The pane maps each code to the advice that actually helps, and says nothing
  more than the code supports.

Nothing else in the platform needs to change, and the pane keeps working exactly
as it does today for a supplier whose code is null.

**Migration name:** must sort after `20270524000000`, so
`20270525000000_a_failed_supplier_sync_remembers_why`.

## Files changed so far

- `piggles/apps/workbench/surfaces/dropship/dropship-data.ts`
- `sparx/apps/workbench/surfaces/dropship/dropship-data.ts`

## The thing to remember

**"Usually" is a word that belongs in advice and not in a diagnosis.** The
screen was not wrong to guess - with nothing stored it can only guess - it was
wrong to print the guess in the voice it uses for facts. A business owner reads
"Check the address is right" as "we checked, and the address is the problem."

The measurement that finds it is not "is this message clear" - it was perfectly
clear. It is **"how many different things produce this message, and do they have
the same answer?"** Here six did, and they did not.
