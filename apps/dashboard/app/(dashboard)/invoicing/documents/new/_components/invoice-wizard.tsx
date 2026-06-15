'use client';

// Comprehensive invoice / billing-document creation wizard (docs/87, docs/86
// WizardFrame). The "one-shot" document builder — it creates a COMPLETE billing
// document in a guided flow, not just a header:
//   1. Bill to   — workflow (the document's lifecycle), the customer or B2B account
//                  it bills, currency, optional assignee.
//   2. Lines     — the typed charges, priced live (manual price, or the markup
//                  engine for marked-up parts / pass-through), with running totals.
//   3. Charges   — document tax rate, shipping, surcharge, due date, valid-until, notes.
//   4. Deposit   — an optional upfront deposit / payment recorded on create.
//   5. Review    — the summary, plus which stage to start at (e.g. jump straight to
//                  a finalized Invoice). Create.
//
// Everything is composed locally and committed on finish: create the document,
// then best-effort add each line, record the deposit, and advance to the chosen
// start stage — landing on the new document either way (a failed extra is reported,
// never silently dropped, and never blocks the others).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
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

import {
  advanceStageAction,
  addLineAction,
  createDocumentAction,
  recordPaymentAction,
} from '../../../document-actions';
import { formatMoney } from '../../../_components/format';
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
  workflows: WorkflowOption[];
  customers: PartyOption[];
  b2bAccounts: PartyOption[];
  lineTypes: LineTypeOption[];
  markupRules: MarkupRuleSummary[];
  /** Current user id — powers the "Assign to me" toggle (optional assignee). */
  currentUserId?: string;
  preselectedCustomerId?: string | null;
  preselectedAccountId?: string | null;
}

// A line composed locally before the document exists. `display` drives the running
// totals + the review summary; `payload` is the exact AddBillingLine body sent on
// finish (so a markup line is priced server-side identically to the editor).
interface LocalLine {
  tempId: string;
  typeLabel: string;
  description: string;
  quantity: number;
  unitPrice: number; // effective unit price (dollars) for the running total
  taxable: boolean;
  payload: Record<string, unknown>;
}

type StepKey = 'billto' | 'lines' | 'charges' | 'deposit' | 'review';

const STEP_ORDER: StepKey[] = ['billto', 'lines', 'charges', 'deposit', 'review'];

const ALL_STEPS: Record<StepKey, WizardStepDef> = {
  billto: { key: 'billto', label: 'Bill to', sublabel: 'Workflow & party' },
  lines: { key: 'lines', label: 'Line items', sublabel: 'The charges' },
  charges: { key: 'charges', label: 'Charges', sublabel: 'Tax & terms' },
  deposit: { key: 'deposit', label: 'Deposit', sublabel: 'Optional' },
  review: { key: 'review', label: 'Review', sublabel: 'Create' },
};

const RAIL: Record<StepKey, { title: string; blurb: string; context?: string }> = {
  billto: {
    title: 'Start a document',
    blurb:
      'Pick the workflow — its stages and label (Estimate, Invoice, Work Order) — and who it bills.',
    context: 'A document bills a retail customer or a B2B account — at least one is required.',
  },
  lines: {
    title: 'Build the charges',
    blurb:
      'Add typed lines — parts, labor, fees, sublet. Marked-up lines price live off a cost basis.',
    context: 'Lines are optional here — you can also add them on the document afterward.',
  },
  charges: {
    title: 'Tax & terms',
    blurb: 'The document tax rate, shipping, any surcharge, due date and notes — all optional.',
    context: 'Tax applies to the lines you mark taxable. Leave a field at 0 to omit it.',
  },
  deposit: {
    title: 'Take a deposit',
    blurb: 'Record an upfront deposit or payment now — or skip and collect it later.',
    context: 'Optional — leave the amount blank to skip. You can take payment anytime.',
  },
  review: {
    title: 'Review & create',
    blurb: 'Confirm the document, choose which stage it starts at, and create it.',
    context: 'Starting at a later stage runs that stage’s effects — numbering, lock, snapshot.',
  },
};

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

// ─── Component ────────────────────────────────────────────────────────────────────

