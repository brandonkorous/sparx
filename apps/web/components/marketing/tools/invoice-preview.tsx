'use client';

import { computeTotals, formatMoney, type InvoiceData } from './lib/invoice';

/**
 * Live, on-paper preview that mirrors the generated PDF.
 *
 * NOTE ON COLOR: this is a DOCUMENT mockup, not site chrome. The sheet is white
 * and its ink is fixed because the PDF it mirrors is white with fixed ink — it
 * must NOT flip with the visitor's light/dark theme, or the preview stops
 * previewing. Those fidelity colors are therefore static Tailwind palette
 * utilities (`bg-white`, `text-zinc-900`, `text-zinc-500`), never theme tokens
 * and never inline hexes. Only the surrounding frame border/radius uses site
 * tokens. `data.accent` stays inline: it is user-chosen data.
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
    <div className="border-base-300 overflow-x-auto rounded-lg border bg-white p-7 font-[Arial,Helvetica,sans-serif] text-zinc-900">
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
          <div className="text-xs text-zinc-500"># {data.invoiceNumber || '0001'}</div>
        </div>
      </div>

      <div className="my-4 h-0.5" style={{ backgroundColor: data.accent }} />

      <div className="flex flex-wrap gap-8">
        <Block label="FROM" name={data.businessName} body={fromLines} />
        <Block label="BILL TO" name={data.clientName} body={data.clientAddress} />
      </div>

      <div className="mt-3.5 flex gap-6 text-xs text-zinc-500">
        <span>Issued: {data.issueDate || '—'}</span>
        <span>
          {dateLabel}: {data.dueDate || '—'}
        </span>
      </div>

      <table className="mt-5 w-full border-collapse text-[13px]">
        <thead>
          {/* Uppercase column headers are invoice-document mimicry, not eyebrows. */}
          <tr className="bg-zinc-100 text-[10px] tracking-[0.04em] text-zinc-500">
            <th className="px-2 py-[7px] text-left">DESCRIPTION</th>
            <th className="w-[52px] px-2 py-[7px] text-right">QTY</th>
            <th className="w-[90px] px-2 py-[7px] text-right">UNIT</th>
            <th className="w-24 px-2 py-[7px] text-right">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-200">
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
          <div className="mt-1.5 border-t border-zinc-300 pt-2">
            <Row label="Total" value={money(totals.total)} bold accent={data.accent} />
          </div>
        </div>
      </div>

      {data.notes.trim() ? (
        <div className="mt-5">
          <div className="text-[10px] font-bold tracking-[0.04em] text-zinc-500">NOTES</div>
          <p className="mt-1.5 text-xs whitespace-pre-wrap text-zinc-500">{data.notes}</p>
        </div>
      ) : null}
    </div>
  );
}

function Block({ label, name, body }: { label: string; name: string; body: string }) {
  return (
    <div className="min-w-[160px]">
      {/* Field label — invoice-document mimicry. */}
      <div className="text-[10px] font-bold tracking-[0.04em] text-zinc-500">{label}</div>
      {name ? <div className="mt-1 text-[13px] font-bold">{name}</div> : null}
      {body ? (
        <div className="mt-0.5 text-xs leading-normal whitespace-pre-wrap text-zinc-500">
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
      <span className={`${cell} ${bold ? 'text-zinc-900' : 'text-zinc-500'}`}>{label}</span>
      <span
        className={`${cell} ${accent ? '' : 'text-zinc-900'}`}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
