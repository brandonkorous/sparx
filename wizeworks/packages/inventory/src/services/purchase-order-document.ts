// Purchase-order print document (docs/100 P3b). Mirrors the billing-document
// print pattern (docs/87 §10) — a self-contained, branded, print-styled HTML
// sheet (browser → PDF); concrete color/font values only, so the artifact opens
// anywhere. @wizeworks/inventory can't import @wizeworks/crm's renderer (the dependency
// rule points consumers AT inventory, never the reverse), so this is a focused
// peer renderer in the same visual language.
//
// `renderPurchaseOrderHtml` is PURE (no DB/React). `buildPurchaseOrderDocumentHtml`
// loads the PO + parties inside the tenant tx and feeds the renderer; the API
// layer passes the resolved seller brand.

import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

// ─── Render data ───────────────────────────────────────────────────────────────

export interface PurchaseOrderDocumentBrand {
  businessName?: string;
  addressLines?: string[];
  logoUrl?: string;
  primary?: string;
  foreground?: string;
  muted?: string;
  border?: string;
  fontHeading?: string;
  fontBody?: string;
}

export interface PurchaseOrderDocumentParty {
  heading: string;
  name: string;
  lines: string[];
}

export interface PurchaseOrderDocumentLine {
  description: string;
  sku: string | null;
  supplierSku: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unitCostCents: number;
  lineTotalCents: number;
}

export interface PurchaseOrderDocumentData {
  number: string;
  status: string;
  currency: string;
  orderedAt: string | null;
  expectedArrivalAt: string | null;
  reference: string | null;
  paymentTerms: string | null;
  vendor: PurchaseOrderDocumentParty;
  shipTo: PurchaseOrderDocumentParty;
  lines: PurchaseOrderDocumentLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  notes: string | null;
}

