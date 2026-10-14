'use client';

// Everything Take a sale holds while it is being written: who, what, what they
// pay, the sales tax, and what was handed over. Moved out of sale-detail.tsx so
// each piece is one job (sparx persona issue 230).

import { useMemo, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { shownInPlace } from '@wizeworks/query';

import { afterPaneChange } from '../../lib/defer';
import { useActivePropertyId } from '../../lib/api/shell-data';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { CustomerSummary } from '../invoicing/customer-picker';
import { saleTotals } from './sale-core';
import type { SaleLine } from './sale-data';
import { depositDue, dueDayLabel } from './sale-made-to-order';
import { useTakeSale, type TakeSaleInput } from './sale-take';
import { whatToOffer } from './sale-taking';
import { useAgreedPricing } from './use-agreed-pricing';
import { useSalePayment } from './use-sale-payment';
import { useSaleTaxQuote } from './use-sale-tax';

/** Every line named and priced, a customer chosen, and the tax known. */
function readyToWrite(customer: CustomerSummary | null, lines: SaleLine[], taxReady: boolean) {
  const priced = lines.every((line) => Number.isFinite(Number(line.price)));
  const named = lines.every((line) => line.name.trim() !== '');
  return customer !== null && lines.length > 0 && priced && named && taxReady;
}

/** Writes it down, then opens the order it became. */
function useWriteItDown(ctx: SurfaceContext) {
  const toast = useToast();
  const take = useTakeSale();
  const write = (input: TakeSaleInput) => {
    take.mutate(input, {
      onSuccess: (order) => {
        ctx.open('commerce.order.detail', { id: order.id }, { target: 'replace' });
        afterPaneChange(() => {
          toast.add({ title: 'Sale written down', type: 'success' });
        });
      },
      onError: shownInPlace,
    });
  };
  return { take, write };
}

export function useCounterSale(ctx: SurfaceContext) {
  const { take, write } = useWriteItDown(ctx);
  const propertyId = useActivePropertyId();
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [lines, setLines] = useState<SaleLine[]>([]);
  useAgreedPricing(customer, propertyId, lines, setLines);
  const tax = useSaleTaxQuote(customer?.id ?? null, lines);
  // Core deposits and sales tax are IN the total taken, each on its own row.
  const totals = useMemo(
    () => saleTotals(lines, tax.quote?.totalTaxCents ?? 0),
    [lines, tax.quote]
  );
  // Filed under a business they buy for, which is the same fact the picker
  // marks. A shop that phoned this through has handed over nothing.
  const buysOnAccount = customer?.companyId != null;
  // A deposit product asks for its deposit, not the whole price (issue 026), and
  // an order going out on account offers nothing at all (issue 748).
  const asking = useMemo(
    () => whatToOffer({ depositAsked: depositDue(lines), total: totals.total, buysOnAccount }),
    [lines, totals.total, buysOnAccount]
  );
  const payment = useSalePayment(asking);
  const started = customer !== null || lines.length > 0;
  useDirtySource(
    started && !take.isSuccess,
    'This sale has not been written down yet. Close anyway?'
  );
  const canSave = readyToWrite(customer, lines, tax.ready) && !take.isPending && !take.isSuccess;
  const submit = () => {
    if (!canSave || !customer) return;
    const { paid, paidWith, paidNote } = payment;
    write({
      customerId: customer.id,
      currency: 'USD',
      lines,
      propertyId,
      tax: tax.quote,
      paid: Number(paid) || 0,
      paidWith,
      paidNote,
    });
  };
  const sale = { customer, setCustomer, lines, setLines, dueDay: dueDayLabel(lines) };
  return { ...sale, take, tax, totals, buysOnAccount, payment, canSave, submit };
}
