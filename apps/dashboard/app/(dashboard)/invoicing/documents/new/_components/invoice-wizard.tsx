'use client';

// Comprehensive invoice / billing-document creation form (docs/87, docs/86
// SurfaceFrame). SINGLE-PAGE (WS1, docs/105): the "one-shot" document builder
// creates a COMPLETE billing document in one scroll, not just a header:
//   • Bill to — workflow (the document's lifecycle), the customer or B2B account it
//               bills, currency, optional assignee.
//   • Lines   — the typed charges, priced live (manual price, or the markup engine
//               for marked-up parts / pass-through), with running totals.
//   • Charges — document tax rate, shipping, surcharge, due date, valid-until, notes.
//   • Deposit — an optional upfront deposit / payment recorded on create.
//   • Start at stage — which stage to start at (e.g. jump straight to a finalized
//                      Invoice). The old "Review" step is dropped: the live summary
//                      column already carries the totals + deposit, so it IS the review.
//
// Everything is composed locally and committed on finish: create the document, then
// best-effort add each line, record the deposit, and advance to the chosen start
// stage — landing on the new document either way (a failed extra is reported, never
// silently dropped, and never blocks the others; a partial failure shows a recap
// panel with "Open document").
//
// Presentation: the `/new` route renders the `embedded` full page inside the
// dashboard chrome; the Documents list opens it inside the drawer/modal detail
// chrome (`overlay` → SurfaceFrame `inline`), picked by the user's `defaultDetailView`.

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';

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
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import {
  advanceStageAction,
  addLineAction,
  createDocumentAction,
  recordPaymentAction,
} from '../../../document-actions';
import { formatMoney } from '../../../_components/format';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';
import { useDetailFooterNode } from '../../../../_components/detail-header-slot';
import { ViewSwitcher } from '../../../../_components/detail-panel';
import { CREATE_SENTINEL } from '../../../../_shell/detail-registry';
import {
  freshMarkupState,
  isMarkupMode,
  MarkupFields,
  type MarkupRuleSummary,
  type MarkupState,
  resolveMarkup,
  SELECT_CLASS,
} from '../../_lib/markup';

// ─── Public option shapes (resolved server-side, passed in) ──────────────────────

export interface StageOption {
  id: string;
  name: string;
  customerLabel: string;
  stageType: string;
  sortOrder: number;
  numberOnEnter: boolean;
  snapshotOnEnter: boolean;
  locksEditing: boolean;
}
export interface WorkflowOption {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  stages: StageOption[];
}
export interface PartyOption {
  id: string;
  label: string;
}
export interface LineTypeOption {
  id: string;
  key: string;
  label: string;
  pricingMode: string;
  defaultTaxable: boolean;
}

export interface InvoiceWizardProps {
  /** `'page'` = full-screen `/new` route; `'overlay'` = inside the dashboard
   *  drawer/modal detail chrome (the `defaultDetailView` preference picks which). */
  presentation?: 'page' | 'overlay';
  workflows: WorkflowOption[];
  customers: PartyOption[];
  b2bAccounts: PartyOption[];
  lineTypes: LineTypeOption[];
  markupRules: MarkupRuleSummary[];
  /** Current user id — powers the "Assign to me" toggle (optional assignee). */
  currentUserId?: string;
  preselectedCustomerId?: string | null;
  preselectedAccountId?: string | null;
  /** Workflow id to start on, e.g. deep-linking "New Quote" from B2B onto the
   *  system `b2b-quotes` workflow. Falls back to the tenant's default workflow. */
  preselectedWorkflowId?: string | null;
}

// A line composed locally before the document exists. `display` drives the running
// totals + the summary; `payload` is the exact AddBillingLine body sent on finish
// (so a markup line is priced server-side identically to the editor).
interface LocalLine {
  tempId: string;
  typeLabel: string;
  description: string;
  quantity: number;
  unitPrice: number; // effective unit price (dollars) for the running total
  taxable: boolean;
  payload: Record<string, unknown>;
}

