'use client';

// Quote creation wizard (docs/86 SurfaceFrame, docs/68). The one-shot quote
// builder — it composes a COMPLETE draft quote in a guided flow:
//   1. Bill to   — the customer and/or B2B account it's for, plus currency.
//   2. Line items — the priced lines (SKU, name, qty, unit price, per-line tax
//                   and discount), via the shared LineItemsEditor.
//   3. Terms     — shipping, payment terms, an expiry, and notes (all optional).
//   4. Review    — the summary + totals. Create.
//
// Everything is composed locally and committed in a single `createQuoteAction`
// on finish (the quote API takes the header + items together), then the user
// lands on the new draft. Mirrors the Invoice/Document wizard's shape; the line
// editor is shared with the New-order form.
//
// Presentation (like the other create-wizards): the `/new` route renders the
// in-app `embedded` top stepper (full page inside the dashboard chrome); the
// Quotes list opens it inside the drawer/modal detail chrome (`overlay` →
// SurfaceFrame `inline`), picked by the user's `defaultDetailView`. Finishing
// navigates to the new quote, which clears the overlay token — closing the
// drawer/modal on its own.

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Badge,
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
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createQuoteAction } from '../../../quote-actions';
import { LineItemsEditor, type LineItem } from '../../../_components/line-items-editor';

// ─── Public option shape (resolved server-side, passed in) ────────────────────────

export interface PartyOption {
  id: string;
  label: string;
}

export interface QuoteWizardProps {
  /** `'page'` = the in-app full-page `/new` route (embedded top stepper, inside
   *  the dashboard chrome); `'overlay'` = the drawer/modal detail chrome (the
   *  `defaultDetailView` preference picks which). */
  presentation?: 'page' | 'overlay';
  customers: PartyOption[];
  b2bAccounts: PartyOption[];
  preselectedCustomerId?: string | null;
}

type StepKey = 'billto' | 'lines' | 'terms' | 'review';
type QuoteTerms = '' | 'prepay' | 'net15' | 'net30' | 'net60' | 'net90';

const STEP_ORDER: StepKey[] = ['billto', 'lines', 'terms', 'review'];

const ALL_STEPS: Record<StepKey, SurfaceStepDef> = {
  billto: { key: 'billto', label: 'Bill to', sublabel: 'Customer' },
  lines: { key: 'lines', label: 'Line items', sublabel: 'The quote' },
  terms: { key: 'terms', label: 'Terms', sublabel: 'Shipping & notes' },
  review: { key: 'review', label: 'Review', sublabel: 'Create' },
};

