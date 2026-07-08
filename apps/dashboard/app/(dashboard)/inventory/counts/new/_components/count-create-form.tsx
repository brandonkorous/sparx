'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Warehouse as WarehouseIcon } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  Input,
  Label,
  NativeSelect,
  Textarea,
} from 'silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';

import { createInventoryCountAction } from '../../../_lib/count-actions';
import { lookupVariantBySkuAction } from '../../../_lib/supplier-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

interface PartyOption {
  id: string;
  name: string;
  code: string;
}

interface PickedVariant {
  variantId: string;
  sku: string;
  title: string | null;
}

// New-count form on the standard create surface (docs/86 F layout, WS2). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// Single-step form. Pick the warehouse + type (cycle covers chosen SKUs, full
// snapshots every level), set the approval threshold, and — for a cycle — add the
// variants by SKU. Counts have no @detail drawer (the count detail is where
// quantities are entered, a full-page surface), so on success we navigate there.
// Fields stay an uncontrolled native form, so the frame primary bridges to it via
// requestSubmit().

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

interface CountCreateFormProps {
  surface: 'page' | 'overlay';
  warehouses: PartyOption[];
}

export function CountCreateForm({ surface, warehouses }: CountCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [type, setType] = React.useState<'cycle' | 'full'>('cycle');
  const [variants, setVariants] = React.useState<PickedVariant[]>([]);

  const formRef = React.useRef<HTMLFormElement>(null);
  const [fieldsDirty, setFieldsDirty] = React.useState(false);
  const recomputeDirty = React.useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const get = (k: string) => {
      const v = data.get(k);
      return typeof v === 'string' ? v.trim() : '';
    };
    setFieldsDirty(get('threshold') !== '' || get('note') !== '');
  }, []);
  const dirty = variants.length > 0 || type !== 'cycle' || fieldsDirty;
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'count' });

  function addVariant(v: PickedVariant) {
    setVariants((prev) => (prev.some((p) => p.variantId === v.variantId) ? prev : [...prev, v]));
  }
  function removeVariant(variantId: string) {
    setVariants((prev) => prev.filter((p) => p.variantId !== variantId));
  }

  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/inventory/counts');
    }
  }, [surface, pathname, searchParams, router]);

  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const warehouseId = str(form.get('warehouseId'));
    if (!warehouseId) {
      setError('Choose a warehouse.');
      return;
    }
    const threshold = str(form.get('threshold'));
    const input = {
      warehouseId,
      type,
      ...(threshold ? { approvalThresholdCents: Math.round(Number(threshold) * 100) } : {}),
      ...nonEmpty('note', form),
      ...(type === 'cycle' ? { variantIds: variants.map((v) => v.variantId) } : {}),
    };

    startTransition(async () => {
      const result = await createInventoryCountAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/inventory/counts/${result.data.id}`);
      router.refresh();
    });
  }

  // Guard: a count is scoped to one warehouse, so at least one is required.
  if (warehouses.length === 0) {
    return (
      <ModuleProvider module="inventory" className="h-full">
        <div className="flex h-full items-center justify-center p-8">
          <Card className="w-full max-w-lg">
            <EmptyState
              icon={<WarehouseIcon className="h-5 w-5" />}
              title="Add a warehouse first"
              description="A count is scoped to one warehouse. Create one, then come back to start counting."
              actions={
                <Button
                  color="module"
                  iconStart={<Plus className="h-4 w-4" />}
                  render={<Link href="/inventory/warehouses/new" />}
                >
                  New warehouse
                </Button>
              }
            />
          </Card>
        </div>
      </ModuleProvider>
    );
  }

  return (
    <ModuleProvider module="inventory" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New count"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Count details',
            supporting:
              'Reconcile stock against a physical count. A cycle count covers the SKUs you pick; a full count snapshots every level in the warehouse.',
          }}
          actions={{
            onNext: () => formRef.current?.requestSubmit(),
            nextLabel: 'Start count',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <form
            ref={formRef}
            onSubmit={onSubmit}
            onInput={recomputeDirty}
            onChange={recomputeDirty}
            className="contents"
          >
            <div className="flex flex-col gap-6">
              <Card>
                <CardBody>
                  <div className="flex flex-col gap-1">
                    <CardTitle>Count details</CardTitle>
                    <p className="opacity-70">
                      A count is scoped to one warehouse. Choose how much to count and the variance
                      value above which a manager must approve before it posts.
                    </p>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-row flex-wrap gap-3">
                      <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
                        <Label htmlFor="warehouseId">Warehouse</Label>
                        <NativeSelect
                          id="warehouseId"
                          name="warehouseId"
                          defaultValue={warehouses[0]?.id}
                        >
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.code})
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                        <Label htmlFor="type">Type</Label>
                        <NativeSelect
                          id="type"
                          value={type}
                          onChange={(e) => setType(e.target.value === 'full' ? 'full' : 'cycle')}
                        >
                          <option value="cycle">Cycle — chosen SKUs</option>
                          <option value="full">Full — every level in the warehouse</option>
                        </NativeSelect>
                      </div>
                      <div className="flex min-w-[10rem] flex-col gap-1">
                        <Label htmlFor="threshold">Approval over ($)</Label>
                        <Input id="threshold" name="threshold" type="number" placeholder="50.00" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="note">Note</Label>
                      <Textarea id="note" name="note" rows={2} />
                    </div>

                    {error && (
                      <p className="text-danger text-sm" role="alert" aria-live="polite">
                        {error}
                      </p>
                    )}
                  </div>
                </CardBody>
              </Card>

              {type === 'cycle' ? (
                <CyclePicker
                  variants={variants}
                  onAdd={addVariant}
                  onRemove={removeVariant}
                  busy={pending}
                />
              ) : (
                <Card>
                  <CardBody>
                    <p className="text-base-content/70 py-2 text-sm">
                      A full count snapshots every active level in the warehouse — you&apos;ll enter
                      a counted quantity for each on the next screen.
                    </p>
                  </CardBody>
                </Card>
              )}
            </div>
          </form>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}

function CyclePicker({
  variants,
  onAdd,
  onRemove,
  busy,
}: {
  variants: PickedVariant[];
  onAdd: (v: PickedVariant) => void;
  onRemove: (variantId: string) => void;
  busy: boolean;
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-1">
          <CardTitle>Items to count</CardTitle>
          <p className="opacity-70">
            Add the variants to count by SKU. You can also add more once the count is open.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {variants.length === 0 ? (
            <p className="text-base-content/70 text-sm">
              No items yet — add a SKU below, or start empty and add them on the next screen.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {variants.map((v) => (
                <div
                  key={v.variantId}
                  className="flex flex-row flex-wrap items-center gap-3 rounded border border-[var(--color-border-default)] px-3 py-2"
                >
                  <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
                    <p className="text-sm font-medium">{v.title ?? v.sku}</p>
                    <p className="text-base-content/70 font-mono text-xs">{v.sku}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => onRemove(v.variantId)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <SkuAddRow onAdd={onAdd} disabled={busy} />
        </div>
      </CardBody>
    </Card>
  );
}

function SkuAddRow({ onAdd, disabled }: { onAdd: (v: PickedVariant) => void; disabled?: boolean }) {
  const [value, setValue] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function add() {
    const sku = value.trim();
    if (!sku) {
      setError('Enter a variant SKU.');
      return;
    }
    setError(null);
    setBusy(true);
    void (async () => {
      const lookup = await lookupVariantBySkuAction(sku);
      if (!lookup.ok) {
        setError(`No variant found for SKU "${sku}".`);
        setBusy(false);
        return;
      }
      onAdd({
        variantId: lookup.data.variantId,
        sku: lookup.data.sku,
        title: lookup.data.productTitle,
      });
      setValue('');
      setBusy(false);
    })();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row flex-wrap items-end gap-3 rounded border border-dashed border-[var(--color-border-default)] p-3">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <Label htmlFor="count-add-sku">Variant SKU</Label>
          <Input
            id="count-add-sku"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. FUEL-FILTER-1"
          />
        </div>
        <Button color="module" type="button" onClick={add} disabled={busy || disabled}>
          {busy ? 'Adding…' : 'Add item'}
        </Button>
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}

function nonEmpty(name: string, form: FormData): Record<string, string> {
  const value = str(form.get(name));
  return value ? { [name]: value } : {};
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}
