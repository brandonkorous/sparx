'use client';

import { computeTotals, formatMoney, type InvoiceData } from './lib/invoice';

const ink = '#18181b';
const muted = '#71717a';

/** Live, on-paper preview that mirrors the generated PDF. */
export function InvoicePreview({ data }: { data: InvoiceData }) {
  const totals = computeTotals(data);
  const money = (n: number) => formatMoney(n, data.currency);
  const fromLines = [data.businessAddress, data.businessEmail].filter(Boolean).join('\n');

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: ink,
        overflowX: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
        }}
      >
        <div>
          {data.logo ? (
            <img
              src={data.logo}
              alt=""
              style={{ height: '40px', maxWidth: '180px', objectFit: 'contain' }}
            />
          ) : (
            <strong style={{ fontSize: '17px' }}>{data.businessName || 'Your Business'}</strong>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: data.accent,
              letterSpacing: '0.02em',
            }}
          >
            INVOICE
          </div>
          <div style={{ fontSize: '12px', color: muted }}># {data.invoiceNumber || '0001'}</div>
        </div>
      </div>

      <div style={{ height: '2px', backgroundColor: data.accent, margin: '16px 0' }} />

      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
        <Block label="FROM" name={data.businessName} body={fromLines} />
        <Block label="BILL TO" name={data.clientName} body={data.clientAddress} />
      </div>

      <div
        style={{ display: 'flex', gap: '24px', marginTop: '14px', fontSize: '12px', color: muted }}
      >
        <span>Issued: {data.issueDate || '—'}</span>
        <span>Due: {data.dueDate || '—'}</span>
      </div>

      <table
        style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', fontSize: '13px' }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: '#f4f4f5',
              color: muted,
              fontSize: '10px',
              letterSpacing: '0.04em',
            }}
          >
            <th style={{ textAlign: 'left', padding: '7px 8px' }}>DESCRIPTION</th>
            <th style={{ textAlign: 'right', padding: '7px 8px', width: '52px' }}>QTY</th>
            <th style={{ textAlign: 'right', padding: '7px 8px', width: '90px' }}>UNIT</th>
            <th style={{ textAlign: 'right', padding: '7px 8px', width: '96px' }}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #ededf0' }}>
              <td style={{ padding: '8px', verticalAlign: 'top' }}>{item.description || '—'}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>
                {money(Number(item.unitPrice) || 0)}
              </td>
              <td style={{ padding: '8px', textAlign: 'right' }}>
                {money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        <div style={{ width: '220px', fontSize: '13px' }}>
          <Row label="Subtotal" value={money(totals.subtotal)} />
          {totals.discount > 0 ? (
            <Row label="Discount" value={`-${money(totals.discount)}`} />
          ) : null}
          {totals.taxAmount > 0 ? (
            <Row label={`Tax (${data.taxRate}%)`} value={money(totals.taxAmount)} />
          ) : null}
          <div style={{ borderTop: '1px solid #d4d4d8', marginTop: '6px', paddingTop: '8px' }}>
            <Row label="Total" value={money(totals.total)} bold accent={data.accent} />
          </div>
        </div>
      </div>

      {data.notes.trim() ? (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: muted, letterSpacing: '0.04em' }}>
            NOTES
          </div>
          <p style={{ fontSize: '12px', color: muted, marginTop: '6px', whiteSpace: 'pre-wrap' }}>
            {data.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Block({ label, name, body }: { label: string; name: string; body: string }) {
  return (
    <div style={{ minWidth: '160px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: muted, letterSpacing: '0.04em' }}>
        {label}
      </div>
      {name ? (
        <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '4px' }}>{name}</div>
      ) : null}
      {body ? (
        <div
          style={{
            fontSize: '12px',
            color: muted,
            marginTop: '2px',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
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
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span
        style={{
          color: bold ? ink : muted,
          fontWeight: bold ? 700 : 400,
          fontSize: bold ? '15px' : '13px',
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: accent ?? ink,
          fontWeight: bold ? 700 : 400,
          fontSize: bold ? '15px' : '13px',
        }}
      >
        {value}
      </span>
    </div>
  );
}
