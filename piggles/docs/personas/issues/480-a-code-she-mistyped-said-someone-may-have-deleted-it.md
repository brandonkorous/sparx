# 480 — A code she mistyped came back as "someone may have deleted it"

**Status:** fixed
**Severity:** major
**Found by:** Devi typing "linen" into "Your product code" on Ashcombe Mills
**Surface:** `inventory.suppliers.detail` (both consoles)
**Filed:** 2026-09-09

## What was wrong

"What you buy from this supplier" asks for **Your product code** and says _"We
find the item in your catalog by its code."_ She typed `linen`, which is what she
buys, and pressed **Add item**.

Two messages arrived together and did not agree:

**Beside the field, correct:**

> No item in your catalog has the code "linen". Check the code and try again.

**In a toast, at the same moment:**

> **That didn't save**
> That no longer exists — someone may have deleted it while you had it open.
> Nothing was changed.

Three things wrong with the second one:

1. **Nothing was being saved.** The lookup is a `GET`.
2. **Nothing was deleted.** The code never existed.
3. **There is no "someone".** Devi is the only person in her business.

An owner reading it goes looking for a product that was never there, or wonders
who else has been in her account.

## Why

The failed-write net watches every mutation in one place, deliberately, so no
failed write is ever silent. Its rule, in its own words:

> _"Announce it ONLY if nobody else did… A surface that instead RENDERS the
> error has spoken just as clearly, but no watcher can see a render, so it says
> so by passing `shownInPlace`."_

The lookup is a `useMutation` on purpose — _"it fires on a button press with a
value typed moments before, not on render"_ — and this call site handles the
failure in a **try/catch**, which is exactly as invisible to a cache watcher as a
render is. The net saw a call site that said nothing and spoke.

`bom-detail.tsx`, the Recipes pane, uses the same lookup hook and passes its own
`onError`, so the flag gets set and the net stays quiet. One caller of two.

## The fix

```ts
resolved = await lookup.mutateAsync(code, { onError: shownInPlace });
```

The mechanism already existed with a name and a docblock; this call site had not
used it.

## The 404 sentence itself, measured and left alone for now

`describeWriteFailure`'s 404 branch returns one message for two causes: **the
record you had open is gone** (remedy: reopen the list) and **a value you typed
matches nothing** (remedy: check what you typed). The file's own header rule says
_"where one OUTCOME has two causes with different remedies, it gets two
messages"_, so by its own standard that branch is one short.

Not split here, because with `shownInPlace` in place no screen this run reaches
is showing it, and splitting it needs a server-side signal to tell the two apart
rather than a guess at the call site. Recorded so the next person who meets it
does not re-derive it.

## Proven

Typed `linen` again on Ashcombe Mills. One message: the inline one, naming the
code, with the remedy on it. No toast.
