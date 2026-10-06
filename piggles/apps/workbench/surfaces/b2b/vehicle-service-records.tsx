'use client';

// A trade account's service visits, staff side (sparx persona issue 086).
//
// The /b2b page promises "service history records against the vehicle in the
// fleet profile, and parts from an order link to the service record: the full
// picture for the next visit". `VehicleServiceRecords` is that picture for one
// vehicle, on its row in the account's fleet; `UnfiledServiceRecords` lists the
// account's visits that name no vehicle yet, so they can be opened and filed.
//
// Both render nothing when scheduling is off: the account screen exists without
// it, and an account with no bookings module has no visits to show.

import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { Icon } from '@piggles/ui';
import { faArrowUpRightFromSquare, faCalendarClock } from '@fortawesome/pro-solid-svg-icons';

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatWhen } from '../scheduling/bookings-data';
import { useAccountServiceHistory, type ServiceVisit } from '../scheduling/service-record-data';
import { partLine, visitStatus } from '../scheduling/service-record-words';

/** The newest visits a vehicle row shows; older ones are a filter on the
 *  bookings list away. */
const ON_ROW = 5;

function VisitList({ ctx, visits }: { ctx: SurfaceContext; visits: ServiceVisit[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {visits.map((v) => {
        const status = visitStatus(v.status);
        return (
          <li key={v.id} className="border-base-300 rounded-box flex flex-col gap-2 border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="text-base font-semibold">{v.serviceName}</span>
                <span className="text-sm">{formatWhen(v.startAt, v.timezone)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={status.tone} variant="soft" size="sm">
                  {status.label}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  color="module-scheduling"
                  aria-label={`Open the ${v.serviceName} booking`}
                  onClick={() => {
                    ctx.open('scheduling.bookings.detail', { id: v.id }, { target: 'beside' });
                  }}
                >
                  <Icon glyph={faCalendarClock} className="size-4" aria-hidden />
                  Open
                </Button>
              </div>
            </div>
            {v.notes ? <Text className="text-sm">Customer note: {v.notes}</Text> : null}
            {v.staffNotes ? <Text className="text-sm">Team note: {v.staffNotes}</Text> : null}
            {v.parts.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {v.parts.map((p, i) => (
                  <li
                    key={`${p.orderItemId ?? p.title}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>{partLine(p)}</span>
                    {p.orderId && p.orderNumber ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        color="module-commerce"
                        onClick={() => {
                          ctx.open(
                            'commerce.order.detail',
                            { id: p.orderId! },
                            { target: 'beside' }
                          );
                        }}
                      >
                        <Icon glyph={faArrowUpRightFromSquare} className="size-4" aria-hidden />
                        Order {p.orderNumber}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function VehicleServiceRecords({
  ctx,
  companyId,
  vehicleId,
}: {
  ctx: SurfaceContext;
  companyId: string;
  vehicleId: string;
}) {
  const history = useAccountServiceHistory(companyId);
  if (history.isError) {
    return (
      <Text className="text-sm">This vehicle&rsquo;s service history could not be loaded.</Text>
    );
  }
  if (!history.data || !history.data.enabled) return null;
  const visits = history.data.records.filter((r) => r.vehicle?.vehicleId === vehicleId);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-semibold">Service history</span>
      {visits.length === 0 ? (
        <Text className="text-sm">No visits booked for this vehicle yet.</Text>
      ) : (
        <>
          <VisitList ctx={ctx} visits={visits.slice(0, ON_ROW)} />
          {visits.length > ON_ROW ? (
            <Text className="text-sm">
              Showing the newest {ON_ROW} of {visits.length} visits.
            </Text>
          ) : null}
        </>
      )}
    </div>
  );
}

export function UnfiledServiceRecords({
  ctx,
  companyId,
}: {
  ctx: SurfaceContext;
  companyId: string;
}) {
  const history = useAccountServiceHistory(companyId);
  if (!history.data || !history.data.enabled) return null;
  const visits = history.data.records.filter((r) => !r.vehicle);
  if (visits.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-semibold">Visits with no vehicle on them</span>
      <Text className="text-sm">
        Open a visit and pick its vehicle so it shows in that vehicle&rsquo;s history.
      </Text>
      <VisitList ctx={ctx} visits={visits} />
    </div>
  );
}
