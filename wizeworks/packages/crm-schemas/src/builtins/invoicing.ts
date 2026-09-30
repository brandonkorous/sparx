// Built-in invoicing templates (docs/87 §3, §5).
//
// Seeded into each tenant on `invoicing` module activation, then fully
// editable — same "own copy per tenant" pattern as the default pipeline. A
// tenant gets a simple two-stage Invoice workflow (default) plus an example
// Service / Repair flow showing the full estimate→paid lifecycle, and a
// starter line-type registry covering the common charge shapes.

import type { InvoiceTemplateNodeInput } from '../invoicing';

export type DocumentStageTypeLiteral = 'draft' | 'open' | 'committed' | 'final' | 'paid' | 'void';

export type LinePricingModeLiteral = 'catalog' | 'markup' | 'labor' | 'flat' | 'pass_through';

export interface DocumentStageTemplate {
  name: string;
  customerLabel: string;
  stageType: DocumentStageTypeLiteral;
  snapshotOnEnter: boolean;
  numberOnEnter: boolean;
  numberPrefix?: string;
  locksEditing: boolean;
  sortOrder: number;
  color?: string;
}

export interface DocumentWorkflowTemplate {
  name: string;
  slug: string;
  isDefault: boolean;
  sortOrder: number;
  stages: DocumentStageTemplate[];
}

export interface DocumentLineTypeTemplate {
  key: string;
  name: string;
  label: string;
  pricingMode: LinePricingModeLiteral;
  defaultTaxable: boolean;
  computation?: string;
  category?: string;
  sortOrder: number;
}

export const DEFAULT_DOCUMENT_WORKFLOWS: DocumentWorkflowTemplate[] = [
  {
    name: 'Invoice',
    slug: 'invoice',
    isDefault: true,
    sortOrder: 0,
    stages: [
      {
        name: 'Invoice',
        customerLabel: 'Invoice',
        stageType: 'open',
        snapshotOnEnter: false,
        numberOnEnter: true,
        numberPrefix: 'INV-',
        locksEditing: false,
        sortOrder: 0,
        color: '#6366F1',
      },
      {
        name: 'Paid',
        customerLabel: 'Receipt',
        stageType: 'paid',
        snapshotOnEnter: true,
        numberOnEnter: false,
        locksEditing: true,
        sortOrder: 1,
        color: '#10B981',
      },
      // THE WAY OUT. Without a void stage an invoice is permanent from the
      // moment it is raised: `canDelete` in the console is `stageType ===
      // 'draft'` and this workflow has no draft, so the More menu offers
      // nothing, and the order it came from refuses every later attempt with
      // "void it before raising another" — an instruction with nowhere to
      // carry it out. MEASURED 2026-09-20: 205 live workflows, 52 with a void
      // stage; the quote workflows in this same file have had Declined and
      // Expired since they were written. [[feedback_a_fix_leaves_its_neighbour_behind]]
      {
        name: 'Canceled',
        customerLabel: 'Canceled',
        stageType: 'void',
        snapshotOnEnter: false,
        numberOnEnter: false,
        locksEditing: true,
        sortOrder: 2,
        color: '#EF4444',
      },
    ],
  },
  {
    name: 'Service / Repair',
    slug: 'service-repair',
    isDefault: false,
    sortOrder: 1,
    stages: [
      {
        name: 'Estimate',
        customerLabel: 'Estimate',
        stageType: 'draft',
        snapshotOnEnter: false,
        numberOnEnter: true,
        numberPrefix: 'EST-',
        locksEditing: false,
        sortOrder: 0,
        color: '#94A3B8',
      },
      {
        name: 'Approved',
        customerLabel: 'Approved Estimate',
        stageType: 'committed',
        snapshotOnEnter: true,
        numberOnEnter: false,
        locksEditing: false,
        sortOrder: 1,
        color: '#06B6D4',
      },
      {
        name: 'In Progress',
        customerLabel: 'Work Order',
        stageType: 'open',
        snapshotOnEnter: false,
        numberOnEnter: false,
        locksEditing: false,
        sortOrder: 2,
        color: '#0EA5E9',
      },
      {
        name: 'Invoiced',
        customerLabel: 'Invoice',
        stageType: 'final',
        snapshotOnEnter: true,
        numberOnEnter: true,
        numberPrefix: 'INV-',
        locksEditing: true,
        sortOrder: 3,
        color: '#6366F1',
      },
      {
        name: 'Paid',
        customerLabel: 'Receipt',
        stageType: 'paid',
        snapshotOnEnter: false,
        numberOnEnter: false,
        locksEditing: true,
        sortOrder: 4,
        color: '#10B981',
      },
      {
        name: 'Canceled',
        customerLabel: 'Canceled',
        stageType: 'void',
        snapshotOnEnter: false,
        numberOnEnter: false,
        locksEditing: true,
        sortOrder: 5,
        color: '#EF4444',
      },
    ],
  },
];

