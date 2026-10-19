'use client';

// "What they have charged": the order's lines at the agreed price and what
// arrived, plus freight, tax and the invoice total.

import type { Dispatch, SetStateAction } from 'react';
import { Field, FieldControl, FieldLabel, Input, Text } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { FormSection } from '../../components/form-section';
import { moneyCents, MoneyTextInput } from '../../components/money-input';
import { formatCents } from './data';
import type { BillDraftLine } from './supplier-bill-new-model';
import type { SupplierBillDraft } from './use-supplier-bill-draft';

interface BillLineRowProps {
  line: BillDraftLine;
  index: number;
  currency: string;
  setLines: Dispatch<SetStateAction<BillDraftLine[]>>;
}

function BillLineLabel({ line, currency }: { line: BillDraftLine; currency: string }) {
  const typedCost = moneyCents(line.unitCost) ?? 0;
  const priceMoved = typedCost !== line.agreedUnitCostCents;
  return (
    <td className="w-full max-w-0 min-w-56">
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{line.title ?? 'Untitled line'}</span>
        <span className="truncate font-mono text-sm">{line.sku ?? 'No code'}</span>
        {priceMoved ? (
          <span className="truncate text-sm">
            agreed {formatCents(line.agreedUnitCostCents, currency)}
          </span>
        ) : null}
      </span>
    </td>
  );
}

function BillLineRow({ line, index, currency, setLines }: BillLineRowProps) {
  return (
    <tr>
      <BillLineLabel line={line} currency={currency} />
      <td className="text-right tabular-nums" data-label="Arrived">
        {line.receivedQuantity}
      </td>
      <td data-label="Billed">
        <Input
          size="sm"
          color="module"
          type="number"
          min={0}
          aria-label={`Quantity billed for ${line.sku ?? 'this line'}`}
          /* Beside a `w-full` cell, a number box with no width of its own is
             crushed to a couple of pixels (see `supplier-return-detail`). */
          className="w-20 text-right tabular-nums"
          value={line.quantity}
          onChange={(event) => {
            const quantity = event.target.value;
            setLines((current) => current.map((l, i) => (i === index ? { ...l, quantity } : l)));
          }}
        />
      </td>
      <td data-label="Each">
        <MoneyTextInput
          size="sm"
          color="module"
          className="w-28"
          aria-label={`Price each billed for ${line.sku ?? 'this line'}`}
          text={line.unitCost}
          onTextChange={(unitCost) => {
            setLines((current) => current.map((l, i) => (i === index ? { ...l, unitCost } : l)));
          }}
        />
      </td>
    </tr>
  );
}

function BillExtrasFields({ draft }: { draft: SupplierBillDraft }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Field className="max-w-40">
        <FieldLabel>Freight</FieldLabel>
        <FieldControl
          render={
            <MoneyTextInput
              color="module"
              aria-label="Freight"
              text={draft.freight}
              onTextChange={(value) => {
                draft.setFreight(value);
              }}
            />
          }
        />
      </Field>
      <Field className="max-w-40">
        <FieldLabel>Tax</FieldLabel>
        <FieldControl
          render={
            <MoneyTextInput
              color="module"
              aria-label="Tax"
              text={draft.tax}
              onTextChange={(value) => {
                draft.setTax(value);
              }}
            />
          }
        />
      </Field>
    </div>
  );
}

export function BillChargesSection({ draft }: { draft: SupplierBillDraft }) {
  const total = draft.goodsCents + draft.freightCents + draft.taxCents;
  return (
    <FormSection
      title="What they have charged"
      description="Filled in from the order at the agreed price and what actually arrived. Change only what differs."
    >
      <Table size="sm">
        <thead>
          <tr>
            <th>Line</th>
            <th className="w-24 text-right">Arrived</th>
            <th className="w-28 text-right">Billed</th>
            <th className="w-32 text-right">Each</th>
          </tr>
        </thead>
        <tbody>
          {draft.lines.map((line, index) => (
            <BillLineRow
              key={line.purchaseOrderLineId}
              line={line}
              index={index}
              currency={draft.currency}
              setLines={draft.setLines}
            />
          ))}
        </tbody>
      </Table>
      <BillExtrasFields draft={draft} />
      <Text>
        Total on this invoice: <strong>{formatCents(total, draft.currency)}</strong>
      </Text>
    </FormSection>
  );
}
