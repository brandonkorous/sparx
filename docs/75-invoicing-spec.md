# Sparx Platform — Invoicing Spec

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-05-31

---

## 1. Overview

Invoicing is built into the Commerce and B2B modules — not a separate module. The value is the integration: a Sparx invoice knows the customer's order history, payment terms, and CRM context. It's not a standalone billing tool.

**Included in Commerce (+$49/mo):**

- Invoice from any order (one click)
- Standalone invoice creation
- Hosted payment page
- Basic reminders (3 days before, due date)

**Additional capabilities in B2B (+$99/mo):**

- Quote → Invoice conversion (one click)
- Advanced dunning workflows (7/14/30 days overdue)
- Aging reports
- Client portal (client views all invoices, pays, downloads)
- Net terms management
- Multi-currency invoicing

---

## 2. Core Use Cases

**Use case 1 — Commerce invoice**
Merchant sells something, wants to send a formal invoice instead of just an order confirmation. Common in B2B — "send me an invoice I can give to accounting." One-click from the order detail page.

**Use case 2 — Standalone invoice**
Merchant invoices for services, consulting, custom work that doesn't go through the Sparx storefront. A contractor, photographer, or service business creates an invoice from scratch, sends it to a client, and gets paid.

**Use case 3 — Quote → Invoice (B2B)**
B2B merchant has an approved quote. One click converts to invoice with all line items, pricing, and payment terms preserved. Client receives invoice email with payment link.

---

## 3. Data Model

```sql
CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  invoice_number    VARCHAR(50) NOT NULL,
  -- Auto-generated: INV-2026-0441, or merchant-defined format
  customer_id       UUID REFERENCES customers(id),
  order_id          UUID REFERENCES orders(id),      -- if from order
  quote_id          UUID REFERENCES quotes(id),      -- if from quote
  status            VARCHAR(20) DEFAULT 'draft',
  -- draft | sent | viewed | partial | paid | overdue | void
  issue_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE,
  currency          CHAR(3) DEFAULT 'USD',
  line_items        JSONB NOT NULL DEFAULT '[]',
  -- [{ description, quantity, unit_price, amount, tax_rate }]
  subtotal_cents    INTEGER NOT NULL DEFAULT 0,
  tax_cents         INTEGER NOT NULL DEFAULT 0,
  discount_cents    INTEGER NOT NULL DEFAULT 0,
  total_cents       INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  amount_due_cents  INTEGER GENERATED ALWAYS AS (total_cents - amount_paid_cents) STORED,
  notes             TEXT,
  terms             TEXT,  -- "Net 30", "Due on receipt", custom
  pdf_url           TEXT,  -- generated on send, stored in GCS
  sent_at           TIMESTAMPTZ,
  viewed_at         TIMESTAMPTZ,  -- when client first opened
  paid_at           TIMESTAMPTZ,
  reminder_1_sent_at TIMESTAMPTZ,
  reminder_2_sent_at TIMESTAMPTZ,
  overdue_1_sent_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id),
  amount_cents    INTEGER NOT NULL,
  method          VARCHAR(30),
  -- stripe | ach | check | cash | wire | other
  reference       VARCHAR(255),  -- check number, wire ref, etc.
  stripe_pi_id    VARCHAR(255),  -- if paid via Stripe payment link
  note            TEXT,
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Number sequence per tenant
CREATE TABLE invoice_sequences (
  tenant_id     UUID PRIMARY KEY REFERENCES tenants(id),
  prefix        VARCHAR(20) DEFAULT 'INV',
  year_format   BOOLEAN DEFAULT true,  -- INV-2026-0001 vs INV-0001
  next_number   INTEGER DEFAULT 1
);
```

---

## 4. Hosted Invoice Page

Every invoice has a unique hosted URL that clients can access without logging in:

```
invoice.sparx.zone/inv/[uuid]
  OR
invoice.gillettdiesel.com/inv/[uuid]  (if merchant has custom domain)
```

The page shows:

- Merchant logo + brand colors
- Invoice number, issue date, due date
- Bill To (client name, address)
- Line items table
- Subtotal, tax, discount, total
- Amount paid (if partial)
- **Amount due** (large, prominent)
- [Pay Now — $4,820.00] → Stripe payment link
- [Download PDF]
- Invoice notes and payment terms

**No login required** for the client. UUID in URL serves as the auth token. Expires (becomes read-only) 90 days after payment or void. View event (first open) is recorded → merchant notified.

---

## 5. Invoice Workflow

### Creating an Invoice

Three entry points:

**From an order:**

```
Order #4821 detail page
→ [Create Invoice] button
→ Invoice pre-populated with:
    - Customer info from order
    - Line items from order
    - Merchant's default payment terms
→ Merchant reviews, edits if needed
→ [Send Invoice]
```

**From a quote (B2B):**

```
Quote #Q-2026-041 detail page (status: Approved)
→ [Convert to Invoice] button
→ Invoice pre-populated with:
    - All quote line items and pricing
    - Customer's net terms (Net 30, etc.)
    - Quote reference number preserved
→ [Send Invoice]
```

**Standalone:**

```
Invoices → [New Invoice]
→ Select customer (or create new)
→ Add line items manually
→ Set due date and terms
→ [Send Invoice] or [Save as Draft]
```

### Sending

On send:

