# 307 — Partner pages promised an apply step that did not exist

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Partner › every section; api-rest partner routes; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

Every partner section, for a business not in the program, said "An owner or admin can apply to join from your account settings". No screen could. The apply route and its status read had no caller since the move to the workbench. Some lists also failed as a load error instead of showing that page.

## What should have happened

The page says the business is not a partner, and lets an owner apply there. It shows a pending or refused application when there is one.

## How to reproduce

1. As a business that is not a partner, open Partner › Clients.

## Why it matters

The copy sent the owner to a place with no such step. That is a promise that cannot be kept.

## Where it lives

`api-rest/src/lib/partners/not-a-partner.ts` (new), the partner service and routes, `surfaces/partner/gate.tsx`, `join.tsx` (new), `data.ts`, the clients, referrals and bootcamp lists; Piggles `lib/console/copy.ts`.

## The fix

- The API answers `FORBIDDEN` with `reason: 'not_a_partner'` from one helper.
- `isNotAPartner(error)` sends that answer to the not-a-partner page instead of a load error.
- The page reads "An owner or admin can apply here, and sparx reviews each application." and shows `JoinPartnerProgram`: the application status, or a name and a kind, then "Apply to join".

No test: proved on screen.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. Partner › Clients reads "This account isn’t a sparx partner … An owner or admin can apply here, and sparx reviews each application." with the name field, "What describes you" and "Apply to join". Earlier the same day one application was sent and showed "Your application is in review". That row (`partner_applications` 75d80a59) was then deleted to put Doty back.

Later the same day: a bootcamp page opened outside the program said "This bootcamp no longer exists". It now shows the same not-a-partner page, in both consoles (`surfaces/partner/bootcamp-detail.tsx`). Seen on screen: `/partner/bootcamps/new` and an unknown bootcamp both read "This account isn’t a sparx partner" with the apply form.

## Rating effect

See the pane's row in `rating.md`.
