// What you expect it to cost to get here: ESTIMATES entered when the order is
// raised, so a part-shipped order can apportion them across its deliveries.

import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { faPlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import { FormSection } from '../../components/form-section';
import { formatCents } from './data';
import { basisLabel, chargeKindLabel, type Charge } from './costing-data';
import { usePurchaseOrderCharges, type ChargesModel } from './use-purchase-order-charges';
import { AddChargeForm } from './purchase-order-charges-form';

/** Color carries the state: fully apportioned, partly, or simply waiting. */
function LandedBadge({ charge, currency }: { charge: Charge; currency: string }) {
  const allocated = charge.allocatedCents ?? 0;
  const done = allocated >= charge.amountCents;
  return (
    <Badge color={done ? 'success' : allocated > 0 ? 'info' : 'neutral'} variant="soft" size="sm">
      {allocated === 0 ? 'Not yet' : done ? 'All of it' : formatCents(allocated, currency)}
    </Badge>
  );
}

function ChargeRow({ charge, model }: { charge: Charge; model: ChargesModel }) {
  const label = chargeKindLabel(charge.kind);
  return (
    <tr>
      <td>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{label}</span>
          {charge.description ? (
            <span className="truncate text-sm">{charge.description}</span>
          ) : null}
        </span>
      </td>
      <td className="hidden text-sm @lg:table-cell">{basisLabel(charge.allocationBasis)}</td>
      <td className="text-right font-medium tabular-nums">
        {formatCents(charge.amountCents, model.currency)}
      </td>
      <td className="hidden text-right @md:table-cell">
        <LandedBadge charge={charge} currency={model.currency} />
      </td>
      <td>
        <Button
          size="sm"
          variant="ghost"
          color="danger"
          shape="square"
          aria-label={`Remove ${label}`}
          loading={model.removing}
          onClick={() => {
            void model.remove(charge.id, label.toLowerCase(), charge.allocatedCents ?? 0);
          }}
        >
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
        </Button>
      </td>
    </tr>
  );
}

function ChargesTable({ model }: { model: ChargesModel }) {
  const { currency, total, landed } = model;
  return (
    <>
      <Table size="sm">
        <thead>
          <tr>
            <th>Cost</th>
            <th className="hidden @lg:table-cell">Spread</th>
            <th className="text-right whitespace-nowrap">Quoted</th>
            <th className="hidden text-right whitespace-nowrap @md:table-cell">On deliveries</th>
            <th className="w-10" aria-label="Remove" />
          </tr>
        </thead>
        <tbody>
          {model.rows.map((charge) => (
            <ChargeRow key={charge.id} charge={charge} model={model} />
          ))}
        </tbody>
      </Table>
      <Text className="text-sm">
        {formatCents(total, currency)} expected in total
        {landed > 0
          ? `, of which ${formatCents(landed, currency)} has already landed on deliveries.`
          : '. None of it has reached a delivery yet.'}
      </Text>
    </>
  );
}

function NothingExpected({ freightCents, currency }: { freightCents: number; currency: string }) {
  return (
    <Text className="text-sm">
      {freightCents > 0
        ? `The ${formatCents(freightCents, currency)} of freight on this order is already being spread across the items as they arrive. Anything else (duty, customs, a broker's fee) goes here.`
        : 'Nothing expected on top of the goods and the freight. If a customs or duty bill comes in later, add it here and every delivery against this order picks up its share.'}
    </Text>
  );
}

/** `freightCents` is the order's own Freight, named here rather than claiming
 *  nothing is expected while it sits on the same screen (issue 496). */
export function OrderChargesSection({
  purchaseOrderId,
  currency,
  freightCents,
}: {
  purchaseOrderId: string;
  currency: string;
  freightCents: number;
}) {
  const model = { ...usePurchaseOrderCharges(purchaseOrderId, currency), currency };
  return (
    <FormSection
      title="What you expect it to cost to get here"
      description="Import duty, customs fees, a broker's bill you have been quoted. Each delivery against this order carries its share, so what you hold is valued at what it really cost rather than at the invoice price."
      action={
        model.adding ? null : (
          <Button
            size="sm"
            variant="outline"
            color="neutral"
            onClick={() => {
              model.setAdding(true);
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add an expected cost
          </Button>
        )
      }
    >
      {model.rows.length === 0 && !model.adding ? (
        <NothingExpected freightCents={freightCents} currency={currency} />
      ) : null}
      {model.rows.length > 0 ? <ChargesTable model={model} /> : null}
      {model.adding ? <AddChargeForm model={model} /> : null}
    </FormSection>
  );
}
