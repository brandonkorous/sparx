'use client';

// Purchase-order creation form (docs/86 SurfaceFrame, docs/100 P3b). SINGLE-PAGE
// (WS1, docs/105): orders stock from a supplier into a warehouse, composed in one
// scroll:
//   • Details — supplier (required), warehouse (required), currency.
//   • Lines   — the variants to order, added by SKU via the shared LineAddRow.
//   • Terms   — payment terms, reference, expected arrival, shipping, notes.
// The old "Review" step is dropped: the live summary column already carries the
// supplier/destination/running cost, so it IS the review. Lines accumulate locally;
// the whole PO is committed as a draft in a single `createPurchaseOrderAction` on
// finish (a blank draft is allowed — add lines later; a blank line cost defaults
// server-side from the supplier link / variant cost), then the user lands on its
// detail.
//
// Presentation: the `/new` route renders the `embedded` full page inside the
// dashboard chrome; the PO list opens it inside the drawer/modal detail chrome
// (`overlay` → SurfaceFrame `inline`), picked by the user's `defaultDetailView`.

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Truck } from 'lucide-react';

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

import { createPurchaseOrderAction } from '../../../_lib/purchase-order-actions';
import { LineAddRow, type ResolvedLine } from '../../_components/line-add-row';
import { formatMoney } from '../../_components/types';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

// ─── Public option shape (resolved server-side, passed in) ────────────────────────

export interface PartyOption {
  id: string;
  name: string;
  code: string;
}

export interface PurchaseOrderWizardProps {
  /** `'page'` = the in-app full-page `/new` route (embedded, inside the dashboard
   *  chrome); `'overlay'` = the drawer/modal detail chrome (the `defaultDetailView`
   *  preference picks which). */
  presentation?: 'page' | 'overlay';
  suppliers: PartyOption[];
  warehouses: PartyOption[];
}

// Single-page form = one step, so SurfaceFrame's MiniProgress auto-hides and the
// toolbar is Cancel + Create (no Back/Continue).
const SINGLE_STEP: SurfaceStepDef[] = [{ key: 'po', label: 'Purchase order' }];

export function PurchaseOrderWizard(props: PurchaseOrderWizardProps) {
  // Both presentations are full-height frames (embedded fills the dashboard
  // content area; inline fills the drawer/modal body), so the wrapping
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

  const knownSubtotal = lines.reduce(
    (s, l) => s + (l.unitCostCents !== undefined ? l.unitCostCents * l.quantity : 0),
    0
  );
  const hasDefaults = lines.some((l) => l.unitCostCents === undefined);
  const supplierLabel = suppliers.find((s) => s.id === supplierId)?.name ?? '—';
  const warehouseLabel = warehouses.find((w) => w.id === warehouseId)?.name ?? '—';

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

  // Unsaved-changes guard. A create form starts blank, so "dirty" is "the user
  // entered or changed anything" — a supplier/warehouse moved off the default,
  // added lines, a changed currency, or any term. Guards a Cancel / Close /
  // backdrop so a half-built purchase order isn't silently discarded.
  const dirty =
    supplierId !== (suppliers[0]?.id ?? '') ||
    warehouseId !== (warehouses[0]?.id ?? '') ||
    currency.trim().toUpperCase() !== 'USD' ||
    lines.length > 0 ||
    paymentTerms.trim() !== '' ||
    reference.trim() !== '' ||
    expectedArrival.trim() !== '' ||
    shipping.trim() !== '' ||
    notes.trim() !== '';
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'purchase order' });

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work. The create path (router.push) leaves on its own, unguarded.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  async function handleCreate() {
    if (!supplierId || !warehouseId) {
      setError('Choose a supplier and a warehouse.');
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

  // ── Live draft summary (the F layout's right column, docs/86) ─────────────────
  // The supplier, destination, and running cost — this is the "review" the old
  // step 4 used to be.
  const summary = (
    <SurfaceSummary
      title="Draft summary"
      footer={
        <Badge color="module" variant="soft" size="sm">
          Draft — editable before submit
        </Badge>
      }
    >
      <SurfaceSummaryRow label="Supplier" value={supplierLabel} />
      <SurfaceSummaryRow label="Warehouse" value={warehouseLabel} />
      <SurfaceSummaryRow label="Currency" value={(currency || 'USD').toUpperCase()} />
      <SurfaceSummaryRow label="Lines" value={String(lines.length)} />
      <SurfaceSummaryDivider />
      <SurfaceSummaryRow
        label="Known subtotal"
        value={`${formatMoney(knownSubtotal, currency)}${hasDefaults ? ' + defaults' : ''}`}
        strong
      />
    </SurfaceSummary>
  );

  // ── Frame ──────────────────────────────────────────────────────────────────
  // Single-page: one SurfaceStep stacking details / lines / terms. A supplier and
  // warehouse are required, so the primary stays disabled until both are chosen.
  return (
    <SurfaceFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New purchase order"
      steps={SINGLE_STEP}
      current={0}
      onCancel={cancel}
      summary={summary}
    >
      <SurfaceStep
        actions={{
          onNext: () => void handleCreate(),
          nextLabel: 'Create draft',
          nextLoading: submitting,
          nextDisabled: submitting || !supplierId || !warehouseId,
        }}
      >
        <div className="flex flex-col gap-5">
          {/* Supplier & warehouse */}
          <Card variant="default">
            <CardHeader>
              <Heading level={3}>Supplier &amp; warehouse</Heading>
              <Text size="sm" variant="muted">
                Who you’re buying from and where it lands.
              </Text>
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

          {/* Lines */}
          <Card variant="default">
            <CardHeader>
              <Heading level={3}>Lines</Heading>
              <Text size="sm" variant="muted">
                Add the variants to order by SKU. Leave the cost blank to use the supplier’s agreed
                cost (falls back to the variant cost). You can save an empty draft and add lines
                later.
              </Text>
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

          {/* Terms */}
          <Card variant="default">
            <CardHeader>
              <Heading level={3}>Terms &amp; dates</Heading>
              <Text size="sm" variant="muted">
                All optional — terms default onto the order and can be overridden per line later.
              </Text>
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

          {error && (
            <Text size="sm" variant="danger" role="alert">
              {error}
            </Text>
          )}
        </div>
      </SurfaceStep>
    </SurfaceFrame>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

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
