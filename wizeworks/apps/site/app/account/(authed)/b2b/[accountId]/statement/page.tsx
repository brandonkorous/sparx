'use client';

// Wholesale account statement: what the account owed at the start of a period,
// every invoice and payment in it, and what it owes at the end, with the
// buyer's own purchase-order number on every line.
//
// The shop's B2B page promises the PO number a buyer types at checkout "rides
// onto the invoice and every statement, so AP can reconcile without a phone
// call." This is that statement. The emailed copy links here with the period in
// the address (`?from=…&to=…`), so the link opens the same statement the email
// summarised.
//
// Money arrives in CENTS. Dates are calendar days and are read in UTC, or a
// buyer west of UTC would see every date a day early.

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import { useCustomer } from '@/components/customer-provider';
import {
  b2bStatementPrintUrl,
  getB2bStatement,
  type B2bStatement,
  type B2bStatementOpenItem,
  type B2bStatementPeriod,
} from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { Alert, Badge, Button, Input, NativeSelect, Table } from '@wizeworks/silicaui-react';

type Preset = 'this_month' | 'last_month' | 'last_90' | 'this_year' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'this_month', label: 'This month so far' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_90', label: 'The last 90 days' },
  { value: 'this_year', label: 'This year so far' },
  { value: 'custom', label: 'Pick the dates' },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number): string => String(n).padStart(2, '0');
const dayText = (y: number, m: number, d: number): string => `${String(y)}-${pad(m + 1)}-${pad(d)}`;

/** The period a preset stands for, from the buyer's own today. "So far"
 *  periods leave the end blank, so the shop decides what today is: a buyer a
 *  time zone ahead of the shop must not ask for a day the shop has not reached. */
function presetPeriod(
  preset: Exclude<Preset, 'custom'>,
  now: Date = new Date()
): B2bStatementPeriod {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'this_month':
      return {};
    case 'last_month': {
      const last = new Date(y, m, 0);
      return {
        from: dayText(last.getFullYear(), last.getMonth(), 1),
        to: dayText(last.getFullYear(), last.getMonth(), last.getDate()),
      };
    }
    case 'last_90': {
      const start = new Date(y, m, now.getDate() - 89);
      return { from: dayText(start.getFullYear(), start.getMonth(), start.getDate()) };
    }
    case 'this_year':
      return { from: dayText(y, 0, 1) };
  }
}

function formatDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const at = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function lateWords(item: B2bStatementOpenItem): {
  label: string;
  tone: 'danger' | 'warning' | 'info';
} {
  if (item.dueAt === null) return { label: 'Due on receipt', tone: 'warning' };
  if (item.daysLate > 0) {
    return {
      label: item.daysLate === 1 ? '1 day late' : `${item.daysLate} days late`,
      tone: 'danger',
    };
  }
  if (item.daysLate === 0) return { label: 'Due that day', tone: 'warning' };
  return { label: 'Not yet due', tone: 'info' };
}

export default function B2bStatementPage() {
  return (
    <Suspense fallback={<div className="skeleton h-75" />}>
      <StatementView />
    </Suspense>
  );
}

function StatementView() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const search = useSearchParams();

  // A link from the statement email carries its period; open on exactly that.
  const linkedFrom = search.get('from') ?? '';
  const linkedTo = search.get('to') ?? '';
  const linked = DAY.test(linkedFrom) && DAY.test(linkedTo);

  const [preset, setPreset] = useState<Preset>(linked ? 'custom' : 'this_month');
  const [from, setFrom] = useState(linked ? linkedFrom : '');
  const [to, setTo] = useState(linked ? linkedTo : '');
  const [applied, setApplied] = useState<B2bStatementPeriod>(
    linked ? { from: linkedFrom, to: linkedTo } : {}
  );
  const [statement, setStatement] = useState<B2bStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getB2bStatement(tenantSlug, accountId, applied)
      .then((s) => {
        if (!active) return;
        setStatement(s);
        setFrom(s.period.from);
        setTo(s.period.to);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(
          e instanceof Error && e.message
            ? e.message
            : 'Your statement could not be loaded just now.'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId, applied]);

  const customProblem = useMemo(() => {
    if (preset !== 'custom') return null;
    if (!DAY.test(from) || !DAY.test(to)) return 'Fill in both days, then show the statement.';
    if (from > to) return 'The first day has to be on or before the last day.';
    return null;
  }, [preset, from, to]);

  const printHref = statement
    ? b2bStatementPrintUrl(tenantSlug, accountId, statement.period)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href={`/account/b2b/${accountId}`} className="link link-primary">
          ← Back to account
        </Link>
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">Statement</h1>
      </div>

      <div className="card border-base-300 flex flex-col gap-4 border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-base-content text-sm font-medium">Period</span>
            <NativeSelect
              value={preset}
              onChange={(e) => {
                const next = e.currentTarget.value as Preset;
                setPreset(next);
                if (next !== 'custom') setApplied(presetPeriod(next));
              }}
            >
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          {preset === 'custom' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-base-content text-sm font-medium">From</span>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-base-content text-sm font-medium">To</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <Button
                type="button"
                color="primary"
                disabled={customProblem !== null}
                onClick={() => setApplied({ from, to })}
              >
                Show this period
              </Button>
            </>
          )}
          {printHref && (
            <Button
              render={
                <Link href={printHref} prefetch={false} target="_blank" rel="noopener noreferrer" />
              }
              color="primary"
              variant="outline"
              className="ml-auto"
            >
              Print or save as PDF
            </Button>
          )}
        </div>
        {customProblem && <p className="text-base-content text-sm">{customProblem}</p>}
      </div>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : !statement ? (
        <div className="skeleton h-75" />
      ) : (
        <StatementBody statement={statement} loading={loading} accountId={accountId} />
      )}
    </div>
  );
}

