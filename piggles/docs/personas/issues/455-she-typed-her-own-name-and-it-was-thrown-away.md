# 455 — She typed her own name and it was thrown away

**Status:** fixed
**Severity:** major
**Found by:** driving Email campaigns as P03 · Juniper Row
**Surface:** Marketing › Email campaigns · Email settings
**Filed:** 2026-09-09

## What her customers saw

Devi's newsletter went to 23 of her customers on 26 August. In their inbox it
read:

```
From:  Piggles <noreply@sparx.email>
```

Piggles is the software she rents. Not one of those 23 people has heard of it.
They bought a coat from **Juniper Row** — and the letterhead inside that very
email says Juniper Row, in her colours. The inbox line and the letter disagree,
which is the single loudest signal a person has for "this is not from who it
says it is".

## What the product told her to do about it

**Marketing › Email settings** opens with a card titled **Who your email comes
from**, subtitled _"This is what your customers see in their inbox, and where
their replies go."_ Its first field:

| field           | hint on screen                                                            |
| --------------- | ------------------------------------------------------------------------- |
| **Sender name** | "The name shown in the inbox — usually your business name, not a person." |
| From address    | "Leave it blank and we will send from our shared one."                    |

So: type your business name here. She typed **Juniper Row** and saved. The row
landed (`from_name = 'Juniper Row'`, `from_address = NULL`).

Then the send screen — **"The address it comes from · This is who your broadcast
appears to be from"** — still read `Piggles <noreply@sparx.email>`, after a
refresh.

## Why

One line, in the one function that answers this for the whole platform:

```ts
if (fromAddress) return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
// … no address? go straight to the platform, and never look at fromName again
```

The sender name was read **only inside the branch that already had an address**.
A shop with a verified sending domain got her name. A shop without one — which
is most of them, and which the same settings screen says is fine — had her
answer discarded.

That is not a fallback. A fallback fills a blank. This overwrote something she
had filled in, and gave her no way to tell: the field kept showing "Juniper Row"
while every email said Piggles.

The address and the name are separate questions. The **address** must be one the
provider is authorised to send for, and there is no arguing with that. The
**name** in front of it is only ever a label, and hers is the honest one — it is
already the letterhead inside the same message.

## The neighbour on the same line

`` `${fromName} <${fromAddress}>` `` never quoted the name. A mail header lets a
bare display name hold letters, digits and a few marks; anything else has to be
quoted or the header parses as something else. `Bob's Parts, Inc. <a@b.c>`
unquoted is a name, then a comma, then a second recipient that does not exist —
so the shop whose mail breaks is the one whose name has "Inc." in it. Both
branches now go through one `headerFrom`, which quotes when it has to and
escapes a quote inside the name.

## And a blank one now names the shop

That left one question, and it was Brandon's rather than mine, because it
changes what every tenant who has never opened the settings screen has always
sent: what should a **blank** sender name fall back to? He answered it — the
**site's own name**, on both brands.

It is the right answer for the same reason the typed name is. The recipient
bought from Juniper Row. The letterhead inside says Juniper Row. The software
the shop happens to rent is not a party to that conversation. The platform's own
name survives only where there is no site name at all.

The name is read per **site**, never per tenant: one owner may run a bookshop and
a bakery, and a newsletter from one must not go out signed by the other. That is
why `propertyId` became a parameter rather than something derived from the
tenant, and why all five call sites now pass the site they are sending from.

## The screen that promised it and never showed it

**Email settings** is titled _"Who your email comes from · This is what your
customers see in their inbox"_ and showed only the boxes that FEED that answer,
never the answer. The server has been sending it all along — `resolvedFrom`, the
literal `From` header a send will carry — and the piggles pane fetched it and
drew nothing. The only way to find out who your email came from was to open a
broadcast. That is where "Piggles" was found.

Both consoles now show **What your customers see now** at the top of that card.

## The same defect, still live on the other console

sparx's `senderDisplay` had never been fixed. It re-derived the fallback in the
browser and returned a bare `noreply@sparx.email` — no name at all — which is
the defect [245] fixed in piggles and left behind here. It now reads the
server's `resolvedFrom`, like its twin. On screen it went from
`noreply@sparx.email` to `WizeWorks <noreply@sparx.email>` in one reload.

## Where the code changed

- `wizeworks/packages/email-platform/src/services/platform-sender.ts` —
  `headerName`, `headerFrom`, `addressOf`, `siteName`, `platformSender`, and the
  three-step ladder: her typed name, her site's name, the platform
- `wizeworks/packages/email-platform/src/services/{broadcast,builder-email,settings}-service.ts`
  and `wizeworks/services/api-rest/src/lib/{email-dispatch,tenant-email}.ts` —
  the site threaded to all five call sites
- `{piggles,sparx}/apps/workbench/surfaces/email/email-settings.tsx` — **What
  your customers see now**
- `sparx/apps/workbench/surfaces/email/{broadcasts-data.ts, settings-data.ts}` —
  `resolvedFrom`, and `senderDisplay` stops re-deriving it
- `wizeworks/packages/email-platform/test/platform-sender.test.ts` (NEW, 10)

Every send path already funnels through `buildTenantFrom` — the file's own
header records that a second copy once shipped and won, so it is now the only
place. One fix covers the broadcast screen, the send itself, and every
transactional email.

## Verification

Driven as Devi. Typed **Juniper Row** into Sender name, saved, reloaded the
broadcast: **`Juniper Row <noreply@sparx.email>`** where it said `Piggles`
minutes before.

Each guard proved red on its own:

Then the fallback, on her **sample sale** site, whose name differs from her
primary's and which has no settings row at all. Every box on that card blank:

> **What your customers see now**
> `Juniper Row Sample Sale <noreply@sparx.email>`

Which is the blank fallback and per-site scoping proved in one screenshot.

On the sparx console, the same card went from a bare `noreply@sparx.email` to
`WizeWorks <noreply@sparx.email>`.

| removing                                | reddens                                                     |
| --------------------------------------- | ----------------------------------------------------------- |
| the name in front of the shared address | 4, incl. `expected 'Piggles <…>' to be 'Juniper Row <…>'`   |
| the quoting in `headerName`             | 2, and only those                                           |
| the site-name fallback                  | 3, incl. `expected 'Piggles <…>' to be 'Savory Donuts <…>'` |

The typed-name tests deliberately type a name the SITE is not called
("Devi at Juniper Row"). Typing the site's own name would have let them pass off
the fallback and prove nothing — the trap that had already caught one test this
week ([[feedback_a_test_that_cannot_go_red]]).

email-platform 28 across 4 files, api-rest 510 across 87. Typecheck, lint and
prettier clean; `check:console-parity`, `check:boundaries`, `check:routes` and
`check:events` all pass.

## Rating effect

`Marketing › Email campaigns` and `Marketing › Email settings` — recorded in
[rating.md](../rating.md).
