'use client';

// Quote creation form (docs/86 SurfaceFrame, docs/68). SINGLE-PAGE (WS1, docs/105):
// the one-shot quote builder composes a COMPLETE draft quote in one scroll:
//   • Bill to    — the customer and/or B2B account it's for, plus currency.
//   • Line items — the priced lines (SKU, name, qty, unit price, per-line tax and
//                  discount), via the shared LineItemsEditor.
//   • Terms      — shipping, payment terms, an expiry, and notes (all optional).
// The old "Review" step is dropped: the live summary column already carries the
// running totals, so it IS the review. Everything is composed locally and committed
// in a single `createQuoteAction` on finish (the quote API takes the header + items
// together), then the user lands on the new draft. The line editor is shared with
// the New-order form.
//
// Presentation: the `/new` route renders the `embedded` full page inside the
// dashboard chrome; the Quotes list opens it inside the drawer/modal detail chrome
// (`overlay` → SurfaceFrame `inline`), picked by the user's `defaultDetailView`.
// Finishing navigates to the new quote, which clears the overlay token.

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
import {
  ModuleProvider,
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createQuoteAction } from '../../../quote-actions';
import { LineItemsEditor, type LineItem } from '../../../_components/line-items-editor';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';
import { useDetailFooterNode } from '../../../../_components/detail-header-slot';
import { CREATE_SENTINEL } from '../../../../_shell/detail-registry';
import { ViewSwitcher } from '../../../../_components/detail-panel';

// ─── Public option shape (resolved server-side, passed in) ────────────────────────

export interface PartyOption {
  id: string;
  label: string;
}

export interface QuoteWizardProps {
  /** `'page'` = the in-app full-page `/new` route (embedded, inside the dashboard
   *  chrome); `'overlay'` = the drawer/modal detail chrome (the `defaultDetailView`
   *  preference picks which). */
  presentation?: 'page' | 'overlay';
  customers: PartyOption[];
  b2bAccounts: PartyOption[];
  preselectedCustomerId?: string | null;
}

type QuoteTerms = '' | 'prepay' | 'net15' | 'net30' | 'net60' | 'net90';

