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
} from 'silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';

import { createLotBatchAction } from '../../../_lib/lot-actions';
import { lookupVariantBySkuAction } from '../../../_lib/supplier-actions';
import { HAZMAT_OPTIONS } from '../../_components/types';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface PickedVariant {
  variantId: string;
  sku: string;
  title: string | null;
}

// New-lot form on the standard create surface (docs/86 F layout, WS2). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// Single-step form. Resolve the item by SKU, pick the warehouse, and record the
// batch (lot number, quantity, manufactured/expiry dates, hazmat, supplier ref).
// Lots have no @detail drawer (the lot detail manages serials + recalls full-page),
// so on success we navigate there. The fields stay an uncontrolled native form, so
// the frame's toolbar primary bridges to it via requestSubmit().

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

interface LotCreateFormProps {
  surface: 'page' | 'overlay';
  warehouses: WarehouseOption[];
}

export function LotCreateForm({ surface, warehouses }: LotCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [variant, setVariant] = React.useState<PickedVariant | null>(null);

  const formRef = React.useRef<HTMLFormElement>(null);
  const [fieldsDirty, setFieldsDirty] = React.useState(false);
  const recomputeDirty = React.useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const str = (k: string) => {
      const v = data.get(k);
      return typeof v === 'string' ? v.trim() : '';
    };
    setFieldsDirty(
      str('lotNumber') !== '' ||
        (str('quantity') !== '' && str('quantity') !== '0') ||
        str('manufacturedAt') !== '' ||
        str('expiresAt') !== '' ||
        str('hazmatClass') !== 'none' ||
        str('supplierBatchRef') !== ''
    );
  }, []);
  const dirty = variant !== null || fieldsDirty;
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'lot' });

  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/inventory/lots');
    }
  }, [surface, pathname, searchParams, router]);

  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!variant) {
      setError('Resolve an item by SKU first.');
      return;
    }
    const form = new FormData(e.currentTarget);
    const warehouseId = str(form.get('warehouseId'));
    const lotNumber = str(form.get('lotNumber'));
    if (!warehouseId || !lotNumber) {
      setError('Choose a warehouse and enter a lot number.');
      return;
    }
    const input = {
      variantId: variant.variantId,
      warehouseId,
      lotNumber,
      quantity: Math.max(0, Math.round(Number(str(form.get('quantity')) || '0'))),
      hazmatClass: str(form.get('hazmatClass')) || 'none',
      ...isoDate('manufacturedAt', form),
      ...isoDate('expiresAt', form),
      ...nonEmpty('supplierBatchRef', form),
    };

    startTransition(async () => {
      const result = await createLotBatchAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/inventory/lots/${result.data.id}`);
      router.refresh();
    });
  }

  // Guard: a lot is held at one warehouse, so at least one is required.
  if (warehouses.length === 0) {
    return (
      <ModuleProvider module="inventory" className="h-full">
        <div className="flex h-full items-center justify-center p-8">
          <Card className="w-full max-w-lg">
            <EmptyState
              icon={<WarehouseIcon className="h-5 w-5" />}
              title="Add a warehouse first"
              description="A lot is held at one warehouse. Create one, then come back to record a lot."
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
        title="New lot"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Lot details',
            supporting:
              'A lot is one batch of an item at a warehouse. Quantity is traceability metadata — on-hand is managed separately through the stock ledger.',
          }}
          actions={{
            onNext: () => formRef.current?.requestSubmit(),
            nextLabel: 'Create lot',
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
            <Card>
              <CardBody>
                <div className="flex flex-col gap-1">
                  <CardTitle>Lot details</CardTitle>
                  <p className="opacity-70">
                    Resolve the item by SKU, choose its warehouse, and record the batch.
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <SkuResolver
                    variant={variant}
                    onResolve={setVariant}
                    onClear={() => setVariant(null)}
                  />

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
                    <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
                      <Label htmlFor="lotNumber">Lot number</Label>
                      <Input id="lotNumber" name="lotNumber" placeholder="e.g. LOT-2026-001" />
                    </div>
                    <div className="flex min-w-[7rem] flex-col gap-1">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input id="quantity" name="quantity" type="number" min={0} defaultValue={0} />
                    </div>
                  </div>

                  <div className="flex flex-row flex-wrap gap-3">
                    <div className="flex min-w-[10rem] flex-col gap-1">
                      <Label htmlFor="manufacturedAt">Manufactured</Label>
                      <Input id="manufacturedAt" name="manufacturedAt" type="date" />
                    </div>
                    <div className="flex min-w-[10rem] flex-col gap-1">
                      <Label htmlFor="expiresAt">Expires</Label>
                      <Input id="expiresAt" name="expiresAt" type="date" />
                    </div>
                    <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
                      <Label htmlFor="hazmatClass">Hazmat class</Label>
                      <NativeSelect id="hazmatClass" name="hazmatClass" defaultValue="none">
                        {HAZMAT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="supplierBatchRef">Supplier batch reference</Label>
                    <Input id="supplierBatchRef" name="supplierBatchRef" placeholder="Optional" />
                  </div>

                  {error && (
                    <p className="text-danger text-sm" role="alert" aria-live="polite">
                      {error}
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          </form>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}

function SkuResolver({
  variant,
  onResolve,
  onClear,
}: {
  variant: PickedVariant | null;
  onResolve: (v: PickedVariant) => void;
  onClear: () => void;
}) {
  const [value, setValue] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function resolve() {
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
      onResolve({
        variantId: lookup.data.variantId,
        sku: lookup.data.sku,
        title: lookup.data.productTitle,
      });
      setValue('');
      setBusy(false);
    })();
  }

  if (variant) {
    return (
      <div className="flex flex-row flex-wrap items-center gap-3 rounded border border-[var(--color-border-default)] px-3 py-2">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
          <p className="text-sm font-medium">{variant.title ?? variant.sku}</p>
          <p className="text-base-content/70 font-mono text-xs">{variant.sku}</p>
        </div>
        <Button variant="ghost" size="sm" type="button" onClick={onClear}>
          Change item
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row flex-wrap items-end gap-3 rounded border border-dashed border-[var(--color-border-default)] p-3">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <Label htmlFor="lot-item-sku">Item SKU</Label>
          <Input
            id="lot-item-sku"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                resolve();
              }
            }}
            placeholder="e.g. FUEL-FILTER-1"
          />
        </div>
        <Button color="module" type="button" onClick={resolve} disabled={busy}>
          {busy ? 'Finding…' : 'Find item'}
        </Button>
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}

function isoDate(name: string, form: FormData): Record<string, string> {
  const value = str(form.get(name));
  return value ? { [name]: `${value}T00:00:00.000Z` } : {};
}

function nonEmpty(name: string, form: FormData): Record<string, string> {
  const value = str(form.get(name));
  return value ? { [name]: value } : {};
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}
