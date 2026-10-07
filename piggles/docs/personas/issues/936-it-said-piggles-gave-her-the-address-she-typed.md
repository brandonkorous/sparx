# 936 — It said Piggles gave her the address she typed

**Status:** fixed (act 325)
**Severity:** copy
**Found by:** P03 · Juniper Row · act 325, re-scoring Domains (P01's row, Ease 6)
**Surface:** mypiggles › Domains › a free address (Piggles console)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, her main address and her Archive site's address, each with its own true sentence
**Blocked on:** —

## What happened

Domains' row carried one gap since issue 010: the pane "does not say WHERE it
was chosen, so somebody who does not remember doing it reads it as the product
having picked for her".

Issue 927 later gave each free address a "Where this address comes from" card.
It said, for every business: **"Piggles gave your business this address when
you signed up."** And for every added site: **"Piggles gave this site its
address when it was added."**

Since 2026-08-24 (commit 9ac046f0f) neither is true for a new business. She
types the address herself, in the **Your web address** box on getpiggles' last
sign-up step, and in the **Web address** box when she adds a site. The card
told her the opposite of what happened, and did not say where she could have
seen it.

Older businesses are the other way round, and that is why one sentence cannot
serve: before 2026-08-22 a business got a made-up name (`quiet-haven-3783`),
and for the two days after it got one made from its name.

## The fix

`surfaces/domains/address-origin.ts` picks the sentence by the address's age
and shape:

- made on or after 2026-08-25: **"You chose this address when you signed up,
  in the Your web address box on the last step."** For a site: **"You chose
  this site's address when you added the site, in its Web address box."**
- older, made-up shape: **"Piggles made this address up when you signed up,
  before it asked businesses to choose their own."**
- older, otherwise: **"Piggles made this address from your business's name when
  you signed up."** For a site: the old sentence, which was true then.

The card's sentences also went from 14px to 16px.

## Proof

- `address-origin.test.ts`, 4 cases. Making every address read as older
  reddens 2.
- On screen, as Devi: `juniper-row.piggles.site` (signed up 2026-08-23) reads
  "Piggles made this address from your business's name when you signed up";
  `archive.juniper-row.piggles.site` reads "You chose this site's address when
  you added the site, in its Web address box. The first part, archive, is the
  site's own".
- Only words and a text size changed, so the layout was not re-checked in dark
  mode or at 360px.

## Not changed

- The sparx console's card keeps its sentence. sparx's signup and its dates are
  its own, and this run did not walk them.
