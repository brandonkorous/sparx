'use client';

// Settling an exchange: sending the replacement instead of moving money.
//
// The only way out of "checked, ready to settle" used to be a refund, so an
// even swap could only be ended by giving back money nobody was owed (persona
// issue 220). This ends it the way the customer asked.

import { useEffect, useState } from 'react';
import { Field, FieldLabel, Text, useToast } from '@wizeworks/silicaui-react';

import { ActionDialog } from './return-action-dialog';
import { VariantPicker, versionOf } from './variant-picker';
import type { VariantChoice } from './bundles-data';
import { returnErrorMessage, useSettleExchange, type ReturnDetail } from './returns-data';

export function ExchangeReturnModal({
  detail,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const settle = useSettleExchange(detail.id);
  const [picked, setPicked] = useState<VariantChoice | null>(null);

  useEffect(() => {
    if (open) setPicked(null);
  }, [open]);

  const submit = () => {
    if (!picked) return;
    settle.mutate(
      { replacementVariantId: picked.id, quantity: 1 },
      {
        onSuccess: () => {
          toast.add({
            title: 'Swap settled',
            description: 'One came back on the shelf, one went out, and no money moved.',
            type: 'success',
          });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not settle the swap',
            description: returnErrorMessage(
              error,
              'Nothing was changed on this return. Try again in a moment.'
            ),
            type: 'error',
          });
        },
      }
    );
  };

  const who = detail.customerName ?? 'the customer';

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Send the replacement"
      description={`This finishes the return by sending ${who} the version they asked for. No money moves in either direction.`}
      submitLabel={picked ? `Send ${versionOf(picked) || picked.sku}` : 'Send the replacement'}
      submitColor="module"
      submitDisabled={!picked}
      busy={settle.isPending}
      onSubmit={submit}
    >
      {picked ? (
        <Field>
          <FieldLabel>Going out</FieldLabel>
          <div className="border-base-300 flex flex-col gap-0.5 rounded-lg border p-3">
            <Text className="text-base font-medium">{picked.productTitle}</Text>
            <Text className="text-base">{versionOf(picked) || picked.sku}</Text>
            <Text className="font-mono text-sm">{picked.sku}</Text>
          </div>
          <button
            type="button"
            className="link self-start text-sm"
            onClick={() => {
              setPicked(null);
            }}
          >
            Pick a different one
          </button>
        </Field>
      ) : (
        <Field>
          <FieldLabel required>What are you sending instead</FieldLabel>
          <VariantPicker onPick={setPicked} placeholder="Search your products…" />
        </Field>
      )}

      <Text className="text-base">
        One of these comes off your stock the moment you send it. What came back went on the shelf
        when you decided what happened to it.
      </Text>
    </ActionDialog>
  );
}
