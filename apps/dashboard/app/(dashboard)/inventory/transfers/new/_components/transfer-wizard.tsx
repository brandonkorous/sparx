'use client';

// Inventory-transfer creation wizard (docs/86 SurfaceFrame, docs/100 P4). Moves
// stock between two warehouses, composed in a guided flow:
//   1. Route  — source + destination warehouse (must differ), an optional note.
//   2. Items  — the variants to move, added by SKU with a quantity each.
//   3. Review — the summary. Create.
//
// Items are accumulated locally; the whole transfer is committed as a draft in a
// single `createInventoryTransferAction` on finish, then the user lands on its
// detail (which ships → receives). A blank draft is allowed (add items later).
//
// Presentation (like the other create-wizards): the `/new` route renders the
// in-app `embedded` top stepper (full page inside the dashboard chrome); the
// Transfers list opens it inside the drawer/modal detail chrome (`overlay` →
// SurfaceFrame `inline`), picked by the user's `defaultDetailView`. The transfer
// detail stays full-page; finishing navigates there, clearing the overlay token.

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Plus, Warehouse as WarehouseIcon } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Heading,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  Stack,
  Text,
  Textarea,
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
  /** `'page'` = the in-app full-page `/new` route (embedded top stepper, inside
   *  the dashboard chrome); `'overlay'` = the drawer/modal detail chrome (the
   *  `defaultDetailView` preference picks which). */
  presentation?: 'page' | 'overlay';
  warehouses: WarehouseOption[];
}

type StepKey = 'route' | 'items' | 'review';

const STEP_ORDER: StepKey[] = ['route', 'items', 'review'];

const ALL_STEPS: Record<StepKey, SurfaceStepDef> = {
  route: { key: 'route', label: 'Route', sublabel: 'From & to' },
  items: { key: 'items', label: 'Items', sublabel: 'What to move' },
  review: { key: 'review', label: 'Review', sublabel: 'Create' },
};

const RAIL: Record<StepKey, { context: string }> = {
  route: { context: 'Source and destination must be different warehouses.' },
  items: { context: 'You can add items now or once the transfer is open.' },
  review: { context: 'Created as a draft; units sit in transit until received.' },
};

