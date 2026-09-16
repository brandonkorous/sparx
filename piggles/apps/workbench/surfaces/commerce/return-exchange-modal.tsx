'use client';

// Settling an exchange: sending the replacement instead of moving money.
//
// The only way out of "checked, ready to settle" used to be a refund, so an
// even swap could only be ended by giving back money nobody was owed (persona
// issue 220). This ends it the way the customer asked.

import { useEffect, useMemo, useState } from 'react';
import { Field, FieldLabel, Text, useToast } from '@wizeworks/silicaui-react';

import { ActionDialog } from './return-action-dialog';
import { VariantPicker, versionOf } from './variant-picker';
import { ReplacementShipmentFields } from './replacement-shipment-fields';
import {
  EMPTY_SHIPMENT_FORM,
  replacementShipmentBody,
  swapSettledMessage,
  type ShipmentForm,
} from './return-shipment';
import type { VariantChoice } from './bundles-data';
import { returnErrorMessage, useSettleExchange, type ReturnDetail } from './returns-data';
import { sellable, useProductStock, type VariantStock } from './products-data';

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
  // Known here only when the parcel has already gone, which some shops do and
  // most do not. Left empty, the swap settles and the tracking number is
  // recorded afterwards through "Say how it went out".
  const [shipping, setShipping] = useState<ShipmentForm>(EMPTY_SHIPMENT_FORM);

  useEffect(() => {
    if (open) {
      setPicked(null);
      setShipping(EMPTY_SHIPMENT_FORM);
    }
  }, [open]);

  const submit = () => {
    if (!picked) return;
    const shipment = replacementShipmentBody(shipping);
    settle.mutate(
      {
        replacementVariantId: picked.id,
        quantity: 1,
        ...(shipment ? { shipment } : {}),
      },
      {
        onSuccess: (result) => {
          toast.add({
            title: 'Swap settled',
            description: swapSettledMessage(result, shipment !== undefined),
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

  // WHICH product came back. A swap is almost always another version of it, so
  // the picker opens on those; before this it opened alphabetically over the
  // whole catalog and offered signet rings for a returned knit.
  const cameBack = detail.items.find((line) => line.productId !== null)?.productId ?? null;

  // What she HAS of each version, which is the question the customer usually
  // asked her — "a size up in Oat if you have one". The picker showed price and
  // code and no count, so the decision was made from memory (persona issue 450).
  const productStock = useProductStock(cameBack ?? '');
  const stock = useMemo<VariantStock | undefined>(() => {
    // Nothing was asked, so nothing is claimed. A return line with no product
    // behind it (hand-typed, or a product since deleted) leaves every row
    // unbadged rather than badged wrong (issue 451).
    if (cameBack === null || productStock.data === undefined) return undefined;
    const counts = new Map<string, number>();
    for (const level of productStock.data.items) {
      counts.set(level.variantId, (counts.get(level.variantId) ?? 0) + sellable(level));
    }
    return { productId: cameBack, counts };
  }, [cameBack, productStock.data]);

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
          <VariantPicker
            onPick={setPicked}
            {...(cameBack ? { preferProductId: cameBack } : {})}
            {...(stock ? { stock } : {})}
            placeholder="Search your products…"
          />
        </Field>
      )}

      <ReplacementShipmentFields
        value={shipping}
        onChange={setShipping}
        trackingHint="Leave this empty if it has not gone yet. You can add it when you post it, and that is when the customer is told."
      />

      <Text className="text-base">
        One of these comes off your stock the moment you send it. What came back went on the shelf
        when you decided what happened to it.
      </Text>
    </ActionDialog>
  );
}
