'use client';

// One vehicle on the trade portal's Fleet page (sparx persona issue 086): what
// it is, a way to the parts that fit it, and, for the account's primary contact,
// change and remove. Its service history sits under it.

import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from '@wizeworks/silicaui-react';
import { vehicleDescription } from '@wizeworks/commerce-schemas';

import { partsThatFitHref, type PortalFleetVehicle } from '@/lib/fleet-client';

import { VehicleServiceHistory } from './vehicle-service-history';

export function FleetVehicleCard({
  vehicle,
  accountId,
  canEdit,
  onEdit,
  onRemove,
}: {
  vehicle: PortalFleetVehicle;
  accountId: string;
  canEdit: boolean;
  onEdit: () => void;
  onRemove: () => Promise<void>;
}) {
  const description = vehicleDescription(vehicle);
  const matchable = Boolean(vehicle.nodeId);

  return (
    <div className="card border-base-300 flex flex-col gap-3 border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base-content text-xl font-semibold">{vehicle.label}</h2>
          {description ? <p className="text-base-content m-0">{description}</p> : null}
        </div>
        {matchable ? (
          <Button render={<Link href={partsThatFitHref(vehicle.id)} />} color="primary">
            Parts that fit
          </Button>
        ) : null}
      </div>

      {vehicle.vin || vehicle.count > 1 || vehicle.notes ? (
        <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          {vehicle.vin ? (
            <>
              <dt className="text-base-content font-medium">VIN</dt>
              <dd className="m-0 font-mono break-all">{vehicle.vin}</dd>
            </>
          ) : null}
          {vehicle.count > 1 ? (
            <>
              <dt className="text-base-content font-medium">How many</dt>
              <dd className="m-0">{vehicle.count} like this one</dd>
            </>
          ) : null}
          {vehicle.notes ? (
            <>
              <dt className="text-base-content font-medium">Notes</dt>
              <dd className="m-0 whitespace-pre-line">{vehicle.notes}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {!matchable ? (
        <p className="text-base-content m-0">
          {canEdit
            ? 'Pick this vehicle from the shop’s list (change it, then choose its make, model and engine) so the shop can show the parts that fit it.'
            : 'The shop cannot match parts to this vehicle yet, because it was not picked from the shop’s list.'}
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button color="primary" variant="outline" onClick={onEdit}>
            Change
          </Button>
          <AlertDialog>
            <AlertDialogTrigger>
              <Button color="danger" variant="ghost">
                Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Remove {vehicle.label} from your fleet?</AlertDialogTitle>
              <AlertDialogDescription>
                {vehicle.displayName} will no longer be on this account, and the shop will stop
                marking the parts that fit it.
              </AlertDialogDescription>
              <div className="mt-4 flex justify-end gap-2">
                <AlertDialogClose>
                  <Button variant="ghost">Keep it</Button>
                </AlertDialogClose>
                <AlertDialogClose>
                  <Button color="danger" onClick={() => void onRemove()}>
                    Remove {vehicle.label}
                  </Button>
                </AlertDialogClose>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}

      {/* This vehicle's service history (sparx persona issue 086). Renders nothing
          when the shop does not take bookings. */}
      <VehicleServiceHistory accountId={accountId} vehicleId={vehicle.id} />
    </div>
  );
}
