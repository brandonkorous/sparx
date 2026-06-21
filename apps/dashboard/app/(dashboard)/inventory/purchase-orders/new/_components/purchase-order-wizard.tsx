'use client';

// Purchase-order creation wizard (docs/86 WizardFrame, docs/100 P3b). Orders
// stock from a supplier into a warehouse, composed in a guided flow:
//   1. Details — supplier (required), warehouse (required), currency.
//   2. Lines   — the variants to order, added by SKU via the shared LineAddRow.
//   3. Terms   — payment terms, reference, expected arrival, shipping, notes.
//   4. Review  — the summary. Create draft.
//
// Lines are accumulated locally; the whole PO is committed as a draft in a single
// `createPurchaseOrderAction` on finish, then the user lands on its detail. A
// blank draft is allowed (add lines later). A line cost left blank defaults
// server-side from the supplier link / variant cost.
//
// Presentation (like the other create-wizards): the `/new` route renders the
// in-app `embedded` top stepper (full page inside the dashboard chrome); the PO
// list opens it inside the drawer/modal detail chrome (`overlay` → WizardFrame
// `inline`), picked by the user's `defaultDetailView`. The PO detail/editor stays
// full-page; finishing navigates there, clearing the overlay token.

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Truck } from 'lucide-react';

import {
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
  WizardFrame,
  WizardStep,
  type WizardStepDef,
} from '@sparx/ui';

import { createPurchaseOrderAction } from '../../../_lib/purchase-order-actions';
import { LineAddRow, type ResolvedLine } from '../../_components/line-add-row';
import { formatMoney } from '../../_components/types';

// ─── Public option shape (resolved server-side, passed in) ────────────────────────

export interface PartyOption {
  id: string;
  name: string;
  code: string;
}

export interface PurchaseOrderWizardProps {
  /** `'page'` = the in-app full-page `/new` route (embedded top stepper, inside
   *  the dashboard chrome); `'overlay'` = the drawer/modal detail chrome (the
   *  `defaultDetailView` preference picks which). */
  presentation?: 'page' | 'overlay';
  suppliers: PartyOption[];
  warehouses: PartyOption[];
}

type StepKey = 'details' | 'lines' | 'terms' | 'review';

const STEP_ORDER: StepKey[] = ['details', 'lines', 'terms', 'review'];

const ALL_STEPS: Record<StepKey, WizardStepDef> = {
  details: { key: 'details', label: 'Details', sublabel: 'Supplier & warehouse' },
  lines: { key: 'lines', label: 'Lines', sublabel: 'What to order' },
  terms: { key: 'terms', label: 'Terms', sublabel: 'Shipping & dates' },
  review: { key: 'review', label: 'Review', sublabel: 'Create draft' },
};

const RAIL: Record<StepKey, { context: string }> = {
  details: { context: 'Who you’re buying from and where it lands.' },
  lines: { context: 'Leave the cost blank to use the supplier’s agreed cost.' },
  terms: { context: 'All optional — terms default onto the order.' },
  review: { context: 'Saved as a draft you can edit, then submit when ready.' },
};

export function PurchaseOrderWizard(props: PurchaseOrderWizardProps) {
  // Both presentations are full-height top-stepper frames (embedded fills the
  // dashboard content area; inline fills the drawer/modal body), so the wrapping
  // ModuleProvider carries the height through (h-full).
  return (
    <ModuleProvider module="inventory" className="h-full">
      <PurchaseOrderWizardInner {...props} />
    </ModuleProvider>
  );
}