// ── System "Net-terms AR" workflow (docs/87 §15) ─────────────────────────────
//
// The convergence target for order-derived B2B net-terms AR. When a B2B order is
// placed on net terms (checkout / approval), the AR header is materialised as a
// BillingDocument on THIS workflow rather than the legacy `b2b_invoices` table —
// so the one billing-document engine owns every receivable.
//
// It is NOT part of `DEFAULT_DOCUMENT_WORKFLOWS` (the user-facing Invoice /
// Service-Repair starters seeded on `invoicing` activation). This is a SYSTEM
// workflow, lazily ensured by the B2B flow itself (gated on the `b2b` module, not
// `invoicing`) — `billing_documents` is a shared AR substrate, the same way
// `customers` is shared across CRM / Commerce / B2B. Resolve it by its stable
// slug; never assume it pre-exists.
//
// The order-derived document is constructed already-finalised at the Invoice
// stage (the charge came from a placed order — its lines aren't hand-authored),
// so the Invoice stage is `final` + locked + numbered + snapshot-on-enter.
export const NET_TERMS_AR_WORKFLOW_SLUG = 'net-terms-ar';

export const NET_TERMS_AR_WORKFLOW: DocumentWorkflowTemplate = {
  name: 'Net-terms AR',
  slug: NET_TERMS_AR_WORKFLOW_SLUG,
  isDefault: false,
  sortOrder: 100,
  stages: [
    {
      name: 'Invoice',
      customerLabel: 'Invoice',
      stageType: 'final',
      snapshotOnEnter: true,
      numberOnEnter: true,
      numberPrefix: 'INV-',
      locksEditing: true,
      sortOrder: 0,
      color: '#6366F1',
    },
    {
      name: 'Paid',
      customerLabel: 'Receipt',
      stageType: 'paid',
      snapshotOnEnter: false,
      numberOnEnter: false,
      locksEditing: true,
      sortOrder: 1,
      color: '#10B981',
    },
    // An AR invoice raised in error needs the same way out as any other. This
    // is CANCELLING it, not writing it off: a write-off says the money is owed
    // and will not be collected, and keeps the receivable's history. The two
    // are different answers and the screen must be able to give either.
    {
      name: 'Canceled',
      customerLabel: 'Canceled',
      stageType: 'void',
      snapshotOnEnter: false,
      numberOnEnter: false,
      locksEditing: true,
      sortOrder: 2,
      color: '#EF4444',
    },
  ],
};

// ── System "B2B Quotes" workflow (Quote → BillingDocument consolidation) ─────
//
// Quotes are BillingDocuments — this SYSTEM workflow (gated on the `b2b`
// module, lazily ensured the same way NET_TERMS_AR_WORKFLOW is) replaces the
// retired standalone Quote model's lifecycle. `draft`-type stages cover every
// pre-decision state (a tenant sees them as Draft/Submitted/Under Review/
// Quoted); `committed` = the customer-approved moment (snapshotOnEnter freezes
// "the approved quote"); the two `void`-type stages are the terminal
// non-approval outcomes. There is deliberately no "Converted" stage —
// conversion to an Order is tracked by Order.convertedFromDocumentId,
// independent of stage, so an accepted+converted quote simply stays in
// Accepted.
export const B2B_QUOTE_WORKFLOW_SLUG = 'b2b-quotes';