1. PDF generated and stored in GCS
2. Email sent via Postal with hosted invoice link
3. Invoice status → `sent`
4. Merchant's sent_at timestamp recorded

Email template:

```
Subject: Invoice INV-2026-0441 from Gillett Diesel Service — $4,820.00 due [date]

Hi [Client Name],

Please find your invoice from Gillett Diesel Service attached.

Invoice #: INV-2026-0441
Amount:    $4,820.00
Due:       June 30, 2026

[View & Pay Invoice →]  (button → hosted invoice page)

Questions? Reply to this email or call [merchant phone].

Gillett Diesel Service
```

### Reminders (Commerce)

- 3 days before due date: "Friendly reminder" email
- Due date (if unpaid): "Invoice due today" email

### Dunning (B2B)

- 7 days overdue: "Invoice overdue" email
- 14 days overdue: "Second notice" email
- 30 days overdue: "Final notice" email + flag in CRM as collection risk

All reminder/dunning emails configurable (enable/disable, custom copy) from Settings → Invoicing.

---

## 6. Payment

Clients can pay via:

**Stripe payment link (auto-generated):**

- Card (Visa, Mastercard, Amex)
- ACH bank transfer (US only)
- Apple Pay / Google Pay
- BNPL via Stripe (Klarna, Afterpay) — merchant opt-in

**Mark as paid manually:**
Merchant can record manual payments (cash, check, wire):

```
Invoice #4821 → [Record Payment]
  Amount: $4,820.00
  Method: Check
  Reference: #1042
  Date: 2026-06-15
  [Save]
```

**Partial payments:**
Invoice accepts multiple payments. Status shows `partial` until fully paid. Each payment recorded in invoice_payments.

---

## 7. Dashboard UI

### Invoice List

```
Invoices

[New Invoice]  [Filter: All / Unpaid / Overdue / Paid]  [Search]

INV-2026-0441  Ranchero Trucking   $4,820  Due Jun 30   [OVERDUE]
INV-2026-0440  Halcyon & Reed     $12,400  Due Jul 15   [SENT]
INV-2026-0439  Marisa Webb           $348  Paid Jun 10  [PAID]
INV-2026-0438  Pacific Forge        $2,100  Due Jun 20  [VIEWED]
```

Status badges use module color system:

- DRAFT → neutral
- SENT → blue (Email color)
- VIEWED → teal (CMS color)
- PARTIAL → orange (Commerce color)
- PAID → green (success)
- OVERDUE → red (danger)
- VOID → muted

### Aging Report (B2B)

```
Accounts Receivable Aging

Current (not yet due)    $42,800   3 invoices
1–30 days overdue         $4,820   1 invoice    ← Ranchero Trucking
31–60 days overdue             $0
60+ days overdue               $0

Total outstanding        $47,620
```

---

## 8. API Endpoints

```
POST   /v1/invoices                    Create invoice
GET    /v1/invoices                    List invoices (with filters)
GET    /v1/invoices/:id                Get invoice + payments
PATCH  /v1/invoices/:id                Update draft invoice
POST   /v1/invoices/:id/send           Send to client
POST   /v1/invoices/:id/payments       Record manual payment
POST   /v1/invoices/:id/void           Void invoice
GET    /v1/invoices/:id/pdf            Download PDF
POST   /v1/invoices/from-order/:orderId    Create from order
POST   /v1/invoices/from-quote/:quoteId    Create from quote (B2B)

GET    /v1/invoices/aging              Aging report (B2B)

# Public (no auth, UUID as token)
GET    /public/invoices/:uuid          Hosted invoice page data
POST   /public/invoices/:uuid/pay      Create Stripe payment intent
```

---

## 9. MCP Tools

```
list_invoices({ status?, customer_id?, date_range? })
get_invoice({ invoice_id })
create_invoice({ customer_id, line_items, due_date, terms? })
send_invoice({ invoice_id })
get_aging_report()   // B2B only

Example:
"Which invoices are overdue?"
→ list_invoices({ status: 'overdue' })
→ "3 invoices are overdue totaling $8,420.
   Oldest: INV-2026-0441 from Ranchero Trucking,
   $4,820, 12 days overdue.
   Want me to send a reminder?"
```

---

## 10. Implementation Checklist

- [ ] DB schema — invoices + invoice_payments + invoice_sequences
- [ ] Invoice number sequence generator per tenant
- [ ] Create invoice UI (standalone + from order + from quote)
- [ ] PDF generation (Puppeteer or @sparx/pdf-renderer)
- [ ] GCS upload for generated PDFs
- [ ] Hosted invoice page (public route, no auth)
- [ ] Send invoice → Postal email with payment link
- [ ] View tracking (first open event)
- [ ] Stripe payment link generation
- [ ] Manual payment recording UI
- [ ] Partial payment support
- [ ] Reminder automation (Commerce: 3 days before + due date)
- [ ] Dunning automation (B2B: 7/14/30 days overdue)
- [ ] Invoice list with status filters
- [ ] Aging report (B2B)
- [ ] Quote → Invoice conversion (B2B)
- [ ] Order → Invoice conversion (Commerce)
- [ ] MCP tools
- [ ] Custom invoice number format (Settings → Invoicing)
- [ ] Custom reminder email copy (Settings → Invoicing)
      EOF
