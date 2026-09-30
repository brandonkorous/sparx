# 755 — An invoice raised by mistake is permanent, and the order behind it is stuck

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 268
**Surface:** `@wizeworks/crm-schemas` + `@wizeworks/crm` (document workflows); both consoles
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, on screen and measured against the running database
**Blocked on:** —

## What happened

The wholesale order from [748](748-a-shop-phones-an-order-and-there-is-nowhere-to-type-it.md)
needed a bill. One click on **Make an invoice** and INV-000011 existed, with
every line and the $30 already in carried across. Good.

Now suppose it should not have been raised. Wrong lines, wrong customer, wrong
day. She goes to get rid of it:

| where she looked      | what was there                           |
| --------------------- | ---------------------------------------- |
| the **More** menu     | Print or save as PDF · Copy payment link |
| the **stage** menu    | Invoice · Receipt                        |
| back on the **order** | "…or void it before raising another."    |

**There is no void.** There is no delete either. The order will now refuse every
further attempt forever, pointing at an action the console does not have.

## Why

Two facts that are each defensible and together close the door.

**The default Invoice workflow has two stages.** `isDefault: true`, seeded into
every tenant the moment invoicing is switched on:

```ts
{ name: 'Invoice', stageType: 'open',  numberOnEnter: true  },
{ name: 'Paid',    stageType: 'paid',  locksEditing: true   },
```

No `void`. Nothing in it ends a document that should not exist.

**The console's delete is gated on a draft.** `canDelete = stage?.stageType ===
'draft'`, which is right on its own: a numbered invoice is not something to
delete quietly. But this workflow has no draft stage either, so the gate is
never open and the menu item never appears.

The machinery for the exit was all there and waiting. Entering a `void` stage
stamps `voidedAt`, sets the AR status to `void` and publishes
`crm.billing_document.voided`. The stage just did not exist.

**MEASURED 2026-09-20 against the running database: 205 live workflows, 52 with
a void stage, 153 without.**

## The neighbour, in the same file

The QUOTE workflows have had `Declined` and `Expired` since the day they were
written, forty lines below the invoice one in the same source file. A quote
could always be ended; an invoice never could.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

**Every built-in workflow gained a `Canceled` stage** — terminal, locking, red,
no number. Five of them needed it:

| workflow           | where                                   |
| ------------------ | --------------------------------------- |
| `invoice`          | the default one every tenant gets       |
| `service-repair`   | the other starter                       |
| `net-terms-ar`     | wholesale invoices raised from an order |
| `retail-quote`     | preset                                  |
| `deposit-progress` | preset                                  |
| `subscription`     | preset                                  |

Three of those six I had not spotted by reading. `check:workflow-exit` found
them on its first run.

**The order's refusal now names the action that exists**: "Open that invoice to
chase it, or **cancel it there** before raising another." It said "void it",
which is an accounting word for a button that is going to say Canceled.

**`check:workflow-exit` fails the build** on a built-in workflow with no `void`
stage, and is wired into `pre-push`.

## The 153 existing workflows, and the backfill that reached them

`bootstrapDefaultWorkflows` skips a workflow whose slug already exists, by
design — they are the tenant's own once seeded — so fixing the template reaches
new tenants only. Every business already on the platform kept the dead end
until the backfill ran.

**Proof the template fix works on its own:** Juniper Row's `net-terms-ar`
workflow was seeded at `2026-09-20 10:30:49+00`, the moment INV-000012 was
raised, and came out of `bootstrapDefaultWorkflows` carrying `Canceled` at sort
order 2. New workflows were already fine. Old ones were not.

**The backfill was authorized and applied 2026-09-20.**

```
wizeworks/packages/db/prisma/migrations/20270514000000_every_document_workflow_has_a_way_out/
```

`prisma migrate status` first reported it as the single pending migration of
330, then `prisma migrate deploy` applied it. Measured on either side of that
one command:

|        | live workflows | with an exit | without |
| ------ | -------------- | ------------ | ------- |
| before | 206            | 53           | **153** |
| after  | 206            | **206**      | 0       |

**153 stages written**, which is the number the SELECT dry-run predicted, and
**no workflow ended up with two.** Juniper Row's own:

```
 invoice        | Invoice     | open  | 0 | locks_editing f
 invoice        | Paid        | paid  | 1 | locks_editing t
 invoice        | Canceled    | void  | 2 | locks_editing t | #EF4444
```

Sort order 2, locking, red, no number — exactly what the template writes. No
document moved: a stage is a door, and the migration only hangs the door.

### One thing worth recording about the migration table

`_prisma_migrations` holds **two rows** for each of seven migrations: a
`rolled_back_at` attempt and a later successful one. A rolled-back row on its
own would make `migrate deploy` retry that migration, and all seven of those
directories are still on disk with their tables already created — so the deploy
would have failed on `relation already exists` before ever reaching this one.
It did not, because each has a succeeded row beside it. `migrate status` was
asked before `migrate deploy` was run, and it named exactly one pending
migration. [[feedback_verify_capability_in_code_not_docs]]

## Files

- `wizeworks/packages/crm-schemas/src/builtins/invoicing.ts` — invoice, service-repair, net-terms-ar
- `wizeworks/packages/crm/src/presets/invoicing.ts` — the three presets
- `wizeworks/packages/crm/src/services/billing-from-order-service.ts` — the refusal
- `scripts/check-workflow-exit.mjs` — new
- `package.json`, `.githooks/pre-push` — wired
- `wizeworks/packages/db/prisma/migrations/20270514000000_…/migration.sql` — applied 2026-09-20

## Proof

`check:workflow-exit` **went red on its first run** and named three preset
workflows I had not found by reading. It was then proved red three ways:

| what was broken                     | what it said                                     |
| ----------------------------------- | ------------------------------------------------ |
| the exit taken back off `invoice`   | `invoice [open, paid]` with its file and line    |
| a source file renamed               | cannot find it, rather than passing over nothing |
| pointed at a file with no workflows | "parsed no workflows at all"                     |

It also had a blindness of its own, found by checking its denominator: two
system workflows name their slug with a CONSTANT rather than a literal, so
their stages were being counted against whichever workflow came before them.
The count read 5 where 8 was right. Fixed before it was believed.
[[feedback_structural_checks_go_blind]]

crm 251, crm-schemas 48, and every typecheck.
