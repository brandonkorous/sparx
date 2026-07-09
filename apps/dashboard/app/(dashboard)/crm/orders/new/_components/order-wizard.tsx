'use client';

// Order creation form (docs/86 SurfaceFrame, docs/68). SINGLE-PAGE (WS1, docs/105):
// the manual-order builder composes a COMPLETE order in one scroll:
//   • Customer   — the customer (required), channel, and currency.
//   • Line items — the priced lines (SKU, name, qty, unit price, per-line tax and
//                  discount), via the shared LineItemsEditor.
//   • Details    — source, shipping, and notes (all optional).
// The old "Review" step is dropped: the live summary column already carries the
// running totals, so it IS the review. Everything is composed locally and committed
// in a single `createOrderAction` on finish (the order API takes the header + items
// together; the service emits `order.created` after the transaction commits), then
// the user lands on the new order. The line editor is shared with the Quote form.
//
// Presentation: the `/new` route renders the `embedded` full page inside the
// dashboard chrome; the Orders list opens it inside the drawer/modal detail chrome
// (`overlay` → SurfaceFrame `inline`), picked by the user's `defaultDetailView`.
// Finishing navigates to the new order, which clears the overlay token.

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  ModuleProvider,
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  type SurfaceStepDef,
} from '@sparx/ui';
import {
  Badge,
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';

import { createOrderAction } from '../../../order-actions';
import { LineItemsEditor, type LineItem } from '../../../_components/line-items-editor';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';
import { CREATE_SENTINEL } from '../../../../_shell/detail-registry';
import { ViewSwitcher } from '../../../../_components/detail-panel';

// ─── Public option shape (resolved server-side, passed in) ────────────────────────

export interface CustomerOption {
  id: string;
  label: string;
}

export interface OrderWizardProps {
  /** `'page'` = the in-app full-page `/new` route (embedded, inside the dashboard
   *  chrome); `'overlay'` = the drawer/modal detail chrome (the `defaultDetailView`
   *  preference picks which). */
  presentation?: 'page' | 'overlay';
  customers: CustomerOption[];
  preselectedCustomerId?: string | null;
}

type Channel = 'admin' | 'storefront' | 'b2b_portal' | 'import' | 'mcp';

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'storefront', label: 'Storefront' },
  { value: 'b2b_portal', label: 'B2B portal' },
  { value: 'import', label: 'Import' },
  { value: 'mcp', label: 'MCP' },
];

// Single-page form = one step, so SurfaceFrame's MiniProgress auto-hides and the
// toolbar is Cancel + Create (no Back/Continue).
const SINGLE_STEP: SurfaceStepDef[] = [{ key: 'order', label: 'Order' }];

// ─── Helpers ──────────────────────────────────────────────────────────────────────

