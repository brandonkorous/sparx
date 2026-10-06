'use client';

// One vehicle's service history, on its card on the Fleet page (sparx persona
// issue 086). The /b2b page promises "service history records against the vehicle
// in the fleet profile": this is where a buyer reads it, with a way to book the
// next visit for this vehicle when their role lets them book.
//
// Renders nothing at all when the business does not take bookings, so a shop
// without scheduling shows no booking entry on the fleet.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { loadAccountService, type AccountService } from '@/lib/fleet-service-client';
import { recordsForVehicle } from '@/lib/service-record-words';

import { ServiceRecordList } from './service-record-list';

/** The newest visits a card shows; the Service page has the rest. */
const ON_CARD = 5;

export function VehicleServiceHistory({
  accountId,
  vehicleId,
}: {
  accountId: string;
  vehicleId: string;
}) {
  const { tenantSlug, propertySlug } = useCustomer();
  const [service, setService] = useState<AccountService | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadAccountService(tenantSlug, accountId, propertySlug)
      .then((s) => active && setService(s))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId, propertySlug]);

  if (failed) {
    return (
      <p className="text-base-content text-sm">
        This vehicle&rsquo;s service history could not be loaded just now.
      </p>
    );
  }
  if (!service) return <div className="skeleton h-12" />;
  if (!service.enabled) return null;

  const records = recordsForVehicle(service.records, vehicleId);
  const bookHref = `/account/b2b/${encodeURIComponent(accountId)}/service?vehicle=${encodeURIComponent(vehicleId)}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base-content text-lg font-semibold">Service history</h3>
        {service.canBook ? (
          <Button render={<Link href={bookHref} />} color="primary" size="sm">
            Book service
          </Button>
        ) : null}
      </div>
      {records.length === 0 ? (
        <p className="text-base-content text-sm">
          No service has been booked for this vehicle yet.
        </p>
      ) : (
        <>
          <ServiceRecordList
            records={records.slice(0, ON_CARD)}
            accountId={accountId}
            myOrderIds={service.myOrderIds}
            showVehicle={false}
          />
          {records.length > ON_CARD ? (
            <Link
              href={`/account/b2b/${encodeURIComponent(accountId)}/service`}
              className="link link-primary text-sm"
            >
              See all {records.length} visits
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}
