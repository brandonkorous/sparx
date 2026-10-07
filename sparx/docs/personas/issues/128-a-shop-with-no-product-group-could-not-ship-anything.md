# 128 — A shop with no product group could not add any delivery option

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9 (adding UPS Ground to the United States region)
**Surface:** workbench › Shipping › a region › Add a delivery option (both consoles); `POST /v1/commerce/shipping/rates`; the MCP tool `create_shipping_rate`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

The Shipping screen says of product groups: "Most shops need just one", and with none, "Every product ships the same way until you add a group." Doty took it at its word. In his new region, "Add a delivery option" answered "Add a product group first: a delivery option needs a product group to apply to. Add one from the Shipping screen, then come back." Every option had to name a group, so a shop with none could not ship anything.

## What should have happened

A shop that has no reason to split its products adds its first delivery option, and it applies to everything.

## Why it matters

Shipping is the first thing a selling shop sets up. A dead end that contradicts the screen before it reads as "this does not work".

## The fix

- `commerce-schemas/src/shipping.ts`: a delivery option's group is optional.
- `commerce/src/services/shipping-service.ts` `createRate`: with no group named, the option goes under the shop's default group (its oldest, the existing rule), and when the shop has none it is made: "All products", "Everything you sell, unless you put it in another group."
- Both consoles, `shipping-rate-editor.tsx`: the dead-end alert is gone; with no groups the form asks no group question and sends none. The MCP tool uses the same schema, so it follows.

Test, proved red:

- `api-rest/test/integration/first-delivery-option.test.ts` (database): with no group, two options are added; one group "All products" exists and holds both. With the group required again, the first answers 422.

## Confirmed by

On screen, 2026-10-06, as Doty: "Add a delivery option" opened the form; "UPS Ground", free over a certain order value, $15.00, free from $250.00, carrier UPS, 5 days; "UPS Ground added", the region reads "1 delivery option". The database holds "All products" with that option. At checkout, the stranger's St. George address offered "UPS Ground · 5 days, Free" for a $545.00 part.

## Rating effect

—
