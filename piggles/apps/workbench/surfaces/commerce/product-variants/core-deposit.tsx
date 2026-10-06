'use client';

// The core deposit, and the other way to buy a part that carries one (issue 057):
// send the old part first, pay nothing, and the part ships when it arrives.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Switch,
} from '@wizeworks/silicaui-react';

import { OptionalMoney } from './fields';
import type { VariantDraft } from './draft';
import type { Variant } from '../products-data';

/** A part the supplier ships straight to the buyer cannot offer it: the old part
 *  would have to come here first. The server refuses that in these same words. */
function SendFirstSwitch({
  variant,
  label,
  draft,
  onChange,
}: {
  variant: Variant;
  label: string;
  draft: VariantDraft;
  onChange: (change: Partial<VariantDraft>) => void;
}) {
  const fromSupplier = variant.dropshipSourceId !== null;
  return (
    <Field>
      <FieldLabel>Buyers can send their old part first instead</FieldLabel>
      <FieldControl
        render={
          <Switch
            color="module"
            checked={draft.coreFirst && !fromSupplier}
            disabled={fromSupplier}
            aria-label={`Buyers of ${label} can send their old part first`}
            onCheckedChange={(next: boolean) => {
              onChange({ coreFirst: next });
            }}
          />
        }
      />
      <FieldDescription>No deposit. The part is held until the old one arrives.</FieldDescription>
      {fromSupplier ? (
        <FieldStatus status="warning">
          Your supplier ships this part straight to the buyer, so the old part cannot come to you
          first.
        </FieldStatus>
      ) : null}
    </Field>
  );
}

export function CoreDeposit({
  variant,
  label,
  draft,
  onChange,
}: {
  variant: Variant;
  label: string;
  draft: VariantDraft;
  onChange: (change: Partial<VariantDraft>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <OptionalMoney
        label="Core deposit"
        description="For a rebuilt part. Charged on top of the price, never taxed or discounted, and paid back when the customer returns their old part."
        value={draft.core}
        addLabel="Add a core deposit"
        onChange={(next) => {
          onChange({ core: next });
        }}
      />
      {draft.core !== null && draft.core > 0 ? (
        <SendFirstSwitch variant={variant} label={label} draft={draft} onChange={onChange} />
      ) : null}
    </div>
  );
}