function PurchaseOrderWizardInner({
  presentation = 'page',
  suppliers,
  warehouses,
}: PurchaseOrderWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [stepKey, setStepKey] = React.useState<StepKey>('details');

  const [supplierId, setSupplierId] = React.useState(suppliers[0]?.id ?? '');
  const [warehouseId, setWarehouseId] = React.useState(warehouses[0]?.id ?? '');
  const [currency, setCurrency] = React.useState('USD');
  const [lines, setLines] = React.useState<ResolvedLine[]>([]);
  const [paymentTerms, setPaymentTerms] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [expectedArrival, setExpectedArrival] = React.useState('');
  const [shipping, setShipping] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const steps: WizardStepDef[] = STEP_ORDER.map((k) => ALL_STEPS[k]);
  const current = Math.max(
    0,
    steps.findIndex((s) => s.key === stepKey)
  );

  const knownSubtotal = lines.reduce(
    (s, l) => s + (l.unitCostCents !== undefined ? l.unitCostCents * l.quantity : 0),
    0
  );
  const hasDefaults = lines.some((l) => l.unitCostCents === undefined);
  const supplierLabel = suppliers.find((s) => s.id === supplierId)?.name ?? '—';
  const warehouseLabel = warehouses.find((w) => w.id === warehouseId)?.name ?? '—';

  function goToStep(key: StepKey) {
    setError(null);
    setStepKey(key);
  }

  function addLine(line: ResolvedLine) {
    setLines((prev) => [...prev.filter((l) => l.variantId !== line.variantId), line]);
  }
  function removeLine(variantId: string) {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  const close = React.useCallback(() => {
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/inventory/purchase-orders');
    }
  }, [presentation, pathname, searchParams, router]);

  async function handleCreate() {
    if (!supplierId || !warehouseId) {
      setError('Choose a supplier and a warehouse.');
      goToStep('details');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const input = {
        supplierId,
        warehouseId,
        currency: (currency.trim() || 'USD').toUpperCase().slice(0, 3),
        ...(paymentTerms.trim() ? { paymentTerms: paymentTerms.trim() } : {}),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(expectedArrival ? { expectedArrivalAt: new Date(expectedArrival).toISOString() } : {}),
        shippingCents: shipping ? Math.round(Number(shipping) * 100) : 0,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          ...(l.unitCostCents !== undefined ? { unitCostCents: l.unitCostCents } : {}),
        })),
      };
      const result = await createPurchaseOrderAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/inventory/purchase-orders/${result.data.id}`);
      router.refresh();
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step bodies ──────────────────────────────────────────────────────────────

  const detailsStep = (
    <WizardStep
      header={{
        title: 'Order details',
        supporting: 'Who you’re buying from and where it lands.',
      }}
      actions={{
        onNext: () => goToStep('lines'),
        nextLabel: 'Continue',
        nextDisabled: !supplierId || !warehouseId || submitting,
      }}
    >
      <Card variant="module">
        <CardHeader>
          <Heading level={3}>Supplier & warehouse</Heading>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="po-supplier">Supplier</Label>
                <NativeSelect
                  id="po-supplier"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="po-warehouse">Warehouse</Label>
                <NativeSelect
                  id="po-warehouse"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="max-w-[8rem]">
              <Label htmlFor="po-currency">Currency</Label>
              <Input
                id="po-currency"
                value={currency}
                maxLength={3}
                className="uppercase"
                onChange={(e) => setCurrency(e.target.value)}
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
    </WizardStep>
  );

  const linesStep = (
    <WizardStep
      header={{
        title: 'Lines',
        supporting:
          'Add the variants to order by SKU. Leave the cost blank to use the supplier’s agreed cost (falls back to the variant cost).',
      }}
      actions={{
        onBack: () => goToStep('details'),
        onNext: () => goToStep('terms'),
        nextLabel: 'Continue',
        nextDisabled: submitting,
      }}
    >
      <Card variant="module">
        <CardHeader>
          <Heading level={3}>Lines</Heading>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {lines.length === 0 ? (
              <Text size="sm" variant="muted">
                No lines yet — you can still save an empty draft and add them later.
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
                    <Text size="sm">×{l.quantity}</Text>
                    <Text size="sm" variant="muted">
                      {l.unitCostCents !== undefined
                        ? formatMoney(l.unitCostCents, currency)
                        : 'default'}
                    </Text>
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
                <Stack direction="row" justify="end">
                  <Text size="sm" variant="muted">
                    Subtotal {formatMoney(knownSubtotal, currency)}
                    {hasDefaults ? ' + default-priced lines' : ''}
                  </Text>
                </Stack>
              </Stack>
            )}
            <LineAddRow onAdd={addLine} disabled={submitting} />
          </div>
        </CardContent>
      </Card>
    </WizardStep>
  );

  const termsStep = (
    <WizardStep
      header={{
        title: 'Terms & dates',
        supporting: 'Terms default onto the order and can be overridden per line later.',
      }}
      actions={{
        onBack: () => goToStep('lines'),
        onNext: () => goToStep('review'),
        nextLabel: 'Continue',
        nextDisabled: submitting,
      }}
    >
      <Card variant="module">
        <CardHeader>
          <Heading level={3}>Terms</Heading>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="po-terms">Payment terms</Label>
                <Input
                  id="po-terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="net30"
                />
              </div>
              <div>
                <Label htmlFor="po-ref">Reference</Label>
                <Input
                  id="po-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div>
                <Label htmlFor="po-eta">Expected arrival</Label>
                <Input
                  id="po-eta"
                  type="date"
                  value={expectedArrival}
                  onChange={(e) => setExpectedArrival(e.target.value)}
                />
              </div>
            </div>
            <div className="max-w-[10rem]">
              <Label htmlFor="po-shipping">Shipping ($)</Label>
              <Input
                id="po-shipping"
                type="number"
                min="0"
                step="0.01"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="po-notes">Notes</Label>
              <Textarea
                id="po-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </WizardStep>
  );

  const reviewStep = (
    <WizardStep
      header={{
        title: 'Review & create',
        supporting: 'Saved as a draft you can edit before submitting.',
      }}
      actions={{
        onBack: () => goToStep('terms'),
        onNext: () => void handleCreate(),
        nextLabel: 'Create draft',
        nextLoading: submitting,
        nextDisabled: submitting || !supplierId || !warehouseId,
      }}
    >
      <div className="flex flex-col gap-5">
        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Summary</Heading>
          </CardHeader>
          <CardContent>
            <Stack gap={2}>
              <SummaryRow label="Supplier" value={supplierLabel} />
              <SummaryRow label="Warehouse" value={warehouseLabel} />
              <SummaryRow label="Currency" value={(currency || 'USD').toUpperCase()} />
              <SummaryRow label="Lines" value={String(lines.length)} />
              <div className="border-t border-[var(--color-border-default)] pt-2">
                <SummaryRow
                  label="Known subtotal"
                  value={`${formatMoney(knownSubtotal, currency)}${hasDefaults ? ' + defaults' : ''}`}
                  strong
                />
              </div>
            </Stack>
          </CardContent>
        </Card>
        {error && (
          <Text size="sm" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </div>
    </WizardStep>
  );

  let body: React.ReactNode;
  if (stepKey === 'details') body = detailsStep;
  else if (stepKey === 'lines') body = linesStep;
  else if (stepKey === 'terms') body = termsStep;
  else body = reviewStep;

  // ── Guard: a PO needs a supplier + a warehouse ─────────────────────────────────
  if (suppliers.length === 0 || warehouses.length === 0) {
    const needSupplier = suppliers.length === 0;
    return (
      <GuardPanel
        title={needSupplier ? 'Add a supplier first' : 'Add a warehouse first'}
        description={
          needSupplier
            ? 'A purchase order needs a supplier to buy from. Create one, then come back.'
            : 'A purchase order needs a destination warehouse to receive into. Create one, then come back.'
        }
        href={needSupplier ? '/inventory/suppliers/new' : '/inventory/warehouses/new'}
        cta={needSupplier ? 'New supplier' : 'New warehouse'}
      />
    );
  }

  // ── Frame ──────────────────────────────────────────────────────────────────
  const onStepSelect = (key: string) => {
    const target = steps.findIndex((s) => s.key === key);
    if (target >= 0 && target <= current) goToStep(key as StepKey);
  };
  const canSelectStep = (_key: string, index: number) => index <= current;
  const cancelButton = (
    <button
      type="button"
      onClick={close}
      className="text-[var(--color-text-muted)] underline-offset-2 hover:underline"
    >
      Cancel
    </button>
  );

  return (
    <WizardFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New purchase order"
      steps={steps}
      current={current}
      context={RAIL[stepKey].context}
      onStepSelect={onStepSelect}
      canSelectStep={canSelectStep}
      footer={cancelButton}
    >
      {body}
    </WizardFrame>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" justify="between" align="center">
      <Text
        size="sm"
        variant={strong ? 'default' : 'muted'}
        className={strong ? 'font-semibold' : ''}
      >
        {label}
      </Text>
      <Text size="sm" className={`tabular-nums ${strong ? 'font-semibold' : ''}`}>
        {value}
      </Text>
    </Stack>
  );
}

function GuardPanel({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card padding="none" className="w-full max-w-lg">
        <EmptyState
          icon={<Truck className="h-5 w-5" />}
          title={title}
          description={description}
          action={
            <Button color="module" asChild leftIcon={<Plus className="h-4 w-4" />}>
              <Link href={href}>{cta}</Link>
            </Button>
          }
        />
      </Card>
    </div>
  );
}
