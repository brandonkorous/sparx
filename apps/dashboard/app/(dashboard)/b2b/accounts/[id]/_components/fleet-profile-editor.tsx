'use client';

// Fleet editor — add/edit the vehicles (or patients, devices, …) an account
// operates. Fitment is GENERALIZED: a domain declares an ordered list of
// DIMENSIONS (each a `level` tier or a `range` axis). For each `level` we drill
// the node tree one step at a time (each pick loads that node's children via
// listFitmentNodesAction); for each `range` we show a numeric input. We store
// the deepest selected nodeId + a value per range dimension — no hardcoded
// Make/Model/Engine/Year, the dimension labels come straight from the domain.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  ModuleProvider,
  NativeSelect,
  Label,
  Spinner,
  Stack,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';
import { Plus, Trash2, Truck } from 'lucide-react';

import {
  listFitmentDomainsAction,
  listFitmentNodesAction,
  type FitmentDimension,
  type FitmentDomainRow,
  type FitmentNodeRow,
} from '../../../../commerce/fitment-actions';
import { updateFleetVehicles, type FleetVehiclePayload } from '../../_lib/actions';

// A fleet vehicle as held in editor state. `nodeId` is the deepest level picked;
// `nodePath` mirrors the chosen node names (root → self) for the list label;
// `rangeValues` carries one numeric value per range dimension.
interface FleetVehicle {
  label: string;
  vin?: string;
  domainId: string;
  domainName: string;
  nodeId: string | null;
  nodePath: string[];
  rangeValues: { dimensionKey: string; value: number }[];
  mileage?: number;
  notes?: string;
  count: number;
}

// The server may hand back resolved vehicles (with nodeName/nodePath/ranges) or,
// for older rows, just the raw stored shape. Accept both.
export interface FleetVehicleView {
  label?: string;
  vin?: string;
  domainId?: string;
  domainName?: string | null;
  nodeId?: string | null;
  nodeName?: string | null;
  nodePath?: string[];
  rangeValues?: { dimensionKey: string; value: number }[];
  ranges?: { dimensionKey: string; label: string; unit: string | null; value: number }[];
  mileage?: number;
  notes?: string;
  count?: number;
}

interface FleetProfileEditorProps {
  accountId: string;
  initialVehicles: FleetVehicleView[];
}

function toEditorVehicle(v: FleetVehicleView): FleetVehicle {
  return {
    label: v.label ?? 'Vehicle',
    vin: v.vin,
    domainId: v.domainId ?? '',
    domainName: v.domainName ?? '',
    nodeId: v.nodeId ?? null,
    nodePath: v.nodePath ?? (v.nodeName ? [v.nodeName] : []),
    rangeValues:
      v.rangeValues ??
      v.ranges?.map((r) => ({ dimensionKey: r.dimensionKey, value: r.value })) ??
      [],
    mileage: v.mileage,
    notes: v.notes,
    count: v.count ?? 1,
  };
}

function vehicleSummary(v: FleetVehicle, domain?: FitmentDomainRow): string {
  const path = v.nodePath.join(' / ');
  const ranges = v.rangeValues
    .map((rv) => {
      const dim = domain?.dimensions.find((d) => d.key === rv.dimensionKey);
      const unit = dim?.unit ? ` ${dim.unit}` : '';
      return `${dim?.label ?? rv.dimensionKey} ${rv.value}${unit}`;
    })
    .join(' · ');
  return [path, ranges].filter(Boolean).join(' — ') || v.domainName || 'Whole domain';
}

