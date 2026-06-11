// Billing-document print rendering (docs/87 §10, Phase 5).
//
// Two renderers share the building blocks in this file:
//   · renderBillingDocumentHtml — the out-of-the-box DEFAULT (a fixed composition),
//     so a tenant never *must* design a template.
//   · the builder-authored template renderer (renderInvoiceTree, in api-rest) — a
//     PEER renderer in the builder framework (like the page + email renderers): it
//     walks an authored BuilderNode tree and drops these same section builders in
//     wherever the author places a data-aware invoice node, surrounded by authorable
//     chrome. Same blocks → the default and a customised template stay visually one.
//
// Everything here is PURE (no DB, no React, no framework) and consumes the SAME
// frozen-payload shape a snapshot stores, so a LIVE document and a FROZEN snapshot
// render through one path — the §10 "prints identically forever" guarantee for the
// financial substance. v1 emits print-HTML (`@media print`, browser → PDF); server
// PDF bytes are the documented fast-follow.

/** Brand tokens the render reads. All optional — unset tokens fall back to the
 *  Sparx defaults, so a tenant with no brand identity still prints cleanly.
 *  Concrete color/font values only (never CSS custom properties): the artifact is
 *  self-contained and prints/opens anywhere. */
export interface BillingRenderBrand {
  primary?: string;
  primaryForeground?: string;
  accent?: string;
  background?: string;
  foreground?: string;
  muted?: string;
  border?: string;
  fontHeading?: string;
  fontBody?: string;
  /** Absolute logo URL; when present the masthead renders the image. */
  logoUrl?: string;
  /** Seller business name — masthead fallback + footer. */
  businessName?: string;
  /** Seller address / contact lines, rendered under the masthead name. */
  addressLines?: string[];
}

type ResolvedBrand = Required<Omit<BillingRenderBrand, 'logoUrl' | 'addressLines'>> &
  Pick<BillingRenderBrand, 'logoUrl' | 'addressLines'>;

const DEFAULT_BRAND: Required<Omit<BillingRenderBrand, 'logoUrl' | 'addressLines'>> = {
  primary: '#6366F1',
  primaryForeground: '#FFFFFF',
  accent: '#6366F1',
  background: '#FFFFFF',
  foreground: '#111827',
  muted: '#F3F4F6',
  border: '#E5E7EB',
  fontHeading: "'Geist', system-ui, -apple-system, Segoe UI, sans-serif",
  fontBody: "'Geist', system-ui, -apple-system, Segoe UI, sans-serif",
  businessName: 'Sparx',
};

/** Merge a partial brand over the Sparx defaults. */
export function resolveBillingBrand(brand: BillingRenderBrand = {}): ResolvedBrand {
  return { ...DEFAULT_BRAND, ...brand };
}

/** A party block (bill-to / ship-to): a heading, a name, and free address /
 *  contact lines — already resolved to display strings by the caller. */
export interface BillingRenderParty {
  heading: string;
  name: string;
  lines: string[];
}

export interface BillingRenderLine {
  /** Line-type label ("Part", "Labor", "Sublet") or null for an untyped line. */
  typeLabel: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxable: boolean;
}

export interface BillingRenderTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  /** Tax rate as a fraction (0.0875 = 8.75%) — shown next to the tax row. */
  taxRate: number;
  shippingTotal: number;
  surchargeTotal: number;
  total: number;
  depositTotal: number;
  amountPaid: number;
  balance: number;
}

export interface BillingRenderPaymentRow {
  label: string;
  method: string;
  amount: number;
  receivedAt: string | null;
}

/** Everything the renderer needs, brand aside — assembled by billingRenderService
 *  from a live document or a frozen snapshot. Dates are ISO strings (or null). */
export interface BillingRenderData {
  /** The customer-facing noun for this document at its stage ("Invoice",
   *  "Estimate", "Work Order", "Ticket") — the §3 `customerLabel`. */
  title: string;
  number: string | null;
  /** AR status (unpaid | partial | paid | overdue | void) — drives the banner. */
  status: string;
  currency: string;
  issuedAt: string | null;
  dueAt: string | null;
  validUntil: string | null;
  billTo: BillingRenderParty | null;
  shipTo: BillingRenderParty | null;
  lines: BillingRenderLine[];
  totals: BillingRenderTotals;
  notes: string | null;
  payments?: BillingRenderPaymentRow[];
}

