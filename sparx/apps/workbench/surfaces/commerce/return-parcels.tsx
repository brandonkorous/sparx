'use client';

// What is travelling on this return, and which way.
//
// Two legs, and until now the pane drew neither. The return detail has always
// fetched `labels` — the prepaid label bought when the return was approved — and
// nothing on any screen rendered it, so a shop that wanted to tell a customer
// "your label is 1Z999, it was posted Tuesday" had to look in the database.
// The replacement going the other way did not exist at all.
//
// Both are drawn here because they are the same question asked twice, and a
// customer chasing a parcel does not care which of our tables it is in.

import { Badge, Text } from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import { formatDateTime } from './data';
import { shipmentCarrierName } from './return-shipment';
import type { ReturnLabelRecord } from './returns-data';

/** What each leg is FOR, in the words a shop owner would use. Not "inbound" and
 *  "outbound", which describe a warehouse and not a person's day. */
function legWords(direction: string): { title: string; tone: 'info' | 'success' } {
  return direction === 'outbound'
    ? { title: 'The replacement going out', tone: 'success' }
    : { title: 'Their label to send it back', tone: 'info' };
}

export function ReturnParcels({ labels }: { labels: ReturnLabelRecord[] }) {
  // No parcel, no card. A return settled by refund never has one, and an empty
  // "Parcels: none" on every one of those would be a heading over nothing.
  if (labels.length === 0) return null;

  return (
    <FormSection title="Parcels">
      <div className="flex flex-col gap-4">
        {labels.map((row) => {
          const words = legWords(row.direction);
          const carrier = shipmentCarrierName(row);
          return (
            <div key={row.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Text as="span" className="text-base font-medium">
                  {words.title}
                </Text>
                <Badge color={words.tone} variant="soft" size="sm">
                  {row.direction === 'outbound' ? 'On its way to them' : 'Coming back to you'}
                </Badge>
              </div>

              {carrier ? <Text className="text-base">{carrier}</Text> : null}

              {row.trackingNumber ? (
                <Text className="font-mono text-sm">{row.trackingNumber}</Text>
              ) : (
                <Text className="text-sm">No tracking number was recorded for this one.</Text>
              )}

              {row.trackingUrl ? (
                <a
                  className="link self-start text-sm"
                  href={row.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Follow it
                </a>
              ) : null}

              {row.shippedAt ? (
                <Text className="text-sm">Posted {formatDateTime(row.shippedAt)}</Text>
              ) : null}
            </div>
          );
        })}
      </div>
    </FormSection>
  );
}