export function FleetProfileEditor({ accountId, initialVehicles }: FleetProfileEditorProps) {
  const router = useRouter();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>(() =>
    initialVehicles.map(toEditorVehicle)
  );
  const [saving, setSaving] = useState(false);

  const [domains, setDomains] = useState<FitmentDomainRow[]>([]);
  const [domainsLoaded, setDomainsLoaded] = useState(false);

  // Load the tenant's fitment domains once the editor opens.
  useEffect(() => {
    if (!open || domainsLoaded) return;
    let cancelled = false;
    void listFitmentDomainsAction().then((res) => {
      if (cancelled) return;
      if (res.ok) setDomains(res.data);
      setDomainsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, domainsLoaded]);

  function removeVehicle(idx: number) {
    const target = vehicles[idx];
    if (!target) return;
    void (async () => {
      const ok = await confirm({
        title: `Remove "${target.label}"?`,
        description: 'This vehicle will be removed from the fleet when you save.',
        confirmLabel: 'Remove',
        tone: 'danger',
      });
      if (!ok) return;
      setVehicles((prev) => prev.filter((_, i) => i !== idx));
    })();
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: FleetVehiclePayload[] = vehicles.map((v) => ({
        label: v.label,
        ...(v.vin ? { vin: v.vin } : {}),
        domainId: v.domainId,
        nodeId: v.nodeId,
        ...(v.rangeValues.length > 0 ? { rangeValues: v.rangeValues } : {}),
        ...(v.mileage !== undefined ? { mileage: v.mileage } : {}),
        ...(v.notes ? { notes: v.notes } : {}),
        count: v.count,
      }));
      const fleetSize = vehicles.reduce((sum, v) => sum + v.count, 0);
      const { error } = await updateFleetVehicles(accountId, payload, fleetSize);
      if (error) {
        toast.error(error);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const domainById = new Map(domains.map((d) => [d.id, d]));

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Truck className="mr-1 h-4 w-4" />
        Edit fleet
      </Button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModuleProvider module="b2b">
          <ModalContent className="max-w-2xl">
            <ModalHeader>
              <ModalTitle>Fleet</ModalTitle>
            </ModalHeader>

            <Stack gap={3} className="max-h-96 overflow-y-auto">
              {!domainsLoaded ? (
                <div className="flex items-center gap-2 py-8 text-[var(--color-text-muted)]">
                  <Spinner className="h-4 w-4" /> Loading fitment…
                </div>
              ) : domains.length === 0 ? (
                <Text size="sm" variant="muted" className="py-4 text-center">
                  No fitment domains installed. Install one from the Fitment surface to build a
                  fleet.
                </Text>
              ) : vehicles.length === 0 ? (
                <Text size="sm" variant="muted" className="py-4 text-center">
                  No vehicles in fleet yet.
                </Text>
              ) : (
                vehicles.map((v, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <Stack direction="row" align="center" gap={2} wrap>
                        <Text size="sm" className="font-medium">
                          {v.label}
                        </Text>
                        <Badge color="module" variant="soft">
                          ×{v.count}
                        </Badge>
                      </Stack>
                      <Text size="sm" variant="muted" className="truncate">
                        {vehicleSummary(v, domainById.get(v.domainId))}
                      </Text>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      color="danger"
                      onClick={() => removeVehicle(idx)}
                      aria-label={`Remove ${v.label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </Stack>

            {domains.length > 0 && (
              <AddVehicleForm
                domains={domains}
                onAdd={(v) => setVehicles((prev) => [...prev, v])}
              />
            )}

            <ModalFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button color="module" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save fleet'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </ModuleProvider>
      </Modal>
    </>
  );
}

// ─── Add-vehicle sub-form (generic dimension-driven node drill) ──────────

interface AddVehicleFormProps {
  domains: FitmentDomainRow[];
  onAdd: (vehicle: FleetVehicle) => void;
}

function AddVehicleForm({ domains, onAdd }: AddVehicleFormProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [count, setCount] = useState('1');
  const [domainId, setDomainId] = useState(domains[0]?.id ?? '');

  // One picked node id per level dimension (index = level depth), plus the
  // children loaded for the NEXT level to pick.
  const [levelPicks, setLevelPicks] = useState<(FitmentNodeRow | null)[]>([]);
  const [levelOptions, setLevelOptions] = useState<FitmentNodeRow[][]>([]);
  const [loadingLevel, setLoadingLevel] = useState<number | null>(null);

  // One numeric value (as a string) per range dimension key.
  const [rangeInputs, setRangeInputs] = useState<Record<string, string>>({});

  const domain = domains.find((d) => d.id === domainId);
  const levelDims: FitmentDimension[] = domain?.dimensions.filter((d) => d.kind === 'level') ?? [];
  const rangeDims: FitmentDimension[] = domain?.dimensions.filter((d) => d.kind === 'range') ?? [];

  // Reset + load the first level whenever the domain changes (or the form opens).
  useEffect(() => {
    if (!open || !domainId) return;
    let cancelled = false;
    setLevelPicks([]);
    setLevelOptions([]);
    setRangeInputs({});
    setLoadingLevel(0);
    void listFitmentNodesAction(domainId, null).then((res) => {
      if (cancelled) return;
      setLevelOptions(res.ok ? [res.data] : [[]]);
      setLoadingLevel(null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, domainId]);

  // Pick a node at `level`; truncate deeper picks and load the next level's
  // children if there are more levels and this node has any.
  function pickLevel(level: number, nodeId: string) {
    const node = levelOptions[level]?.find((n) => n.id === nodeId) ?? null;
    setLevelPicks((prev) => {
      const next = prev.slice(0, level);
      next[level] = node;
      return next;
    });
    setLevelOptions((prev) => prev.slice(0, level + 1));

    if (!node || level + 1 >= levelDims.length || node.childCount === 0) return;
    setLoadingLevel(level + 1);
    void listFitmentNodesAction(domainId, node.id).then((res) => {
      setLevelOptions((prev) => {
        const next = prev.slice(0, level + 1);
        next[level + 1] = res.ok ? res.data : [];
        return next;
      });
      setLoadingLevel(null);
    });
  }

  function reset() {
    setLabel('');
    setCount('1');
    setLevelPicks([]);
    setLevelOptions([]);
    setRangeInputs({});
  }

  function handleAdd() {
    const picked = levelPicks.filter((p): p is FitmentNodeRow => Boolean(p));
    const deepest = picked.length > 0 ? picked[picked.length - 1] : null;
    const rangeValues = rangeDims
      .map((d) => ({ dimensionKey: d.key, raw: rangeInputs[d.key]?.trim() ?? '' }))
      .filter((r) => r.raw.length > 0 && Number.isFinite(Number(r.raw)))
      .map((r) => ({ dimensionKey: r.dimensionKey, value: Number(r.raw) }));

    onAdd({
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- `||` is intended: an empty trimmed label must fall through to the deepest node name, then the domain name, then the placeholder, which `??` would not do.
      label: label.trim() || deepest?.name || domain?.displayName || 'Vehicle',
      domainId,
      domainName: domain?.displayName ?? '',
      nodeId: deepest?.id ?? null,
      nodePath: picked.map((p) => p.name),
      rangeValues,
      count: Math.max(1, Number.parseInt(count, 10) || 1),
    });
    setOpen(false);
    reset();
  }

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        Add vehicle
      </Button>
      <ModuleProvider module="b2b">
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Add vehicle to fleet</ModalTitle>
          </ModalHeader>
          <Stack gap={4} className="max-h-[28rem] overflow-y-auto py-2">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="fleet-label">Label</Label>
                <Input
                  id="fleet-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Truck #14"
                />
              </div>
              <div className="w-24">
                <Label htmlFor="fleet-count">Count</Label>
                <Input
                  id="fleet-count"
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
            </div>

            {domains.length > 1 && (
              <div>
                <Label htmlFor="fleet-domain">Kind</Label>
                <NativeSelect
                  id="fleet-domain"
                  value={domainId}
                  onChange={(e) => setDomainId(e.target.value)}
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.displayName}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}

            {/* Level drill — one select per level dimension, generic over labels. */}
            {levelDims.map((dim, level) => {
              const options = levelOptions[level] ?? [];
              const enabled = level === 0 || Boolean(levelPicks[level - 1]);
              if (!enabled) return null;
              return (
                <div key={dim.key}>
                  <Label htmlFor={`fleet-level-${dim.key}`}>{dim.label}</Label>
                  <NativeSelect
                    id={`fleet-level-${dim.key}`}
                    value={levelPicks[level]?.id ?? ''}
                    onChange={(e) => pickLevel(level, e.target.value)}
                    disabled={loadingLevel === level || options.length === 0}
                  >
                    <option value="">{level === 0 ? 'Select…' : 'Any'}</option>
                    {options.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              );
            })}

            {/* Range axes — one numeric input per range dimension. */}
            {rangeDims.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {rangeDims.map((dim) => (
                  <div key={dim.key}>
                    <Label htmlFor={`fleet-range-${dim.key}`}>
                      {dim.label}
                      {dim.unit ? ` (${dim.unit})` : ''}
                    </Label>
                    <Input
                      id={`fleet-range-${dim.key}`}
                      inputMode="numeric"
                      value={rangeInputs[dim.key] ?? ''}
                      onChange={(e) =>
                        setRangeInputs((prev) => ({ ...prev, [dim.key]: e.target.value }))
                      }
                      placeholder="e.g. 2020"
                    />
                  </div>
                ))}
              </div>
            )}
          </Stack>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button color="module" onClick={handleAdd}>
              Add to fleet
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModuleProvider>
    </Modal>
  );
}
