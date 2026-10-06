// A trade account's statement as a page to print, or to save as a PDF.
//
// Built from the same pieces as the printed invoice (billing-document-html.ts):
// the same masthead with the shop's logo, name and address, the same brand
// colors, the same money and date formatting. A statement that looked like it
// came from a different company than the invoices it lists would be the first
// thing an accounts clerk queried.
//
// Pure: no database, no framework. The caller hands in the statement and the
// shop's brand; the same function serves the shop's print and the buyer's.

import type { AccountStatement } from './b2b-statement-service';
import {
  escapeHtml as esc,
  formatDate,
  formatMoney,
  invoiceStyles,
  resolveBillingBrand,
  sellerBlockHtml,
  type BillingRenderBrand,
} from './billing-document-html';

export interface StatementHtmlOptions {
  /** Draw a "Print or save as PDF" button at the top of the screen copy. It
   *  never prints: the print stylesheet hides it. */
  printButton?: boolean;
}

function money(cents: number, currency: string): string {
  return formatMoney(cents / 100, currency);
}

/** A period as it is read aloud: "Oct 1, 2026 to Oct 31, 2026". */
export function statementPeriodText(period: { from: string; to: string }): string {
  return `${formatDate(`${period.from}T00:00:00.000Z`)} to ${formatDate(`${period.to}T00:00:00.000Z`)}`;
}

function lateText(daysLate: number, dueAt: string | null): string {
  if (dueAt === null) return 'Due on receipt';
  if (daysLate > 0) return daysLate === 1 ? '1 day late' : `${String(daysLate)} days late`;
  if (daysLate === 0) return 'Due that day';
  return 'Not yet due';
}

function statementStyles(brand: BillingRenderBrand): string {
  const b = resolveBillingBrand(brand);
  return `
  .doc-head .meta { color: #374151; font-size: 13px; }
  .doc-head .meta span { color: #4B5563; }
  .print-bar { max-width: 800px; margin: 0 auto 16px; display: flex; justify-content: flex-end; }
  .print-btn { font: inherit; font-weight: 600; font-size: 15px; padding: 10px 18px; border-radius: 8px;
    border: none; cursor: pointer; background: ${b.primary}; color: ${b.primaryForeground}; }
  .who { display: flex; gap: 48px; margin: 32px 0 24px; }
  .who > div { flex: 1; }
  .who-label { font-size: 13px; color: #4B5563; margin-bottom: 4px; }
  .who-name { font-weight: 600; font-size: 15px; }
  .who div div { font-size: 14px; }
  .figures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 8px 0 28px; }
  .figure { border: 1px solid ${b.border}; border-radius: 10px; padding: 12px 14px; }
  .figure span { display: block; font-size: 13px; color: #4B5563; }
  .figure strong { display: block; margin-top: 4px; font-size: 18px; font-variant-numeric: tabular-nums; }
  .figure.closing { border-color: ${b.accent}; }
  .figure.closing strong { color: ${b.accent}; }
  h2.section { font-size: 17px; font-weight: 700; margin: 28px 0 8px; }
  .scroll { overflow-x: auto; }
  table.statement { width: 100%; border-collapse: collapse; }
  table.statement th { text-align: left; font-size: 13px; font-weight: 600; color: #374151;
    padding: 8px 6px; border-bottom: 2px solid ${b.border}; vertical-align: bottom; }
  table.statement td { padding: 10px 6px; border-bottom: 1px solid ${b.border}; vertical-align: top; font-size: 14px; }
  table.statement th.num { text-align: right; white-space: normal; }
  table.statement td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  table.statement tr.carry td { font-weight: 600; background: ${b.muted}; }
  table.statement td.nw { white-space: nowrap; }
  table.statement td.po { font-weight: 600; white-space: nowrap; }
  table.statement td.late { color: #991B1B; font-weight: 600; }
  table.aging td { text-align: center; font-variant-numeric: tabular-nums; }
  table.aging th { text-align: center; }
  table.aging td.late { color: #991B1B; }
  .none { padding: 16px; text-align: center; color: #374151; border: 1px solid ${b.border}; border-radius: 10px; }
  @media (max-width: 640px) {
    .who { flex-direction: column; gap: 16px; }
    .figures { grid-template-columns: repeat(2, 1fr); }
    table.statement th, table.statement td { padding: 8px 4px; font-size: 13px; }
  }
  @media print {
    .print-bar { display: none; }
    .scroll { overflow: visible; }
    .figures { grid-template-columns: repeat(4, 1fr); }
  }`;
}

function whoBlock(statement: AccountStatement): string {
  const { account } = statement;
  const address = account.billingAddress.map((line) => `<div>${esc(line)}</div>`).join('');
  const terms = account.paymentTermsWords
    ? `<div>${esc(account.paymentTermsWords)}</div>`
    : '<div>No payment terms agreed</div>';
  const limit =
    account.creditLimitCents > 0
      ? `<div>Credit limit ${money(account.creditLimitCents, statement.currency)}</div>`
      : '';
  return `<div class="who">
    <div>
      <div class="who-label">Statement for</div>
      <div class="who-name">${esc(account.companyName)}</div>
      ${address}
    </div>
    <div>
      <div class="who-label">Your terms</div>
      ${terms}
      ${limit}
    </div>
  </div>`;
}

function figuresBlock(statement: AccountStatement): string {
  const c = statement.currency;
  const fig = (label: string, cents: number, cls = '') =>
    `<div class="figure ${cls}"><span>${label}</span><strong>${money(cents, c)}</strong></div>`;
  return `<div class="figures">
    ${fig('Owed at the start', statement.openingCents)}
    ${fig('New charges', statement.chargesCents)}
    ${fig('Payments and credits', statement.creditsCents)}
    ${fig('Owed at the end', statement.closingCents, 'closing')}
  </div>`;
}

