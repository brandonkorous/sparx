'use client';

// The tracking number, when it arrived after the swap was settled.
//
// Which is the ordinary way round. A shop decides what to send while the
// customer is waiting, settles it there and then, and the parcel goes out that
// afternoon or the next morning. Until this existed, a number that turned up
// five minutes after the settle screen closed had nowhere in the product to go,
// so the customer's email could only say "on its way" and stop — on a platform
// whose ordinary shipping confirmation leads with the tracking number because
// that is what the recipient opened it for.
//
// Sending this is what tells the customer. It is not a note to self.

import { useEffect, useState } from 'react';
import { Text, useToast } from '@wizeworks/silicaui-react';

import { ActionDialog } from './return-action-dialog';
import { ReplacementShipmentFields } from './replacement-shipment-fields';
import { EMPTY_SHIPMENT_FORM, replacementShipmentBody, type ShipmentForm } from './return-shipment';
import {
  returnErrorMessage,
  useRecordReplacementShipment,
  type ReturnDetail,
} from './returns-data';

export function RecordReplacementShipmentModal({
  detail,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const record = useRecordReplacementShipment(detail.id);
  const [form, setForm] = useState<ShipmentForm>(EMPTY_SHIPMENT_FORM);

  useEffect(() => {
    if (open) setForm(EMPTY_SHIPMENT_FORM);
  }, [open]);

  const shipment = replacementShipmentBody(form);
  const who = detail.customerName ?? 'the customer';

  const submit = () => {
    if (!shipment) return;
    record.mutate(
      { shipment },
      {
        onSuccess: () => {
          toast.add({
            title: 'Tracking number sent',
            description: `${who} has been emailed the number so they can follow it.`,
            type: 'success',
          });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not record how it went out',
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

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Say how it went out"
      description={`${who} is waiting to hear how to follow their replacement. Putting the tracking number here emails it to them.`}
      submitLabel="Send the tracking number"
      submitColor="module"
      submitDisabled={!shipment}
      busy={record.isPending}
      onSubmit={submit}
    >
      <ReplacementShipmentFields value={form} onChange={setForm} />

      <Text className="text-base">
        The tracking number is the one thing this email exists to carry, so it is the one thing that
        has to be here. A carrier on its own gives them nothing to follow.
      </Text>
    </ActionDialog>
  );
}
