'use client';

// A list of service visits for a trade account's vehicles (sparx persona issue
// 086): when, what was done, where it stands, the note, and the parts that went
// into it, each linked to the order it came from. Used by the account's Service
// page (every vehicle) and by each vehicle card on the Fleet page (one vehicle).

import Link from 'next/link';
import { Badge } from '@wizeworks/silicaui-react';

import { formatStamp } from '@/components/booking/booking-clock';
import type { ServiceRecord } from '@/lib/fleet-service-client';
import {
  partLine,
  partOrderHref,
  serviceStatusTone,
  serviceStatusWords,
} from '@/lib/service-record-words';

export function ServiceRecordList({
  records,
  accountId,
  myOrderIds,
  showVehicle,
}: {
  records: ServiceRecord[];
  accountId: string;
  myOrderIds: string[];
  /** Name the vehicle on each visit: on for a list of several vehicles, off on a
   *  vehicle's own card, where it would only repeat the card's heading. */
  showVehicle: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {records.map((r) => (
        <li key={r.id} className="card border-base-300 flex flex-col gap-2 border px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="flex min-w-0 flex-col">
              <strong>{r.serviceName}</strong>
              <span className="text-base-content text-sm">
                {formatStamp(r.startAt, r.timezone)}
                {showVehicle ? ` · ${r.vehicle?.label ?? 'No vehicle named'}` : ''}
              </span>
            </div>
            <Badge color={serviceStatusTone(r.status)} variant="soft">
              {serviceStatusWords(r.status)}
            </Badge>
          </div>
          {r.notes ? <p className="text-base-content text-sm">{r.notes}</p> : null}
          {r.parts.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-base-content text-sm font-medium">Parts used</span>
              <ul className="flex flex-col gap-1">
                {r.parts.map((p, i) => {
                  const href = partOrderHref(p, accountId, myOrderIds);
                  return (
                    <li
                      key={`${p.orderItemId ?? p.sku ?? p.title}-${i}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
                    >
                      <span>{partLine(p)}</span>
                      {href && p.orderNumber ? (
                        <Link href={href} className="link link-primary whitespace-nowrap">
                          Order {p.orderNumber}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
