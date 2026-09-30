'use client';

// Settling an exchange: sending the replacement instead of moving money, so an
// even swap no longer ends in a refund nobody was owed (persona issue 220).

import { useEffect, useMemo, useState } from 'react';
import { Field, FieldLabel, Text, Textarea, useToast } from '@wizeworks/silicaui-react';

import { ActionDialog } from './return-action-dialog';
import { VariantPicker, versionOf } from './variant-picker';
import { ReplacementShipmentFields } from './replacement-shipment-fields';
import {
  EMPTY_SHIPMENT_FORM,
  settleExchangeBody,
  swapSettledMessage,
  type ShipmentForm,
} from './return-shipment';
import type { VariantChoice } from './bundles-data';
import {
  returnErrorMessage,
  useSettleExchange,
  type ReturnDetail,
  type SettleExchangeBody,
} from './returns-data';
import { sellable, useProductStock, type VariantStock } from './products-data';

/** Which product came back, and what she holds of each version of it, so the
 *  picker opens on those with counts (persona issues 450, 451). */
function useReturnedStock(detail: ReturnDetail) {
  const cameBack = detail.items.find((line) => line.productId !== null)?.productId ?? null;
  const productStock = useProductStock(cameBack ?? '');
  const stock = useMemo<VariantStock | undefined>(() => {
    // Nothing asked, nothing claimed: no product behind the line leaves rows unbadged.
    if (cameBack === null || productStock.data === undefined) return undefined;
    const counts = new Map<string, number>();
    for (const level of productStock.data.items) {
      counts.set(level.variantId, (counts.get(level.variantId) ?? 0) + sellable(level));
    }
    return { productId: cameBack, counts };
  }, [cameBack, productStock.data]);
  return { cameBack, stock };
}

function useSettle(detail: ReturnDetail, onClose: () => void) {
  const toast = useToast();
  const settle = useSettleExchange(detail.id);
  const send = (body: SettleExchangeBody) => {
    settle.mutate(body, {
      onSuccess: (result) => {
        toast.add({
          title: 'Swap settled',
          description: swapSettledMessage(result, body.shipment !== undefined),
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
    });
  };
  return { send, busy: settle.isPending };
}

function VersionField({
  picked,
  onPick,
  cameBack,
  stock,
}: {
  picked: VariantChoice | null;
  onPick: (next: VariantChoice | null) => void;
  cameBack: string | null;
  stock: VariantStock | undefined;
}) {
  if (!picked) {
    return (
      <Field>
        <FieldLabel required>What are you sending instead</FieldLabel>
        <VariantPicker
          onPick={onPick}
          {...(cameBack ? { preferProductId: cameBack } : {})}
          {...(stock ? { stock } : {})}
          placeholder="Search your products…"
        />
      </Field>
    );
  }
  return (
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
          onPick(null);
        }}
      >
        Pick a different one
      </button>
    </Field>
  );
}

/** The team's note, appended to the return's own note by the server. */
function TeamNoteField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <Field>
      <FieldLabel>Note for your team</FieldLabel>
      <Textarea
        color="module"
        rows={2}
        value={value}
        placeholder="Optional. Why this swap, for whoever looks at it next. The customer never sees it."
        aria-label="Note for your team"
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </Field>
  );
}

export function ExchangeReturnModal({
  detail,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { send, busy } = useSettle(detail, onClose);
  const { cameBack, stock } = useReturnedStock(detail);
  const [picked, setPicked] = useState<VariantChoice | null>(null);
  // Filled only when the parcel has already gone; otherwise recorded afterwards.
  const [shipping, setShipping] = useState<ShipmentForm>(EMPTY_SHIPMENT_FORM);
  const [staffNote, setStaffNote] = useState('');

  useEffect(() => {
    if (open) {
      setPicked(null);
      setShipping(EMPTY_SHIPMENT_FORM);
      setStaffNote('');
    }
  }, [open]);

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
      busy={busy}
      onSubmit={() => {
        if (picked) send(settleExchangeBody(picked.id, shipping, staffNote));
      }}
    >
      <VersionField picked={picked} onPick={setPicked} cameBack={cameBack} stock={stock} />
      <ReplacementShipmentFields
        value={shipping}
        onChange={setShipping}
        trackingHint="Leave this empty if it has not gone yet. You can add it when you post it, and that is when the customer is told."
      />
      <TeamNoteField value={staffNote} onChange={setStaffNote} />
      <Text className="text-base">
        One of these comes off your stock the moment you send it. What came back went on the shelf
        when you decided what happened to it.
      </Text>
    </ActionDialog>
  );
}
