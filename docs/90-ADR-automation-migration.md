# ADR — Automation Module: Complete the Migration Now

**For:** Claude Code / build agent
**Date:** 2026-06-12
**Status:** Decided — execute this slice completely.
**Context:** Zero users in production. No migration risk. Do it all now.

---

## 1. The Decision

Do the full automation migration in one slice. Do not do it incrementally.
Do not leave the legacy system partially in place. There are no users to
protect. The cost of doing this later is migration complexity plus risk to
real merchants. The cost of doing it now is only engineering time.

---

## 2. What to Delete — No Soft Deprecation

Delete these completely. No stubs. No soft deprecation. No "deprecated" comments.

```
@sparx/email-platform:
  → DEFAULT_AUTOMATIONS constant / catalog
  → evaluateTrigger() engine and all its callsites
  → The seeding logic that installs these rows on email activation
  → Any DB rows seeded by this system (truncate or delete in migration)

Dashboard:
  → The standalone "Email Automations" page
    (apps/dashboard/app/(dashboard)/email/automations/ or similar)
  → Any route that reads from the legacy email automation tables
    exclusively
```

Replace the dashboard email automations page with a filtered view of the
unified automations list: all automations where any action has type
`send_campaign` or `send_internal`. This is one query filter, not a
separate page. Merge it into the main automations list as a tab or filter.

---

## 3. What to Build — The Full Catalog in One Slice

### 3a. Default Builder-Emails Library (the keystone)

Build this first. Everything else that sends email depends on it.

On `email` module activation, provision a set of editable Builder email
node-trees for the tenant. These are starting-point templates the merchant
can customize. They are not locked — they are owned by the tenant the
moment they are provisioned.

Required templates (minimum set to unblock all seeded workflows):

```
welcome-customer          Subject: "Welcome to {{store.name}}"
win-back                  Subject: "We miss you, {{customer.firstName}}"
abandoned-cart            Subject: "You left something behind"
post-purchase-review      Subject: "How did we do?"
b2b-account-approved      Subject: "Your account is approved"
b2b-quote-received        Subject: "Quote received — {{quote.number}}"
b2b-invoice-due           Subject: "Invoice due in {{invoice.daysUntilDue}} days"
b2b-quote-expiring        Subject: "Your quote expires in 48 hours"
invoicing-reminder        Subject: "Friendly reminder — {{invoice.number}} due {{invoice.dueDate}}"
invoicing-overdue         Subject: "Invoice {{invoice.number}} is overdue"
invoicing-overdue-2       Subject: "Second notice — {{invoice.number}}"
invoicing-overdue-final   Subject: "Final notice — {{invoice.number}}"
chat-satisfaction         Subject: "How was your experience?"
chat-no-response          (internal staff notification — not customer-facing)
```

These are node-trees using the existing Builder email renderer. They do not
need to be pixel-perfect at launch — they need to be functional and
editable. Merchants will customize them. Ship working, not beautiful.

Provisioning logic:

- Runs on email module activation event
- Idempotent — if templates already exist for a tenant, skip
- Reconcile runs nightly to backfill any tenant that missed activation
- Templates are owned by the tenant (tenant_id scoped, RLS enforced)

### 3b. Per-Module Automation Catalog

Restructure seeds into the per-module catalog format. Each seed declares:

- `module` — which module's activation installs it
- `requires` — additional modules that must be active for email sends
  to fire (not for the automation to seed — see Section 4)
- `locked` — boolean (see Section 5)
- `origin` — 'system'
- The full trigger/condition/actions definition

**CRM module seeds:**

```
welcome-new-customer
  trigger:  crm.customer.created
  requires: ['email']
  actions:  send_campaign(welcome-customer)
  locked:   false

win-back-inactive
  trigger:  schedule.daily
  predicate: customer.daysSinceLastOrder >= 90
             AND customer.totalOrders > 0
  requires: ['email']
  actions:  send_campaign(win-back)
  locked:   false

auto-tag-vip
  trigger:  crm.customer.ltv_threshold_crossed
  condition: customer.lifetimeValue >= [tenant.vipThreshold ?? 1000]
  actions:  crm.add_tag(tag: 'vip')
  locked:   false
  (no email required — tags only)

new-lead-follow-up-task
  trigger:  crm.deal.created
  condition: deal.stage.type = 'open'
  actions:  crm.create_task(
              title: 'Follow up — {{deal.name}}',
              assignee: deal.ownerId,
              dueInDays: 1
            )
  locked:   false
  (no email required — task only)

deal-closed-won-invoice-task
  trigger:  crm.deal.stage_changed
  condition: deal.stage.type = 'won'
  actions:  crm.create_task(
              title: 'Create invoice — {{deal.name}}',
              assignee: deal.ownerId,
              dueInDays: 1
            )
  locked:   false
  (no email required — cross-module with invoicing, task only)
```

