'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Heading,
  Input,
  NativeSelect,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  useConfirm,
} from '@sparx/ui';

import {
  createSurchargeRuleAction,
  deleteSurchargeRuleAction,
  updateSurchargeRuleAction,
} from '../../surcharge-actions';

type SurchargeType = 'percentage' | 'flat';
type SurchargeBasis = 'subtotal' | 'subtotal_plus_shipping' | 'total';
type PaymentMethod = 'card' | 'account' | 'ach' | 'check';

export interface SurchargeRuleRow {
  id: string;
  name: string;
  type: SurchargeType;
  value: number;
  basis: SurchargeBasis;
  paymentMethods: PaymentMethod[];
  appliesTo: 'checkout' | 'invoice' | 'both';
  label: string;
  capCents: number | null;
  isActive: boolean;
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Card',
  account: 'Net terms',
  ach: 'ACH',
  check: 'Check',
};
const BASIS_LABELS: Record<SurchargeBasis, string> = {
  subtotal: 'Subtotal',
  subtotal_plus_shipping: 'Subtotal + shipping',
  total: 'Order total',
};

function summary(r: SurchargeRuleRow): string {
  const amount = r.type === 'percentage' ? `${r.value}%` : money.format(r.value);
  return `${amount} on ${BASIS_LABELS[r.basis].toLowerCase()}`;
}

