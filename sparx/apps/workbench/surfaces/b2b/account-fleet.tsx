'use client';

// A trade account's fleet, on the account pane (sparx persona issue 086).
//
// The vehicles this business runs. Each is picked from the shop's own fitment
// list (Make, Model, Engine, whatever levels the list has), because that is what
// parts are matched on: the business's buyers see "Fits your fleet" on the parts
// that fit, and those parts first, on the shop's website, and a warning on a
// product page that fits none of them.
//
// Saved one vehicle at a time, straight away, like the contacts above it: a
// vehicle keeps its id through every change, and the service history linked to
// that id stays with it. The fleet size (a number on the account's own record)
// is passed in as `sizeField` so it stays part of the pane's one Save.

import { useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  Select,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import {
  chooseLevelLabel,
  vehicleDescription,
  vehicleLabel,
  type FleetVehicle,
} from '@wizeworks/commerce-schemas';
import { api } from '../../lib/api/client';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  levelDimensions,
  useFitmentDomains,
  useFitmentNodes,
  type FitmentDomain,
} from '../commerce/fitment-data';
import { accountErrorMessage, accountKeys } from './accounts-data';
import { fleetListState, type FleetListState } from './fleet-list-state';
import { UnfiledServiceRecords, VehicleServiceRecords } from './vehicle-service-records';

/* ── Data ───────────────────────────────────────────────────────────────── */

/** One vehicle as the console reads it: the shared `FleetVehicle` plus where it
 *  sits in the fitment list. */
export interface StaffFleetVehicle extends FleetVehicle {
  nodeIdPath: string[];
  domainName: string | null;
}

/** What the vehicle form sends. Blank fields clear. */
interface VehicleForm {
  label: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  notes: string;
  domainId: string;
  nodeId: string;
}

const fleetKey = (accountId: string) => [...accountKeys.detail(accountId), 'fleet'] as const;

export function useAccountFleet(accountId: string) {
  return useQuery({
    queryKey: fleetKey(accountId),
    queryFn: () =>
      api.get<{ vehicles: StaffFleetVehicle[] }>(`/v1/b2b/accounts/${accountId}/fleet`),
  });
}

