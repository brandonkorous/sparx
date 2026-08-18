// Packing slip (docs/146 Phase 4.5) — the piece of paper that goes IN the box.
//
// Same build path as `purchase-order-document.ts`: a pure renderer plus a
// tenant-scoped loader, producing a self-contained print-styled HTML sheet with
// concrete color and font values so the artifact opens anywhere, including on a
// bench PC that has never heard of our stylesheet. The house rules about tokens
// and silicaui govern SCREENS; this is a print artefact and a browser printing it
// resolves no CSS variables of ours.
//
// ── Why it is not the invoice ────────────────────────────────────────────────
//
// A packing slip carries NO PRICES. Deliberately, and it is the single most
// common thing to get wrong: the box may be a gift, it may be a dropship going
// direct to someone else's customer, and it may be one of four boxes on an order
// whose total means nothing on its own. What the recipient needs is what is in
// THIS box, what is still coming, and who it is from.
//
// ── "Also in this order" earns its space ─────────────────────────────────────
//
// A partial shipment with no mention of the rest generates a support ticket every
// single time. Listing what is still to come costs four lines of paper and
// answers the question before it is asked.

import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

// ─── Render data ───────────────────────────────────────────────────────────────

export interface PackingSlipBrand {
  businessName?: string;
  addressLines?: string[];
  logoUrl?: string;
  primary?: string;
  foreground?: string;
  muted?: string;
  border?: string;
  fontHeading?: string;
  fontBody?: string;
  /** Printed at the foot — returns policy, a thank-you, a support address. */
  footerNote?: string;
}

export interface PackingSlipLine {
  description: string;
  sku: string | null;
  quantity: number;
  /** True when every unit in the box was confirmed by a scan. */
  verified: boolean;
}

export interface PackingSlipData {
  packageNumber: string;
  orderNumber: string;
  orderedAt: string | null;
  packedAt: string | null;
  /** "Box 2 of 3" — omitted when there is only one. */
  boxIndex: number;
  boxCount: number;
  shipTo: { name: string; lines: string[] };
  customerNote: string | null;
  lines: PackingSlipLine[];
  /** Ordered but in another box, or not yet packed at all. */
  toFollow: { description: string; sku: string | null; quantity: number }[];
  weightGrams: number | null;
}

const DEFAULT_BRAND = {
  businessName: 'Packing slip',
  primary: '#0F766E',
  foreground: '#111827',
  muted: '#F3F4F6',
  border: '#E5E7EB',
  fontHeading: "'Geist', system-ui, -apple-system, Segoe UI, sans-serif",
  fontBody: "'Geist', system-ui, -apple-system, Segoe UI, sans-serif",
};

// ─── Formatting ────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const esc = escapeHtml;

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** The first candidate that actually says something. */
function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function formatWeight(grams: number | null): string {
  if (grams === null || grams <= 0) return '';
  if (grams < 1000) return `${grams} g`;
  return `${(grams / 1000).toFixed(2)} kg`;
}

// ─── Renderer (pure) ───────────────────────────────────────────────────────────