export function TransferWizard(props: TransferWizardProps) {
  // Both presentations are full-height top-stepper frames (embedded fills the
  // dashboard content area; inline fills the drawer/modal body), so the wrapping
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

  const [stepKey, setStepKey] = React.useState<StepKey>('route');

  const [fromId, setFromId] = React.useState(warehouses[0]?.id ?? '');
  const [toId, setToId] = React.useState(warehouses[1]?.id ?? '');
  const [note, setNote] = React.useState('');
  const [lines, setLines] = React.useState<PickedLine[]>([]);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const steps: SurfaceStepDef[] = STEP_ORDER.map((k) => ALL_STEPS[k]);
  const current = Math.max(
    0,
    steps.findIndex((s) => s.key === stepKey)
  );

  const sameWarehouse = Boolean(fromId) && fromId === toId;
  const routeValid = Boolean(fromId) && Boolean(toId) && !sameWarehouse;
  const fromLabel = warehouses.find((w) => w.id === fromId)?.name ?? '—';
  const toLabel = warehouses.find((w) => w.id === toId)?.name ?? '—';
  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);

  function goToStep(key: StepKey) {
    setError(null);
    setStepKey(key);
  }

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

  // Unsaved-changes guard. A create wizard starts blank, so "dirty" is "the user
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
      setError('Choose two different warehouses.');
      goToStep('route');
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

  // ── Step bodies ──────────────────────────────────────────────────────────────

  const routeStep = (
    <SurfaceStep
      header={{
        title: 'Route',
        supporting: 'Choose where the stock moves from and to. They must be different warehouses.',
      }}
      actions={{
        onNext: () => {
          if (!routeValid) {
            setError(
              sameWarehouse
                ? 'Source and destination must be different warehouses.'
                : 'Choose a source and destination warehouse.'
            );
            return;
          }
          goToStep('items');
        },
        nextLabel: 'Continue',
        nextDisabled: !routeValid || submitting,
      }}
    >
      <Card variant="module">
        <CardHeader>
          <Heading level={3}>Route</Heading>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Stack direction="row" gap={3} align="end" wrap>
              <Stack gap={1} className="min-w-[12rem] flex-1">
                <Label htmlFor="tw-from">From</Label>
                <NativeSelect
                  id="tw-from"
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </NativeSelect>
              </Stack>
              <ArrowRight className="mb-2 h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
              <Stack gap={1} className="min-w-[12rem] flex-1">
                <Label htmlFor="tw-to">To</Label>
                <NativeSelect id="tw-to" value={toId} onChange={(e) => setToId(e.target.value)}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </NativeSelect>
              </Stack>
            </Stack>
            {sameWarehouse && (
              <Text size="xs" className="text-[var(--color-warning-text)]">
                Source and destination must be different warehouses.
              </Text>
            )}
            <div>
              <Label htmlFor="tw-note">Note</Label>
              <Textarea
                id="tw-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      {error && (
        <Text size="sm" variant="danger" role="alert" className="mt-4">
          {error}
        </Text>
      )}
    </SurfaceStep>
  );

  const itemsStep = (
    <SurfaceStep
      header={{
        title: 'Items to move',
        supporting:
          'Add the variants to transfer by SKU and set a quantity. Adding items is optional.',
      }}
      actions={{
        onBack: () => goToStep('route'),
        onNext: () => goToStep('review'),
        nextLabel: 'Continue',
        nextDisabled: submitting,
      }}
    >
      <Card variant="module">
        <CardHeader>
          <Heading level={3}>Items</Heading>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {lines.length === 0 ? (
              <Text size="sm" variant="muted">
                No items yet — add a SKU below, or start empty and add them later.
              </Text>
            ) : (
              <Stack gap={2}>
                {lines.map((l) => (
                  <Stack
                    key={l.variantId}
                    direction="row"
                    align="center"
                    gap={3}
                    wrap
                    className="rounded border border-[var(--color-border-default)] px-3 py-2"
                  >
                    <Stack gap={0} className="min-w-[12rem] flex-1">
                      <Text size="sm" className="font-medium">
                        {l.title ?? l.sku}
                      </Text>
                      <Text size="xs" variant="muted" className="font-mono">
                        {l.sku}
                      </Text>
                    </Stack>
                    <Stack gap={0} className="w-[6rem]">
                      <Label htmlFor={`tw-qty-${l.variantId}`} className="sr-only">
                        Quantity
                      </Label>
                      <Input
                        id={`tw-qty-${l.variantId}`}
                        type="number"
                        min={1}
                        value={l.quantity}
                        aria-label="Quantity"
                        onChange={(e) =>
                          setQuantity(l.variantId, Math.max(1, Math.round(Number(e.target.value))))
                        }
                      />
                    </Stack>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => removeLine(l.variantId)}
                    >
                      Remove
                    </Button>
                  </Stack>
                ))}
              </Stack>
            )}
            <SkuAddRow onAdd={addLine} disabled={submitting} />
          </div>
        </CardContent>
      </Card>
    </SurfaceStep>
  );

  const reviewStep = (
    <SurfaceStep
      header={{
        title: 'Review & create',
        supporting: 'Confirm the transfer and create the draft.',
      }}
      actions={{
        onBack: () => goToStep('items'),
        onNext: () => void handleCreate(),
        nextLabel: 'Create transfer',
        nextLoading: submitting,
        nextDisabled: submitting || !routeValid,
      }}
    >
      <div className="flex flex-col gap-5">
        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Summary</Heading>
          </CardHeader>
          <CardContent>
            <Stack gap={2}>
              <SummaryRow label="From" value={fromLabel} />
              <SummaryRow label="To" value={toLabel} />
              <SummaryRow label="Items" value={String(lines.length)} />
            </Stack>
          </CardContent>
        </Card>
        {error && (
          <Text size="sm" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </div>
    </SurfaceStep>
  );

  let body: React.ReactNode;
  if (stepKey === 'route') body = routeStep;
  else if (stepKey === 'items') body = itemsStep;
  else body = reviewStep;

  // ── Guard: a transfer needs two warehouses ─────────────────────────────────────
  if (warehouses.length < 2) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card padding="none" className="w-full max-w-lg">
          <EmptyState
            icon={<WarehouseIcon className="h-5 w-5" />}
            title="Add a second warehouse first"
            description="A transfer moves stock between two warehouses, so you need at least two. Create another, then come back to start a transfer."
            action={
              <Button color="module" asChild leftIcon={<Plus className="h-4 w-4" />}>
                <Link href="/inventory/warehouses/new">New warehouse</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  // ── Frame ──────────────────────────────────────────────────────────────────
  const onStepSelect = (key: string) => {
    const target = steps.findIndex((s) => s.key === key);
    if (target >= 0 && target <= current) goToStep(key as StepKey);
  };
  const canSelectStep = (_key: string, index: number) => index <= current;

  // The live draft summary — the F layout's right-hand column (docs/86). A
  // transfer has no money, so the running figures are the route + units to move.
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

  return (
    <SurfaceFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New transfer"
      steps={steps}
      current={current}
      context={RAIL[stepKey].context}
      onStepSelect={onStepSelect}
      canSelectStep={canSelectStep}
      onCancel={cancel}
      summary={summary}
    >
      {body}
    </SurfaceFrame>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justify="between" align="center">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <Text size="sm" className="tabular-nums">
        {value}
      </Text>
    </Stack>
  );
}

// Add a line by SKU — resolves the variant, then hands it to `onAdd`. Ported from
// the former transfer form so the wizard owns its line input.
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
    <Stack gap={2}>
      <Stack
        direction="row"
        gap={3}
        align="end"
        wrap
        className="rounded border border-dashed border-[var(--color-border-default)] p-3"
      >
        <Stack gap={1} className="min-w-[12rem] flex-1">
          <Label htmlFor="transfer-add-sku">Variant SKU</Label>
          <Input
            id="transfer-add-sku"
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
        </Stack>
        <Button color="module" type="button" onClick={add} disabled={busy || disabled}>
          {busy ? 'Adding…' : 'Add item'}
        </Button>
      </Stack>
      {error && (
        <Text size="sm" className="text-[var(--color-danger)]">
          {error}
        </Text>
      )}
    </Stack>
  );
}