**Commerce module seeds:**

```
abandoned-cart-nudge
  trigger:  commerce.cart.abandoned  (>30 min with items, no checkout)
  requires: ['email']
  actions:  wait(2h) → send_campaign(abandoned-cart)
  locked:   false

post-purchase-review-request
  trigger:  commerce.order.fulfilled
  requires: ['email']
  actions:  wait(3d) → send_campaign(post-purchase-review)
  locked:   false

high-value-order-staff-alert
  trigger:  commerce.order.paid
  condition: order.total >= [tenant.highValueThreshold ?? 500]
  actions:  send_internal(
              to: tenant.alertEmail,
              subject: 'High-value order — {{order.number}} · ${{order.total}}'
            )
  locked:   false
  (no email module required — internal alert uses transactional send)

low-inventory-alert
  trigger:  commerce.inventory.below_threshold
  actions:  send_internal(
              to: tenant.alertEmail,
              subject: 'Low inventory — {{product.title}} · {{inventory.quantity}} remaining'
            )
  locked:   false
  (no email module required — internal alert)

refund-issued-crm-note
  trigger:  commerce.order.refunded
  actions:  crm.add_note(
              customerId: order.customerId,
              body: 'Refund issued — {{order.number}} · ${{refund.amount}}'
            )
  locked:   false
  (no email required — CRM note only, cross-module)
```

**B2B module seeds:**

```
b2b-overdue-escalation  ← ALREADY BUILT, LOCKED
  Do not modify. Do not unlock. Leave as-is.

b2b-account-approved
  trigger:  b2b.account.approved
  requires: ['email']
  actions:  send_campaign(b2b-account-approved)
  locked:   false

b2b-quote-received
  trigger:  b2b.quote.created
  requires: ['email']
  actions:  send_campaign(b2b-quote-received)
  locked:   false

b2b-invoice-due-nudge
  trigger:  schedule.daily
  predicate: billingDocument.daysUntilDue = 3
             AND billingDocument.status = 'unpaid'
             AND billingDocument.workflow.slug = 'net-terms-ar'
  requires: ['email']
  actions:  send_campaign(b2b-invoice-due)
  locked:   false

b2b-quote-expiring
  trigger:  schedule.daily
  predicate: quote.expiresAt <= now() + 48h
             AND quote.status = 'open'
  requires: ['email']
  actions:  send_campaign(b2b-quote-expiring)
  locked:   false

b2b-new-account-task
  trigger:  b2b.account.created
  actions:  crm.create_task(
              title: 'Onboard new B2B account — {{account.name}}',
              assignee: tenant.defaultSalesOwnerId,
              dueInDays: 1
            )
  locked:   false
  (no email required — task only)
```

**CMS module seeds:**

```
(none)

"Scheduled content publish" is a CMS feature — a publish_at timestamp
on the document model. It is NOT an automation. Do not add CMS
automations to the catalog.
```

**Invoicing module seeds:**
(gate: invoicing OR b2b active — see invoicing ADR)

```
invoicing-reminder-3-days
  trigger:  schedule.daily
  predicate: billingDocument.daysUntilDue = 3
             AND billingDocument.status = 'unpaid'
             AND billingDocument.workflow.origin = 'user'
  requires: ['email']
  actions:  send_campaign(invoicing-reminder)
  locked:   false

invoicing-overdue-7
  trigger:  schedule.daily
  predicate: billingDocument.overdueDays = 7
             AND billingDocument.status IN ['unpaid','partial']
             AND billingDocument.workflow.origin = 'user'
  requires: ['email']
  actions:  send_campaign(invoicing-overdue)
  locked:   false

invoicing-overdue-14
  trigger:  schedule.daily
  predicate: billingDocument.overdueDays = 14
             AND billingDocument.status IN ['unpaid','partial']
             AND billingDocument.workflow.origin = 'user'
  requires: ['email']
  actions:  send_campaign(invoicing-overdue-2)
  locked:   false

invoicing-overdue-30
  trigger:  schedule.daily
  predicate: billingDocument.overdueDays = 30
             AND billingDocument.status IN ['unpaid','partial']
             AND billingDocument.workflow.origin = 'user'
  requires: ['email']
  actions:  send_campaign(invoicing-overdue-final)
  locked:   false

invoicing-estimate-approved-task
  trigger:  billing_document.stage_changed
  condition: stage.type = 'committed'
             AND document.workflow.origin = 'user'
  actions:  crm.create_task(
              title: 'Advance to next stage — {{document.number}}',
              assignee: document.ownerId,
              dueInDays: 0
            )
  locked:   false
  (no email required — task only)
```

**Chat module seeds:**