function activityBlock(statement: AccountStatement): string {
  const c = statement.currency;
  const start = `<tr class="carry">
      <td class="nw">${esc(formatDate(`${statement.period.from}T00:00:00.000Z`))}</td>
      <td colspan="4">Owed at the start of the period</td>
      <td class="num"></td><td class="num"></td>
      <td class="num">${money(statement.openingCents, c)}</td>
    </tr>`;
  const rows = statement.rows
    .map(
      (r) => `<tr>
      <td class="nw">${esc(formatDate(r.at))}</td>
      <td>${esc(r.description)}</td>
      <td class="nw">${esc(r.documentNumber ?? '')}</td>
      <td class="po">${esc(r.poNumber ?? '')}</td>
      <td class="nw">${esc(r.dueAt ? formatDate(r.dueAt) : '')}</td>
      <td class="num">${r.chargeCents > 0 ? money(r.chargeCents, c) : ''}</td>
      <td class="num">${r.creditCents > 0 ? money(r.creditCents, c) : ''}</td>
      <td class="num">${money(r.balanceCents, c)}</td>
    </tr>`
    )
    .join('');
  const end = `<tr class="carry">
      <td class="nw">${esc(formatDate(`${statement.period.to}T00:00:00.000Z`))}</td>
      <td colspan="4">Owed at the end of the period</td>
      <td class="num">${money(statement.chargesCents, c)}</td>
      <td class="num">${money(statement.creditsCents, c)}</td>
      <td class="num">${money(statement.closingCents, c)}</td>
    </tr>`;
  const quiet =
    statement.rows.length === 0
      ? `<tr><td colspan="8">Nothing was billed or paid on this account in this period.</td></tr>`
      : '';
  return `<h2 class="section">What happened in this period</h2>
  <div class="scroll"><table class="statement">
    <thead><tr>
      <th>Date</th><th>What happened</th><th>Invoice</th><th>Your PO number</th><th>Due</th>
      <th class="num">Charges</th><th class="num">Payments and credits</th><th class="num">Balance</th>
    </tr></thead>
    <tbody>${start}${rows}${quiet}${end}</tbody>
  </table></div>`;
}

function openBlock(statement: AccountStatement): string {
  const c = statement.currency;
  if (statement.openItems.length === 0) {
    return `<h2 class="section">Still open</h2>
    <div class="none">Nothing was owed at the end of this period.</div>`;
  }
  const rows = statement.openItems
    .map(
      (item) => `<tr>
      <td class="nw">${esc(item.number ?? '')}</td>
      <td class="po">${esc(item.poNumber ?? '')}</td>
      <td class="nw">${esc(formatDate(item.issuedAt))}</td>
      <td class="nw">${esc(item.dueAt ? formatDate(item.dueAt) : '')}</td>
      <td class="num">${money(item.totalCents, c)}</td>
      <td class="num">${money(item.openCents, c)}</td>
      <td class="${item.daysLate > 0 ? 'late' : ''}">${esc(lateText(item.daysLate, item.dueAt))}</td>
    </tr>`
    )
    .join('');
  return `<h2 class="section">Still open</h2>
  <div class="scroll"><table class="statement">
    <thead><tr>
      <th>Invoice</th><th>Your PO number</th><th>Issued</th><th>Due</th>
      <th class="num">Amount</th><th class="num">Still owed</th><th>When</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function agingBlock(statement: AccountStatement): string {
  const c = statement.currency;
  const head = statement.aging.map((b) => `<th>${esc(b.label)}</th>`).join('');
  const cells = statement.aging
    .map(
      (b) =>
        `<td class="${b.key !== 'current' && b.cents > 0 ? 'late' : ''}">${money(b.cents, c)}</td>`
    )
    .join('');
  return `<h2 class="section">How late, at the end of the period</h2>
  <table class="statement aging">
    <thead><tr>${head}</tr></thead>
    <tbody><tr>${cells}</tr></tbody>
  </table>`;
}

/** Render a statement to a complete, branded, print-ready HTML page. */
export function renderAccountStatementHtml(
  statement: AccountStatement,
  brand: BillingRenderBrand = {},
  options: StatementHtmlOptions = {}
): string {
  const b = resolveBillingBrand(brand);
  const periodText = statementPeriodText(statement.period);
  const title = `Statement for ${statement.account.companyName}, ${periodText}`;
  const printBar = options.printButton
    ? `<div class="print-bar"><button type="button" class="print-btn" onclick="window.print()">Print or save as PDF</button></div>`
    : '';
  const body = `
    <header class="masthead">
      <div class="masthead-seller">${sellerBlockHtml(brand)}</div>
      <div class="doc-head">
        <div class="doc-title">Statement</div>
        <div class="meta">
          <div><span>Period</span>${esc(periodText)}</div>
          <div><span>Amount due now</span><strong>${money(statement.dueNowCents, statement.currency)}</strong></div>
        </div>
      </div>
    </header>
    ${whoBlock(statement)}
    ${figuresBlock(statement)}
    ${activityBlock(statement)}
    ${openBlock(statement)}
    ${agingBlock(statement)}
    <div class="footer">${esc(b.businessName)} &middot; ${esc(title)}</div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>${invoiceStyles(brand)}${statementStyles(brand)}</style>
</head>
<body>
  ${printBar}
  <div class="sheet">${body}</div>
</body>
</html>`;
}
