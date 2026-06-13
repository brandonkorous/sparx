import { notFound } from 'next/navigation';
import { Printer, Receipt } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Heading,
  Stack,
  Stat,
  Text,
} from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { AR_STATUS_VARIANT, formatMoney } from '../../_components/format';
import { StageBar } from './_components/stage-bar';
import { LineGrid, type MarkupRuleSummary } from './_components/line-grid';
import { PaymentsPanel } from './_components/payments-panel';

interface LineMarkupSnapshot {
  ruleId: string | null;
  ruleName: string | null;
  method: string;
  value: number | null;
  marginPct: number;
  markupPct: number;
  costBasisValueCents: number;
}

// GET /v1/markup-rules returns every rule with `appliesTo`; we keep the
// document-applicable ones for the line-grid markup picker.
type MarkupRuleApi = MarkupRuleSummary & { appliesTo: string };
interface DocumentLine {
  id: string;
  lineTypeId: string | null;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  costCents: number | null;
  appliedMarkup: LineMarkupSnapshot | null;
  taxable: boolean;
  discountAmount: string | number;
  taxAmount: string | number;
  lineSubtotal: string | number;
  lineTotal: string | number;
  sortOrder: number;
}
interface BillingDocument {
  id: string;
  number: string | null;
  status: string;
  currency: string;
  taxRate: string | number;
  customerId: string | null;
  b2bAccountId: string | null;
  stageId: string;
  workflowId: string;
  subtotal: string | number;
  discountTotal: string | number;
  taxTotal: string | number;
  shippingTotal: string | number;
  surchargeTotal: string | number;
  total: string | number;
  depositTotal: string | number;
  amountPaid: string | number;
  balance: string | number;
  dueAt: string | null;
  validUntil: string | null;
  notes: string | null;
  finalizedAt: string | null;
  voidedAt: string | null;
  lines: DocumentLine[];
}
interface Stage {
  id: string;
  name: string;
  customerLabel: string;
  stageType: string;
  snapshotOnEnter: boolean;
  numberOnEnter: boolean;
  locksEditing: boolean;
  sortOrder: number;
  color: string | null;
}
interface Workflow {
  id: string;
  name: string;
  slug: string;
  stages: Stage[];
}
interface LineType {
  id: string;
  key: string;
  label: string;
  pricingMode: string;
  defaultTaxable: boolean;
  isActive: boolean;
}
interface PaymentRow {
  id: string;
  kind: string;
  method: string;
  amount: string | number;
  reference: string | null;
  receivedAt: string;
}
interface SnapshotRow {
  id: string;
  documentNumber: string | null;
  customerLabel: string;
  stageType: string;
  createdAt: string;
}

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