// ── Formatting / escaping ────────────────────────────────────────────────────

/** HTML-escape every interpolated value — descriptions, party names and notes are
 *  author/customer text and must never break out of their cell. Exported so the
 *  tree renderer escapes chrome text through the same path. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const esc = escapeHtml;

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    // Unknown/invalid currency code — fall back to a plain 2-dp figure + code.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Quantities carry fractional labor hours (2.5 h) — show up to 3 decimals,
 *  trimming trailing zeros so whole counts read as "2", not "2.000". */
function qty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function pct(rate: number): string {
  return `${Number((rate * 100).toFixed(4))}%`;
}

const STATUS_LABEL: Record<string, string> = {
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid in full',
  overdue: 'Overdue',
  void: 'Void',
};

// ── Section builders (shared by both renderers) ───────────────────────────────

/** The seller masthead: logo image (or business-name wordmark) + address lines. */
export function sellerBlockHtml(brand: BillingRenderBrand): string {
  const b = resolveBillingBrand(brand);
  const mark = b.logoUrl
    ? `<img class="logo" src="${esc(b.logoUrl)}" alt="${esc(b.businessName)}" />`
    : `<div class="logo-wordmark">${esc(b.businessName)}</div>`;
  const sellerLines = (b.addressLines ?? [])
    .filter((l) => l.trim().length > 0)
    .map((l) => `<div>${esc(l)}</div>`)
    .join('');
  return `${mark}${sellerLines ? `<div class="seller">${sellerLines}</div>` : ''}`;
}

/** The document head: title, AR status pill, and the number/dates meta. */
export function docHeadBlockHtml(data: BillingRenderData): string {
  const meta: string[] = [];
  if (data.number) meta.push(`<div><span>Number</span><strong>${esc(data.number)}</strong></div>`);
  if (data.issuedAt) meta.push(`<div><span>Issued</span>${esc(formatDate(data.issuedAt))}</div>`);
  if (data.dueAt) meta.push(`<div><span>Due</span>${esc(formatDate(data.dueAt))}</div>`);
  if (data.validUntil) {
    meta.push(`<div><span>Valid until</span>${esc(formatDate(data.validUntil))}</div>`);
  }
  const statusLabel = STATUS_LABEL[data.status] ?? data.status;
  const statusClass =
    data.status === 'paid' ? 'ok' : data.status === 'overdue' ? 'alert' : 'neutral';
  return `<div class="doc-head">
    <div class="doc-title">${esc(data.title)}</div>
    <div class="status ${statusClass}">${esc(statusLabel)}</div>
    <div class="meta">${meta.join('')}</div>
  </div>`;
}

function partyBlock(party: BillingRenderParty | null): string {
  if (!party) return '';
  const lines = party.lines
    .filter((l) => l.trim().length > 0)
    .map((l) => `<div>${esc(l)}</div>`)
    .join('');
  return `<div class="party">
    <div class="party-heading">${esc(party.heading)}</div>
    ${party.name ? `<div class="party-name">${esc(party.name)}</div>` : ''}
    ${lines}
  </div>`;
}

/** Both party blocks (bill-to + ship-to), in the `.parties` row. */
export function partiesBlockHtml(data: BillingRenderData): string {
  return `<div class="parties">${partyBlock(data.billTo)}${partyBlock(data.shipTo)}</div>`;
}

