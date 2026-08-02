'use client';

import { computeTotals, formatMoney, type InvoiceData } from './lib/invoice';

/**
 * Live, on-paper preview that mirrors the generated PDF.
 *
 * NOTE ON COLOR: this is a DOCUMENT mockup, not site chrome. The sheet must NOT
 * flip with the visitor's light/dark theme, or the preview stops previewing —
 * the PDF it mirrors is always ink-on-paper.
 *
 * That is a THEME-PINNING problem, not a reason to leave the token system. The
 * root carries `data-theme="light"`, which pins this subtree to the sparx light
 * palette in `@sparx/brand/theme.css`; `bg-base-100` / `text-base-content` /
 * `border-base-300` then resolve to paper and ink and STAY there whatever the
 * page around them is doing. It used to spell the same intent with Tailwind's
 * own palette (`bg-white`, `text-base-content`, `text-base-content`) — a third color
 * vocabulary alongside silica's, which is what this pass removed.
 *
 * Label/value hierarchy rides weight and size, which the markup already has —
 * not a faded ink. `data.accent` stays inline: it is user-chosen data.
 */
export function InvoicePreview({
  data,
  title = 'INVOICE',
  dateLabel = 'Due',
}: {
  data: InvoiceData;
  title?: string;
  dateLabel?: string;
}) {
  const totals = computeTotals(data);
  const money = (n: number) => formatMoney(n, data.currency);
  const fromLines = [data.businessAddress, data.businessEmail].filter(Boolean).join('\n');

  return (
    <div
      data-theme="light"
      className="border-base-300 text-base-content bg-base-100 overflow-x-auto rounded-lg border p-7 font-[Arial,Helvetica,sans-serif]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {data.logo ? (
            <img src={data.logo} alt="" className="h-10 max-w-[180px] object-contain" />
          ) : (
            <strong className="text-[17px]">{data.businessName || 'Your Business'}</strong>
          )}
        </div>
        <div className="text-right">
          <div className="text-[22px] font-bold tracking-[0.02em]" style={{ color: data.accent }}>
            {title}
          </div>
          <div className="text-base-content text-xs"># {data.invoiceNumber || '0001'}</div>
        </div>
      </div>

      <div className="my-4 h-0.5" style={{ backgroundColor: data.accent }} />

      <div className="flex flex-wrap gap-8">
        <Block label="FROM" name={data.businessName} body={fromLines} />
        <Block label="BILL TO" name={data.clientName} body={data.clientAddress} />
      </div>

      <div className="text-base-content mt-3.5 flex gap-6 text-xs">
        <span>Issued: {data.issueDate || '—'}</span>
        <span>
          {dateLabel}: {data.dueDate || '—'}
        </span>
      </div>

      <table className="mt-5 w-full border-collapse text-[13px]">
        <thead>
          {/* Uppercase column headers are invoice-document mimicry, not eyebrows. */}
          <tr className="bg-base-200 text-base-content text-[10px] tracking-[0.04em]">
            <th className="px-2 py-[7px] text-left">DESCRIPTION</th>
            <th className="w-[52px] px-2 py-[7px] text-right">QTY</th>
            <th className="w-[90px] px-2 py-[7px] text-right">UNIT</th>
            <th className="w-24 px-2 py-[7px] text-right">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id} className="border-base-300 border-b">
              <td className="p-2 align-top">{item.description || '—'}</td>
              <td className="p-2 text-right">{item.quantity}</td>
              <td className="p-2 text-right">{money(Number(item.unitPrice) || 0)}</td>
              <td className="p-2 text-right">
                {money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-[220px] text-[13px]">
          <Row label="Subtotal" value={money(totals.subtotal)} />
          {totals.discount > 0 ? (
            <Row label="Discount" value={`-${money(totals.discount)}`} />
          ) : null}
          {totals.taxAmount > 0 ? (
            <Row label={`Tax (${data.taxRate}%)`} value={money(totals.taxAmount)} />
          ) : null}
          {/* The totals rule is document structure, not decoration. */}
          <div className="border-base-300 mt-1.5 border-t pt-2">
            <Row label="Total" value={money(totals.total)} bold accent={data.accent} />
          </div>
        </div>
      </div>

      {data.notes.trim() ? (
        <div className="mt-5">
          <div className="text-base-content text-[10px] font-bold tracking-[0.04em]">NOTES</div>
          <p className="text-base-content mt-1.5 text-xs whitespace-pre-wrap">{data.notes}</p>
        </div>
      ) : null}
    </div>
  );
}

function Block({ label, name, body }: { label: string; name: string; body: string }) {
  return (
    <div className="min-w-[160px]">
      {/* Field label — invoice-document mimicry. */}
      <div className="text-base-content text-[10px] font-bold tracking-[0.04em]">{label}</div>
      {name ? <div className="mt-1 text-[13px] font-bold">{name}</div> : null}
      {body ? (
        <div className="text-base-content mt-0.5 text-xs leading-normal whitespace-pre-wrap">
          {body}
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: string;
}) {
  const cell = bold ? 'text-[15px] font-bold' : 'text-[13px] font-normal';
  return (
    <div className="flex justify-between py-[3px]">
      <span className={`${cell} ${bold ? 'text-base-content' : 'text-base-content'}`}>{label}</span>
      <span
        className={`${cell} ${accent ? '' : 'text-base-content'}`}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
