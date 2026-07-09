'use client';

// Inventory-transfer creation form (docs/86 SurfaceFrame, docs/100 P4). SINGLE-PAGE
// (WS1, docs/105): moves stock between two warehouses, composed in one scroll:
//   • Route — source + destination warehouse (must differ), an optional note.
//   • Items — the variants to move, added by SKU with a quantity each.
// The old "Review" step is dropped: the live summary column already carries the
// route + units to move, so it IS the review. Items accumulate locally; the whole
// transfer is committed as a draft in a single `createInventoryTransferAction` on
// finish (a blank draft is allowed — add items later), then the user lands on its
// detail (which ships → receives).
//
// Presentation: the `/new` route renders the `embedded` full page inside the
// dashboard chrome; the Transfers list opens it inside the drawer/modal detail
// chrome (`overlay` → SurfaceFrame `inline`), picked by the user's `defaultDetailView`.

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Plus, Warehouse as WarehouseIcon } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import {
  ModuleProvider,
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createInventoryTransferAction } from '../../../_lib/transfer-actions';
import { lookupVariantBySkuAction } from '../../../_lib/supplier-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';
import { ViewSwitcher } from '../../../../_components/detail-panel';
import { CREATE_SENTINEL } from '../../../../_shell/detail-registry';

// ─── Public option shape (resolved server-side, passed in) ────────────────────────

export interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface PickedLine {
  variantId: string;
  sku: string;
  title: string | null;
  quantity: number;
}

export interface TransferWizardProps {
  /** `'page'` = the in-app full-page `/new` route (embedded, inside the dashboard
   *  chrome); `'overlay'` = the drawer/modal detail chrome (the `defaultDetailView`
   *  preference picks which). */
  presentation?: 'page' | 'overlay';
  warehouses: WarehouseOption[];
}

// Single-page form = one step, so SurfaceFrame's MiniProgress auto-hides and the
// toolbar is Cancel + Create (no Back/Continue).
const SINGLE_STEP: SurfaceStepDef[] = [{ key: 'transfer', label: 'Transfer' }];

export function TransferWizard(props: TransferWizardProps) {
  // Both presentations are full-height frames (embedded fills the dashboard
  // content area; inline fills the drawer/modal body), so the wrapping
  // ModuleProvider carries the height through (h-full).
  return (
    <ModuleProvider module="inventory" className="h-full">
      <TransferWizardInner {...props} />
    </ModuleProvider>
  );
}