export const B2B_QUOTE_WORKFLOW: DocumentWorkflowTemplate = {
  name: 'B2B Quotes',
  slug: B2B_QUOTE_WORKFLOW_SLUG,
  isDefault: false,
  sortOrder: 101,
  stages: [
    {
      name: 'Draft',
      customerLabel: 'Draft',
      stageType: 'draft',
      snapshotOnEnter: false,
      numberOnEnter: true,
      numberPrefix: 'Q-',
      locksEditing: false,
      sortOrder: 0,
      color: '#94A3B8',
    },
    {
      name: 'Submitted',
      customerLabel: 'Submitted',
      stageType: 'draft',
      snapshotOnEnter: false,
      numberOnEnter: false,
      locksEditing: false,
      sortOrder: 1,
      color: '#0EA5E9',
    },
    {
      name: 'Under Review',
      customerLabel: 'Under Review',
      stageType: 'draft',
      snapshotOnEnter: false,
      numberOnEnter: false,
      locksEditing: false,
      sortOrder: 2,
      color: '#0EA5E9',
    },
    {
      name: 'Quoted',
      customerLabel: 'Quoted',
      stageType: 'draft',
      snapshotOnEnter: false,
      numberOnEnter: false,
      locksEditing: false,
      sortOrder: 3,
      color: '#6366F1',
    },
    {
      name: 'Accepted',
      customerLabel: 'Accepted',
      stageType: 'committed',
      snapshotOnEnter: true,
      numberOnEnter: false,
      locksEditing: false,
      sortOrder: 4,
      color: '#10B981',
    },
    {
      name: 'Declined',
      customerLabel: 'Declined',
      stageType: 'void',
      snapshotOnEnter: false,
      numberOnEnter: false,
      locksEditing: true,
      sortOrder: 5,
      color: '#EF4444',
    },
    {
      name: 'Expired',
      customerLabel: 'Expired',
      stageType: 'void',
      snapshotOnEnter: false,
      numberOnEnter: false,
      locksEditing: true,
      sortOrder: 6,
      color: '#94A3B8',
    },
  ],
};

// ── System "Customer Estimates" workflow ─────────────────────────────────────
//
// The direct-customer (non-B2B) counterpart to B2B_QUOTE_WORKFLOW — a signed-in
// storefront customer requests an estimate for work/parts, the merchant prices
// it, the customer approves or declines. Gated on the `invoicing` module (not
// `b2b`), lazily ensured the same way — this is a shared system workflow, not a
// tenant-editable starter like `service-repair`, so a customer request always
// lands somewhere stable even if a tenant renamed/deleted their own copies.
export const CUSTOMER_ESTIMATE_WORKFLOW_SLUG = 'customer-estimates';

export const CUSTOMER_ESTIMATE_WORKFLOW: DocumentWorkflowTemplate = {
  name: 'Customer Estimates',
  slug: CUSTOMER_ESTIMATE_WORKFLOW_SLUG,
  isDefault: false,
  sortOrder: 102,
  stages: [
    {
      name: 'Requested',
      customerLabel: 'Requested',
      stageType: 'draft',
      snapshotOnEnter: false,
      numberOnEnter: true,
      numberPrefix: 'EST-',
      locksEditing: false,
      sortOrder: 0,
      color: '#94A3B8',
    },
    {
      name: 'Priced',
      customerLabel: 'Ready for review',
      stageType: 'draft',
      snapshotOnEnter: false,
      numberOnEnter: false,
      locksEditing: false,
      sortOrder: 1,
      color: '#6366F1',
    },
    {
      name: 'Approved',
      customerLabel: 'Approved',
      stageType: 'committed',
      snapshotOnEnter: true,
      numberOnEnter: false,
      locksEditing: false,
      sortOrder: 2,
      color: '#10B981',
    },
    {
      name: 'Declined',
      customerLabel: 'Declined',
      stageType: 'void',
      snapshotOnEnter: false,
      numberOnEnter: false,
      locksEditing: true,
      sortOrder: 3,
      color: '#EF4444',
    },
  ],
};

