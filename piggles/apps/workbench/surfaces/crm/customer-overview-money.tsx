'use client';

// What this customer is worth, what they owe, and what they hold with you.
//
// Commerce's numbers, so the whole band wears the Commerce hue — the one signal
// that these come from orders rather than from something typed into the CRM.

import { Text } from '@wizeworks/silicaui-react';

import { ModuleScope } from '../../components/module-scope';
import { useAccountCreditLedger } from '../commerce/account-credit-data';
import { type Customer } from './customers-data';
import { describeOrderRecency, formatMoney, longDate } from './customer-display';

// A bordered base-100 tile — the app's KPI shape (mirrors reports.tsx). Value
// leads on scale and weight; the label sits under it in full ink, never faded.
function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-base-300 bg-base-100 flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-sm">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-sm">{hint}</span> : null}
    </div>
  );
}

export function WorthKpis({ customer }: { customer: Customer }) {
  // Two questions, and answering only the second is what made this card read
  // $0.00 above three orders worth $502 (issue 323). Both are net of refunds, so
  // the gap between them is money owed rather than money returned.
  const ordered = Number(customer.totalOrdered);
  const spent = Number(customer.totalSpent);
  const orders = customer.orderCount;
  const outstanding = ordered - spent;
  // The real average order value — order VALUE over orders placed, the same
  // quantity Sell › How selling is going means by the phrase. It was the size of
  // a payment over the count of orders, which described nothing.
  const avg = orders > 0 ? ordered / orders : 0;

  return (
    <ModuleScope module="commerce">
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <Kpi
          label="Their orders come to"
          value={orders > 0 ? formatMoney(ordered) : '—'}
          hint={orders > 0 ? `${formatMoney(avg)} an order on average` : undefined}
        />
        <Kpi
          label="Paid you so far"
          value={formatMoney(spent)}
          hint={
            outstanding > 0
              ? `${formatMoney(outstanding)} still to come`
              : orders > 0
                ? 'Paid in full'
                : undefined
          }
        />
        <Kpi label="Orders" value={orders.toLocaleString()} />
        <Kpi
          label="Last order"
          value={orders > 0 ? describeOrderRecency(customer.lastOrderAt) : 'None yet'}
          hint={
            orders > 0 && customer.firstOrderAt
              ? `First ${longDate(customer.firstOrderAt)}`
              : undefined
          }
        />
      </div>
    </ModuleScope>
  );
}

export function StoreCredit({ customerId }: { customerId: string }) {
  const { data } = useAccountCreditLedger(customerId);
  const cents = data?.balanceCents ?? 0;
  // A positive-only accent: its ABSENCE is not something a viewer looks for (most
  // customers never have store credit), so unlike the sections below it stays
  // conditional rather than showing a "no credit" line for everyone.
  if (cents <= 0) return null;

  return (
    <ModuleScope module="commerce">
      <div className="border-base-300 bg-base-100 flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="flex min-w-0 flex-col">
          <Text as="span" className="font-medium">
            Store credit
          </Text>
          <Text as="span" className="text-sm">
            Balance this customer can spend at checkout.
          </Text>
        </div>
        <span className="shrink-0 text-2xl font-semibold tabular-nums">
          {formatMoney(cents / 100, data?.currency)}
        </span>
      </div>
    </ModuleScope>
  );
}