// Single-page form = one step, so SurfaceFrame's MiniProgress auto-hides and the
// toolbar is Cancel + Create (no Back/Continue).
const SINGLE_STEP: SurfaceStepDef[] = [{ key: 'document', label: 'Document' }];

// ─── Parsing helpers ──────────────────────────────────────────────────────────────

/** A money string → a non-negative number rounded to cents. */
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

// A money/charge field is optional but, when present, must be a non-negative number.
function optionalNonNegative(value: string): string | null {
  const s = value.trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return 'Enter a valid amount.';
  if (n < 0) return 'Must be 0 or more.';
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────────

export function InvoiceWizard(props: InvoiceWizardProps) {
  // Both presentations are full-height frames (embedded fills the dashboard
  // content area; inline fills the drawer/modal body), so the wrapping
  // ModuleProvider carries the height through (h-full).
  return (
    <ModuleProvider module="invoicing" className="h-full">
      <InvoiceWizardInner {...props} />
    </ModuleProvider>
  );
}

function InvoiceWizardInner({
  presentation = 'page',
  workflows,
  customers,
  b2bAccounts,
  lineTypes,
  markupRules,
  currentUserId,
  preselectedCustomerId,
  preselectedAccountId,
  preselectedWorkflowId,
}: InvoiceWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The overlay host (drawer/modal) already renders a footer-slot row for
  // Cancel/Save; handing it to SurfaceFrame merges the frame's own toolbar
  // into THAT row instead of stacking a second one underneath it — null
  // until the host mounts.
  const overlayActionsTarget = useDetailFooterNode();

  const defaultWorkflow = workflows.find((w) => w.isDefault) ?? workflows[0];
  const preselectedWorkflow = preselectedWorkflowId
    ? workflows.find((w) => w.id === preselectedWorkflowId)
    : undefined;

  // Bill to
  const [workflowId, setWorkflowId] = React.useState(
    (preselectedWorkflow ?? defaultWorkflow)?.id ?? ''
  );
  const [customerId, setCustomerId] = React.useState(preselectedCustomerId ?? '');
  const [b2bAccountId, setB2bAccountId] = React.useState(preselectedAccountId ?? '');
  const [assignToMe, setAssignToMe] = React.useState(false);
  const [currency, setCurrency] = React.useState('USD');

  // Lines
  const [lines, setLines] = React.useState<LocalLine[]>([]);

  // Charges & terms
  const [taxRatePct, setTaxRatePct] = React.useState('0');
  const [shipping, setShipping] = React.useState('');
  const [surcharge, setSurcharge] = React.useState('');
  const [dueAt, setDueAt] = React.useState('');
  const [validUntil, setValidUntil] = React.useState('');
  const [notes, setNotes] = React.useState('');

  // Deposit
  const [depositKind, setDepositKind] = React.useState<'deposit' | 'payment'>('deposit');
  const [depositMethod, setDepositMethod] = React.useState('card');
  const [depositAmount, setDepositAmount] = React.useState('');
  const [depositReference, setDepositReference] = React.useState('');

  // Start stage
  const selectedWorkflow = workflows.find((w) => w.id === workflowId) ?? defaultWorkflow;
  const stages = React.useMemo(
    () => (selectedWorkflow?.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [selectedWorkflow]
  );
  const firstStageId = stages[0]?.id ?? '';
  const [startStageId, setStartStageId] = React.useState(firstStageId);

  // When the workflow changes, snap the start stage back to its first stage.
  React.useEffect(() => {
    setStartStageId(firstStageId);
  }, [firstStageId]);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdDocId, setCreatedDocId] = React.useState<string | null>(null);
  const [partialFailures, setPartialFailures] = React.useState<string[]>([]);

  const hasParty = Boolean(customerId) || Boolean(b2bAccountId);

  // Document-level charge fields are optional, but a filled value must be a valid,
  // non-negative number (tax additionally caps at 100%).
  const v = useFieldValidation(
    { taxRatePct, shipping, surcharge, depositAmount },
    {
      taxRatePct: (val) => {
        const s = String(val ?? '').trim();
        if (s === '') return null;
        const n = Number(s);
        if (!Number.isFinite(n)) return 'Enter a valid rate.';
        if (n < 0 || n > 100) return 'Enter a rate between 0 and 100.';
        return null;
      },
      shipping: optionalNonNegative,
      surcharge: optionalNonNegative,
      depositAmount: optionalNonNegative,
    }
  );

  // Live totals (server is authoritative; this mirrors its math for preview).
  const taxPct = Math.min(100, Math.max(0, Number(taxRatePct) || 0));
  const shippingNum = parseMoney(shipping);
  const surchargeNum = parseMoney(surcharge);
  const depositNum = parseMoney(depositAmount);
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const taxableBase = lines.reduce((s, l) => s + (l.taxable ? l.quantity * l.unitPrice : 0), 0);
  const taxTotal = (taxableBase * taxPct) / 100;
  const total = subtotal + taxTotal + shippingNum + surchargeNum;
  const balance = Math.max(0, total - depositNum);

  function addLocalLine(line: LocalLine) {
    setLines((prev) => [...prev, line]);
  }
  function removeLocalLine(tempId: string) {
    setLines((prev) => prev.filter((l) => l.tempId !== tempId));
  }

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
      router.push('/invoicing/documents');
    }
  }, [presentation, pathname, searchParams, router]);

  // Unsaved-changes guard. A create form starts blank, so "dirty" is "the user
  // entered or changed anything" — the workflow/party moved off the defaults, added
  // lines, any charge/term, or a deposit. Guards a Cancel / Close / backdrop so a
  // half-built document isn't silently discarded. (Once the document is created —
  // `createdDocId` — the form only offers "Open document".)
  const dirty =
    !createdDocId &&
    (workflowId !== ((preselectedWorkflow ?? defaultWorkflow)?.id ?? '') ||
      customerId !== (preselectedCustomerId ?? '') ||
      b2bAccountId !== (preselectedAccountId ?? '') ||
      assignToMe ||
      currency.trim().toUpperCase() !== 'USD' ||
      lines.length > 0 ||
      taxRatePct.trim() !== '0' ||
      shipping.trim() !== '' ||
      surcharge.trim() !== '' ||
      dueAt.trim() !== '' ||
      validUntil.trim() !== '' ||
      notes.trim() !== '' ||
      depositAmount.trim() !== '' ||
      depositReference.trim() !== '');
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'document' });

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work. The create path (router.push) leaves on its own, unguarded.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  const openDocument = React.useCallback(() => {
    if (!createdDocId) return;
    router.push(`/invoicing/documents/${createdDocId}`);
    router.refresh();
  }, [createdDocId, router]);

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!hasParty) {
      setError('Choose a customer or a B2B account to bill.');
      return;
    }
    if (!v.validate()) return;
    setError(null);
    setSubmitting(true);
    try {
      const input = {
        workflowId,
        customerId: customerId || undefined,
        b2bAccountId: b2bAccountId || undefined,
        assignedUserId: assignToMe && currentUserId ? currentUserId : undefined,
        currency: (currency.trim() || 'USD').toUpperCase().slice(0, 3),
        taxRate: Math.min(1, Math.max(0, taxPct / 100)),
        shippingTotal: shippingNum,
        surchargeTotal: surchargeNum,
        notes: notes.trim() || undefined,
        dueAt: toIsoDate(dueAt),
        validUntil: toIsoDate(validUntil),
      };

      const result = await createDocumentAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      const docId = result.data.id;

      // Best-effort, in order: the document is already saved, so a failed extra is
      // reported (never silently dropped) and never aborts the rest.
      const failed: string[] = [];

      for (const [i, line] of lines.entries()) {
        const res = await addLineAction(docId, line.payload);
        if (!res.ok) failed.push(`line ${i + 1} (${line.description || 'untitled'})`);
      }

      if (depositNum > 0) {
        const res = await recordPaymentAction(docId, {
          kind: depositKind,
          method: depositMethod,
          amount: depositNum,
          reference: depositReference.trim() || undefined,
        });
        if (!res.ok) failed.push('deposit');
      }

      if (startStageId && startStageId !== firstStageId) {
        const res = await advanceStageAction(docId, startStageId);
        if (!res.ok) failed.push('start stage');
      }

      if (failed.length === 0) {
        router.push(`/invoicing/documents/${docId}`);
        router.refresh();
        return;
      }
      // Partial success — surface what didn't take and let them open the document.
      setCreatedDocId(docId);
      setPartialFailures(failed);
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Live draft summary (the F layout's right column, docs/86) ─────────────────
  // The totals + deposit — this is the "review" the old step 5 used to be. The
  // footer reflects the chosen start stage (it may finalize the document).
  const startStage = stages.find((s) => s.id === startStageId);
  const summary = (
    <SurfaceSummary
      title="Draft summary"
      footer={
        <Badge color="module" variant="soft" size="sm">
          {startStage && startStageId !== firstStageId
            ? `Starts at ${startStage.customerLabel}`
            : 'Draft — editable after create'}
        </Badge>
      }
    >
      <SurfaceSummaryRow label="Workflow" value={selectedWorkflow?.name ?? '—'} />
      <SurfaceSummaryRow
        label="Bills"
        value={partyLabel(customerId, b2bAccountId, customers, b2bAccounts)}
      />
      <SurfaceSummaryRow label="Line items" value={String(lines.length)} />
      <SurfaceSummaryDivider />
      <SurfaceSummaryRow label="Subtotal" value={formatMoney(subtotal, currency)} />
      {taxTotal > 0 && (
        <SurfaceSummaryRow
          label={`Tax (${taxPct.toFixed(2)}%)`}
          value={formatMoney(taxTotal, currency)}
        />
      )}
      {shippingNum > 0 && (
        <SurfaceSummaryRow label="Shipping" value={formatMoney(shippingNum, currency)} />
      )}
      {surchargeNum > 0 && (
        <SurfaceSummaryRow label="Surcharge" value={formatMoney(surchargeNum, currency)} />
      )}
      <SurfaceSummaryDivider />
      <SurfaceSummaryRow label="Total" value={formatMoney(total, currency)} strong />
      {depositNum > 0 && (
        <>
          <SurfaceSummaryRow
            label={`Deposit (${depositKind})`}
            value={`- ${formatMoney(depositNum, currency)}`}
          />
          <SurfaceSummaryRow label="Balance due" value={formatMoney(balance, currency)} strong />
        </>
      )}
    </SurfaceSummary>
  );

  // ── Frame ──────────────────────────────────────────────────────────────────
  // Single-page: one SurfaceStep stacking bill-to / lines / charges / deposit /
  // start-stage. A workflow + party are required, so the primary stays disabled
  // until both are set. On a partial-success create the body becomes a recap panel
  // and the primary turns into "Open document".
  return (
    <SurfaceFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New document"
      backLabel="Documents"
      headerActions={
        presentation === 'page' ? (
          <ViewSwitcher typeId="billing-document" entityId={CREATE_SENTINEL} current="page" />
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
          onNext: createdDocId ? openDocument : () => void handleCreate(),
          nextLabel: createdDocId ? 'Open document' : 'Create document',
          nextLoading: submitting,
          nextDisabled: submitting || (!createdDocId && (!hasParty || !workflowId)),
        }}
      >
        {createdDocId ? (
          <Card className="border-base-300">
            <CardBody className="p-4">
              <div className="flex flex-row items-start gap-3">
                <CheckCircle2 className="text-module mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">
                    Document created — but {partialFailures.length} item
                    {partialFailures.length === 1 ? '' : 's'} couldn’t be added automatically:
                  </p>
                  <p className="text-base-content/70 text-sm">
                    {partialFailures.join(', ')}. Open the document to add{' '}
                    {partialFailures.length === 1 ? 'it' : 'them'} by hand.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Bill to */}
            <Card>
              <CardBody>
                <h3 className="text-xl font-semibold">Document</h3>
                <p className="text-base-content/70 text-sm">
                  The workflow sets the stages and the customer-facing label. Bill a retail customer
                  or a B2B account — at least one is required.
                </p>
                <div className="flex flex-col gap-4">
                  <Field>
                    <FieldLabel>Workflow</FieldLabel>
                    {workflows.length === 0 ? (
                      <p className="text-base-content/70 text-sm">
                        No document workflows exist yet. Create one in Invoicing → Workflows first.
                      </p>
                    ) : (
                      <NativeSelect
                        value={workflowId}
                        onChange={(e) => setWorkflowId(e.target.value)}
                      >
                        {workflows.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                            {w.isDefault ? ' (default)' : ''}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                    <FieldDescription>
                      The workflow’s first stage is where this document starts — you can jump ahead
                      below.
                    </FieldDescription>
                  </Field>

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

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field className="max-w-[8rem]">
                      <FieldLabel>Currency</FieldLabel>
                      <FieldControl
                        name="iw-currency"
                        value={currency}
                        maxLength={3}
                        className="uppercase"
                        onChange={(e) => setCurrency(e.target.value)}
                      />
                    </Field>
                    {currentUserId && (
                      <label className="flex items-end gap-2 pb-2 text-sm">
                        <Checkbox
                          color="module"
                          checked={assignToMe}
                          onChange={(e) => setAssignToMe(e.target.checked)}
                        />
                        Assign this document to me
                      </label>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Line items */}
            <Card>
              <CardBody>
                <div className="flex flex-row items-center gap-2">
                  <h3 className="text-xl font-semibold">Line items</h3>
                  <Badge color="neutral" variant="soft" size="sm">
                    {lines.length}
                  </Badge>
                </div>
                <p className="text-base-content/70 text-sm">
                  Manual lines take a unit price; marked-up parts and pass-through price live from a
                  cost basis. Lines are optional here — you can also add them on the document.
                </p>
                <div className="flex flex-col gap-2">
                  {lines.length === 0 ? (
                    <p className="text-base-content/70 text-sm">
                      No lines yet. Add the first charge below — or continue and add them on the
                      document.
                    </p>
                  ) : (
                    lines.map((l) => (
                      <div
                        key={l.tempId}
                        className="border-base-300 flex flex-row items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <div className="flex min-w-0 flex-row flex-wrap items-center gap-2">
                          <Badge color="info" variant="soft" size="sm">
                            {l.typeLabel}
                          </Badge>
                          <p className="truncate text-sm">{l.description}</p>
                          {!l.taxable && (
                            <p className="text-base-content/70 text-xs">(non-taxable)</p>
                          )}
                        </div>
                        <div className="flex flex-row items-center gap-3">
                          <p className="text-base-content/70 text-xs tabular-nums">
                            {l.quantity} × {formatMoney(l.unitPrice, currency)}
                          </p>
                          <p className="text-sm tabular-nums">
                            {formatMoney(l.quantity * l.unitPrice, currency)}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            shape="square"
                            size="sm"
                            aria-label="Remove line"
                            onClick={() => removeLocalLine(l.tempId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardBody>
            </Card>

            {lineTypes.length === 0 ? (
              <p className="text-base-content/70 text-sm">
                No line types are configured. They seed automatically when Invoicing is activated.
              </p>
            ) : (
              <LineComposer
                lineTypes={lineTypes}
                markupRules={markupRules}
                currency={currency}
                onAdd={addLocalLine}
              />
            )}

            {/* Charges */}
            <Card>
              <CardBody>
                <h3 className="text-xl font-semibold">Tax, shipping &amp; surcharge</h3>
                <p className="text-base-content/70 text-sm">
                  Document-level charges. Tax applies to the lines you mark taxable. All optional.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field {...v.field('taxRatePct')}>
                    <FieldLabel>Tax rate %</FieldLabel>
                    <FieldControl
                      name="iw-tax"
                      type="number"
                      min="0"
                      max="100"
                      step="0.0001"
                      value={taxRatePct}
                      onChange={(e) => setTaxRatePct(e.target.value)}
                      {...v.control('taxRatePct')}
                    />
                  </Field>
                  <Field {...v.field('shipping')}>
                    <FieldLabel>Shipping</FieldLabel>
                    <FieldControl
                      name="iw-shipping"
                      type="number"
                      min="0"
                      step="0.01"
                      value={shipping}
                      onChange={(e) => setShipping(e.target.value)}
                      placeholder="0.00"
                      {...v.control('shipping')}
                    />
                  </Field>
                  <Field {...v.field('surcharge')}>
                    <FieldLabel>Surcharge</FieldLabel>
                    <FieldControl
                      name="iw-surcharge"
                      type="number"
                      min="0"
                      step="0.01"
                      value={surcharge}
                      onChange={(e) => setSurcharge(e.target.value)}
                      placeholder="0.00"
                      {...v.control('surcharge')}
                    />
                  </Field>
                </div>
              </CardBody>
            </Card>

            {/* Terms */}
            <Card>
              <CardBody>
                <h3 className="text-xl font-semibold">Terms</h3>
                <p className="text-base-content/70 text-sm">
                  Due date, validity, and notes — all optional.
                </p>
                <div className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Due date</FieldLabel>
                      <FieldControl
                        name="iw-due"
                        type="date"
                        value={dueAt}
                        onChange={(e) => setDueAt(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Valid until</FieldLabel>
                      <FieldControl
                        name="iw-valid"
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel>Notes</FieldLabel>
                    <FieldControl
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Shown on the document — terms, scope, anything the customer should see."
                      render={<Textarea rows={3} />}
                    />
                  </Field>
                </div>
              </CardBody>
            </Card>

            {/* Deposit */}
            <Card>
              <CardBody>
                <h3 className="text-xl font-semibold">Deposit / payment</h3>
                <p className="text-base-content/70 text-sm">
                  Record an upfront deposit or payment now — optional; leave the amount blank to
                  skip.
                </p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field>
                    <FieldLabel>Type</FieldLabel>
                    <NativeSelect
                      value={depositKind}
                      onChange={(e) => setDepositKind(e.target.value as 'deposit' | 'payment')}
                    >
                      <option value="deposit">Deposit</option>
                      <option value="payment">Payment</option>
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel>Method</FieldLabel>
                    <NativeSelect
                      value={depositMethod}
                      onChange={(e) => setDepositMethod(e.target.value)}
                    >
                      <option value="card">Card</option>
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="ach">ACH</option>
                      <option value="wire">Wire</option>
                      <option value="account_credit">Account credit</option>
                      <option value="other">Other</option>
                    </NativeSelect>
                  </Field>
                  <Field {...v.field('depositAmount')}>
                    <FieldLabel>Amount</FieldLabel>
                    <FieldControl
                      name="iw-dep-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      {...v.control('depositAmount')}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Reference</FieldLabel>
                    <FieldControl
                      name="iw-dep-ref"
                      value={depositReference}
                      onChange={(e) => setDepositReference(e.target.value)}
                      placeholder="Check #, memo…"
                    />
                  </Field>
                </div>
                {depositNum > 0 && (
                  <p className="text-base-content/70 mt-3 text-xs">
                    {formatMoney(depositNum, currency)} {depositKind} will be recorded on create —
                    balance after: {formatMoney(balance, currency)}.
                  </p>
                )}
              </CardBody>
            </Card>

            {/* Start at stage */}
            {stages.length > 1 && (
              <Card>
                <CardBody>
                  <h3 className="text-xl font-semibold">Start at stage</h3>
                  <p className="text-base-content/70 text-sm">
                    The document is created at the first stage; pick a later stage to advance it
                    straight away (e.g. issue the invoice now).
                  </p>
                  <div className="flex flex-col gap-2">
                    <NativeSelect
                      aria-label="Start stage"
                      value={startStageId}
                      onChange={(e) => setStartStageId(e.target.value)}
                    >
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.customerLabel}
                          {s.numberOnEnter ? ' · numbers' : ''}
                          {s.locksEditing ? ' · locks' : ''}
                        </option>
                      ))}
                    </NativeSelect>
                    {startStageId !== firstStageId && lines.length === 0 && (
                      <p className="text-warning text-xs">
                        This stage finalizes the document — consider adding at least one line first.
                      </p>
                    )}
                  </div>
                </CardBody>
              </Card>
            )}

            {error && (
              <FieldStatus status="error" attached={false} role="alert">
                {error}
              </FieldStatus>
            )}
          </div>
        )}
      </SurfaceStep>
    </SurfaceFrame>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

// The inline "add a charge" composer — mirrors the document editor's add row, but
// builds the line LOCALLY (the document doesn't exist yet) instead of POSTing it.
function LineComposer({
  lineTypes,
  markupRules,
  currency,
  onAdd,
}: {
  lineTypes: LineTypeOption[];
  markupRules: MarkupRuleSummary[];
  currency: string;
  onAdd: (line: LocalLine) => void;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [seq, setSeq] = React.useState(0);

  const firstType = lineTypes[0];
  const [lineTypeKey, setLineTypeKey] = React.useState(firstType?.key ?? '');
  const [description, setDescription] = React.useState('');
  const [quantity, setQuantity] = React.useState('1');
  const [unitPrice, setUnitPrice] = React.useState('0');
  const [cost, setCost] = React.useState('');
  const [taxable, setTaxable] = React.useState(firstType?.defaultTaxable ?? true);

  const selectedType = lineTypes.find((t) => t.key === lineTypeKey);
  const pricingMode = selectedType?.pricingMode ?? 'flat';
  const markupMode = isMarkupMode(pricingMode);

  const [markupState, setMarkupState] = React.useState<MarkupState>(() =>
    freshMarkupState(markupRules, pricingMode)
  );
  const resolved = resolveMarkup(markupState, markupRules, pricingMode);

  const v = useFieldValidation(
    { description, quantity, unitPrice, cost },
    {
      description: rule.required('Add a description.'),
      quantity: (val) => {
        const n = Number(String(val).trim());
        if (!Number.isFinite(n)) return 'Enter a number.';
        if (n <= 0) return 'Quantity must be greater than 0.';
        return null;
      },
      unitPrice: (val) => {
        const n = Number(String(val).trim());
        if (!Number.isFinite(n)) return 'Enter a number.';
        if (n < 0) return 'Price cannot be negative.';
        return null;
      },
      cost: optionalNonNegative,
    }
  );

  function onTypeChange(nextKey: string) {
    setLineTypeKey(nextKey);
    const next = lineTypes.find((t) => t.key === nextKey);
    const nextMode = next?.pricingMode ?? 'flat';
    setTaxable(next?.defaultTaxable ?? true);
    if (isMarkupMode(nextMode)) setMarkupState(freshMarkupState(markupRules, nextMode));
  }

  function reset() {
    setDescription('');
    setQuantity('1');
    setUnitPrice('0');
    setCost('');
    setMarkupState(freshMarkupState(markupRules, pricingMode));
    setTaxable(selectedType?.defaultTaxable ?? true);
  }

  function add() {
    setError(null);
    if (!v.validate()) return;
    const qty = Math.max(0.001, Number(quantity) || 1);
    const common = {
      lineTypeKey: lineTypeKey || undefined,
      description: description.trim(),
      quantity: qty,
      taxable,
    };

    let payload: Record<string, unknown>;
    let effectiveUnitPrice: number;
    if (markupMode) {
      if (!resolved.payload || !resolved.preview) {
        setError(resolved.error ?? 'Enter the markup details.');
        return;
      }
      payload = { ...common, ...resolved.payload };
      effectiveUnitPrice = resolved.preview.priceCents / 100;
    } else {
      const price = Math.max(0, Number(unitPrice) || 0);
      const costNum = cost.trim() ? Number(cost) : null;
      payload = {
        ...common,
        unitPrice: price,
        ...(costNum != null && Number.isFinite(costNum)
          ? { explicitCostCents: Math.round(costNum * 100) }
          : {}),
      };
      effectiveUnitPrice = price;
    }

    onAdd({
      tempId: `l${seq}`,
      typeLabel: selectedType?.label ?? 'Line',
      description: description.trim(),
      quantity: qty,
      unitPrice: effectiveUnitPrice,
      taxable,
      payload,
    });
    setSeq((n) => n + 1);
    setError(null);
    reset();
  }

  return (
    <Card>
      <CardBody>
        <h3 className="text-xl font-semibold">Add a charge</h3>
        {/* self-start on every labeled Field cell keeps each field's own
            label+input flush with its neighbors regardless of whether a
            sibling (e.g. Description) is showing a taller inline validation
            error — items-end on the grid itself still bottom-aligns the
            unlabeled taxable checkbox against the input row. */}
        <div className="grid grid-cols-12 items-end gap-2">
          <Field className="col-span-12 self-start md:col-span-3">
            <FieldLabel className="text-xs">Type</FieldLabel>
            <select
              className={SELECT_CLASS}
              value={lineTypeKey}
              onChange={(e) => onTypeChange(e.target.value)}
            >
              {lineTypes.map((t) => (
                <option key={t.id} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field {...v.field('description')} className="col-span-12 self-start md:col-span-5">
            <FieldLabel className="text-xs" required>
              Description
            </FieldLabel>
            <FieldControl
              name="lc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this charge?"
              {...v.control('description')}
            />
          </Field>
          <Field {...v.field('quantity')} className="col-span-4 self-start md:col-span-2">
            <FieldLabel className="text-xs" required>
              Qty
            </FieldLabel>
            <FieldControl
              name="lc-quantity"
              type="number"
              min="0"
              step="0.001"
              className="text-right"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              {...v.control('quantity')}
            />
          </Field>
          <div className="col-span-8 flex items-center gap-2 md:col-span-2 md:justify-end md:pb-2">
            <label className="text-base-content/60 flex items-center gap-1.5 text-xs">
              <Checkbox
                color="module"
                checked={taxable}
                onChange={(e) => setTaxable(e.target.checked)}
              />
              Taxable
            </label>
          </div>

          {markupMode ? (
            <div className="col-span-12">
              <MarkupFields
                state={markupState}
                rules={markupRules}
                pricingMode={pricingMode}
                resolved={resolved}
                disabled={false}
                currency={currency}
                onChange={(next) => setMarkupState((s) => ({ ...s, ...next }))}
              />
            </div>
          ) : (
            <>
              <Field {...v.field('unitPrice')} className="col-span-6 md:col-span-3">
                <FieldLabel className="text-xs">Unit price</FieldLabel>
                <FieldControl
                  name="lc-unit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="text-right"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  {...v.control('unitPrice')}
                />
              </Field>
              <Field {...v.field('cost')} className="col-span-6 md:col-span-3">
                <FieldLabel className="text-xs">Cost (opt.)</FieldLabel>
                <FieldControl
                  name="lc-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  className="text-right"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="—"
                  {...v.control('cost')}
                />
              </Field>
            </>
          )}

          <div className="col-span-12 flex justify-end">
            <Button
              type="button"
              color="module"
              size="sm"
              onClick={add}
              iconStart={<Plus className="h-4 w-4" />}
            >
              Add charge
            </Button>
          </div>
        </div>
        {error && (
          <FieldStatus status="error" attached={false} role="alert" className="mt-2">
            {error}
          </FieldStatus>
        )}
      </CardBody>
    </Card>
  );
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