function StatementBody({
  statement,
  loading,
  accountId,
}: {
  statement: B2bStatement;
  loading: boolean;
  accountId: string;
}) {
  const c = statement.currency;
  const money = (cents: number) => formatMoney(cents, c);
  return (
    <div className="flex flex-col gap-6" aria-busy={loading}>
      {loading && (
        <p className="text-base-content text-sm" role="status">
          Updating the statement…
        </p>
      )}
      <div className="flex flex-col gap-1">
        <h2 className="text-base-content text-xl font-semibold">{statement.account.companyName}</h2>
        <p className="text-base-content">
          {formatDay(statement.period.from)} to {formatDay(statement.period.to)}
          {statement.account.paymentTermsWords ? ` · ${statement.account.paymentTermsWords}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        <Figure label="Owed at the start" value={money(statement.openingCents)} />
        <Figure label="New charges" value={money(statement.chargesCents)} />
        <Figure label="Payments and credits" value={money(statement.creditsCents)} />
        <Figure label="Owed at the end" value={money(statement.closingCents)} emphasis />
      </div>

      {statement.pastDueCents > 0 ? (
        <Alert color="danger">
          <span>
            <strong>{money(statement.pastDueCents)} is past its due date.</strong>{' '}
            {statement.dueNowCents > statement.pastDueCents
              ? `${money(statement.dueNowCents)} is due now in total. `
              : ''}
            <Link href={`/account/b2b/${accountId}/invoices`} className="link">
              See your invoices
            </Link>
          </span>
        </Alert>
      ) : statement.dueNowCents > 0 ? (
        <Alert color="warning">
          <span>
            <strong>{money(statement.dueNowCents)} is due now.</strong>{' '}
            <Link href={`/account/b2b/${accountId}/invoices`} className="link">
              See your invoices
            </Link>
          </span>
        </Alert>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base-content text-xl font-semibold">What happened in this period</h2>
        <div className="overflow-x-auto max-sm:hidden">
          {/* Five columns, so the balance stays in view: what happened sits
              under its date, charges and payments share one column (a payment
              is shown taken off), and the due dates are on the open invoices
              below. The printed statement keeps a column for each. */}
          <Table size="sm">
            <thead>
              <tr>
                <th>Date and what happened</th>
                <th>Invoice</th>
                <th>Your PO number</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-medium">
                <td>
                  <span className="block whitespace-nowrap">
                    {formatDay(statement.period.from)}
                  </span>
                  <span className="block">Owed at the start</span>
                </td>
                <td />
                <td />
                <td />
                <td className="text-right whitespace-nowrap tabular-nums">
                  {money(statement.openingCents)}
                </td>
              </tr>
              {statement.rows.map((row, i) => (
                <tr key={`${row.documentId}-${row.kind}-${i}`}>
                  <td>
                    <span className="block whitespace-nowrap">{formatDay(row.at)}</span>
                    <span className="block">{row.description}</span>
                  </td>
                  <td className="whitespace-nowrap">{row.documentNumber ?? ''}</td>
                  <td className="font-medium whitespace-nowrap">{row.poNumber ?? ''}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {row.creditCents > 0 ? `-${money(row.creditCents)}` : money(row.chargeCents)}
                  </td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {money(row.balanceCents)}
                  </td>
                </tr>
              ))}
              {statement.rows.length === 0 && (
                <tr>
                  <td colSpan={5}>Nothing was billed or paid on this account in this period.</td>
                </tr>
              )}
              <tr className="font-semibold">
                <td>
                  <span className="block whitespace-nowrap">{formatDay(statement.period.to)}</span>
                  <span className="block">Owed at the end</span>
                </td>
                <td />
                <td />
                <td />
                <td className="text-right whitespace-nowrap tabular-nums">
                  {money(statement.closingCents)}
                </td>
              </tr>
            </tbody>
          </Table>
        </div>
        {/* On a phone the same rows as a list: a table this wide would push the
            balance off the side of the screen. Every line still carries the
            invoice number and the buyer's PO number. */}
        {/* The breakpoint sits on a wrapper with no display of its own: the
            site's theme re-declares display utilities after the breakpoint
            ones, so "flex sm:hidden" on one element keeps showing. */}
        <div className="sm:hidden">
          <ul className="flex flex-col gap-2">
            <PhoneRow
              date={formatDay(statement.period.from)}
              what="Owed at the start"
              balance={money(statement.openingCents)}
              strong
            />
            {statement.rows.map((row, i) => (
              <PhoneRow
                key={`${row.documentId}-${row.kind}-${i}`}
                date={formatDay(row.at)}
                what={row.description}
                invoice={row.documentNumber}
                po={row.poNumber}
                amount={row.creditCents > 0 ? `-${money(row.creditCents)}` : money(row.chargeCents)}
                balance={money(row.balanceCents)}
              />
            ))}
            <PhoneRow
              date={formatDay(statement.period.to)}
              what="Owed at the end"
              balance={money(statement.closingCents)}
              strong
            />
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base-content text-xl font-semibold">Still open</h2>
        {statement.openItems.length === 0 ? (
          <div className="card border-base-300 items-center border p-6 text-center">
            <p className="text-base-content">Nothing was owed at the end of this period.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {statement.openItems.map((item) => {
              const late = lateWords(item);
              return (
                <div
                  key={item.documentId}
                  className="card border-base-300 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 border px-4 py-3"
                >
                  <div className="min-w-0">
                    <strong className="whitespace-nowrap">{item.number ?? 'Invoice'}</strong>
                    {item.poNumber && (
                      <span className="text-base-content whitespace-nowrap">
                        {' '}
                        · Your PO {item.poNumber}
                      </span>
                    )}
                    <div className="text-base-content text-sm">
                      {item.dueAt ? `Due ${formatDay(item.dueAt)}` : 'Due on receipt'}
                      {item.openCents < item.totalCents
                        ? ` · ${money(item.openCents)} left of ${money(item.totalCents)}`
                        : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge color={late.tone} variant="soft">
                      {late.label}
                    </Badge>
                    <strong className="whitespace-nowrap">{money(item.openCents)}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base-content text-xl font-semibold">
          How late, at the end of the period
        </h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {statement.aging.map((bucket) => (
            <div key={bucket.key} className="card border-base-300 gap-1 border p-4">
              <span className="text-base-content text-sm">{bucket.label}</span>
              <strong
                className={
                  bucket.key !== 'current' && bucket.cents > 0 ? 'text-danger text-lg' : 'text-lg'
                }
              >
                {money(bucket.cents)}
              </strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PhoneRow({
  date,
  what,
  invoice = null,
  po = null,
  amount = null,
  balance,
  strong = false,
}: {
  date: string;
  what: string;
  invoice?: string | null;
  po?: string | null;
  amount?: string | null;
  balance: string;
  strong?: boolean;
}) {
  return (
    <li className="card border-base-300 flex-row items-start justify-between gap-3 border px-4 py-3">
      <div className="min-w-0">
        <div className={strong ? 'font-semibold' : ''}>{what}</div>
        <div className="text-base-content text-sm">{date}</div>
        {(invoice !== null || po !== null) && (
          <div className="text-base-content text-sm">
            {invoice}
            {po && (
              <>
                {invoice ? ' · ' : ''}Your PO <strong className="whitespace-nowrap">{po}</strong>
              </>
            )}
          </div>
        )}
      </div>
      <div className="text-right">
        {amount && <div className="whitespace-nowrap tabular-nums">{amount}</div>}
        <div className="text-base-content text-sm whitespace-nowrap">Balance</div>
        <strong className="whitespace-nowrap tabular-nums">{balance}</strong>
      </div>
    </li>
  );
}

function Figure({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`card gap-1 border p-4 ${emphasis ? 'border-primary' : 'border-base-300'}`}>
      <span className="text-base-content text-sm">{label}</span>
      <strong className={emphasis ? 'text-primary text-lg' : 'text-lg'}>{value}</strong>
    </div>
  );
}