export async function DocumentEditorContent({ id }: Props) {
  let doc: BillingDocument;
  try {
    doc = await api.get<BillingDocument>(`/v1/invoicing/documents/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const [workflows, lineTypes, payments, snapshots, markupRules] = await Promise.all([
    api.get<Workflow[]>('/v1/invoicing/workflows'),
    api.get<LineType[]>('/v1/invoicing/line-types'),
    api.get<PaymentRow[]>(`/v1/invoicing/documents/${id}/payments`).catch(() => []),
    api.get<SnapshotRow[]>(`/v1/invoicing/documents/${id}/snapshots`).catch(() => []),
    // Document-applicable markup rules for the line picker. Commerce may be off
    // (404) on a services-only tenant — degrade to ad-hoc markup only.
    api
      .get<MarkupRuleApi[]>('/v1/markup-rules?is_active=true')
      .then((rules) => rules.filter((r) => r.appliesTo === 'document' || r.appliesTo === 'both'))
      .catch(() => [] as MarkupRuleApi[]),
  ]);

  const workflow = workflows.find((w) => w.id === doc.workflowId);
  const stages = (workflow?.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const currentStage = stages.find((s) => s.id === doc.stageId);
  const locked = currentStage?.locksEditing ?? false;

  const partyName = await resolvePartyName(doc);

  // Cost-based margin (docs/87 §5 / docs/48) — over lines that carry a cost basis.
  let costCents = 0;
  let revenueCents = 0;
  for (const l of doc.lines) {
    if (l.costCents != null) {
      costCents += l.costCents * Number(l.quantity);
      revenueCents += Math.round(Number(l.lineSubtotal) * 100);
    }
  }
  const marginPct = revenueCents > 0 ? ((revenueCents - costCents) / revenueCents) * 100 : null;

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Stack direction="row" align="center" justify="between" wrap gap={3}>
          <Stack direction="row" align="center" gap={3} wrap>
            <Heading level={1}>{doc.number ?? 'Draft'}</Heading>
            {currentStage && (
              <Badge color="module" variant="soft">
                {currentStage.customerLabel}
              </Badge>
            )}
            <Badge color={AR_STATUS_VARIANT[doc.status] ?? 'neutral'}>{doc.status}</Badge>
            {partyName && (
              <Text size="sm" variant="muted">
                {partyName}
              </Text>
            )}
          </Stack>
          <Button
            asChild
            variant="outline"
            size="sm"
            color="module"
            leftIcon={<Printer className="h-4 w-4" />}
          >
            <a href={`/invoicing/documents/${doc.id}/print`} target="_blank" rel="noreferrer">
              Print
            </a>
          </Button>
        </Stack>
      </Stack>

      <StageBar
        documentId={doc.id}
        stages={stages.map((s) => ({
          id: s.id,
          name: s.name,
          customerLabel: s.customerLabel,
          snapshotOnEnter: s.snapshotOnEnter,
          numberOnEnter: s.numberOnEnter,
          locksEditing: s.locksEditing,
        }))}
        currentStageId={doc.stageId}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card variant="module">
          <CardContent className="py-4">
            <Stat label="Total" value={formatMoney(doc.total, doc.currency)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <Stat label="Balance due" value={formatMoney(doc.balance, doc.currency)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <Stat label="Amount paid" value={formatMoney(doc.amountPaid, doc.currency)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <Stat label="Margin" value={marginPct !== null ? `${marginPct.toFixed(1)}%` : '—'} />
          </CardContent>
        </Card>
      </div>

      <LineGrid
        documentId={doc.id}
        currency={doc.currency}
        locked={locked}
        lines={doc.lines.map((l) => ({
          id: l.id,
          lineTypeId: l.lineTypeId,
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          costCents: l.costCents,
          taxable: l.taxable,
          lineTotal: Number(l.lineTotal),
          markup: l.appliedMarkup
            ? {
                ruleId: l.appliedMarkup.ruleId,
                ruleName: l.appliedMarkup.ruleName,
                method: l.appliedMarkup.method,
                value: l.appliedMarkup.value,
                marginPct: l.appliedMarkup.marginPct,
                costBasisValueCents: l.appliedMarkup.costBasisValueCents,
              }
            : null,
        }))}
        lineTypes={lineTypes
          .filter((t) => t.isActive)
          .map((t) => ({
            id: t.id,
            key: t.key,
            label: t.label,
            pricingMode: t.pricingMode,
            defaultTaxable: t.defaultTaxable,
          }))}
        markupRules={markupRules}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap={2}>
              <TotalRow label="Subtotal" value={formatMoney(doc.subtotal, doc.currency)} />
              {Number(doc.discountTotal) > 0 && (
                <TotalRow
                  label="Discount"
                  value={`- ${formatMoney(doc.discountTotal, doc.currency)}`}
                />
              )}
              <TotalRow
                label={`Tax (${(Number(doc.taxRate) * 100).toFixed(2)}%)`}
                value={formatMoney(doc.taxTotal, doc.currency)}
              />
              {Number(doc.shippingTotal) > 0 && (
                <TotalRow label="Shipping" value={formatMoney(doc.shippingTotal, doc.currency)} />
              )}
              {Number(doc.surchargeTotal) > 0 && (
                <TotalRow label="Surcharge" value={formatMoney(doc.surchargeTotal, doc.currency)} />
              )}
              <div className="border-t border-[var(--color-border-default)] pt-2">
                <TotalRow label="Total" value={formatMoney(doc.total, doc.currency)} strong />
              </div>
              {Number(doc.depositTotal) > 0 && (
                <TotalRow
                  label="Deposit"
                  value={`- ${formatMoney(doc.depositTotal, doc.currency)}`}
                />
              )}
              {Number(doc.amountPaid) > 0 && (
                <TotalRow
                  label="Amount paid"
                  value={`- ${formatMoney(doc.amountPaid, doc.currency)}`}
                />
              )}
              <div className="border-t border-[var(--color-border-default)] pt-2">
                <TotalRow
                  label="Balance due"
                  value={formatMoney(doc.balance, doc.currency)}
                  strong
                />
              </div>
            </Stack>
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <PaymentsPanel
            documentId={doc.id}
            currency={doc.currency}
            balance={Number(doc.balance)}
            payments={payments.map((p) => ({
              id: p.id,
              kind: p.kind,
              method: p.method,
              amount: Number(p.amount),
              reference: p.reference,
              receivedAt: p.receivedAt,
            }))}
          />
        </div>
      </div>

      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Stack direction="row" align="center" gap={2}>
                <Receipt className="h-4 w-4" /> Frozen records
                <Badge variant="outline">{snapshots.length}</Badge>
              </Stack>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap={2}>
              {snapshots.map((s) => (
                <Stack
                  key={s.id}
                  direction="row"
                  align="center"
                  justify="between"
                  className="rounded-md border border-[var(--color-border-default)] px-3 py-2"
                >
                  <Stack direction="row" align="center" gap={3} wrap>
                    <Text size="sm" className="font-medium">
                      {s.documentNumber ?? s.customerLabel}
                    </Text>
                    <Badge variant="outline" className="text-xs">
                      {s.customerLabel}
                    </Badge>
                    <Text size="xs" variant="muted">
                      {new Date(s.createdAt).toLocaleString()}
                    </Text>
                  </Stack>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    leftIcon={<Printer className="h-3.5 w-3.5" />}
                  >
                    <a
                      href={`/invoicing/documents/${doc.id}/print?snapshotId=${s.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Print
                    </a>
                  </Button>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {doc.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Text size="sm" className="whitespace-pre-wrap">
              {doc.notes}
            </Text>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
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

async function resolvePartyName(doc: BillingDocument): Promise<string | null> {
  try {
    if (doc.b2bAccountId) {
      const a = await api.get<{ companyName: string }>(`/v1/crm/b2b-accounts/${doc.b2bAccountId}`);
      return a.companyName;
    }
    if (doc.customerId) {
      const c = await api.get<{
        firstName: string | null;
        lastName: string | null;
        company: string | null;
        email: string | null;
      }>(`/v1/crm/customers/${doc.customerId}`);
      const full = [c.firstName, c.lastName].filter(Boolean).join(' ');
      return full !== '' ? full : (c.company ?? c.email ?? null);
    }
  } catch {
    return null;
  }
  return null;
}