export function InvoiceWizard(props: InvoiceWizardProps) {
  return (
    <ModuleProvider module="invoicing">
      <InvoiceWizardInner {...props} />
    </ModuleProvider>
  );
}

function InvoiceWizardInner({
  workflows,
  customers,
  b2bAccounts,
  lineTypes,
  markupRules,
  currentUserId,
  preselectedCustomerId,
  preselectedAccountId,
}: InvoiceWizardProps) {
  const router = useRouter();

  const defaultWorkflow = workflows.find((w) => w.isDefault) ?? workflows[0];

  const [stepKey, setStepKey] = React.useState<StepKey>('billto');

  // Step 1 — bill to
  const [workflowId, setWorkflowId] = React.useState(defaultWorkflow?.id ?? '');
  const [customerId, setCustomerId] = React.useState(preselectedCustomerId ?? '');
  const [b2bAccountId, setB2bAccountId] = React.useState(preselectedAccountId ?? '');
  const [assignToMe, setAssignToMe] = React.useState(false);
  const [currency, setCurrency] = React.useState('USD');

  // Step 2 — lines
  const [lines, setLines] = React.useState<LocalLine[]>([]);

  // Step 3 — charges & terms
  const [taxRatePct, setTaxRatePct] = React.useState('0');
  const [shipping, setShipping] = React.useState('');
  const [surcharge, setSurcharge] = React.useState('');
  const [dueAt, setDueAt] = React.useState('');
  const [validUntil, setValidUntil] = React.useState('');
  const [notes, setNotes] = React.useState('');

  // Step 4 — deposit
  const [depositKind, setDepositKind] = React.useState<'deposit' | 'payment'>('deposit');
  const [depositMethod, setDepositMethod] = React.useState('card');
  const [depositAmount, setDepositAmount] = React.useState('');
  const [depositReference, setDepositReference] = React.useState('');

  // Step 5 — review / start stage
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

  const steps: WizardStepDef[] = STEP_ORDER.map((k) => ALL_STEPS[k]);
  const current = Math.max(
    0,
    steps.findIndex((s) => s.key === stepKey)
  );

  const hasParty = Boolean(customerId) || Boolean(b2bAccountId);

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

  function goToStep(key: StepKey) {
    setError(null);
    setStepKey(key);
  }

  function addLocalLine(line: LocalLine) {
    setLines((prev) => [...prev, line]);
  }
  function removeLocalLine(tempId: string) {
    setLines((prev) => prev.filter((l) => l.tempId !== tempId));
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!hasParty) {
      setError('Choose a customer or a B2B account to bill.');
      goToStep('billto');
      return;
    }
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

  // ── Step bodies ──────────────────────────────────────────────────────────────

  const billToStep = (
    <WizardStep
      header={{
        title: 'Who and how to bill',
        supporting:
          'The workflow sets the stages and the customer-facing label. Bill a retail customer or a B2B account.',
      }}
      actions={{
        onNext: () => {
          if (!hasParty) {
            setError('Choose a customer or a B2B account to bill.');
            return;
          }
          goToStep('lines');
        },
        nextLabel: 'Continue',
        nextDisabled: !workflowId || !hasParty || submitting,
      }}
    >
      <Card variant="module">
        <CardHeader>
          <Heading level={3}>Document</Heading>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="iw-workflow">Workflow</Label>
              {workflows.length === 0 ? (
                <Text size="sm" variant="muted">
                  No document workflows exist yet. Create one in Invoicing → Workflows first.
                </Text>
              ) : (
                <NativeSelect
                  id="iw-workflow"
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
              <Text size="xs" variant="muted" className="mt-1">
                The workflow’s first stage is where this document starts — you can jump ahead on the
                final step.
              </Text>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="iw-customer">Customer</Label>
                <NativeSelect
                  id="iw-customer"
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
                <Label htmlFor="iw-b2b">B2B account</Label>
                <NativeSelect
                  id="iw-b2b"
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
              Bill a retail customer or a B2B account — at least one is required. A B2B account can
              also carry a contact customer.
            </Text>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="max-w-[8rem]">
                <Label htmlFor="iw-currency">Currency</Label>
                <Input
                  id="iw-currency"
                  value={currency}
                  maxLength={3}
                  className="uppercase"
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </div>
              {currentUserId && (
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={assignToMe}
                    onChange={(e) => setAssignToMe(e.target.checked)}
                  />
                  Assign this document to me
                </label>
              )}
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
          'Add the charges. Manual lines take a unit price; marked-up parts and pass-through price live from a cost basis.',
      }}
      actions={{
        onBack: () => goToStep('billto'),
        onNext: () => goToStep('charges'),
        nextLabel: 'Continue',
        nextDisabled: submitting,
      }}
    >
      <div className="flex flex-col gap-5">
        <Card variant="module">
          <CardHeader>
            <Stack direction="row" align="center" gap={2}>
              <Heading level={3}>Charges</Heading>
              <Badge variant="outline">{lines.length}</Badge>
            </Stack>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {lines.length === 0 ? (
                <Text size="sm" variant="muted">
                  No lines yet. Add the first charge below — or continue and add them on the
                  document.
                </Text>
              ) : (
                lines.map((l) => (
                  <Stack
                    key={l.tempId}
                    direction="row"
                    align="center"
                    justify="between"
                    gap={3}
                    className="rounded-md border border-[var(--color-border-default)] px-3 py-2"
                  >
                    <Stack direction="row" align="center" gap={2} wrap className="min-w-0">
                      <Badge variant="outline" className="text-xs">
                        {l.typeLabel}
                      </Badge>
                      <Text size="sm" className="truncate">
                        {l.description}
                      </Text>
                      {!l.taxable && (
                        <Text size="xs" variant="muted">
                          (non-taxable)
                        </Text>
                      )}
                    </Stack>
                    <Stack direction="row" align="center" gap={3}>
                      <Text size="xs" variant="muted" className="tabular-nums">
                        {l.quantity} × {formatMoney(l.unitPrice, currency)}
                      </Text>
                      <Text size="sm" className="tabular-nums">
                        {formatMoney(l.quantity * l.unitPrice, currency)}
                      </Text>
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
                    </Stack>
                  </Stack>
                ))
              )}

              {lines.length > 0 && (
                <Stack direction="row" justify="between" className="px-1 pt-1">
                  <Text size="sm" variant="muted">
                    Subtotal
                  </Text>
                  <Text size="sm" className="font-medium tabular-nums">
                    {formatMoney(subtotal, currency)}
                  </Text>
                </Stack>
              )}
            </div>
          </CardContent>
        </Card>

        {lineTypes.length === 0 ? (
          <Text size="sm" variant="muted">
            No line types are configured. They seed automatically when Invoicing is activated.
          </Text>
        ) : (
          <LineComposer
            lineTypes={lineTypes}
            markupRules={markupRules}
            currency={currency}
            onAdd={addLocalLine}
          />
        )}
      </div>
    </WizardStep>
  );

  const chargesStep = (
    <WizardStep
      header={{
        title: 'Tax, shipping & terms',
        supporting: 'Document-level charges and terms. Everything here is optional.',
      }}
      actions={{
        onBack: () => goToStep('lines'),
        onNext: () => goToStep('deposit'),
        nextLabel: 'Continue',
        nextDisabled: submitting,
      }}
    >
      <div className="flex flex-col gap-5">
        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Charges</Heading>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="iw-tax">Tax rate %</Label>
                <Input
                  id="iw-tax"
                  type="number"
                  min="0"
                  max="100"
                  step="0.0001"
                  value={taxRatePct}
                  onChange={(e) => setTaxRatePct(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="iw-shipping">Shipping</Label>
                <Input
                  id="iw-shipping"
                  type="number"
                  min="0"
                  step="0.01"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="iw-surcharge">Surcharge</Label>
                <Input
                  id="iw-surcharge"
                  type="number"
                  min="0"
                  step="0.01"
                  value={surcharge}
                  onChange={(e) => setSurcharge(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Terms</Heading>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="iw-due">Due date</Label>
                  <Input
                    id="iw-due"
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="iw-valid">Valid until</Label>
                  <Input
                    id="iw-valid"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="iw-notes">Notes</Label>
                <Textarea
                  id="iw-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Shown on the document — terms, scope, anything the customer should see."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <TotalsPreview
          currency={currency}
          subtotal={subtotal}
          taxPct={taxPct}
          taxTotal={taxTotal}
          shipping={shippingNum}
          surcharge={surchargeNum}
          total={total}
        />
      </div>
    </WizardStep>
  );

  const depositStep = (
    <WizardStep
      header={{
        title: 'Take a deposit',
        supporting:
          'Record an upfront deposit or payment now, or skip it. Leave the amount blank to skip.',
      }}
      actions={{
        onBack: () => goToStep('charges'),
        onNext: () => goToStep('review'),
        nextLabel: 'Continue',
        nextDisabled: submitting,
      }}
    >
      <div className="flex flex-col gap-5">
        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Deposit / payment</Heading>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <Label htmlFor="iw-dep-kind">Type</Label>
                <NativeSelect
                  id="iw-dep-kind"
                  value={depositKind}
                  onChange={(e) => setDepositKind(e.target.value as 'deposit' | 'payment')}
                >
                  <option value="deposit">Deposit</option>
                  <option value="payment">Payment</option>
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="iw-dep-method">Method</Label>
                <NativeSelect
                  id="iw-dep-method"
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
              </div>
              <div>
                <Label htmlFor="iw-dep-amount">Amount</Label>
                <Input
                  id="iw-dep-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="iw-dep-ref">Reference</Label>
                <Input
                  id="iw-dep-ref"
                  value={depositReference}
                  onChange={(e) => setDepositReference(e.target.value)}
                  placeholder="Check #, memo…"
                />
              </div>
            </div>
            {depositNum > 0 && (
              <Text size="xs" variant="muted" className="mt-3">
                {formatMoney(depositNum, currency)} {depositKind} will be recorded on create —
                balance after: {formatMoney(balance, currency)}.
              </Text>
            )}
          </CardContent>
        </Card>
      </div>
    </WizardStep>
  );

  const reviewStep = (
    <WizardStep
      header={{
        title: createdDocId ? 'Document created' : 'Review & create',
        supporting: createdDocId
          ? 'The document is saved. Some extras need a second look.'
          : 'Confirm the document and choose which stage it starts at.',
      }}
      actions={{
        onBack: createdDocId ? undefined : () => goToStep('deposit'),
        onNext: createdDocId
          ? () => {
              router.push(`/invoicing/documents/${createdDocId}`);
              router.refresh();
            }
          : () => void handleCreate(),
        nextLabel: createdDocId ? 'Open document' : 'Create document',
        nextLoading: submitting,
        nextDisabled: submitting || !hasParty || !workflowId,
      }}
    >
      <div className="flex flex-col gap-5">
        {createdDocId && (
          <Card padding="sm" className="border-[var(--color-border-default)]">
            <Stack direction="row" align="start" gap={3}>
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--module-active)]" />
              <div className="flex flex-col gap-1">
                <Text size="sm" className="font-medium">
                  Document created — but {partialFailures.length} item
                  {partialFailures.length === 1 ? '' : 's'} couldn’t be added automatically:
                </Text>
                <Text size="sm" variant="muted">
                  {partialFailures.join(', ')}. Open the document to add{' '}
                  {partialFailures.length === 1 ? 'it' : 'them'} by hand.
                </Text>
              </div>
            </Stack>
          </Card>
        )}

        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Summary</Heading>
          </CardHeader>
          <CardContent>
            <Stack gap={2}>
              <SummaryRow label="Workflow" value={selectedWorkflow?.name ?? '—'} />
              <SummaryRow
                label="Bills"
                value={partyLabel(customerId, b2bAccountId, customers, b2bAccounts)}
              />
              <SummaryRow label="Line items" value={String(lines.length)} />
              <div className="border-t border-[var(--color-border-default)] pt-2">
                <SummaryRow label="Subtotal" value={formatMoney(subtotal, currency)} />
              </div>
              <SummaryRow
                label={`Tax (${taxPct.toFixed(2)}%)`}
                value={formatMoney(taxTotal, currency)}
              />
              {shippingNum > 0 && (
                <SummaryRow label="Shipping" value={formatMoney(shippingNum, currency)} />
              )}
              {surchargeNum > 0 && (
                <SummaryRow label="Surcharge" value={formatMoney(surchargeNum, currency)} />
              )}
              <div className="border-t border-[var(--color-border-default)] pt-2">
                <SummaryRow label="Total" value={formatMoney(total, currency)} strong />
              </div>
              {depositNum > 0 && (
                <>
                  <SummaryRow
                    label={`Deposit (${depositKind})`}
                    value={`- ${formatMoney(depositNum, currency)}`}
                  />
                  <SummaryRow label="Balance due" value={formatMoney(balance, currency)} strong />
                </>
              )}
            </Stack>
          </CardContent>
        </Card>

        {!createdDocId && stages.length > 1 && (
          <Card variant="module">
            <CardHeader>
              <Heading level={3}>Start at stage</Heading>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Text size="sm" variant="muted">
                  The document is created at the first stage; pick a later stage to advance it
                  straight away (e.g. issue the invoice now).
                </Text>
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
                  <Text size="xs" className="text-[var(--color-warning-text)]">
                    This stage finalizes the document — consider adding at least one line first.
                  </Text>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Text size="sm" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </div>
    </WizardStep>
  );

  let body: React.ReactNode;
  if (stepKey === 'billto') body = billToStep;
  else if (stepKey === 'lines') body = linesStep;
  else if (stepKey === 'charges') body = chargesStep;
  else if (stepKey === 'deposit') body = depositStep;
  else body = reviewStep;

  const onStepSelect = (key: string) => {
    const target = steps.findIndex((s) => s.key === key);
    if (target >= 0 && target <= current && !createdDocId) goToStep(key as StepKey);
  };
  const canSelectStep = (_key: string, index: number) => index <= current && !createdDocId;

  const cancelButton = (
    <button
      type="button"
      onClick={() => router.push('/invoicing/documents')}
      className="text-white/70 underline-offset-2 hover:underline"
    >
      Cancel
    </button>
  );

  return (
    <WizardFrame
      variant="page"
      className="fixed inset-0 z-50"
      lede={{ title: RAIL[stepKey].title, blurb: RAIL[stepKey].blurb }}
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

function TotalsPreview({
  currency,
  subtotal,
  taxPct,
  taxTotal,
  shipping,
  surcharge,
  total,
}: {
  currency: string;
  subtotal: number;
  taxPct: number;
  taxTotal: number;
  shipping: number;
  surcharge: number;
  total: number;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <Stack gap={2}>
          <SummaryRow label="Subtotal" value={formatMoney(subtotal, currency)} />
          <SummaryRow
            label={`Tax (${taxPct.toFixed(2)}%)`}
            value={formatMoney(taxTotal, currency)}
          />
          {shipping > 0 && <SummaryRow label="Shipping" value={formatMoney(shipping, currency)} />}
          {surcharge > 0 && (
            <SummaryRow label="Surcharge" value={formatMoney(surcharge, currency)} />
          )}
          <div className="border-t border-[var(--color-border-default)] pt-2">
            <SummaryRow label="Total" value={formatMoney(total, currency)} strong />
          </div>
        </Stack>
      </CardContent>
    </Card>
  );
}

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
    if (!description.trim()) {
      setError('Add a description.');
      return;
    }
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
      <CardHeader>
        <Heading level={3}>Add a charge</Heading>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-12 items-end gap-2">
          <div className="col-span-12 md:col-span-3">
            <Label className="text-xs">Type</Label>
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
          </div>
          <div className="col-span-12 md:col-span-5">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this charge?"
            />
          </div>
          <div className="col-span-4 md:col-span-2">
            <Label className="text-xs">Qty</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              className="text-right"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="col-span-8 flex items-center gap-2 md:col-span-2 md:justify-end md:pb-2">
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <input
                type="checkbox"
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
              <div className="col-span-6 md:col-span-3">
                <Label className="text-xs">Unit price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="text-right"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>
              <div className="col-span-6 md:col-span-3">
                <Label className="text-xs">Cost (opt.)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="text-right"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="—"
                />
              </div>
            </>
          )}

          <div className="col-span-12 flex justify-end">
            <Button
              type="button"
              color="module"
              size="sm"
              onClick={add}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add charge
            </Button>
          </div>
        </div>
        {error && (
          <Text size="xs" variant="danger" className="mt-2" role="alert">
            {error}
          </Text>
        )}
      </CardContent>
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