export function renderPackingSlipHtml(data: PackingSlipData, brand: PackingSlipBrand = {}): string {
  const b = { ...DEFAULT_BRAND, ...brand };

  const meta: string[] = [
    `<div><span>Order</span><strong>${esc(data.orderNumber)}</strong></div>`,
    `<div><span>Box</span>${esc(data.packageNumber)}</div>`,
  ];
  if (data.boxCount > 1) {
    meta.push(`<div><span>Of</span>Box ${data.boxIndex} of ${data.boxCount}</div>`);
  }
  if (data.orderedAt)
    meta.push(`<div><span>Ordered</span>${esc(formatDate(data.orderedAt))}</div>`);
  if (data.packedAt) meta.push(`<div><span>Packed</span>${esc(formatDate(data.packedAt))}</div>`);
  const weight = formatWeight(data.weightGrams);
  if (weight) meta.push(`<div><span>Weight</span>${esc(weight)}</div>`);

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
        <div class="doc-title">Packing slip</div>
        <div class="meta">${meta.join('')}</div>
      </div>
    </header>
    <div class="parties">
      <div class="party">
        <div class="party-heading">Deliver to</div>
        ${data.shipTo.name ? `<div class="party-name">${esc(data.shipTo.name)}</div>` : ''}
        ${data.shipTo.lines
          .filter((l) => l.trim().length > 0)
          .map((l) => `<div>${esc(l)}</div>`)
          .join('')}
      </div>
    </div>
    ${lineTable(data)}
    ${toFollowTable(data)}
    ${
      data.customerNote
        ? `<section class="notes"><h2>Note</h2><p>${esc(data.customerNote)}</p></section>`
        : ''
    }
    ${b.footerNote ? `<section class="notes"><p>${esc(b.footerNote)}</p></section>` : ''}
    <div class="footer">${esc(b.businessName)} &middot; ${esc(data.orderNumber)}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(data.packageNumber)}</title>
<style>${styles(b)}</style>
</head>
<body><div class="sheet">${body}</div></body>
</html>`;
}

function lineTable(data: PackingSlipData): string {
  const rows =
    data.lines.length === 0
      ? `<tr><td class="empty" colspan="3">Nothing in this box.</td></tr>`
      : data.lines
          .map(
            (l) => `<tr>
              <td class="num">${l.quantity}</td>
              <td>
                <div class="line-desc">${esc(l.description)}</div>
                ${l.sku ? `<span class="line-sku">${esc(l.sku)}</span>` : ''}
              </td>
              <td class="check">${l.verified ? '&#10003;' : ''}</td>
            </tr>`
          )
          .join('');
  return `<table class="lines">
    <thead><tr>
      <th class="num">Qty</th><th>Item</th><th class="check" title="Scanned at the bench">&#10003;</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** What is not in this box. Four lines of paper that prevent a support ticket. */
function toFollowTable(data: PackingSlipData): string {
  if (data.toFollow.length === 0) return '';
  const rows = data.toFollow
    .map(
      (l) => `<tr>
        <td class="num">${l.quantity}</td>
        <td>
          <div class="line-desc">${esc(l.description)}</div>
          ${l.sku ? `<span class="line-sku">${esc(l.sku)}</span>` : ''}
        </td>
      </tr>`
    )
    .join('');
  return `<section class="follow">
    <h2>Also in this order — sent separately</h2>
    <table class="lines"><tbody>${rows}</tbody></table>
  </section>`;
}