function TransferWizardInner({ presentation = 'page', warehouses }: TransferWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [fromId, setFromId] = React.useState(warehouses[0]?.id ?? '');
  const [toId, setToId] = React.useState(warehouses[1]?.id ?? '');
  const [note, setNote] = React.useState('');
  const [lines, setLines] = React.useState<PickedLine[]>([]);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sameWarehouse = Boolean(fromId) && fromId === toId;
  const routeValid = Boolean(fromId) && Boolean(toId) && !sameWarehouse;
  const fromLabel = warehouses.find((w) => w.id === fromId)?.name ?? '—';
  const toLabel = warehouses.find((w) => w.id === toId)?.name ?? '—';
  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);

  function addLine(line: PickedLine) {
    setLines((prev) => (prev.some((p) => p.variantId === line.variantId) ? prev : [...prev, line]));
  }
  function removeLine(variantId: string) {
    setLines((prev) => prev.filter((p) => p.variantId !== variantId));
  }
  function setQuantity(variantId: string, quantity: number) {
    setLines((prev) => prev.map((p) => (p.variantId === variantId ? { ...p, quantity } : p)));
  }

  const close = React.useCallback(() => {
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/inventory/transfers');
    }
  }, [presentation, pathname, searchParams, router]);

  // Unsaved-changes guard. A create form starts blank, so "dirty" is "the user
  // entered or changed anything" — a note, added lines, or a route moved off the
  // default first/second warehouse. Guards a Cancel / Close / backdrop so a
  // half-built transfer isn't silently discarded.
  const dirty =
    note.trim() !== '' ||
    lines.length > 0 ||
    fromId !== (warehouses[0]?.id ?? '') ||
    toId !== (warehouses[1]?.id ?? '');
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'transfer' });

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work. The create path (router.push) leaves on its own, unguarded.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  async function handleCreate() {
    if (!routeValid) {
      setError(
        sameWarehouse
          ? 'Source and destination must be different warehouses.'
          : 'Choose a source and destination warehouse.'
      );
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const input = {
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        ...(note.trim() ? { note: note.trim() } : {}),
        lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      };
      const result = await createInventoryTransferAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/inventory/transfers/${result.data.id}`);
      router.refresh();
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Guard: a transfer needs two warehouses ─────────────────────────────────────
  if (warehouses.length < 2) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="w-full max-w-lg">
          <EmptyState
            icon={<WarehouseIcon className="h-5 w-5" />}
            title="Add a second warehouse first"
            description="A transfer moves stock between two warehouses, so you need at least two. Create another, then come back to start a transfer."
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
    );
  }

  // ── Live draft summary (the F layout's right column, docs/86) ─────────────────
  // A transfer has no money, so the running figures are the route + units to move
  // — this is the "review" the old step 3 used to be.
  const summary = (
    <SurfaceSummary
      title="Draft summary"
      footer={
        <Badge color="module" variant="soft" size="sm">
          Draft — in transit until received
        </Badge>
      }
    >
      <SurfaceSummaryRow label="From" value={fromLabel} />
      <SurfaceSummaryRow label="To" value={toLabel} />
      <SurfaceSummaryRow label="Line items" value={String(lines.length)} />
      <SurfaceSummaryDivider />
      <SurfaceSummaryRow label="Total units" value={String(totalUnits)} strong />
    </SurfaceSummary>
  );

  // ── Frame ──────────────────────────────────────────────────────────────────
  // Single-page: one SurfaceStep stacking route / items. Two different warehouses
  // are required, so the primary stays disabled until the route is valid.
  return (
    <SurfaceFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New transfer"
      backLabel="Transfers"
      headerActions={
        presentation === 'page' ? (
          <ViewSwitcher typeId="transfer" entityId={CREATE_SENTINEL} current="page" />
        ) : undefined
      }
      steps={SINGLE_STEP}
      current={0}
      onCancel={cancel}
      summary={summary}
    >
      <SurfaceStep
        actions={{
          onNext: () => void handleCreate(),
          nextLabel: 'Create transfer',
          nextLoading: submitting,
          nextDisabled: submitting || !routeValid,
        }}
      >
        <div className="flex flex-col gap-5">
          {/* Route */}
          <Card>
            <CardBody>
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold">Route</h3>
                <p className="text-base-content/70 text-sm">
                  Choose where the stock moves from and to — they must be different warehouses.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-row flex-wrap items-end gap-3">
                  <Field className="min-w-[12rem] flex-1">
                    <FieldLabel>From</FieldLabel>
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
                      value={fromId}
                      onChange={(e) => setFromId(e.target.value)}
                    />
                  </Field>
                  <ArrowRight className="text-base-content/60 mb-2 h-5 w-5 shrink-0" />
                  <Field className="min-w-[12rem] flex-1">
                    <FieldLabel>To</FieldLabel>
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
                      value={toId}
                      onChange={(e) => setToId(e.target.value)}
                    />
                  </Field>
                </div>
                {sameWarehouse && (
                  <FieldStatus status="warning" attached={false}>
                    Source and destination must be different warehouses.
                  </FieldStatus>
                )}
                <Field>
                  <FieldLabel>Note</FieldLabel>
                  <FieldControl
                    render={<Textarea rows={2} />}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          {/* Items */}
          <Card>
            <CardBody>
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold">Items to move</h3>
                <p className="text-base-content/70 text-sm">
                  Add the variants to transfer by SKU and set a quantity — optional; you can add
                  items once the transfer is open.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                {lines.length === 0 ? (
                  <p className="text-base-content/70 text-sm">
                    No items yet — add a SKU below, or start empty and add them later.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {lines.map((l) => (
                      <div
                        key={l.variantId}
                        className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2"
                      >
                        <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
                          <p className="text-sm font-medium">{l.title ?? l.sku}</p>
                          <p className="text-base-content/70 font-mono text-xs">{l.sku}</p>
                        </div>
                        <Field className="w-[6rem]">
                          <FieldLabel className="sr-only">Quantity</FieldLabel>
                          <FieldControl
                            type="number"
                            min={1}
                            value={l.quantity}
                            aria-label="Quantity"
                            onChange={(e) =>
                              setQuantity(
                                l.variantId,
                                Math.max(1, Math.round(Number(e.target.value)))
                              )
                            }
                          />
                        </Field>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => removeLine(l.variantId)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <SkuAddRow onAdd={addLine} disabled={submitting} />
              </div>
            </CardBody>
          </Card>

          {error && (
            <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
              {error}
            </FieldStatus>
          )}
        </div>
      </SurfaceStep>
    </SurfaceFrame>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

// Add a line by SKU — resolves the variant, then hands it to `onAdd`. Ported from
// the former transfer form so the form owns its line input.
function SkuAddRow({ onAdd, disabled }: { onAdd: (line: PickedLine) => void; disabled?: boolean }) {
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
        quantity: 1,
      });
      setValue('');
      setBusy(false);
    })();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border-base-300 flex flex-row flex-wrap items-end gap-3 rounded border border-dashed p-3">
        <Field className="min-w-[12rem] flex-1">
          <FieldLabel>Variant SKU</FieldLabel>
          <FieldControl
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
        </Field>
        <Button color="module" type="button" onClick={add} disabled={busy || disabled}>
          {busy ? 'Adding…' : 'Add item'}
        </Button>
      </div>
      {error && (
        <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
          {error}
        </FieldStatus>
      )}
    </div>
  );
}
