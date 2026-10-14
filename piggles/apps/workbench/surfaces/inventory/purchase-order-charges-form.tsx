// Adding one expected cost to an order: what it is for, how much, how it spreads.

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import {
  ALLOCATION_BASES,
  CHARGE_KINDS,
  type AllocationBasis,
  type ChargeKind,
} from './costing-data';
import type { ChargesModel } from './use-purchase-order-charges';

function KindField({ model }: { model: ChargesModel }) {
  return (
    <Field>
      <FieldLabel>What is it for?</FieldLabel>
      <NativeSelect
        aria-label="What this cost is"
        value={model.kind}
        onChange={(event) => {
          model.setKind(event.target.value as ChargeKind);
        }}
      >
        {CHARGE_KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

function AmountField({ model }: { model: ChargesModel }) {
  return (
    <Field>
      <FieldLabel required>Amount</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            inputMode="decimal"
            placeholder="0.00"
            aria-label="Amount"
            className="text-right tabular-nums"
            value={model.amount}
            onChange={(event) => {
              model.setAmount(event.target.value);
            }}
          />
        }
      />
    </Field>
  );
}

function BasisField({ model }: { model: ChargesModel }) {
  return (
    <Field>
      <FieldLabel>How should it be spread?</FieldLabel>
      <NativeSelect
        aria-label="How to spread it"
        value={model.basis}
        onChange={(event) => {
          model.setBasis(event.target.value as AllocationBasis);
        }}
      >
        {ALLOCATION_BASES.filter((b) => b.value !== 'manual').map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </NativeSelect>
      <FieldDescription>
        {ALLOCATION_BASES.find((b) => b.value === model.basis)?.hint}
      </FieldDescription>
    </Field>
  );
}

export function AddChargeForm({ model }: { model: ChargesModel }) {
  return (
    <div className="border-base-300 flex flex-col gap-3 rounded-lg border p-3">
      <div className="grid gap-2 @lg:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)]">
        <KindField model={model} />
        <AmountField model={model} />
        <BasisField model={model} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          color="module"
          disabled={!model.canSave}
          loading={model.saving}
          onClick={model.save}
        >
          Add it
        </Button>
        <Button
          size="sm"
          variant="ghost"
          color="neutral"
          onClick={() => {
            model.setAdding(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
