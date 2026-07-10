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
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import { createLotBatchAction } from '../../../_lib/lot-actions';
import { lookupVariantBySkuAction } from '../../../_lib/supplier-actions';
import { HAZMAT_OPTIONS } from '../../_components/types';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';
import { useDetailFooterNode } from '../../../../_components/detail-header-slot';
import { ViewSwitcher } from '../../../../_components/detail-panel';
import { CREATE_SENTINEL } from '../../../../_shell/detail-registry';

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
// so on success we navigate there.

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

// Non-negative integer quantity (traceability metadata, not the stock ledger).
const quantityRule = (value: string): string | null => {
  const s = value.trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return 'Enter a quantity.';
  if (n < 0) return 'Quantity cannot be negative.';
  return null;
};

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
  // The overlay host (drawer/modal) already renders a footer-slot row for
  // Cancel/Save; handing it to SurfaceFrame merges the frame's own toolbar
  // into THAT row instead of stacking a second one underneath it — null
  // until the host mounts.
  const overlayActionsTarget = useDetailFooterNode();
  const [variant, setVariant] = React.useState<PickedVariant | null>(null);

  const [warehouseId, setWarehouseId] = React.useState(warehouses[0]?.id ?? '');
  const [lotNumber, setLotNumber] = React.useState('');
  const [quantity, setQuantity] = React.useState('0');
  const [manufacturedAt, setManufacturedAt] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [hazmatClass, setHazmatClass] = React.useState('none');
  const [supplierBatchRef, setSupplierBatchRef] = React.useState('');

  const values = { lotNumber, quantity };
  const v = useFieldValidation(values, {
    lotNumber: rule.required('Enter a lot number.'),
    quantity: quantityRule,
  });

  const dirty =
    variant !== null ||
    lotNumber.trim() !== '' ||
    (quantity.trim() !== '' && quantity.trim() !== '0') ||
    manufacturedAt !== '' ||
    expiresAt !== '' ||
    hazmatClass !== 'none' ||
    supplierBatchRef.trim() !== '';
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

  function submit() {
    setError(null);
    if (!variant) {
      setError('Resolve an item by SKU first.');
      return;
    }
    if (!v.validate()) return;
    if (!warehouseId) {
      setError('Choose a warehouse.');
      return;
    }
    const input = {
      variantId: variant.variantId,
      warehouseId,
      lotNumber: lotNumber.trim(),
      quantity: Math.max(0, Math.round(Number(quantity.trim() || '0'))),
      hazmatClass: hazmatClass || 'none',
      ...(manufacturedAt ? { manufacturedAt: `${manufacturedAt}T00:00:00.000Z` } : {}),
      ...(expiresAt ? { expiresAt: `${expiresAt}T00:00:00.000Z` } : {}),
      ...(supplierBatchRef.trim() ? { supplierBatchRef: supplierBatchRef.trim() } : {}),
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
        backLabel="Lots"
        headerActions={
          surface === 'page' ? (
            <ViewSwitcher typeId="lot" entityId={CREATE_SENTINEL} current="page" />
          ) : undefined
        }
        actionsTarget={surface === 'overlay' ? overlayActionsTarget : undefined}
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
            onNext: submit,
            nextLabel: 'Create lot',
            nextLoading: pending,
            nextDisabled: pending,
          }}
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
                  <Field className="min-w-[14rem] flex-1">
                    <FieldLabel>Warehouse</FieldLabel>
                    <FieldControl
                      render={
                        <NativeSelect>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.code})
                            </option>
                          ))}
                        </NativeSelect>
                      }
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                    />
                  </Field>
                  <Field className="min-w-[10rem] flex-1" {...v.field('lotNumber')}>
                    <FieldLabel required>Lot number</FieldLabel>
                    <FieldControl
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      placeholder="e.g. LOT-2026-001"
                      {...v.control('lotNumber')}
                    />
                  </Field>
                  <Field className="min-w-[7rem]" {...v.field('quantity')}>
                    <FieldLabel>Quantity</FieldLabel>
                    <FieldControl
                      type="number"
                      min={0}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      {...v.control('quantity')}
                    />
                  </Field>
                </div>

                <div className="flex flex-row flex-wrap gap-3">
                  <Field className="min-w-[10rem]">
                    <FieldLabel>Manufactured</FieldLabel>
                    <FieldControl
                      type="date"
                      value={manufacturedAt}
                      onChange={(e) => setManufacturedAt(e.target.value)}
                    />
                  </Field>
                  <Field className="min-w-[10rem]">
                    <FieldLabel>Expires</FieldLabel>
                    <FieldControl
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </Field>
                  <Field className="min-w-[14rem] flex-1">
                    <FieldLabel>Hazmat class</FieldLabel>
                    <FieldControl
                      render={
                        <NativeSelect>
                          {HAZMAT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </NativeSelect>
                      }
                      value={hazmatClass}
                      onChange={(e) => setHazmatClass(e.target.value)}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel>Supplier batch reference</FieldLabel>
                  <FieldControl
                    value={supplierBatchRef}
                    onChange={(e) => setSupplierBatchRef(e.target.value)}
                    placeholder="Optional"
                  />
                </Field>

                {error && (
                  <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                    {error}
                  </FieldStatus>
                )}
              </div>
            </CardBody>
          </Card>
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
      <div className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2">
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
      <div className="border-base-300 flex flex-row flex-wrap items-end gap-3 rounded border border-dashed p-3">
        <Field className="min-w-[12rem] flex-1">
          <FieldLabel>Item SKU</FieldLabel>
          <FieldControl
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
        </Field>
        <Button color="module" type="button" onClick={resolve} disabled={busy}>
          {busy ? 'Finding…' : 'Find item'}
        </Button>
      </div>
      {error && (
        <FieldStatus status="error" attached={false}>
          {error}
        </FieldStatus>
      )}
    </div>
  );
}
