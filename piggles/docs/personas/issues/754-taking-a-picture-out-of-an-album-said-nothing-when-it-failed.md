# 754 — Taking a picture out of an album said nothing when it failed

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 268 (by the sweep behind [753](753-the-bin-beside-the-switch-did-what-the-switch-does.md))
**Surface:** mypiggles + sparx workbench — the picture picker (`cms/media-picker`)
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, by reading the pair side by side
**Blocked on:** —

## What happened

Putting a picture INTO an album says both things:

```ts
onSuccess: () => { toast.add({ title: `Saved to ${name}`, type: 'success' }); },
onError:   () => { toast.add({ title: 'Could not save that picture', type: 'error' }); },
```

Taking it back OUT said neither:

```ts
removeFromCollection.mutate({ collectionId, assetId });
```

When it works there is nothing to say: the tile leaves the album, which is the
message. When it fails the tile stays where it was and no message appears, which
is exactly what a click that never landed looks like. She presses it again.

## What was done

The failure says so, and says the picture is still in the album so she is not
left guessing which half happened. Success still says nothing, because the
screen already did. [[feedback_a_fix_leaves_its_neighbour_behind]]

## Not a delete

The new `check:confirm` guard flags this call by name and it is on the allowed
list with its reason: it takes a picture OUT of an album, the picture is not
deleted, and the button beside it puts it straight back. There is nothing lost
to warn about, so a confirm here would be a question with no stake in it.

## Files

- `piggles|sparx/apps/workbench/surfaces/cms/media-picker.tsx`
- `scripts/check-destructive-confirm.mjs` — the allowance and its reason