// Single-page form = one step, so SurfaceFrame's MiniProgress auto-hides and the
// toolbar is Cancel + Create (no Back/Continue).
const SINGLE_STEP: SurfaceStepDef[] = [{ key: 'quote', label: 'Quote' }];

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
  // Both presentations are full-height frames (embedded fills the dashboard
  // content area; inline fills the drawer/modal body), so the wrapping
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
  // The overlay host (drawer/modal) already renders a footer-slot row for
  // Cancel/Save; handing it to SurfaceFrame merges the frame's own toolbar
  // into THAT row instead of stacking a second one underneath it — null
  // until the host mounts.
  const overlayActionsTarget = useDetailFooterNode();

  // Bill to
  const [customerId, setCustomerId] = React.useState(preselectedCustomerId ?? '');
  const [b2bAccountId, setB2bAccountId] = React.useState('');
  const [currency, setCurrency] = React.useState('USD');

  // Line items
  const [items, setItems] = React.useState<LineItem[]>([
    { sku: '', name: '', quantity: 1, unitPrice: 0, taxAmount: 0, discountAmount: 0 },
  ]);

  // Terms & notes
  const [shipping, setShipping] = React.useState('');
  const [paymentTerms, setPaymentTerms] = React.useState<QuoteTerms>('');
  const [validUntil, setValidUntil] = React.useState('');
  const [customerNote, setCustomerNote] = React.useState('');
  const [internalNote, setInternalNote] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasParty = Boolean(customerId) || Boolean(b2bAccountId);
  const validItems = items.filter((it) => it.sku.trim() && it.name.trim());

  // Live totals (server is authoritative; this mirrors the line editor's math).
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const taxTotal = items.reduce((s, it) => s + (it.taxAmount || 0), 0);
  const discountTotal = items.reduce((s, it) => s + (it.discountAmount || 0), 0);
  const shippingNum = parseMoney(shipping);
  const total = subtotal - discountTotal + taxTotal + shippingNum;

  // Unsaved-changes guard. A create form starts blank, so "dirty" is "the user
  // entered anything" — guard a Cancel / Close / backdrop so a half-built quote
  // isn't silently discarded.
  const dirty =
    Boolean(customerId) ||
    Boolean(b2bAccountId) ||
    currency.trim().toUpperCase() !== 'USD' ||
    validItems.length > 0 ||
    shipping.trim() !== '' ||
    paymentTerms !== '' ||
    validUntil.trim() !== '' ||
    customerNote.trim() !== '' ||
    internalNote.trim() !== '';
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'quote' });

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
      router.push('/crm/quotes');
    }
  }, [presentation, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work. The create path (router.push) leaves on its own, unguarded.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!hasParty) {
      setError('Choose a customer or a B2B account.');
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

  // ── Live draft summary (the F layout's right column, docs/86) ─────────────────
  // The running totals — this is the "review" the old step 4 used to be.
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

  // ── Frame ──────────────────────────────────────────────────────────────────
  // Single-page: one SurfaceStep stacking bill-to / line items / terms / notes. A
  // party is required, so the primary stays disabled until one is chosen; the
  // line-item requirement surfaces as an inline error on submit.
  return (
    <SurfaceFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New quote"
      backLabel="Quotes"
      headerActions={
        presentation === 'page' ? (
          <ViewSwitcher typeId="quote" entityId={CREATE_SENTINEL} current="page" />
        ) : undefined
      }
      actionsTarget={presentation === 'overlay' ? overlayActionsTarget : undefined}
      steps={SINGLE_STEP}
      current={0}
      onCancel={cancel}
      summary={summary}
    >
      <SurfaceStep
        actions={{
          onNext: () => void handleCreate(),
          nextLabel: 'Create quote',
          nextLoading: submitting,
          nextDisabled: submitting || !hasParty,
        }}
      >
        <div className="flex flex-col gap-5">
          {/* Bill to */}
          <Card>
            <CardBody>
              <h3 className="text-xl font-semibold">Customer</h3>
              <p className="text-base-content/70 text-sm">
                Anchor the quote to a retail customer, a B2B account, or both — at least one is
                required. A B2B account can also carry a contact customer.
              </p>
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Customer</FieldLabel>
                    <NativeSelect
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
                  </Field>
                  <Field>
                    <FieldLabel>B2B account</FieldLabel>
                    <NativeSelect
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
                  </Field>
                </div>
                <Field className="max-w-[8rem]">
                  <FieldLabel>Currency</FieldLabel>
                  <FieldControl
                    name="qw-currency"
                    value={currency}
                    maxLength={3}
                    className="uppercase"
                    onChange={(e) => setCurrency(e.target.value)}
                  />
                </Field>
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

          {/* Terms */}
          <Card>
            <CardBody>
              <h3 className="text-xl font-semibold">Terms</h3>
              <p className="text-base-content/70 text-sm">
                Shipping, payment terms, and an expiry — all optional.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field>
                  <FieldLabel>Shipping</FieldLabel>
                  <FieldControl
                    name="qw-shipping"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                    placeholder="0.00"
                  />
                </Field>
                <Field>
                  <FieldLabel>Payment terms</FieldLabel>
                  <NativeSelect
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
                </Field>
                <Field>
                  <FieldLabel>Valid until</FieldLabel>
                  <FieldControl
                    name="qw-valid"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
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
                    name="qw-cust-note"
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    render={
                      <Textarea
                        rows={3}
                        placeholder="Shown on the quote — terms, scope, anything the customer should see."
                      />
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Internal note</FieldLabel>
                  <FieldControl
                    name="qw-int-note"
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
