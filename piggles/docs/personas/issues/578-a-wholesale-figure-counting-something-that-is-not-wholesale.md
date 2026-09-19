# 578 — A wholesale figure counting something that is not wholesale

**Status:** fixed and proven on screen
**Severity:** medium
**Found by:** Devi, on Customers → How your customers are doing
**Surface:** `piggles|sparx/apps/workbench/surfaces/crm/reports.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_never_present_absence_as_measurement]] · [[feedback_a_copy_edit_breaks_identity_lookups]]

## What she saw

The CRM overview, seven headline tiles:

| Customers | **Wholesale accounts** | Open deals |
| --------- | ---------------------- | ---------- |
| 36        | **0**                  | 0          |

Right for her, by accident. Click the tile and it opens a pane titled
**Companies**.

## Measured

```tsx
<KpiTile
  label="Wholesale accounts"
  value={s.companies.toLocaleString()}
  onOpen={go('crm.accounts.list')}
/>
```

`s.companies` is `tx.company.count({ where: { deletedAt: null } })` — every
company record. The console's own Record types screen says what a company is:

> **Companies** — The businesses your customers work for or buy through.

That is not a trade account. It is any firm a retail customer is attached to.

```sql
select t.name, count(c.id) companies,
       (select count(*) from customers x where x.tenant_id=t.id and x.type='wholesale')
from tenants t join companies c on c.tenant_id = t.id group by t.id, t.name;
```

| tenant                | companies | wholesale customers |
| --------------------- | --------- | ------------------- |
| WizeWorks LLC         | 7         | **0**               |
| Ironclad Fleet Supply | 2         | **0**               |
| Thistle & Rye         | 2         | **0**               |
| …and every other row  | ≥1        | **0**               |

**Every tenant on the platform holding a company record has zero wholesale
customers.** So the figure is wrong for all of them and right for none — it only
ever reads correctly at zero, which is what made it invisible on Devi's screen.

A shop whose retail customers happen to work for seven different firms opens its
CRM overview and reads "Wholesale accounts 7". Either it thinks it has a trade
business it does not have, or it clicks through to a pane called Companies and
loses trust in the number.

Both halves were correct on their own. The defect is the **pairing**, which is
why nothing caught it: the count is right, the label is a real thing the platform
sells, and only holding them together shows the mismatch.

## The fix

The tile says what it counts, and matches the pane it opens:

| Customers | **Companies** | Open deals |
| --------- | ------------- | ---------- |
| 36        | **0**         | 0          |

Both consoles. Verified in the browser.

## Proven

**`reports-tiles-name-what-they-count.test.ts`** — a source scan over
`reports.tsx`, pairing each snapshot-fed `<KpiTile>` with the `s.<field>` it
draws, against an explicit table of the seven fields `tenantSnapshot` returns.

It scans the source rather than rendering, because no render can catch a label
that is true of a different population. It asserts its own denominator (a scan
that quietly found two tiles would pass every other check) and refuses loudly on
a tile it cannot classify, so a rewrite cannot leave it scanning nothing
([[feedback_structural_checks_go_blind]]).

Putting the label back:

```
× name the population they count, not a different one
    AssertionError: no expected field for the label "Wholesale accounts"
× never calls the company count a trade figure
    AssertionError: "Wholesale accounts": expected true to be false
```

**2 of 3 red**, in both consoles.

|                 |                         |
| --------------- | ----------------------- |
| piggles console | **437 pass** (52 files) |
| sparx console   | **349 pass** (43 files) |
| typecheck       | both exit 0             |
