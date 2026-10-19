# 210 — The returns policy link on the return pages went nowhere

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 13 (the other side)
**Surface:** the Gillett site › an order › Return or exchange something; a return's page
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Brynn opened the return form for O-000010. At the foot of it: "Our returns policy
explains what we can take back and how long you have." The link went to
`/returns-policy`, which answers 404 on Gillett's site. Gillett published its policy as
"Refund Policy" at `/refund-policy`; the footer links it correctly. A return's own page
had the same link.

(Issue numbers 198 to 209 belong to a second agent working the same persona.)

## What should have happened

The link goes to the policy this shop published, wherever it is; and when a shop has
published none, there is no link rather than a broken one.

## Where it lives

- `wizeworks/apps/site/app/account/(authed)/orders/[orderId]/return/page.tsx` and
  `returns/[returnId]/page.tsx`: `href="/returns-policy"`, the template's default
  address (`packages/legal-templates`, `defaultSlug`).

## The fix

- `lib/policy-link.ts` `returnsPolicyLink`: the page the shop placed as its returns
  policy, else its refund policy, else nothing.
- `lib/customer-client.ts` `getLegalLinks`: the same placements read the footer makes,
  for the active site.
- `components/returns/returns-policy-note.tsx`: the sentence with the real link, or
  nothing. Both return pages use it.

Checked the neighbours: no other hard-coded policy address on the site. The product
page's "Returns & refunds" link is the owner's block (Gillett's says `/refund-policy`).

Tests, red first: `lib/policy-link.test.ts` (the picker, 4; and that neither return page
hard-codes an address and both use the note). Lint clean.

## Confirmed by

P01 on screen, 2026-10-09, as Brynn: the return form for O-000010 links "returns policy"
to `/refund-policy`, and it opened Gillett's "Refund Policy" page.

## Rating effect

—