const DEFAULT_BRAND = {
  businessName: 'Purchase Order',
  primary: '#F59E0B',
  foreground: '#111827',
  muted: '#F3F4F6',
  border: '#E5E7EB',
  fontHeading: "'Geist', system-ui, -apple-system, Segoe UI, sans-serif",
  fontBody: "'Geist', system-ui, -apple-system, Segoe UI, sans-serif",
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  partial: 'Partially received',
  received: 'Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

// ─── Formatting / escaping ───────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const esc = escapeHtml;

function money(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Renderer (pure) ─────────────────────────────────────────────────────────

export function renderPurchaseOrderHtml(
  data: PurchaseOrderDocumentData,
  brand: PurchaseOrderDocumentBrand = {}
): string {
  const b = { ...DEFAULT_BRAND, ...brand };
  const meta: string[] = [`<div><span>PO number</span><strong>${esc(data.number)}</strong></div>`];
  if (data.orderedAt)
    meta.push(`<div><span>Ordered</span>${esc(formatDate(data.orderedAt))}</div>`);
  if (data.expectedArrivalAt) {
    meta.push(`<div><span>Expected</span>${esc(formatDate(data.expectedArrivalAt))}</div>`);
  }
  if (data.reference) meta.push(`<div><span>Reference</span>${esc(data.reference)}</div>`);
  if (data.paymentTerms) meta.push(`<div><span>Terms</span>${esc(data.paymentTerms)}</div>`);

  const statusLabel = STATUS_LABEL[data.status] ?? data.status;
  const statusClass =
    data.status === 'received' || data.status === 'closed'
      ? 'ok'
      : data.status === 'cancelled'
        ? 'alert'
        : 'neutral';

  const body = `
    <header class="masthead">
      <div class="seller">
        ${
          b.logoUrl
            ? `<img class="logo" src="${esc(b.logoUrl)}" alt="${esc(b.businessName)}" />`
            : `<div class="logo-wordmark">${esc(b.businessName)}</div>`
        }
        ${(b.addressLines ?? [])
          .filter((l) => l.trim().length > 0)
          .map((l) => `<div>${esc(l)}</div>`)
          .join('')}
      </div>
      <div class="doc-head">
        <div class="doc-title">Purchase Order</div>
        <div class="status ${statusClass}">${esc(statusLabel)}</div>
        <div class="meta">${meta.join('')}</div>
      </div>
    </header>
    <div class="parties">
      ${partyBlock(data.vendor)}
      ${partyBlock(data.shipTo)}
    </div>
    ${lineTable(data)}
    ${totals(data)}
    ${data.notes ? `<section class="notes"><h2>Notes</h2><p>${esc(data.notes)}</p></section>` : ''}
    <div class="footer">${esc(b.businessName)} &middot; ${esc(data.number)}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(data.number)}</title>
<style>${styles(b)}</style>
</head>
<body><div class="sheet">${body}</div></body>
</html>`;
}

function partyBlock(party: PurchaseOrderDocumentParty): string {
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

function lineTable(data: PurchaseOrderDocumentData): string {
  const rows =
    data.lines.length === 0
      ? `<tr><td class="empty" colspan="5">No lines.</td></tr>`
      : data.lines
          .map((l) => {
            const sku = [l.sku, l.supplierSku ? `vendor #${l.supplierSku}` : null]
              .filter(Boolean)
              .join(' · ');
            const received =
              l.quantityReceived > 0
                ? `<span class="line-note">${l.quantityReceived} received</span>`
                : '';
            return `<tr>
              <td>
                <div class="line-desc">${esc(l.description)}</div>
                ${sku ? `<span class="line-sku">${esc(sku)}</span>` : ''}${received}
              </td>
              <td class="num">${l.quantityOrdered}</td>
              <td class="num">${money(l.unitCostCents, data.currency)}</td>
              <td class="num">${money(l.lineTotalCents, data.currency)}</td>
            </tr>`;
          })
          .join('');
  return `<table class="lines">
    <thead><tr>
      <th>Item</th><th class="num">Qty</th><th class="num">Unit cost</th><th class="num">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function totals(data: PurchaseOrderDocumentData): string {
  const row = (label: string, value: number, cls = '') =>
    `<tr class="${cls}"><td>${label}</td><td class="num">${money(value, data.currency)}</td></tr>`;
  const out = [row('Subtotal', data.subtotalCents)];
  if (data.shippingCents > 0) out.push(row('Shipping', data.shippingCents));
  out.push(row('Total', data.totalCents, 'grand'));
  return `<div class="summary"><table class="totals">${out.join('')}</table></div>`;
}

function styles(b: typeof DEFAULT_BRAND & PurchaseOrderDocumentBrand): string {
  return `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; font-family: ${b.fontBody}; font-size: 14px;
    line-height: 1.5; color: ${b.foreground}; background: ${b.muted}; }
  .sheet { max-width: 800px; margin: 0 auto; padding: 48px; background: #fff;
    border: 1px solid ${b.border}; border-radius: 12px; }
  h2 { font-family: ${b.fontHeading}; margin: 0; }
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .seller { flex: 1; }
  .logo { max-height: 56px; max-width: 240px; }
  .logo-wordmark { font-family: ${b.fontHeading}; font-size: 24px; font-weight: 700; }
  .seller div { font-size: 12px; color: #6B7280; margin-top: 2px; }
  .doc-head { text-align: right; }
  .doc-title { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; color: ${b.primary}; }
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
  .party-heading { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
    color: #9CA3AF; margin-bottom: 4px; }
  .party-name { font-weight: 600; }
  .party div { font-size: 13px; }
  table.lines { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.lines thead th { text-align: left; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.06em; color: #9CA3AF; padding: 8px 12px; border-bottom: 2px solid ${b.border}; }
  table.lines tbody td { padding: 12px; border-bottom: 1px solid ${b.border}; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .line-desc { font-weight: 500; }
  .line-sku { display: inline-block; margin-top: 4px; margin-right: 8px; font-size: 11px; color: #6B7280; }
  .line-note { font-size: 11px; color: #9CA3AF; }
  td.empty { text-align: center; color: #9CA3AF; padding: 24px; }
  .summary { display: flex; justify-content: flex-end; margin-top: 24px; }
  table.totals { min-width: 280px; border-collapse: collapse; }
  table.totals td { padding: 6px 12px; }
  table.totals tr.grand td { border-top: 2px solid ${b.primary}; font-weight: 700; font-size: 16px; }
  .notes { margin-top: 32px; padding-top: 16px; border-top: 1px solid ${b.border}; }
  .notes h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #9CA3AF;
    margin-bottom: 8px; }
  .notes p { margin: 0; white-space: pre-wrap; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9CA3AF; }
  @page { margin: 0.5in; }
  @media print {
    body { padding: 0; background: #fff; }
    .sheet { max-width: none; margin: 0; padding: 0; border: none; border-radius: 0; }
  }`;
}

// ─── Loader (tenant-scoped) ──────────────────────────────────────────────────

export async function buildPurchaseOrderDocumentHtml(
  ctx: ServiceContext,
  id: string,
  brand: PurchaseOrderDocumentBrand = {}
): Promise<string> {
  const data = await withTenant(ctx, (tx) => loadDocumentData(tx, id));
  return renderPurchaseOrderHtml(data, brand);
}

async function loadDocumentData(tx: TxClient, id: string): Promise<PurchaseOrderDocumentData> {
  const po = await tx.purchaseOrder.findFirst({
    where: { id },
    include: {
      supplier: true,
      warehouse: true,
      lines: {
        orderBy: { createdAt: 'asc' },
        include: { variant: { select: { sku: true, product: { select: { title: true } } } } },
      },
    },
  });
  if (!po) throw new InventoryNotFoundError('PurchaseOrder', id);

  const s = po.supplier;
  const w = po.warehouse;
  return {
    number: po.number,
    status: po.status,
    currency: po.currency,
    orderedAt: po.orderedAt?.toISOString() ?? null,
    expectedArrivalAt: po.expectedArrivalAt?.toISOString() ?? null,
    reference: po.reference,
    paymentTerms: po.paymentTerms,
    vendor: {
      heading: 'Vendor',
      name: s.name,
      lines: [
        s.contactName ?? '',
        s.line1 ?? '',
        s.line2 ?? '',
        [s.city, s.region, s.postalCode].filter(Boolean).join(', '),
        s.country ?? '',
        s.phone ?? '',
        s.email ?? '',
      ],
    },
    shipTo: {
      heading: 'Ship to',
      name: w.name,
      lines: [
        w.line1 ?? '',
        w.line2 ?? '',
        [w.city, w.region, w.postalCode].filter(Boolean).join(', '),
        w.country ?? '',
        w.phone ?? '',
      ],
    },
    lines: po.lines.map((l) => ({
      description: l.description ?? l.variant?.product?.title ?? l.variant?.sku ?? 'Item',
      sku: l.variant?.sku ?? null,
      supplierSku: l.supplierSku,
      quantityOrdered: l.quantityOrdered,
      quantityReceived: l.quantityReceived,
      unitCostCents: l.unitCostCents,
      lineTotalCents: l.quantityOrdered * l.unitCostCents,
    })),
    subtotalCents: po.subtotalCents,
    shippingCents: po.shippingCents,
    totalCents: po.totalCents,
    notes: po.notes,
  };
}