// The platform default line types — deliberately INDUSTRY-AGNOSTIC. What matters
// functionally is the `pricingMode` (how the line gets its price); the wording is
// generic on purpose so a salon, a consultancy, a publisher, and a repair shop
// all read their own work into it. A vertical that wants trade-specific labels
// ("Part", "Sublet", "Chair rental") renames or adds its own — line types are
// per-tenant and editable.
//
// The `key` slugs are the ORIGINAL stable ids and intentionally left unchanged:
// they're internal (the UI sends lineTypeId, never the key), a handful of callers
// look them up by slug, and `bootstrapDefaultLineTypes` is idempotent BY KEY — so
// renaming a key would spawn a duplicate type on any tenant that re-activates
// invoicing. Only the human-facing name/label is neutralised.
export const DEFAULT_DOCUMENT_LINE_TYPES: DocumentLineTypeTemplate[] = [
  {
    key: 'part',
    name: 'Product',
    label: 'Product',
    pricingMode: 'markup',
    defaultTaxable: true,
    category: 'product',
    sortOrder: 0,
  },
  {
    key: 'labor',
    name: 'Service',
    label: 'Service',
    pricingMode: 'labor',
    defaultTaxable: false,
    category: 'service',
    sortOrder: 1,
  },
  {
    key: 'catalog',
    name: 'Catalog item',
    label: 'Catalog item',
    pricingMode: 'catalog',
    defaultTaxable: true,
    category: 'product',
    sortOrder: 2,
  },
  {
    key: 'materials',
    name: 'Materials & supplies',
    label: 'Materials & supplies',
    pricingMode: 'flat',
    defaultTaxable: true,
    category: 'materials',
    sortOrder: 3,
  },
  {
    key: 'fee',
    name: 'Fee',
    label: 'Fee',
    pricingMode: 'flat',
    defaultTaxable: false,
    category: 'fee',
    sortOrder: 4,
  },
  {
    key: 'freight',
    name: 'Shipping',
    label: 'Shipping',
    pricingMode: 'pass_through',
    defaultTaxable: false,
    category: 'shipping',
    sortOrder: 5,
  },
  {
    key: 'sublet',
    name: 'Subcontracted work',
    label: 'Subcontracted work',
    pricingMode: 'pass_through',
    defaultTaxable: true,
    category: 'subcontract',
    sortOrder: 6,
  },
];

// ── Print template (docs/87 §10, Phase 5b) ────────────────────────────────────
//
// The document's printed presentation is ONE BuilderNode tree, AUTHOR-only — a
// peer of the page/email builder trees. The renderer (api-rest's renderInvoiceTree)
// drops the shared print section builders in wherever a DATA-AWARE invoice node
// sits, surrounded by authorable CHROME (heading / prose terms / image / divider /
// containers). These are the data-aware node types the renderer recognises; the
// rest are ordinary builder primitives.
export const INVOICE_STRUCTURED_NODE_TYPES = [
  'InvoiceMasthead', // logo + document head (number/status/dates) — the combined header
  'InvoiceLogo', // seller logo / business name block (split from the masthead)
  'InvoiceMeta', // document head only (number/status/dates)
  'InvoiceParties', // bill-to + ship-to blocks
  'InvoiceLineTable', // the line-items table
  'InvoiceTotals', // subtotal → balance-due summary
  'InvoiceNotes', // the document's own notes
  'InvoicePayments', // the payment ledger
  'InvoiceFooter', // business name + number footer line
] as const;

