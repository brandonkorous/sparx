'use client';

// What a return SAYS — the read-only record, in the order it reads.
//
// Split from the pane so the record and the moves you can make on it are two
// files rather than one 540-line component. Nothing here writes.

import { FormSection } from '../../components/form-section';
import { ModuleScope } from '../../components/module-scope';
import { Text } from '@wizeworks/silicaui-react';
import { ReturnDispositionPanel } from './return-disposition-panel';
import { formatDateTime, formatMoney, type Order } from './data';
import {
  conditionLabel,
  reasonLabel,
  REFUND_ISSUED_AS_LABELS,
  type ReturnDetail,
} from './returns-data';
import { money } from './return-action-dialog';

export function ReturnRecord({
  detail,
  order,
  currency,
}: {
  detail: ReturnDetail;
  /** Backs the line prices. A return stores only quantities and an orderItemId,
   *  so without the order there is no money on this screen. */
  order: Order | undefined;
  currency: string;
}) {
  const priceByOrderItem = new Map((order?.items ?? []).map((it) => [it.id, it.unitPrice]));
  const conditionByLine = new Map(
    detail.inspections.map((ins) => [ins.returnLineItemId, ins] as const)
  );

  return (
    <>
      <FormSection title="What is coming back">
        <ul className="flex flex-col">
          {detail.items.map((it) => {
            const unit = priceByOrderItem.get(it.orderItemId);
            const inspection = conditionByLine.get(it.id);
            const qty = it.approvedQuantity > 0 ? it.approvedQuantity : it.quantity;
            return (
              <li
                key={it.id}
                className="border-base-300 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-base font-medium">{it.orderItemName ?? 'Item'}</span>
                  <span className="text-sm">
                    {reasonLabel(it.reasonCode)} · {it.quantity} asked back
                    {it.approvedQuantity > 0 && it.approvedQuantity !== it.quantity
                      ? ` · ${it.approvedQuantity} accepted`
                      : ''}
                  </span>
                  {inspection ? (
                    <span className="text-sm">
                      Came back {conditionLabel(inspection.condition).toLowerCase()}
                      {inspection.restockable ? ' · fit to resell' : ' · not for resale'}
                    </span>
                  ) : null}
                  {it.customerNote ? <span className="text-sm">“{it.customerNote}”</span> : null}
                </div>
                {unit !== undefined ? (
                  <span className="text-base font-medium tabular-nums">
                    {formatMoney(unit * qty, currency)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </FormSection>

      {/* CRM's data on a commerce screen wears CRM's hue. */}
      {detail.customerName ? (
        <ModuleScope module="crm">
          <FormSection title="Who is returning it">
            <Text className="text-base font-medium">{detail.customerName}</Text>
          </FormSection>
        </ModuleScope>
      ) : null}

      {/* What physically happens to the goods (docs/146 Phase 9.7). Appears
              once anything has been inspected, because before that there is
              nothing to decide about — and deciding where goods go before
              somebody has looked at them is how a damaged item ends up back on
              the shelf. */}
      {detail.inspections.length > 0 ? <ReturnDispositionPanel returnId={detail.id} /> : null}

      {/* A swap settles with no money at all, and saying so out loud is the
              point — "nothing was given back" is the ANSWER on an even
              exchange, not a missing figure (issue 220). */}
      {detail.status === 'exchanged' ? (
        <FormSection title="How it was settled">
          <div className="flex items-baseline justify-between gap-4 text-lg font-semibold">
            <span>Money moved</span>
            <span className="tabular-nums">{money(0, currency)}</span>
          </div>
          <Text className="text-base">
            They were sent a replacement instead of being given anything back
            {detail.refundedAt ? ` · ${formatDateTime(detail.refundedAt)}` : ''}
          </Text>
        </FormSection>
      ) : null}

      {/* The settlement only exists once the money has gone back, so the card
              only appears then — no empty "Refund: none" on every open return. */}
      {detail.status === 'refunded' && detail.refundedAmountCents !== null ? (
        <FormSection title="How it was settled">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-4 text-lg font-semibold">
              <span>Given back</span>
              <span className="tabular-nums">{money(detail.refundedAmountCents, currency)}</span>
            </div>
            {detail.restockingFeeCents && detail.restockingFeeCents > 0 ? (
              <div className="flex items-baseline justify-between gap-4">
                <span>Restocking fee kept</span>
                <span className="tabular-nums">{money(detail.restockingFeeCents, currency)}</span>
              </div>
            ) : null}
            {detail.refundIssuedAs ? (
              <Text className="text-sm">
                {REFUND_ISSUED_AS_LABELS[detail.refundIssuedAs] ?? detail.refundIssuedAs}
                {detail.refundedAt ? ` · ${formatDateTime(detail.refundedAt)}` : ''}
              </Text>
            ) : null}
          </div>
        </FormSection>
      ) : null}

      {/* The staff note is already surfaced in the status alert when a return
              was denied; show the card only when it says something else. */}
      {detail.staffNote && detail.status !== 'denied' ? (
        <FormSection title="Your team’s note">
          <Text className="text-base whitespace-pre-wrap">{detail.staffNote}</Text>
        </FormSection>
      ) : null}
    </>
  );
}
