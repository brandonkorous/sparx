'use client';

// Order creation wizard (docs/86 WizardFrame, docs/68). The manual-order builder
// — it composes a COMPLETE order in a guided flow:
//   1. Customer  — the customer (required), channel, and currency.
//   2. Line items — the priced lines (SKU, name, qty, unit price, per-line tax
//                   and discount), via the shared LineItemsEditor.
//   3. Details   — source, shipping, and notes (all optional).
//   4. Review    — the summary + totals. Create.
//
// Everything is composed locally and committed in a single `createOrderAction`
// on finish (the order API takes the header + items together; the service emits
// `order.created` after the transaction commits), then the user lands on the new
// order. Mirrors the Quote wizard; the line editor is shared with it.
//
// Presentation (like the other create-wizards): the `/new` route renders the
// in-app `embedded` top stepper (full page inside the dashboard chrome); the
// Orders list opens it inside the drawer/modal detail chrome (`overlay` →
// WizardFrame `inline`), picked by the user's `defaultDetailView`. Finishing
// navigates to the new order, which clears the overlay token — closing the
// drawer/modal on its own.

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardHeader,
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

import { createOrderAction } from '../../../order-actions';
import { LineItemsEditor, type LineItem } from '../../../_components/line-items-editor';

// ─── Public option shape (resolved server-side, passed in) ────────────────────────

export interface CustomerOption {
  id: string;
  label: string;
}

export interface OrderWizardProps {
  /** `'page'` = the in-app full-page `/new` route (embedded top stepper, inside
   *  the dashboard chrome); `'overlay'` = the drawer/modal detail chrome (the
   *  `defaultDetailView` preference picks which). */
  presentation?: 'page' | 'overlay';
  customers: CustomerOption[];
  preselectedCustomerId?: string | null;
}

type StepKey = 'customer' | 'lines' | 'details' | 'review';
type Channel = 'admin' | 'storefront' | 'b2b_portal' | 'import' | 'mcp';

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'storefront', label: 'Storefront' },
  { value: 'b2b_portal', label: 'B2B portal' },
  { value: 'import', label: 'Import' },
  { value: 'mcp', label: 'MCP' },
];

const STEP_ORDER: StepKey[] = ['customer', 'lines', 'details', 'review'];

const ALL_STEPS: Record<StepKey, WizardStepDef> = {
  customer: { key: 'customer', label: 'Customer', sublabel: 'Who & how' },
  lines: { key: 'lines', label: 'Line items', sublabel: 'The order' },
  details: { key: 'details', label: 'Details', sublabel: 'Shipping & notes' },
  review: { key: 'review', label: 'Review', sublabel: 'Create' },
};