// The built-in default template — reproduces the code default renderer's layout as
// an editable tree, plus an authorable Prose "terms" block. Seeded (lazy) on the
// tenant's first template list; from then on it's an ordinary editable template.
// Node ids are stable + unique within this tree.
const DEFAULT_TEMPLATE_TREE: InvoiceTemplateNodeInput = {
  id: 'tpl-root',
  type: 'Section',
  name: 'Document',
  class: 'stack gap-lg',
  children: [
    { id: 'tpl-masthead', type: 'InvoiceMasthead', name: 'Header' },
    { id: 'tpl-parties', type: 'InvoiceParties', name: 'Bill to / Ship to' },
    { id: 'tpl-lines', type: 'InvoiceLineTable', name: 'Line items' },
    { id: 'tpl-totals', type: 'InvoiceTotals', name: 'Totals' },
    {
      id: 'tpl-terms',
      type: 'Prose',
      name: 'Terms',
      class: 'notes',
      props: {
        doc: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Payment is due upon receipt unless net terms apply. Thank you for your business.',
                },
              ],
            },
          ],
        },
      },
    },
    { id: 'tpl-notes', type: 'InvoiceNotes', name: 'Document notes' },
    { id: 'tpl-payments', type: 'InvoicePayments', name: 'Payments' },
    { id: 'tpl-footer', type: 'InvoiceFooter', name: 'Footer' },
  ],
};

export interface DocumentTemplateSeed {
  name: string;
  tree: InvoiceTemplateNodeInput;
}

/** The default print template seeded per tenant (docs/87 §10). */
export const DEFAULT_INVOICE_TEMPLATE: DocumentTemplateSeed = {
  name: 'Default',
  tree: DEFAULT_TEMPLATE_TREE,
};

// ── Price offers vs bills ────────────────────────────────────────────────────
//
// Every document the billing engine holds is a `BillingDocument`, and two of the
// system workflows above hold something that is NOT a bill: a quote and an
// estimate are OFFERS of a price. The difference is not cosmetic, and getting it
// wrong is what issue 764 was:
//
//   · a bill falls DUE (`dueAt`) and then counts days late; an offer simply RUNS
//     OUT (`validUntil`). Two columns, and the wrong one is silently ignored;
//   · a bill carries an AR status (unpaid / partial / paid / overdue), which on
//     an offer is meaningless — nobody owes anything on a price they have not
//     accepted. The printed page said "Unpaid" and "Balance due $504.00" under a
//     quote, which a wholesale customer on terms will file as a bill;
//   · a bill is called an invoice, and an offer is not.
//
// Keyed by SLUG because a tenant renames a workflow whenever they like, and the
// system workflows are seeded with a slug that does not move. A workflow a
// tenant invented is absent here and is treated as a bill, which is the honest
// default: we do not know what they made.
const PRICE_OFFER_NOUNS: Readonly<Record<string, string>> = {
  [B2B_QUOTE_WORKFLOW_SLUG]: 'quote',
  [CUSTOMER_ESTIMATE_WORKFLOW_SLUG]: 'estimate',
};

/** Does this workflow hold an offer of a price rather than a demand for money? */
export function isPriceOfferWorkflow(slug: string | null | undefined): boolean {
  return slug != null && slug in PRICE_OFFER_NOUNS;
}

/** What a document on this workflow is called in a sentence: "quote",
 *  "estimate", or "invoice" for everything else. */
export function billingDocumentNoun(slug: string | null | undefined): string {
  if (!slug) return 'invoice';
  return PRICE_OFFER_NOUNS[slug] ?? 'invoice';
}

