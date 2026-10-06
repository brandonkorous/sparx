'use client';

// Service for a wholesale account's vehicles (sparx persona issue 086): book the
// next visit for any vehicle on the account, and read every visit so far with the
// parts that went into it.
//
// The /b2b page promises a fleet account "books service from the same portal" and
// that "service history records against the vehicle in the fleet profile, and
// parts from an order link to the service record". Booking is open to the buyers
// and the primary contact; anyone on the account reads the history. When the
// business does not take bookings there is nothing here to offer, and the account
// page shows no way in.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Alert, NativeSelect } from '@wizeworks/silicaui-react';

import { FleetServiceBooking } from '@/components/account/fleet-service-booking';
import { ServiceRecordList } from '@/components/account/service-record-list';
import { useCustomer } from '@/components/customer-provider';
import { loadAccountService, type AccountService } from '@/lib/fleet-service-client';
import { recordsForVehicle } from '@/lib/service-record-words';

const ALL = '';
const NO_VEHICLE = '__none__';

export default function B2bServicePage() {
  const { tenantSlug, propertySlug } = useCustomer();
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const search = useSearchParams();
  const askedVehicle = search.get('vehicle');
  const [service, setService] = useState<AccountService | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(askedVehicle ?? ALL);

  const load = useCallback(() => {
    loadAccountService(tenantSlug, accountId, propertySlug)
      .then((s) => {
        setService(s);
        setError(null);
      })
      .catch(() => setError('Service for this account could not be loaded just now.'));
  }, [tenantSlug, accountId, propertySlug]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    if (!service?.enabled) return [];
    if (filter === ALL) return service.records;
    if (filter === NO_VEHICLE) return service.records.filter((r) => !r.vehicle);
    return recordsForVehicle(service.records, filter);
  }, [service, filter]);

  const header = (
    <div className="mb-5 flex flex-wrap items-center gap-4">
      <Link href={`/account/b2b/${accountId}`} className="link link-primary">
        ← Back to account
      </Link>
      <h1 className="text-base-content text-3xl font-semibold tracking-tight">Service</h1>
    </div>
  );

  if (error) {
    return (
      <div>
        {header}
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      </div>
    );
  }
  if (!service) {
    return (
      <div>
        {header}
        <div className="skeleton h-75" />
      </div>
    );
  }
  if (!service.enabled) {
    return (
      <div>
        {header}
        <div className="card border-base-300 items-center border p-8 text-center">
          <p className="text-base-content">This shop does not take service bookings online.</p>
        </div>
      </div>
    );
  }

  const hasUnfiled = service.records.some((r) => !r.vehicle);

  return (
    <div className="flex flex-col gap-8">
      <div>
        {header}
        {service.canBook ? (
          <FleetServiceBooking
            accountId={accountId}
            services={service.services}
            vehicles={service.vehicles}
            initialVehicleId={askedVehicle}
            onBooked={load}
          />
        ) : (
          <Alert color="info">
            You can see this account&rsquo;s service history. Booking is done by the account&rsquo;s
            buyers and main contact.
          </Alert>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base-content text-xl font-semibold">Service history</h2>
          {service.vehicles.length > 0 || hasUnfiled ? (
            <label className="flex flex-col gap-1">
              <span className="text-base-content text-sm font-medium">Vehicle</span>
              <NativeSelect value={filter} onChange={(e) => setFilter(e.currentTarget.value)}>
                <option value={ALL}>Every vehicle</option>
                {service.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
                {hasUnfiled ? <option value={NO_VEHICLE}>No vehicle named</option> : null}
              </NativeSelect>
            </label>
          ) : null}
        </div>
        {shown.length === 0 ? (
          <div className="card border-base-300 items-center border p-8 text-center">
            <p className="text-base-content">
              {filter === ALL
                ? 'No service has been booked on this account yet.'
                : 'No service has been booked for this vehicle yet.'}
            </p>
          </div>
        ) : (
          <ServiceRecordList
            records={shown}
            accountId={accountId}
            myOrderIds={service.myOrderIds}
            showVehicle={filter === ALL}
          />
        )}
      </section>
    </div>
  );
}