function parseMoney(value: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────────

export function OrderWizard(props: OrderWizardProps) {
  // Both presentations are full-height frames (embedded fills the dashboard
  // content area; inline fills the drawer/modal body), so the wrapping
  // ModuleProvider carries the height through (h-full).
  return (
    <ModuleProvider module="crm" className="h-full">
      <OrderWizardInner {...props} />
    </ModuleProvider>
  );
}

function OrderWizardInner({
  presentation = 'page',
  customers,
  preselectedCustomerId,
}: OrderWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Customer
  const [customerId, setCustomerId] = React.useState(preselectedCustomerId ?? '');
  const [channel, setChannel] = React.useState<Channel>('admin');
  const [currency, setCurrency] = React.useState('USD');

  // Line items
  const [items, setItems] = React.useState<LineItem[]>([
    { sku: '', name: '', quantity: 1, unitPrice: 0, taxAmount: 0, discountAmount: 0 },
  ]);

  // Details
  const [source, setSource] = React.useState('');
  const [shipping, setShipping] = React.useState('');
  const [customerNote, setCustomerNote] = React.useState('');
  const [internalNote, setInternalNote] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const validItems = items.filter((it) => it.sku.trim() && it.name.trim());

  // Live totals (server is authoritative; this mirrors the line editor's math).
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const taxTotal = items.reduce((s, it) => s + (it.taxAmount || 0), 0);
  const discountTotal = items.reduce((s, it) => s + (it.discountAmount || 0), 0);
  const shippingNum = parseMoney(shipping);
  const total = subtotal - discountTotal + taxTotal + shippingNum;

  const customerLabel = customers.find((c) => c.id === customerId)?.label ?? '—';

  // Unsaved-changes guard. A create form starts blank, so "dirty" is "the user
  // entered anything" — guard a Cancel / Close / backdrop so a half-built order
  // isn't silently discarded.
  const dirty =
    Boolean(customerId) ||
    channel !== 'admin' ||
    currency.trim().toUpperCase() !== 'USD' ||
    validItems.length > 0 ||
    source.trim() !== '' ||
    shipping.trim() !== '' ||
    customerNote.trim() !== '' ||
    internalNote.trim() !== '';
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'order' });

  // Where "leave the form" goes. In the overlay it clears the detail token so the
  // drawer/modal closes in place; the page route returns to the list.
  const close = React.useCallback(() => {
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/crm/orders');
    }
  }, [presentation, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work. The create path (router.push) leaves on its own, unguarded.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!customerId) {
      setError('Choose a customer.');
      return;
    }
    if (validItems.length === 0) {
      setError('Add at least one line item with a SKU and a name.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const input = {
        customerId,
        channel,
        source: source.trim() || undefined,
        currency: (currency.trim() || 'USD').toUpperCase().slice(0, 3),
        shippingTotal: shippingNum,
        customerNote: customerNote.trim() || undefined,
        internalNote: internalNote.trim() || undefined,
        items: validItems,
      };
      const result = await createOrderAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      // Created → go view the order. Navigating away clears the overlay token,
      // so the drawer/modal closes on its own.
      router.push(`/crm/orders/${result.data.id}`);
      router.refresh();
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Live draft summary (the F layout's right column, docs/86) ─────────────────
  // The running totals — this is the "review" the old step 4 used to be.
  const summary = (
    <SurfaceSummary
      title="Draft summary"
      footer={
        <Badge color="module" variant="soft" size="sm">
          Editable after create
        </Badge>
      }
    >
      <SurfaceSummaryRow label="Customer" value={customerLabel} />
      <SurfaceSummaryRow
        label="Channel"
        value={CHANNELS.find((c) => c.value === channel)?.label ?? channel}
      />
      <SurfaceSummaryRow label="Currency" value={(currency || 'USD').toUpperCase()} />
      <SurfaceSummaryRow label="Line items" value={String(validItems.length)} />
      <SurfaceSummaryDivider />
      <SurfaceSummaryRow label="Subtotal" value={money(subtotal, currency)} />
      {discountTotal > 0 && (
        <SurfaceSummaryRow label="Discount" value={`- ${money(discountTotal, currency)}`} />
      )}
      {taxTotal > 0 && <SurfaceSummaryRow label="Tax" value={money(taxTotal, currency)} />}
      {shippingNum > 0 && (
        <SurfaceSummaryRow label="Shipping" value={money(shippingNum, currency)} />
      )}
      <SurfaceSummaryDivider />
      <SurfaceSummaryRow label="Total" value={money(total, currency)} strong />
    </SurfaceSummary>
  );

  // ── Frame ──────────────────────────────────────────────────────────────────
  // Single-page: one SurfaceStep stacking customer / line items / details / notes.
  // A customer is required, so the primary stays disabled until one is chosen; the
  // line-item requirement surfaces as an inline error on submit.
  return (
    <SurfaceFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New order"
      backLabel="Orders"
      headerActions={
        presentation === 'page' ? (
          <ViewSwitcher typeId="order" entityId={CREATE_SENTINEL} current="page" />
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
          nextLabel: 'Create order',
          nextLoading: submitting,
          nextDisabled: submitting || !customerId,
        }}
      >
        <div className="flex flex-col gap-5">
          {/* Customer */}
          <Card>
            <CardBody>
              <h3 className="text-xl font-semibold">Customer</h3>
              <p className="text-base-content/70 text-sm">
                An order is placed for a single customer, through a channel.
              </p>
              <div className="flex flex-col gap-4">
                <Field>
                  <FieldLabel>Customer</FieldLabel>
                  <NativeSelect value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">Choose a customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Channel</FieldLabel>
                    <NativeSelect
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as Channel)}
                    >
                      {CHANNELS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field className="max-w-[8rem]">
                    <FieldLabel>Currency</FieldLabel>
                    <FieldControl
                      name="ow-currency"
                      value={currency}
                      maxLength={3}
                      className="uppercase"
                      onChange={(e) => setCurrency(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Line items */}
          <Card>
            <CardBody>
              <h3 className="text-xl font-semibold">Line items</h3>
              <p className="text-base-content/70 text-sm">
                SKU, name, quantity, unit price, and any per-line tax or discount.
              </p>
              <LineItemsEditor onChange={setItems} initialItems={items} />
            </CardBody>
          </Card>

          {/* Details */}
          <Card>
            <CardBody>
              <h3 className="text-xl font-semibold">Details</h3>
              <p className="text-base-content/70 text-sm">
                A source reference and header shipping — all optional.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Source</FieldLabel>
                  <FieldControl
                    name="ow-source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="quote:Q-000123, ref:…"
                  />
                </Field>
                <Field className="max-w-[10rem]">
                  <FieldLabel>Shipping</FieldLabel>
                  <FieldControl
                    name="ow-shipping"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                    placeholder="0.00"
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          {/* Notes */}
          <Card>
            <CardBody>
              <h3 className="text-xl font-semibold">Notes</h3>
              <div className="flex flex-col gap-3">
                <Field>
                  <FieldLabel>Customer-facing note</FieldLabel>
                  <FieldControl
                    name="ow-cust-note"
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    render={
                      <Textarea
                        rows={3}
                        placeholder="Shown on the order — anything the customer should see."
                      />
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Internal note</FieldLabel>
                  <FieldControl
                    name="ow-int-note"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    render={<Textarea rows={3} placeholder="Only your team sees this." />}
                  />
                </Field>
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