function useFleetWrites(accountId: string) {
  const queryClient = useQueryClient();
  // The account read carries the fleet too, so both refresh.
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: accountKeys.detail(accountId) });
  };
  const add = useMutation({
    mutationFn: (form: VehicleForm) =>
      api.post(`/v1/b2b/accounts/${accountId}/fleet/vehicles`, form),
    onSuccess,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; form: VehicleForm }) =>
      api.put(`/v1/b2b/accounts/${accountId}/fleet/vehicles/${input.id}`, input.form),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/b2b/accounts/${accountId}/fleet/vehicles/${id}`),
    onSuccess,
  });
  return { add, update, remove };
}

function formFrom(v: StaffFleetVehicle | null): VehicleForm {
  return {
    label: v?.label ?? '',
    year: v?.year ? String(v.year) : '',
    make: v?.make ?? '',
    model: v?.model ?? '',
    vin: v?.vin ?? '',
    notes: v?.notes ?? '',
    domainId: v?.domainId ?? '',
    nodeId: v?.nodeId ?? '',
  };
}

/* ── The section ────────────────────────────────────────────────────────── */

export function AccountFleet({
  ctx,
  accountId,
  sizeField,
}: {
  ctx: SurfaceContext;
  accountId: string;
  /** The account's fleet size field, which saves with the pane. */
  sizeField: React.ReactNode;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const fleetQuery = useAccountFleet(accountId);
  const domainsQuery = useFitmentDomains();
  const writes = useFleetWrites(accountId);
  // 'new' to add, a vehicle id to change one, null when not editing.
  const [editing, setEditing] = useState<string | null>(null);

  const vehicles = fleetQuery.data?.vehicles ?? [];
  const lists = (domainsQuery.data ?? []).filter((d) => levelDimensions(d).length > 0);
  const editingVehicle =
    editing && editing !== 'new' ? (vehicles.find((v) => v.id === editing) ?? null) : null;

  const onRemove = async (vehicle: StaffFleetVehicle) => {
    const ok = await confirm({
      title: `Remove ${vehicle.label} from this fleet?`,
      description: `${vehicleLabel(vehicle)} comes off this account, and its buyers stop seeing which parts fit it.`,
      confirmLabel: `Remove ${vehicle.label}`,
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    writes.remove.mutate(vehicle.id, {
      onSuccess: () => {
        toast.add({ title: `${vehicle.label} removed`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: `Could not remove ${vehicle.label}`,
          description: accountErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <FormSection
      title="Their fleet"
      description="The vehicles this business runs. On your website their buyers see “Fits your fleet” on the parts that fit them, and those parts first."
      action={
        editing === null ? (
          <Button
            size="sm"
            color="module"
            onClick={() => {
              setEditing('new');
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add a vehicle
          </Button>
        ) : null
      }
    >
      {sizeField}

      {editing !== null ? (
        <VehicleEditor
          key={editing}
          vehicle={editingVehicle}
          lists={lists}
          listState={fleetListState(
            { isPending: domainsQuery.isPending, isError: domainsQuery.isError },
            lists.length
          )}
          onRetryLists={() => {
            void domainsQuery.refetch();
          }}
          saving={writes.add.isPending || writes.update.isPending}
          onCancel={() => {
            setEditing(null);
          }}
          onSave={(form) => {
            const done = {
              onSuccess: () => {
                setEditing(null);
                toast.add({
                  title: editingVehicle ? `${form.label} saved` : `${form.label} added`,
                  type: 'success',
                });
              },
              onError: (error: unknown) => {
                toast.add({
                  title: 'Could not save that vehicle',
                  description: accountErrorMessage(error, 'Nothing was changed.'),
                  type: 'error',
                });
              },
            };
            if (editingVehicle) writes.update.mutate({ id: editingVehicle.id, form }, done);
            else writes.add.mutate(form, done);
          }}
        />
      ) : null}

      {fleetQuery.isError ? (
        <Text className="text-sm">Their vehicles could not be loaded just now.</Text>
      ) : fleetQuery.isPending ? (
        <Text className="text-sm" role="status">
          Loading their vehicles…
        </Text>
      ) : vehicles.length === 0 ? (
        editing === null ? (
          <Text>
            No vehicles yet. Add the trucks and machines this business runs, with their year, make,
            model and engine, and their buyers will see on your website which of your parts fit
            them, with those parts first.
          </Text>
        ) : null
      ) : (
        <ul className="flex flex-col gap-3">
          {vehicles
            .filter((v) => v.id !== editing)
            .map((vehicle) => (
              <li
                key={vehicle.id}
                className="border-base-300 flex flex-col gap-2 border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                    <span className="font-medium">{vehicle.label}</span>
                    {vehicleDescription(vehicle) ? (
                      <Text as="span" className="text-sm">
                        {vehicleDescription(vehicle)}
                        {vehicle.count > 1 ? `, ${String(vehicle.count)} like this one` : ''}
                      </Text>
                    ) : null}
                    {vehicle.vin ? (
                      <Text as="span" className="font-mono text-sm break-all">
                        VIN {vehicle.vin}
                      </Text>
                    ) : null}
                    {vehicle.notes ? (
                      <Text as="span" className="text-sm whitespace-pre-line">
                        {vehicle.notes}
                      </Text>
                    ) : null}
                    {!vehicle.nodeId ? (
                      <Text as="span" className="text-warning text-sm">
                        Not picked from your fitment list, so no parts are matched to it.
                      </Text>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      color="module"
                      variant="outline"
                      onClick={() => {
                        setEditing(vehicle.id);
                      }}
                    >
                      <Pencil className="size-4" aria-hidden />
                      Change
                    </Button>
                    <Button
                      size="sm"
                      color="danger"
                      variant="ghost"
                      aria-label={`Remove ${vehicle.label}`}
                      loading={writes.remove.isPending && writes.remove.variables === vehicle.id}
                      onClick={() => {
                        void onRemove(vehicle);
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
                {/* This vehicle's service visits (sparx persona issue 086). */}
                <VehicleServiceRecords ctx={ctx} companyId={accountId} vehicleId={vehicle.id} />
              </li>
            ))}
        </ul>
      )}
      {/* Visits on the account that name no vehicle yet (sparx persona issue 086). */}
      <UnfiledServiceRecords ctx={ctx} companyId={accountId} />
    </FormSection>
  );
}

/* ── Add / change one vehicle ───────────────────────────────────────────── */

function VehicleEditor({
  vehicle,
  lists,
  listState,
  onRetryLists,
  saving,
  onSave,
  onCancel,
}: {
  vehicle: StaffFleetVehicle | null;
  lists: FitmentDomain[];
  listState: FleetListState;
  onRetryLists: () => void;
  saving: boolean;
  onSave: (form: VehicleForm) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<VehicleForm>(() => formFrom(vehicle));
  const [domainId, setDomainId] = useState(vehicle?.domainId ?? '');
  const [chain, setChain] = useState<string[]>(vehicle?.nodeIdPath ?? []);
  const [byHand, setByHand] = useState(Boolean(vehicle && !vehicle.nodeId));
  const initial = formFrom(vehicle);
  const dirty =
    JSON.stringify(form) !== JSON.stringify(initial) ||
    (chain[chain.length - 1] ?? '') !== initial.nodeId;
  useDirtySource(dirty, 'a vehicle you have not saved yet');

  const list = lists.find((l) => l.id === domainId) ?? lists[0] ?? null;
  const levels = list ? levelDimensions(list) : [];
  const noList = listState === 'none';
  // A list that could not be read is not a list the shop lacks: the vehicle can
  // still be typed in by hand, but nothing here may say there is no list.
  const listFailed = listState === 'failed';
  const manual = byHand || noList || listFailed;

  function set<K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const submit = () => {
    const nodeId = manual ? '' : (chain[chain.length - 1] ?? '');
    onSave({
      ...form,
      // Only a picked entry ties the vehicle to the list. A list with nothing
      // picked would match every part in it.
      domainId: nodeId && list ? list.id : '',
      nodeId,
      make: manual ? form.make : '',
      model: manual ? form.model : '',
    });
  };

  return (
    <div className="border-base-300 rounded-box flex flex-col gap-4 border p-4">
      <Heading level={3} className="text-base font-semibold">
        {vehicle ? `Change ${vehicle.label}` : 'Add a vehicle'}
      </Heading>

      <div className="grid grid-cols-[2fr_1fr] gap-3 max-sm:grid-cols-1">
        <Field>
          <FieldLabel>Name or unit number</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                maxLength={127}
                value={form.label}
                onChange={(event) => {
                  set('label', event.target.value);
                }}
              />
            }
          />
        </Field>
        <Field>
          <FieldLabel>Model year</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                inputMode="numeric"
                maxLength={4}
                className="tabular-nums"
                value={form.year}
                onChange={(event) => {
                  set('year', event.target.value.replace(/\D/g, ''));
                }}
              />
            }
          />
        </Field>
      </div>

      {listState === 'loading' ? (
        <Text className="text-sm" role="status">
          Loading your fitment list…
        </Text>
      ) : manual ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Field>
              <FieldLabel>Make</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    maxLength={60}
                    value={form.make}
                    onChange={(event) => {
                      set('make', event.target.value);
                    }}
                  />
                }
              />
            </Field>
            <Field>
              <FieldLabel>Model</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    maxLength={60}
                    value={form.model}
                    onChange={(event) => {
                      set('model', event.target.value);
                    }}
                  />
                }
              />
            </Field>
          </div>
          <Text className="text-sm">
            {listFailed
              ? 'Your fitment list could not be loaded just now, so for now this vehicle can only be typed in by hand and no parts are matched to it.'
              : noList
                ? 'You have no fitment list yet, so this vehicle is kept by its make and model but no parts can be matched to it. Set up a list under Fitment to match parts.'
                : 'A vehicle typed in by hand is kept on the fleet, but no parts are matched to it.'}{' '}
            {listFailed ? (
              <Button size="sm" variant="link" color="module" onClick={onRetryLists}>
                Try loading it again
              </Button>
            ) : !noList ? (
              <Button
                size="sm"
                variant="link"
                color="module"
                onClick={() => {
                  setByHand(false);
                }}
              >
                Pick it from your fitment list instead
              </Button>
            ) : null}
          </Text>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lists.length > 1 ? (
            <Field>
              <FieldLabel>Which list</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-sm">
                    <Select
                      color="module"
                      aria-label="Which list"
                      value={list?.id ?? ''}
                      items={lists.map((l) => ({ value: l.id, label: l.displayName }))}
                      onValueChange={(next) => {
                        setDomainId((next as string | null) ?? '');
                        setChain([]);
                      }}
                    />
                  </div>
                }
              />
            </Field>
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
            {list
              ? levels.map((dim, i) => {
                  const parentId = i === 0 ? null : (chain[i - 1] ?? null);
                  if (i > 0 && !parentId) return null;
                  return (
                    <LevelSelect
                      key={`${dim.key}-${parentId ?? 'root'}`}
                      domainId={list.id}
                      parentId={parentId}
                      label={dim.label}
                      value={chain[i] ?? ''}
                      onPick={(id) => {
                        setChain((c) => (id ? [...c.slice(0, i), id] : c.slice(0, i)));
                      }}
                    />
                  );
                })
              : null}
          </div>
          <Text className="text-sm">
            Pick down to the engine if you can: that is what parts are matched on.{' '}
            <Button
              size="sm"
              variant="link"
              color="module"
              onClick={() => {
                setByHand(true);
                setChain([]);
              }}
            >
              It is not in the list
            </Button>
          </Text>
        </div>
      )}

      <Field>
        <FieldLabel>VIN</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              maxLength={17}
              className="max-w-sm font-mono"
              value={form.vin}
              placeholder="17 letters and numbers"
              onChange={(event) => {
                set('vin', event.target.value.toUpperCase());
              }}
            />
          }
        />
        <FieldDescription>Optional.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Notes</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={2}
              maxLength={2000}
              value={form.notes}
              onChange={(event) => {
                set('notes', event.target.value);
              }}
            />
          }
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          color="module"
          loading={saving}
          disabled={form.label.trim() === ''}
          onClick={submit}
        >
          {vehicle ? 'Save vehicle' : 'Add vehicle'}
        </Button>
        <Button variant="ghost" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** One level of the fitment list (Make, Model, Engine) under the entry picked
 *  above it. Hidden when there is nothing deeper to pick. */
function LevelSelect({
  domainId,
  parentId,
  label,
  value,
  onPick,
}: {
  domainId: string;
  parentId: string | null;
  label: string;
  value: string;
  onPick: (id: string) => void;
}) {
  const nodes = useFitmentNodes(domainId, parentId);
  if (parentId && nodes.data && nodes.data.length === 0) return null;
  const items = [
    { value: '', label: chooseLevelLabel(label) },
    ...(nodes.data ?? []).map((n) => ({ value: n.id, label: n.name })),
  ];
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl
        render={
          <Select
            color="module"
            aria-label={label}
            disabled={nodes.isPending}
            value={value}
            items={items}
            onValueChange={(next) => {
              onPick((next as string | null) ?? '');
            }}
          />
        }
      />
    </Field>
  );
}