export function SurchargesManager({ initialRules }: { initialRules: SurchargeRuleRow[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = React.useState<SurchargeRuleRow | 'new' | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onDelete(rule: SurchargeRuleRow) {
    const ok = await confirm({
      title: `Delete "${rule.name}"?`,
      description: 'This surcharge will no longer be added to new orders.',
      confirmLabel: 'Delete surcharge',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    setBusyId(rule.id);
    try {
      const res = await deleteSurchargeRuleAction(rule.id);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Stack gap={5}>
      {error && (
        <Text size="sm" variant="danger" role="alert">
          {error}
        </Text>
      )}

      {editing && (
        <RuleForm
          key={editing === 'new' ? 'new' : editing.id}
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <Card>
        <CardHeader>
          <Stack direction="row" align="center" justify="between" wrap gap={3}>
            <Heading level={3}>Surcharge rules</Heading>
            {!editing && (
              <Button
                color="module"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setEditing('new')}
              >
                New surcharge
              </Button>
            )}
          </Stack>
        </CardHeader>
        <CardContent>
          {initialRules.length === 0 ? (
            <Text variant="muted" className="py-6 text-center">
              No surcharges configured. Add one to pass a card fee or handling charge through to the
              order.
            </Text>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Payment methods</TableHead>
                  <TableHead>Line label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialRules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Text weight="medium">{r.name}</Text>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{summary(r)}</Badge>
                      {r.capCents != null && (
                        <Text size="xs" variant="muted">
                          cap {money.format(r.capCents / 100)}
                        </Text>
                      )}
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {r.paymentMethods.map((m) => METHOD_LABELS[m]).join(', ')}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm">{r.label}</Text>
                    </TableCell>
                    <TableCell>
                      {r.isActive ? (
                        <Badge color="success" variant="outline">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline">Off</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Stack direction="row" gap={1} justify="end">
                        <Button
                          size="xs"
                          variant="ghost"
                          leftIcon={<Pencil className="h-3.5 w-3.5" />}
                          disabled={busyId === r.id}
                          onClick={() => setEditing(r)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          color="danger"
                          leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                          disabled={busyId === r.id}
                          onClick={() => onDelete(r)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

const ALL_METHODS: PaymentMethod[] = ['card', 'account', 'ach', 'check'];

function RuleForm({
  rule,
  onClose,
  onSaved,
}: {
  rule: SurchargeRuleRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(rule?.name ?? '');
  const [type, setType] = React.useState<SurchargeType>(rule?.type ?? 'percentage');
  const [value, setValue] = React.useState(rule ? String(rule.value) : '3');
  const [basis, setBasis] = React.useState<SurchargeBasis>(rule?.basis ?? 'total');
  const [methods, setMethods] = React.useState<PaymentMethod[]>(rule?.paymentMethods ?? ['card']);
  const [label, setLabel] = React.useState(rule?.label ?? 'Card processing fee');
  const [cap, setCap] = React.useState(rule?.capCents != null ? String(rule.capCents / 100) : '');
  const [isActive, setIsActive] = React.useState(rule?.isActive ?? false);

  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Live readout on a $100 sample order.
  const sample = type === 'percentage' ? (100 * Number(value || 0)) / 100 : Number(value || 0);

  function toggleMethod(m: PaymentMethod) {
    setMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      setError('Enter a valid fee value.');
      return;
    }
    if (methods.length === 0) {
      setError('Pick at least one payment method.');
      return;
    }
    const payload = {
      name: name.trim(),
      type,
      value: num,
      basis,
      paymentMethods: methods,
      appliesTo: 'both' as const,
      label: label.trim(),
      capCents: cap ? Math.round(Number(cap) * 100) : null,
      isActive,
    };
    startTransition(async () => {
      const res = rule
        ? await updateSurchargeRuleAction(rule.id, payload)
        : await createSurchargeRuleAction(payload);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      onSaved();
    });
  }

  return (
    <Card>
      <CardHeader>
        <Heading level={3}>{rule ? `Edit "${rule.name}"` : 'New surcharge'}</Heading>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <Stack gap={4}>
            <Stack direction="row" gap={3} wrap>
              <Field label="Name" className="min-w-[14rem] flex-1">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Card processing fee"
                  required
                />
              </Field>
              <Field label="Customer-facing line label" className="min-w-[14rem] flex-1">
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Card processing fee"
                  required
                />
              </Field>
            </Stack>

            <Stack direction="row" gap={3} wrap align="end">
              <Field label="Type" className="min-w-[9rem] flex-1">
                <NativeSelect
                  value={type}
                  onChange={(e) => setType(e.target.value as SurchargeType)}
                >
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat amount</option>
                </NativeSelect>
              </Field>
              <Field
                label={type === 'percentage' ? 'Percent (%)' : 'Amount ($)'}
                className="min-w-[8rem] flex-1"
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </Field>
              <Field label="Computed on" className="min-w-[12rem] flex-1">
                <NativeSelect
                  value={basis}
                  onChange={(e) => setBasis(e.target.value as SurchargeBasis)}
                >
                  <option value="total">Order total (after tax)</option>
                  <option value="subtotal_plus_shipping">Subtotal + shipping</option>
                  <option value="subtotal">Subtotal only</option>
                </NativeSelect>
              </Field>
              <Field label="Cap ($, optional)" className="min-w-[8rem] flex-1">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  placeholder="none"
                />
              </Field>
            </Stack>

            <Stack gap={2}>
              <Text size="xs" variant="muted" weight="medium">
                Apply to payment methods
              </Text>
              <Stack direction="row" gap={4} wrap>
                {ALL_METHODS.map((m) => (
                  <label key={m} className="inline-flex items-center gap-2">
                    <Checkbox
                      checked={methods.includes(m)}
                      onCheckedChange={() => toggleMethod(m)}
                      aria-label={METHOD_LABELS[m]}
                    />
                    <Text size="sm">{METHOD_LABELS[m]}</Text>
                  </label>
                ))}
              </Stack>
              <Text size="xs" variant="muted">
                Card = any card-processor checkout; Net terms = B2B account orders. A card fee
                normally targets Card only.
              </Text>
            </Stack>

            <Stack
              direction="row"
              align="center"
              gap={3}
              className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3"
            >
              <Text size="sm" variant="muted">
                On a $100 order →
              </Text>
              <Text size="sm">
                fee <strong>{money.format(Math.max(0, sample))}</strong>
              </Text>
              <Stack direction="row" align="center" gap={2} className="ml-auto">
                <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Active" />
                <Text size="sm">{isActive ? 'Active' : 'Off'}</Text>
              </Stack>
            </Stack>

            {error && (
              <Text size="sm" variant="danger" role="alert">
                {error}
              </Text>
            )}

            <Stack direction="row" gap={2} justify="end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" color="module" loading={pending}>
                {rule ? 'Save changes' : 'Create surcharge'}
              </Button>
            </Stack>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Stack gap={1} className={className}>
      <Text size="xs" variant="muted" weight="medium">
        {label}
      </Text>
      {children}
    </Stack>
  );
}
