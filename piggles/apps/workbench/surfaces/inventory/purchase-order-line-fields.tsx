// What a line says on the order: description, quantity, cost each, their code,
// the ladder price that applies, and the line total.

import { Field, FieldControl, FieldLabel, Input, Text } from '@wizeworks/silicaui-react';
import { MoneyTextInput } from '../../components/money-input';
import { formatCents } from './data';
import type { LineEditorModel } from './use-purchase-order-line-editor';

export function DescriptionField({ model }: { model: LineEditorModel }) {
  return (
    <Field>
      <FieldLabel>Description on the order</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={model.description}
            placeholder="What appears on the printed order"
            onChange={(event) => {
              model.setDescription(event.target.value);
            }}
          />
        }
      />
    </Field>
  );
}

function QuantityField({ model }: { model: LineEditorModel }) {
  return (
    <Field className="w-24">
      <FieldLabel required>Quantity</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            type="number"
            min={1}
            inputMode="numeric"
            className="text-right tabular-nums"
            value={model.quantity}
            onChange={(event) => {
              model.setQuantity(event.target.value);
            }}
          />
        }
      />
    </Field>
  );
}

function CostField({ model }: { model: LineEditorModel }) {
  return (
    <Field className="w-32">
      <FieldLabel required>Cost each</FieldLabel>
      <FieldControl
        render={
          <MoneyTextInput
            color="module"
            className="text-right"
            aria-label="Cost each"
            text={model.cost}
            onTextChange={(text) => {
              model.setCostTouched(true);
              model.setCost(text);
            }}
          />
        }
      />
    </Field>
  );
}

function TheirCodeField({ model }: { model: LineEditorModel }) {
  return (
    <Field className="w-40">
      <FieldLabel>Their code</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={model.supplierSku}
            placeholder="Optional"
            spellCheck={false}
            onChange={(event) => {
              model.setSupplierSku(event.target.value);
            }}
          />
        }
      />
    </Field>
  );
}

export function LineAmounts({ model }: { model: LineEditorModel }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <QuantityField model={model} />
      <CostField model={model} />
      <TheirCodeField model={model} />
    </div>
  );
}

export function LinePricing({ model, currency }: { model: LineEditorModel; currency: string }) {
  const { laddered, costTouched, lineTotal } = model;
  return (
    <>
      {laddered && !costTouched && laddered.source === 'break' ? (
        <Text className="text-sm">Their price for {laddered.appliedAtQuantity} or more.</Text>
      ) : null}
      {laddered && laddered.nextBreakAtQuantity !== null ? (
        <Text className="text-sm">
          Order {laddered.nextBreakAtQuantity} or more and they charge{' '}
          {formatCents(laddered.nextBreakUnitCostCents ?? 0, currency)} each.
        </Text>
      ) : null}
      {lineTotal !== null ? (
        <div className="flex items-baseline gap-2">
          <Text as="span" className="text-sm">
            Line total
          </Text>
          <Text as="span" className="text-lg font-semibold tabular-nums">
            {formatCents(lineTotal, currency)}
          </Text>
        </div>
      ) : null}
    </>
  );
}
