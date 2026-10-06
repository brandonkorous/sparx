'use client';

// The trade account's fleet, in the portal (sparx persona issue 086).
//
// The vehicles the business runs, each with a way to the parts that fit it. The
// shop uses this list to mark "Fits your fleet" on its pages and to put those
// parts first. Every contact on the account can read it; the primary contact
// keeps it up to date.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Button } from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { FleetVehicleCard } from '@/components/account/fleet-vehicle-card';
import { FleetVehicleForm } from '@/components/account/fleet-vehicle-form';
import {
  addFleetVehicle,
  getFleet,
  removeFleetVehicle,
  updateFleetVehicle,
  type PortalFleet,
} from '@/lib/fleet-client';

export default function B2bFleetPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const [fleet, setFleet] = useState<PortalFleet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 'new' to add, a vehicle id to change one, null when not editing.
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => {
    getFleet(tenantSlug, accountId)
      .then((f) => {
        setFleet(f);
        setError(null);
      })
      .catch(() => setError('Your fleet could not be loaded just now.'));
  }, [tenantSlug, accountId]);

  useEffect(load, [load]);

  if (error && !fleet)
    return (
      <Alert color="danger" role="alert">
        {error}
      </Alert>
    );
  if (!fleet) return <div className="skeleton h-75" />;

  const { vehicles, canEdit } = fleet;
  const editingVehicle =
    editing && editing !== 'new' ? (vehicles.find((v) => v.id === editing) ?? null) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-base-content text-3xl font-semibold tracking-tight">Your fleet</h1>
          <p className="text-base-content m-0 max-w-2xl">
            The vehicles your business runs. The shop marks the parts that fit them with &ldquo;Fits
            your fleet&rdquo; and shows those parts first.
          </p>
        </div>
        {canEdit && editing === null ? (
          <Button color="primary" onClick={() => setEditing('new')}>
            Add a vehicle
          </Button>
        ) : null}
      </div>

      <Link href={`/account/b2b/${accountId}`} className="link link-primary self-start">
        Back to the account
      </Link>

      {notice ? (
        <Alert color="success" role="status">
          {notice}
        </Alert>
      ) : null}
      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      {editing !== null ? (
        <FleetVehicleForm
          key={editing}
          tenantSlug={tenantSlug}
          vehicle={editingVehicle}
          onCancel={() => setEditing(null)}
          onSave={async (form) => {
            const saved = editingVehicle
              ? await updateFleetVehicle(tenantSlug, accountId, editingVehicle.id, form)
              : await addFleetVehicle(tenantSlug, accountId, form);
            setEditing(null);
            setNotice(
              editingVehicle ? `${saved.label} is saved.` : `${saved.label} is on your fleet.`
            );
            load();
          }}
        />
      ) : null}

      {vehicles.length === 0 && editing === null ? (
        <div className="card border-base-300 flex flex-col gap-2 border p-6">
          <h2 className="text-base-content text-xl font-semibold">No vehicles yet</h2>
          <p className="text-base-content m-0 max-w-2xl">
            Add the trucks and machines your business runs, by name or unit number, with their year,
            make, model and engine. The shop will then mark the parts that fit them and show those
            parts first, and warn you when a part fits none of them.
          </p>
          {!canEdit ? (
            <p className="text-base-content m-0 max-w-2xl">
              The main contact on this account can add them, or ask the shop to.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {vehicles
          .filter((v) => v.id !== editing)
          .map((v) => (
            <FleetVehicleCard
              key={v.id}
              vehicle={v}
              accountId={accountId}
              canEdit={canEdit}
              onEdit={() => {
                setNotice(null);
                setEditing(v.id);
              }}
              onRemove={async () => {
                try {
                  await removeFleetVehicle(tenantSlug, accountId, v.id);
                  setNotice(`${v.label} is no longer on your fleet.`);
                  load();
                } catch {
                  setError(`${v.label} could not be removed just now. Please try again.`);
                }
              }}
            />
          ))}
      </div>
    </div>
  );
}