const RAIL: Record<StepKey, { context: string }> = {
  customer: { context: 'An order is placed for a single customer.' },
  lines: { context: 'Totals derive from line items + header shipping.' },
  details: { context: 'All optional — leave a field blank to skip it.' },
  review: { context: 'The service emits order.created after the order commits.' },
};

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
  // Both presentations are full-height top-stepper frames (embedded fills the
  // dashboard content area; inline fills the drawer/modal body), so the wrapping
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

  const [stepKey, setStepKey] = React.useState<StepKey>('customer');

  // Step 1 — customer
  const [customerId, setCustomerId] = React.useState(preselectedCustomerId ?? '');
  const [channel, setChannel] = React.useState<Channel>('admin');
  const [currency, setCurrency] = React.useState('USD');

  // Step 2 — line items
  const [items, setItems] = React.useState<LineItem[]>([
    { sku: '', name: '', quantity: 1, unitPrice: 0, taxAmount: 0, discountAmount: 0 },
  ]);

  // Step 3 — details
  const [source, setSource] = React.useState('');
  const [shipping, setShipping] = React.useState('');
  const [customerNote, setCustomerNote] = React.useState('');
  const [internalNote, setInternalNote] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const steps: WizardStepDef[] = STEP_ORDER.map((k) => ALL_STEPS[k]);
  const current = Math.max(
    0,
    steps.findIndex((s) => s.key === stepKey)
  );

  const validItems = items.filter((it) => it.sku.trim() && it.name.trim());

  // Live totals (server is authoritative; this mirrors the line editor's math).
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const taxTotal = items.reduce((s, it) => s + (it.taxAmount || 0), 0);
  const discountTotal = items.reduce((s, it) => s + (it.discountAmount || 0), 0);
  const shippingNum = parseMoney(shipping);
  const total = subtotal - discountTotal + taxTotal + shippingNum;

  const customerLabel = customers.find((c) => c.id === customerId)?.label ?? '—';

  function goToStep(key: StepKey) {
    setError(null);
    setStepKey(key);
  }

  // Where "leave the wizard" goes. In the overlay it clears the detail token so
  // the drawer/modal closes in place; the page route returns to the list.
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

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!customerId) {
      setError('Choose a customer.');
      goToStep('customer');
      return;
    }
    if (validItems.length === 0) {
      setError('Add at least one line item with a SKU and a name.');
      goToStep('lines');
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

  // ── Step bodies ──────────────────────────────────────────────────────────────

  const customerStep = (
    <WizardStep
      header={{
        title: 'Who is this order for?',
        supporting: 'An order is placed for a single customer, through a channel.',
      }}
      actions={{
        onNext: () => {
          if (!customerId) {
            setError('Choose a customer.');
            return;
          }
          goToStep('lines');
        },
        nextLabel: 'Continue',
        nextDisabled: !customerId || submitting,
      }}
    >
      <Card variant="module">
        <CardHeader>
          <Heading level={3}>Customer</Heading>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="ow-customer">Customer</Label>
              <NativeSelect
                id="ow-customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Choose a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ow-channel">Channel</Label>
                <NativeSelect
                  id="ow-channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as Channel)}
                >
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="max-w-[8rem]">
                <Label htmlFor="ow-currency">Currency</Label>
                <Input
                  id="ow-currency"
                  value={currency}
                  maxLength={3}
                  className="uppercase"
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </div>
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
        title: 'Line items',
        supporting:
          'Add the order lines — SKU, name, quantity, unit price, and any per-line tax or discount.',
      }}
      actions={{
        onBack: () => goToStep('customer'),
        onNext: () => goToStep('details'),
        nextLabel: 'Continue',
        nextDisabled: submitting,
      }}
    >
      <Card variant="module">
        <CardHeader>
          <Heading level={3}>Lines</Heading>
        </CardHeader>
        <CardContent>
          <LineItemsEditor onChange={setItems} initialItems={items} />
        </CardContent>
      </Card>
    </WizardStep>
  );

  const detailsStep = (
    <WizardStep
      header={{
        title: 'Shipping & notes',
        supporting: 'A source reference, header shipping, and notes. Everything here is optional.',
      }}
      actions={{
        onBack: () => goToStep('lines'),
        onNext: () => goToStep('review'),
        nextLabel: 'Continue',
        nextDisabled: submitting,
      }}
    >
      <div className="flex flex-col gap-5">
        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Details</Heading>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ow-source">Source</Label>
                <Input
                  id="ow-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="quote:Q-000123, ref:…"
                />
              </div>
              <div className="max-w-[10rem]">
                <Label htmlFor="ow-shipping">Shipping</Label>
                <Input
                  id="ow-shipping"
                  type="number"
                  min="0"
                  step="0.01"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Notes</Heading>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div>
                <Label htmlFor="ow-cust-note">Customer-facing note</Label>
                <Textarea
                  id="ow-cust-note"
                  rows={3}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Shown on the order — anything the customer should see."
                />
              </div>
              <div>
                <Label htmlFor="ow-int-note">Internal note</Label>
                <Textarea
                  id="ow-int-note"
                  rows={3}
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Only your team sees this."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </WizardStep>
  );

  const reviewStep = (
    <WizardStep
      header={{
        title: 'Review & create',
        supporting: 'Confirm the order and place it.',
      }}
      actions={{
        onBack: () => goToStep('details'),
        onNext: () => void handleCreate(),
        nextLabel: 'Create order',
        nextLoading: submitting,
        nextDisabled: submitting || !customerId,
      }}
    >
      <div className="flex flex-col gap-5">
        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Summary</Heading>
          </CardHeader>
          <CardContent>
            <Stack gap={2}>
              <SummaryRow label="Customer" value={customerLabel} />
              <SummaryRow
                label="Channel"
                value={CHANNELS.find((c) => c.value === channel)?.label ?? channel}
              />
              <SummaryRow label="Currency" value={(currency || 'USD').toUpperCase()} />
              <SummaryRow label="Line items" value={String(validItems.length)} />
              <div className="border-t border-[var(--color-border-default)] pt-2">
                <SummaryRow label="Subtotal" value={money(subtotal, currency)} />
              </div>
              {discountTotal > 0 && (
                <SummaryRow label="Discount" value={`- ${money(discountTotal, currency)}`} />
              )}
              {taxTotal > 0 && <SummaryRow label="Tax" value={money(taxTotal, currency)} />}
              {shippingNum > 0 && (
                <SummaryRow label="Shipping" value={money(shippingNum, currency)} />
              )}
              <div className="border-t border-[var(--color-border-default)] pt-2">
                <SummaryRow label="Total" value={money(total, currency)} strong />
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
  if (stepKey === 'customer') body = customerStep;
  else if (stepKey === 'lines') body = linesStep;
  else if (stepKey === 'details') body = detailsStep;
  else body = reviewStep;

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

  // One top-stepper frame for both presentations: `embedded` fills the dashboard
  // content area at `/new` (sidebar + header stay); `inline` fills the drawer/
  // modal detail panel, which supplies its own chrome.
  return (
    <WizardFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New order"
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
