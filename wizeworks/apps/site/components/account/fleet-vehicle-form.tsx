'use client';

// Add or change one vehicle on a trade account's fleet, from the portal (sparx
// persona issue 086).
//
// The vehicle is picked from the shop's own fitment list (Make, then Model, then
// Engine, whatever levels the shop set up), because that is what parts are
// matched against. A vehicle the list does not hold can still be added with its
// make and model typed in: it is on the fleet, it just cannot be matched to parts
// until the shop adds it to the list.

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, NativeSelect, Textarea } from '@wizeworks/silicaui-react';

import {
  FleetError,
  formFromVehicle,
  getFitmentEntries,
  getFitmentLists,
  type FitmentEntry,
  type FitmentList,
  type FleetVehicleForm as FormValues,
  type PortalFleetVehicle,
} from '@/lib/fleet-client';
import { chooseLevelLabel } from '@wizeworks/commerce-schemas';

function entriesKey(domainId: string, parentId: string | null): string {
  return `${domainId}:${parentId ?? 'root'}`;
}

export function FleetVehicleForm({
  tenantSlug,
  vehicle,
  onSave,
  onCancel,
}: {
  tenantSlug: string;
  /** The vehicle being changed, or null to add one. */
  vehicle: PortalFleetVehicle | null;
  onSave: (form: FormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormValues>(() => formFromVehicle(vehicle));
  const [lists, setLists] = useState<FitmentList[] | null>(null);
  const [domainId, setDomainId] = useState(vehicle?.domainId ?? '');
  // The picked entry at each level, top first.
  const [chain, setChain] = useState<string[]>(vehicle?.nodeIdPath ?? []);
  const [entries, setEntries] = useState<Record<string, FitmentEntry[]>>({});
  const asked = useRef(new Set<string>());
  // Typed by hand: not in the shop's list.
  const [byHand, setByHand] = useState(Boolean(vehicle && !vehicle.nodeId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getFitmentLists(tenantSlug)
      .then((all) => {
        if (!active) return;
        const usable = all.filter((l) => l.dimensions.some((d) => d.kind === 'level'));
        setLists(usable);
        if (usable.length === 0) setByHand(true);
        setDomainId((current) => current || (usable[0]?.id ?? ''));
      })
      .catch(() => {
        if (!active) return;
        setLists([]);
        setByHand(true);
      });
    return () => {
      active = false;
    };
  }, [tenantSlug]);

  const list = lists?.find((l) => l.id === domainId) ?? null;
  const levels = list?.dimensions.filter((d) => d.kind === 'level') ?? [];

  // Load the entries for every level that is open: the top level, and the level
  // under each picked entry.
  useEffect(() => {
    if (!domainId || byHand) return;
    const parents: (string | null)[] = [null, ...chain];
    for (const parentId of parents.slice(0, levels.length)) {
      const key = entriesKey(domainId, parentId);
      if (asked.current.has(key)) continue;
      asked.current.add(key);
      getFitmentEntries(tenantSlug, domainId, parentId)
        .then((rows) => setEntries((e) => ({ ...e, [key]: rows })))
        .catch(() => setEntries((e) => ({ ...e, [key]: [] })));
    }
  }, [tenantSlug, domainId, chain, byHand, levels.length]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function pick(level: number, id: string) {
    setChain((c) => (id ? [...c.slice(0, level), id] : c.slice(0, level)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const nodeId = byHand ? '' : (chain[chain.length - 1] ?? '');
    try {
      await onSave({
        ...form,
        // Only a picked entry ties the vehicle to the list. A list with nothing
        // picked would match every part in it.
        domainId: nodeId ? domainId : '',
        nodeId,
        make: byHand ? form.make : '',
        model: byHand ? form.model : '',
      });
    } catch (err) {
      setError(err instanceof FleetError ? err.message : 'That did not save. Please try again.');
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="card border-base-300 flex flex-col gap-4 border p-5"
    >
      <h2 className="text-base-content text-xl font-semibold">
        {vehicle ? `Change ${vehicle.label}` : 'Add a vehicle'}
      </h2>

      <div className="grid grid-cols-[2fr_1fr] gap-4 max-[640px]:grid-cols-1">
        <label className="flex flex-col gap-1.5">
          <span className="text-base-content text-sm font-medium">Name or unit number</span>
          <Input
            required
            maxLength={127}
            value={form.label}
            onChange={(e) => set('label', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base-content text-sm font-medium">Model year</span>
          <Input
            inputMode="numeric"
            maxLength={4}
            value={form.year}
            onChange={(e) => set('year', e.target.value.replace(/\D/g, ''))}
          />
        </label>
      </div>

      {lists === null ? (
        <div className="skeleton h-12" />
      ) : byHand ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            <label className="flex flex-col gap-1.5">
              <span className="text-base-content text-sm font-medium">Make</span>
              <Input
                maxLength={60}
                value={form.make}
                onChange={(e) => set('make', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-base-content text-sm font-medium">Model</span>
              <Input
                maxLength={60}
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
              />
            </label>
          </div>
          {lists.length > 0 ? (
            <Alert color="info">
              <span>
                A vehicle typed in by hand is kept on your fleet, but the shop cannot match parts to
                it.{' '}
                <button type="button" className="link" onClick={() => setByHand(false)}>
                  Pick it from the shop&apos;s list instead
                </button>
              </span>
            </Alert>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lists.length > 1 ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-base-content text-sm font-medium">What kind of vehicle</span>
              <NativeSelect
                value={domainId}
                onChange={(e) => {
                  setDomainId(e.target.value);
                  setChain([]);
                }}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.displayName}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
            {levels.map((dim, i) => {
              const parentId = i === 0 ? null : (chain[i - 1] ?? null);
              if (i > 0 && !parentId) return null;
              const options = entries[entriesKey(domainId, parentId)];
              if (i > 0 && options?.length === 0) return null;
              return (
                <label key={dim.key} className="flex flex-col gap-1.5">
                  <span className="text-base-content text-sm font-medium">{dim.label}</span>
                  <NativeSelect
                    value={chain[i] ?? ''}
                    disabled={!options}
                    onChange={(e) => pick(i, e.target.value)}
                  >
                    <option value="">{chooseLevelLabel(dim.label)}</option>
                    {(options ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              );
            })}
          </div>
          <p className="text-base-content m-0 text-sm">
            Pick down to the engine if you can: that is what parts are matched on.{' '}
            <button
              type="button"
              className="link"
              onClick={() => {
                setByHand(true);
                setChain([]);
              }}
            >
              My vehicle is not in this list
            </button>
          </p>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-base-content text-sm font-medium">VIN (optional)</span>
        <Input
          maxLength={17}
          value={form.vin}
          onChange={(e) => set('vin', e.target.value.toUpperCase())}
          placeholder="17 letters and numbers"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-base-content text-sm font-medium">Notes (optional)</span>
        <Textarea
          rows={3}
          maxLength={2000}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </label>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" color="primary" disabled={busy}>
          {busy ? 'Saving…' : vehicle ? 'Save changes' : 'Add vehicle'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