function styles(b: typeof DEFAULT_BRAND & PackingSlipBrand): string {
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
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; width: 64px; }
  .check { text-align: center; width: 40px; color: ${b.primary}; font-weight: 700; }
  .line-desc { font-weight: 500; }
  .line-sku { display: inline-block; margin-top: 4px; font-size: 11px; color: #6B7280; }
  td.empty { text-align: center; color: #9CA3AF; padding: 24px; }
  .follow { margin-top: 32px; }
  .follow h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #9CA3AF;
    margin-bottom: 8px; }
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

// ─── Loader (tenant-scoped) ────────────────────────────────────────────────────

export async function buildPackingSlipHtml(
  ctx: ServiceContext,
  packageId: string,
  brand: PackingSlipBrand = {}
): Promise<string> {
  const data = await withTenant(ctx, (tx) => loadPackingSlipData(tx, ctx.tenantId, packageId));
  return renderPackingSlipHtml(data, brand);
}

interface AddressSnapshot {
  name?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

async function loadPackingSlipData(
  tx: TxClient,
  tenantId: string,
  packageId: string
): Promise<PackingSlipData> {
  const box = await tx.shipmentPackage.findFirst({
    where: { id: packageId, tenantId },
    select: {
      id: true,
      number: true,
      orderId: true,
      packedAt: true,
      weightGrams: true,
      createdAt: true,
    },
  });
  if (!box) throw new InventoryNotFoundError('ShipmentPackage', packageId);

  const order = await tx.order.findFirst({
    where: { id: box.orderId },
    select: {
      orderNumber: true,
      placedAt: true,
      shippingAddress: true,
      customerNote: true,
      // `companyName` is the SCALAR on Customer; `company` is the relation to the
      // Company row and selecting it would hand a whole object to a string field.
      customer: { select: { firstName: true, lastName: true, companyName: true } },
    },
  });
  if (!order) throw new InventoryNotFoundError('Order', box.orderId);

  const siblings = await tx.shipmentPackage.findMany({
    where: { orderId: box.orderId, tenantId, status: { not: 'cancelled' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const boxIndex = Math.max(1, siblings.findIndex((s) => s.id === packageId) + 1);

  const rows = await tx.$queryRaw<
    {
      description: string;
      sku: string | null;
      inThisBox: number;
      scanned: number;
      ordered: number;
      packedElsewhere: number;
    }[]
  >`
    SELECT oi.name                           AS "description",
           NULLIF(oi.sku, '')                AS "sku",
           COALESCE(mine.quantity, 0)        AS "inThisBox",
           COALESCE(mine.scanned_quantity, 0) AS "scanned",
           oi.quantity                       AS "ordered",
           COALESCE(other.units, 0)::int     AS "packedElsewhere"
      FROM order_items oi
      LEFT JOIN inventory_shipment_package_lines mine
             ON mine.order_item_id = oi.id AND mine.package_id = ${packageId}::uuid
      LEFT JOIN LATERAL (
        SELECT SUM(x.quantity) AS units
          FROM inventory_shipment_package_lines x
          JOIN inventory_shipment_packages xp ON xp.id = x.package_id
         WHERE x.order_item_id = oi.id
           AND xp.status <> 'cancelled'
           AND xp.id <> ${packageId}::uuid
      ) other ON TRUE
     WHERE oi.tenant_id = ${tenantId}::uuid
       AND oi.order_id  = ${box.orderId}::uuid
     ORDER BY oi.created_at ASC
  `;

  const address = (order.shippingAddress ?? null) as AddressSnapshot | null;
  // The snapshot on the order wins over the customer record: the address block on
  // a box has to say who the box was addressed to at the time, not who the
  // customer has since become. `??` is not enough — the snapshot's name fields are
  // routinely PRESENT and empty — so each candidate is tested for content.
  const recipient =
    firstNonEmpty(
      address?.name,
      [address?.firstName, address?.lastName].filter(Boolean).join(' '),
      [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' '),
      order.customer?.companyName
    ) ?? '';

  return {
    packageNumber: box.number,
    orderNumber: order.orderNumber,
    orderedAt: order.placedAt?.toISOString() ?? null,
    packedAt: box.packedAt?.toISOString() ?? null,
    boxIndex,
    boxCount: Math.max(1, siblings.length),
    shipTo: {
      name: recipient,
      lines: [
        address?.company ?? '',
        address?.line1 ?? '',
        address?.line2 ?? '',
        [address?.city, address?.region, address?.postalCode].filter(Boolean).join(', '),
        address?.country ?? '',
        address?.phone ?? '',
      ],
    },
    customerNote: order.customerNote,
    lines: rows
      .filter((r) => r.inThisBox > 0)
      .map((r) => ({
        description: r.description,
        sku: r.sku,
        quantity: r.inThisBox,
        verified: r.scanned >= r.inThisBox,
      })),
    toFollow: rows
      .map((r) => ({
        description: r.description,
        sku: r.sku,
        quantity: r.ordered - r.packedElsewhere - r.inThisBox,
      }))
      .filter((r) => r.quantity > 0),
    weightGrams: box.weightGrams,
  };
}