// ── Is this money somebody owes? ─────────────────────────────────────────────
//
// Issue 764 above named four places that had to tell a bill from an offer: the
// print renderer, the unsaved-preview renderer, and each of the two consoles.
// There was a fifth, and nobody asked it — the query that ADDS UP what she is
// owed (issue 857).
//
// It selected on `status in (unpaid | partial | overdue)` alone, which is the
// payment state and says nothing about whether the document is a bill. So every
// quote and estimate was counted as a receivable, and the note four paragraphs
// up was already describing the consequence: "nobody owes anything on a price
// they have not accepted."
//
// MEASURED 2026-09-28 across the platform: $67,279.83 shown as outstanding, of
// which $9,345.64 over 16 documents was quotes. On Juniper Row it was $1,512.00
// of $3,911.70 — 39% of what her console said she was owed. One of the two was
// Q-000017, at $504.00: the same document, for the same amount, that 764 was
// filed about.
//
// THREE CLAUSES, EACH ONE A SENTENCE THE PLATFORM ALREADY PRINTS.
//
//   not a price offer   "nobody owes anything on a price they have not accepted"
//   not a draft stage   "Nothing is promised to the customer yet."
//   not a void stage    "it is not owed and not collectable."
//
// The last two come from `stage-presentation.ts` in the console, which is where
// a tenant is told what each stage type means when they choose one.
//
// A stage type this does NOT exclude is a receivable: `open` ("sent, still
// yours to change"), `final` ("This is what they owe") and `committed` on a BILL
// workflow all count. Failing open that way is deliberate — a workflow a tenant
// invented is treated as a bill, the same honest default `isPriceOfferWorkflow`
// takes, because we do not know what they made.

/** Stages where a document is not yet, or no longer, a demand for money. */
export const NOT_OWED_STAGE_TYPES: readonly DocumentStageTypeLiteral[] = ['draft', 'void'];

/** The system workflows that hold an offer rather than a bill, as a list — for a
 *  query that has to exclude them all rather than test one. */
export const PRICE_OFFER_WORKFLOW_SLUGS: readonly string[] = Object.keys(PRICE_OFFER_NOUNS);

/**
 * Is this document money somebody owes?
 *
 * The AR question, asked once. `status` alone cannot answer it: an unsent quote
 * carries `unpaid` and a balance exactly like an invoice does, because the
 * status machine is payment-derived and knows nothing about workflows.
 */
export function isOwedDocument(doc: {
  workflowSlug: string | null | undefined;
  /** The stage the document sits in, as the database spells it — a plain
   *  string, because a tenant can add stages and every caller reads this off a
   *  row rather than out of the template above. */
  stageType: string | null | undefined;
  status: string;
}): boolean {
  if (!['unpaid', 'partial', 'overdue'].includes(doc.status)) return false;
  if (isPriceOfferWorkflow(doc.workflowSlug)) return false;
  return !NOT_OWED_STAGE_TYPES.includes(doc.stageType as DocumentStageTypeLiteral);
}

/**
 * The workflows the PLATFORM resolves by slug, so the slug is not the tenant's
 * to change (issue 781).
 *
 * Three services look their workflow up by name rather than by id, because they
 * run with no document in hand and have to find the right one from nothing:
 * `b2b-ar-service` when a net-terms order settles later, `b2b-quote-service`
 * when a wholesale customer asks a price, `customer-estimate-service` when a
 * retail one does. `isPriceOfferWorkflow` above reads the same slugs to decide
 * whether a document is a demand for money or an offer of a price — which is
 * what stops a quote printing "Balance due".
 *
 * Every one of those reads was written on the premise, stated in this file, that
 * "the system workflows are seeded with a slug that does not move". The workflow
 * editor let anyone move it, in a field whose help text invites the change. A
 * rename made the lookup miss: the next quote minted a SECOND "B2B Quotes"
 * workflow, the renamed one kept every existing document, and the tenant's own
 * quotes started rendering as invoices. `documentWorkflowService.update` now
 * refuses it, so the premise is enforced where it is relied upon.
 *
 * Everything ELSE about these workflows stays the tenant's: the display name,
 * the stages, what the customer is shown at each one, and whether it is the
 * default.
 */
export const SYSTEM_WORKFLOW_SLUGS: readonly string[] = [
  NET_TERMS_AR_WORKFLOW_SLUG,
  B2B_QUOTE_WORKFLOW_SLUG,
  CUSTOMER_ESTIMATE_WORKFLOW_SLUG,
];

/** Is this a workflow the platform finds by name, rather than one the tenant
 *  invented? */
export function isSystemWorkflowSlug(slug: string | null | undefined): boolean {
  return slug != null && SYSTEM_WORKFLOW_SLUGS.includes(slug);
}
