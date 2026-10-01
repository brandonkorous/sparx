# 903 — Opening the stock rule form counted as an unsaved change

**Status:** fixed
**Severity:** **minor** — a false "Not saved" and a dot on the tab, and a
close warning about changes nobody made
**Found by:** P03 · act 321, on LINEN-NAT-200
**Surface:** `inventory.stock.item` (both consoles), `ManagementForm`
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** walked on screen: open shows nothing unsaved; 12 → 13 shows
"Not saved"; 13 → 12 clears it

## What happened

"Change how this is managed" opened with Warn me at 12, Order 40, 14 days.
Nothing typed. The status bar read **Not saved: LINEN-NAT-200**, the tab grew a
dot, and Save was live.

## Why

Dirty was `ruleTouched && ruleValid`, and `ruleTouched` meant "a box has a
number in it". The boxes open holding the saved rule, so it was true on open.
Issue 507 fixed this exact shape on the spending-limit form.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## The fix

Dirty is now a CHANGE against the stored level: reorder point, quantity, or a
lead time that would be sent. The save only rewrites the rule when one of them
changed. `ruleTouched` stays for what it is good for: telling a half-filled
rule apart from an empty one.