```
chat-no-response-staff-alert
  trigger:  chat.conversation.unresponded  (10 min with no merchant reply)
  actions:  send_internal(
              to: conversation.assignedStaff ?? tenant.alertEmail,
              subject: 'Unresponded chat — {{customer.name ?? "Anonymous"}}'
            )
  locked:   false
  (no email module required — internal alert)

chat-satisfaction-survey
  trigger:  chat.conversation.resolved
  requires: ['email']
  actions:  wait(10m) → send_campaign(chat-satisfaction)
  locked:   false
```

---

## 4. Cross-Module Email Gating Rule

Seed on the purpose module. Gate sends at runtime via the gated dispatcher.

```
When Commerce activates:
  → abandoned-cart-nudge seeds immediately
  → Merchant sees it in their automations list
  → Toggle is ON
  → If email module is NOT active:
      send action records as gated (gate_log entry)
      UI shows: "Add Email module to activate sending"
  → When email activates:
      gate clears automatically
      automation starts firing on next trigger

Do NOT wait for both modules before seeding.
Do NOT hide automations from merchants until all requires are met.
The gated dispatcher already handles this — trust it.
```

The gated run step in the audit log is a feature, not a bug. Merchants
seeing "2 sends gated — Email module required" is a conversion nudge
built into the product. Do not suppress it.

---

## 5. Locked vs Managed

```
Locked (tenant cannot disable or edit):
  → b2b-overdue-escalation (already built, already locked)
  → Any future compliance or legal invariant
  → Rule: only lock if "tenant disabled this" creates legal
    or financial liability for sparx or the merchant

Managed (seeded on, fully editable by tenant):
  → Everything else in this catalog
  → Merchants own their automations even when sparx seeded them
  → They can edit, disable, clone, or delete managed automations
```

Do not make things Locked out of caution. Locked automations make
merchants feel the platform is controlling their business. Only lock
what genuinely cannot be delegated.

---

## 6. Reconciliation

The daily reconcile already exists for B2B dunning. Extend it:

```
Nightly reconcile job:
  For each active tenant:
    For each active module:
      Ensure all catalog seeds for that module are installed
      Ensure Builder-email templates are provisioned if email active
      Self-heal any missed activation events
      Skip seeds that already exist (idempotent)
      Log any seeds that failed to install (don't throw)
```

This makes the system self-healing. A missed activation event doesn't
leave a tenant without their automations forever.

---

## 7. Build Order Within This Slice

Hard dependency: Builder-emails library must exist before any email
workflow that references a template can be seeded.

```
Step 1: Delete legacy system (see Section 2)
        No reason to wait. Nothing depends on it being alive.

Step 2: Build Default Builder-emails library + provisioning
        All 14 templates. Functional, not beautiful.
        Idempotent provisioning on email activation.
        Nightly reconcile extended to cover provisioning.

Step 3: Seed the no-email workflows immediately
        These have no dependency on Step 2:
          auto-tag-vip, new-lead-follow-up-task,
          deal-closed-won-invoice-task, high-value-order-staff-alert,
          low-inventory-alert, refund-issued-crm-note,
          b2b-new-account-task, invoicing-estimate-approved-task,
          chat-no-response-staff-alert

Step 4: Seed all email workflows
        Now that templates exist from Step 2.
        All remaining catalog entries.

Step 5: Repoint email automations dashboard page
        Filtered view of unified automations.
        Remove legacy page and legacy tables.

Step 6: Verify end-to-end
        Activate each module on a test tenant.
        Confirm correct seeds installed.
        Confirm reconcile backfills correctly.
        Confirm gated sends log correctly when email is inactive.
        Confirm send fires correctly when email is active.
```

---

## 8. What This Slice Does NOT Include

Do not build these as part of this slice. They are separate work:

```
→ Visual automation builder UI improvements (canvas is already built)
→ Additional action executors beyond what exists
→ The merchant-facing automation template library / gallery
→ MCP automation authoring improvements
→ Analytics / automation performance reporting
→ Pricing / packaging for the automation capability
   (it is infrastructure, not a paid module — no charge)
```

---

## 9. Definition of Done

This slice is complete when:

```
✅ Legacy @sparx/email-platform automations code deleted
✅ Legacy email automations dashboard page removed
✅ All 14 Builder-email templates provisioned on email activation
✅ Nightly reconcile provisions templates for existing tenants
✅ All catalog seeds installed per module (29 automations total)
✅ B2B dunning ladder unchanged and still locked
✅ Gated dispatcher correctly gates email sends when email inactive
✅ Gated sends visible in run history with clear reason
✅ Unified automations list filterable by module/action type
✅ Test tenant with all modules active shows full catalog
✅ Test tenant with commerce only shows commerce seeds + gated email actions
✅ Nightly reconcile self-heals missed activation events
```