const RAIL: Record<StepKey, { context: string }> = {
  billto: { context: 'At least one of customer or B2B account is required.' },
  lines: { context: 'Drafts can be edited freely after creating.' },
  terms: { context: 'All optional — leave a field blank to skip it.' },
  review: { context: 'Submitting later locks the quote; accepted quotes convert to an order.' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────────

function parseMoney(value: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function toIsoDate(value: string): string | undefined {
  const s = value.trim();
  if (!s) return undefined;
  return new Date(`${s}T00:00:00Z`).toISOString();
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

function partyLabel(
  customerId: string,
  b2bAccountId: string,
  customers: PartyOption[],
  b2bAccounts: PartyOption[]
): string {
  const parts: string[] = [];
  const acct = b2bAccounts.find((a) => a.id === b2bAccountId);
  const cust = customers.find((c) => c.id === customerId);
  if (acct) parts.push(acct.label);
  if (cust) parts.push(cust.label);
  return parts.length ? parts.join(' · ') : '—';
}

// ─── Component ────────────────────────────────────────────────────────────────────

export function QuoteWizard(props: QuoteWizardProps) {
  // Both presentations are full-height top-stepper frames (embedded fills the
  // dashboard content area; inline fills the drawer/modal body), so the wrapping
  // ModuleProvider carries the height through (h-full).
  return (
    <ModuleProvider module="crm" className="h-full">
      <QuoteWizardInner {...props} />
    </ModuleProvider>
  );
}

function QuoteWizardInner({
  presentation = 'page',
  customers,
  b2bAccounts,
  preselectedCustomerId,
}: QuoteWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [stepKey, setStepKey] = React.useState<StepKey>('billto');

  // Step 1 — bill to
  const [customerId, setCustomerId] = React.useState(preselectedCustomerId ?? '');
  const [b2bAccountId, setB2bAccountId] = React.useState('');
  const [currency, setCurrency] = React.useState('USD');

  // Step 2 — line items
  const [items, setItems] = React.useState<LineItem[]>([
    { sku: '', name: '', quantity: 1, unitPrice: 0, taxAmount: 0, discountAmount: 0 },
  ]);

  // Step 3 — terms & notes
  const [shipping, setShipping] = React.useState('');
  const [paymentTerms, setPaymentTerms] = React.useState<QuoteTerms>('');
  const [validUntil, setValidUntil] = React.useState('');
  const [customerNote, setCustomerNote] = React.useState('');
  const [internalNote, setInternalNote] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const steps: SurfaceStepDef[] = STEP_ORDER.map((k) => ALL_STEPS[k]);
  const current = Math.max(
    0,
    steps.findIndex((s) => s.key === stepKey)
  );

  const hasParty = Boolean(customerId) || Boolean(b2bAccountId);
  const validItems = items.filter((it) => it.sku.trim() && it.name.trim());

  // Live totals (server is authoritative; this mirrors the line editor's math).
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const taxTotal = items.reduce((s, it) => s + (it.taxAmount || 0), 0);
  const discountTotal = items.reduce((s, it) => s + (it.discountAmount || 0), 0);
  const shippingNum = parseMoney(shipping);
  const total = subtotal - discountTotal + taxTotal + shippingNum;

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
      router.push('/crm/quotes');
    }
  }, [presentation, pathname, searchParams, router]);

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!hasParty) {
      setError('Choose a customer or a B2B account.');
      goToStep('billto');
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
        customerId: customerId || undefined,
        b2bAccountId: b2bAccountId || undefined,
        currency: (currency.trim() || 'USD').toUpperCase().slice(0, 3),
        shippingTotal: shippingNum,
        paymentTerms: paymentTerms || undefined,
        validUntil: toIsoDate(validUntil),
        customerNote: customerNote.trim() || undefined,
        internalNote: internalNote.trim() || undefined,
        items: validItems,
      };
      const result = await createQuoteAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      // Created → go view the quote. Navigating away clears the overlay token,
      // so the drawer/modal closes on its own.
      router.push(`/crm/quotes/${result.data.id}`);
      router.refresh();
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step bodies ──────────────────────────────────────────────────────────────

  const billToStep = (
    <SurfaceStep
      header={{
        title: 'Who is this quote for?',
        supporting: 'Anchor the quote to a retail customer, a B2B account, or both.',
      }}
      actions={{
        onNext: () => {
          if (!hasParty) {
            setError('Choose a customer or a B2B account.');
            return;
          }
          goToStep('lines');
        },
        nextLabel: 'Continue',
        nextDisabled: !hasParty || submitting,
      }}
    >
      <Card variant="module">
        <CardHeader>
          <Heading level={3}>Customer</Heading>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="qw-customer">Customer</Label>
                <NativeSelect
                  id="qw-customer"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">(none)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="qw-b2b">B2B account</Label>
                <NativeSelect
                  id="qw-b2b"
                  value={b2bAccountId}
                  onChange={(e) => setB2bAccountId(e.target.value)}
                >
                  <option value="">(none)</option>
                  {b2bAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <Text size="xs" variant="muted">
              At least one of customer or B2B account is required. A B2B account can also carry a
              contact customer.
            </Text>
            <div className="max-w-[8rem]">
              <Label htmlFor="qw-currency">Currency</Label>
              <Input
                id="qw-currency"
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
    </SurfaceStep>
  );

  const linesStep = (
    <SurfaceStep
      header={{
        title: 'Line items',
        supporting:
          'Add the quote lines — SKU, name, quantity, unit price, and any per-line tax or discount.',
      }}
      actions={{
        onBack: () => goToStep('billto'),
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
          <LineItemsEditor onChange={setItems} initialItems={items} />
        </CardContent>
      </Card>
    </SurfaceStep>
  );

  const termsStep = (
    <SurfaceStep
      header={{
        title: 'Terms & notes',
        supporting: 'Shipping, payment terms, an expiry, and notes. Everything here is optional.',
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
            <Heading level={3}>Terms</Heading>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="qw-shipping">Shipping</Label>
                <Input
                  id="qw-shipping"
                  type="number"
                  min="0"
                  step="0.01"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="qw-terms">Payment terms</Label>
                <NativeSelect
                  id="qw-terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value as QuoteTerms)}
                >
                  <option value="">(unspecified)</option>
                  <option value="prepay">Prepay</option>
                  <option value="net15">Net 15</option>
                  <option value="net30">Net 30</option>
                  <option value="net60">Net 60</option>
                  <option value="net90">Net 90</option>
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="qw-valid">Valid until</Label>
                <Input
                  id="qw-valid"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
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
                <Label htmlFor="qw-cust-note">Customer-facing note</Label>
                <Textarea
                  id="qw-cust-note"
                  rows={3}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Shown on the quote — terms, scope, anything the customer should see."
                />
              </div>
              <div>
                <Label htmlFor="qw-int-note">Internal note</Label>
                <Textarea
                  id="qw-int-note"
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
    </SurfaceStep>
  );

  const reviewStep = (
    <SurfaceStep
      header={{
        title: 'Review & create',
        supporting: 'Confirm the quote and create it. It starts as a draft you can keep editing.',
      }}
      actions={{
        onBack: () => goToStep('terms'),
        onNext: () => void handleCreate(),
        nextLabel: 'Create quote',
        nextLoading: submitting,
        nextDisabled: submitting || !hasParty,
      }}
    >
      <div className="flex flex-col gap-5">
        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Summary</Heading>
          </CardHeader>
          <CardContent>
            <Stack gap={2}>
              <SummaryRow
                label="Quote for"
                value={partyLabel(customerId, b2bAccountId, customers, b2bAccounts)}
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
    </SurfaceStep>
  );

  let body: React.ReactNode;
  if (stepKey === 'billto') body = billToStep;
  else if (stepKey === 'lines') body = linesStep;
  else if (stepKey === 'terms') body = termsStep;
  else body = reviewStep;

  // ── Frame ──────────────────────────────────────────────────────────────────

  const onStepSelect = (key: string) => {
    const target = steps.findIndex((s) => s.key === key);
    if (target >= 0 && target <= current) goToStep(key as StepKey);
  };
  const canSelectStep = (_key: string, index: number) => index <= current;

  // The live draft summary — the F layout's right-hand column (docs/86). Mirrors
  // the Review step's totals so the running figures are visible from step one.
  const summary = (
    <SurfaceSummary
      title="Draft summary"
      footer={
        <Badge color="module" variant="soft" size="sm">
          Draft — editable after create
        </Badge>
      }
    >
      <SurfaceSummaryRow
        label="Quote for"
        value={partyLabel(customerId, b2bAccountId, customers, b2bAccounts)}
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

  // One top-stepper frame for both presentations: `embedded` fills the dashboard
  // content area at `/new` (sidebar + header stay); `inline` fills the drawer/
  // modal detail panel, which supplies its own chrome.
  return (
    <SurfaceFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New quote"
      steps={steps}
      current={current}
      context={RAIL[stepKey].context}
      onStepSelect={onStepSelect}
      canSelectStep={canSelectStep}
      onCancel={close}
      summary={summary}
    >
      {body}
    </SurfaceFrame>
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