/** The line-items table. */
export function lineTableHtml(data: BillingRenderData): string {
  const { currency } = data;
  const rows =
    data.lines.length === 0
      ? `<tr><td class="empty" colspan="4">No line items.</td></tr>`
      : data.lines
          .map((l) => {
            const type = l.typeLabel ? `<span class="line-type">${esc(l.typeLabel)}</span>` : '';
            const taxFlag = l.taxable ? '' : '<span class="line-note">non-taxable</span>';
            return `<tr>
              <td>
                <div class="line-desc">${esc(l.description)}</div>
                ${type}${taxFlag}
              </td>
              <td class="num">${qty(l.quantity)}</td>
              <td class="num">${formatMoney(l.unitPrice, currency)}</td>
              <td class="num">${formatMoney(l.lineTotal, currency)}</td>
            </tr>`;
          })
          .join('');
  return `<table class="lines">
    <thead>
      <tr>
        <th>Description</th>
        <th class="num">Qty</th>
        <th class="num">Unit price</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** The totals summary block — zero rows are omitted; the balance-due row anchors. */
export function totalsBlockHtml(data: BillingRenderData): string {
  const t = data.totals;
  const { currency } = data;
  const row = (label: string, value: number, cls = '') =>
    `<tr class="${cls}"><td>${label}</td><td class="num">${formatMoney(value, currency)}</td></tr>`;

  const out: string[] = [row('Subtotal', t.subtotal)];
  if (t.discountTotal > 0) out.push(row('Discount', -t.discountTotal));
  if (t.taxTotal > 0 || t.taxRate > 0) {
    out.push(row(`Tax${t.taxRate > 0 ? ` (${pct(t.taxRate)})` : ''}`, t.taxTotal));
  }
  if (t.shippingTotal > 0) out.push(row('Shipping', t.shippingTotal));
  if (t.surchargeTotal > 0) out.push(row('Surcharge', t.surchargeTotal));
  out.push(row('Total', t.total, 'grand'));
  if (t.depositTotal > 0) out.push(row('Deposit', -t.depositTotal));
  if (t.amountPaid > 0) out.push(row('Amount paid', -t.amountPaid));
  out.push(row('Balance due', t.balance, 'balance'));
  return `<div class="summary"><table class="totals">${out.join('')}</table></div>`;
}

/** The notes / terms block — empty when there are no notes. */
export function notesBlockHtml(data: BillingRenderData): string {
  if (!data.notes) return '';
  return `<section class="notes"><h2>Notes</h2><p>${esc(data.notes)}</p></section>`;
}

/** The payment ledger block — empty when there are no payments. */
export function paymentsBlockHtml(data: BillingRenderData): string {
  const rows = data.payments;
  if (!rows || rows.length === 0) return '';
  const body = rows
    .map(
      (p) =>
        `<tr><td>${esc(p.label)}</td><td>${esc(p.method)}</td>` +
        `<td>${esc(formatDate(p.receivedAt))}</td><td class="num">${formatMoney(p.amount, data.currency)}</td></tr>`
    )
    .join('');
  return `<section class="payments">
    <h2>Payments</h2>
    <table class="payments-table">
      <thead><tr><th>Type</th><th>Method</th><th>Date</th><th class="num">Amount</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </section>`;
}

// ── Document shell (CSS + frame) ──────────────────────────────────────────────

/** The print stylesheet, parameterised by the resolved brand. Shared by both
 *  renderers so a default print and a builder-authored template share one look. */
export function invoiceStyles(brand: BillingRenderBrand): string {
  const b = resolveBillingBrand(brand);
  return `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px;
    font-family: ${b.fontBody};
    font-size: 14px; line-height: 1.5;
    color: ${b.foreground}; background: ${b.muted};
  }
  .sheet {
    max-width: 800px; margin: 0 auto; padding: 48px;
    background: ${b.background}; border: 1px solid ${b.border}; border-radius: 12px;
  }
  h1, h2 { font-family: ${b.fontHeading}; margin: 0; }
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .masthead-seller { flex: 1; }
  .logo { max-height: 56px; max-width: 240px; }
  .logo-wordmark { font-family: ${b.fontHeading}; font-size: 24px; font-weight: 700; color: ${b.foreground}; }
  .seller { margin-top: 8px; font-size: 12px; color: #6B7280; }
  .doc-head { text-align: right; }
  .doc-title { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; color: ${b.accent}; }
  .status { display: inline-block; margin-top: 8px; padding: 4px 12px; border-radius: 999px;
    font-size: 12px; font-weight: 600; }
  .status.ok { background: #DCFCE7; color: #166534; }
  .status.alert { background: #FEE2E2; color: #991B1B; }
  .status.neutral { background: ${b.muted}; color: #374151; }
  .meta { margin-top: 16px; font-size: 12px; color: #6B7280; }
  .meta div { display: flex; gap: 8px; justify-content: flex-end; margin-top: 2px; }
  .meta span { color: #9CA3AF; }
  .parties { display: flex; gap: 48px; margin: 32px 0; }
  .party { flex: 1; }
  .party-heading { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #9CA3AF; margin-bottom: 4px; }
  .party-name { font-weight: 600; }
  .party div { font-size: 13px; }
  table.lines { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.lines thead th { text-align: left; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.06em; color: #9CA3AF; padding: 8px 12px; border-bottom: 2px solid ${b.border}; }
  table.lines tbody td { padding: 12px; border-bottom: 1px solid ${b.border}; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .line-desc { font-weight: 500; }
  .line-type { display: inline-block; margin-top: 4px; margin-right: 8px; padding: 1px 8px;
    font-size: 11px; border-radius: 999px; background: ${b.muted}; color: #4B5563; }
  .line-note { font-size: 11px; color: #9CA3AF; }
  td.empty { text-align: center; color: #9CA3AF; padding: 24px; }
  .summary { display: flex; justify-content: flex-end; margin-top: 24px; }
  table.totals { min-width: 280px; border-collapse: collapse; }
  table.totals td { padding: 6px 12px; }
  table.totals td.num { font-variant-numeric: tabular-nums; }
  table.totals tr.grand td { border-top: 1px solid ${b.border}; font-weight: 600; font-size: 15px; }
  table.totals tr.balance td { border-top: 2px solid ${b.accent}; font-weight: 700; font-size: 17px; color: ${b.accent}; }
  .notes { margin-top: 32px; padding-top: 16px; border-top: 1px solid ${b.border}; }
  .notes h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #9CA3AF; margin-bottom: 8px; }
  .notes p { margin: 0; white-space: pre-wrap; }
  .payments { margin-top: 32px; }
  .payments h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #9CA3AF; margin-bottom: 8px; }
  table.payments-table { width: 100%; border-collapse: collapse; }
  table.payments-table th { text-align: left; font-size: 11px; text-transform: uppercase;
    color: #9CA3AF; padding: 6px 12px; border-bottom: 1px solid ${b.border}; }
  table.payments-table td { padding: 6px 12px; border-bottom: 1px solid ${b.border}; font-size: 13px; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9CA3AF; }
  /* Builder-template containers: a plain container flows its children (each
     section carries its own margins); an explicit row lays them side by side. */
  .ibx-row { display: flex; flex-direction: row; gap: 24px; justify-content: space-between;
    align-items: flex-start; }
  .ibx-row > * { flex: 1; }
  /* Builder-template prose (authored terms/footer) inherits the sheet body. */
  .invoice-prose :where(h1, h2, h3) { font-family: ${b.fontHeading}; }
  .invoice-prose p { margin: 0 0 8px; }
  @page { margin: 0.5in; }
  @media print {
    body { padding: 0; background: ${b.background}; }
    .sheet { max-width: none; margin: 0; padding: 0; border: none; border-radius: 0; }
  }`;
}

/** Wrap a rendered body in the full print document shell (DOCTYPE + head + sheet).
 *  Used by both the default renderer and the builder-template renderer. */
export function invoiceHtmlShell(input: {
  title: string;
  brand: BillingRenderBrand;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(input.title)}</title>
<style>${invoiceStyles(input.brand)}</style>
</head>
<body>
  <div class="sheet">${input.body}</div>
</body>
</html>`;
}

// ── Default renderer ─────────────────────────────────────────────────────────

/** Render a billing document (live or frozen) to a complete, branded, print-ready
 *  HTML document using the built-in default layout. */
export function renderBillingDocumentHtml(
  data: BillingRenderData,
  brand: BillingRenderBrand = {}
): string {
  const b = resolveBillingBrand(brand);
  const docTitle = data.number ? `${data.title} ${data.number}` : data.title;
  const body = `
    <header class="masthead">
      <div class="masthead-seller">${sellerBlockHtml(brand)}</div>
      ${docHeadBlockHtml(data)}
    </header>
    ${partiesBlockHtml(data)}
    ${lineTableHtml(data)}
    ${totalsBlockHtml(data)}
    ${notesBlockHtml(data)}
    ${paymentsBlockHtml(data)}
    <div class="footer">${esc(b.businessName)}${data.number ? ` &middot; ${esc(data.number)}` : ''}</div>`;
  return invoiceHtmlShell({ title: docTitle, brand, body });
}
