'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { useConfirm } from '@sparx/ui';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Switch,
  Table,
} from '@wizeworks/silicaui-react';
import { rule as fieldRule, useFieldValidation } from '@sparx/forms';

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
    <div className="flex flex-col gap-5">
      {error && (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
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
        <CardBody>
          <div className="flex flex-row flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">Surcharge rules</h3>
            {!editing && (
              <Button
                color="module"
                size="sm"
                iconStart={<Plus className="h-4 w-4" />}
                onClick={() => setEditing('new')}
              >
                New surcharge
              </Button>
            )}
          </div>
          {initialRules.length === 0 ? (
            <p className="text-base-content/70 py-6 text-center text-base">
              No surcharges configured. Add one to pass a card fee or handling charge through to the
              order.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Fee</th>
                  <th>Payment methods</th>
                  <th>Line label</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialRules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <p className="text-base font-medium">{r.name}</p>
                    </td>
                    <td>
                      <Badge color="info" variant="soft" size="sm">
                        {summary(r)}
                      </Badge>
                      {r.capCents != null && (
                        <p className="text-base-content/70 text-xs">
                          cap {money.format(r.capCents / 100)}
                        </p>
                      )}
                    </td>
                    <td>
                      <p className="text-base-content/70 text-sm">
                        {r.paymentMethods.map((m) => METHOD_LABELS[m]).join(', ')}
                      </p>
                    </td>
                    <td>
                      <p className="text-sm">{r.label}</p>
                    </td>
                    <td>
                      <Badge color={r.isActive ? 'success' : 'neutral'} variant="soft" size="sm">
                        {r.isActive ? 'Active' : 'Off'}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <div className="flex flex-row justify-end gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          iconStart={<Pencil className="h-3.5 w-3.5" />}
                          disabled={busyId === r.id}
                          onClick={() => setEditing(r)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          color="danger"
                          iconStart={<Trash2 className="h-3.5 w-3.5" />}
                          disabled={busyId === r.id}
                          onClick={() => onDelete(r)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
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

  const values = { name, label, value };
  const v = useFieldValidation(values, {
    name: fieldRule.required('Name is required.'),
    label: fieldRule.required('A customer-facing label is required.'),
    value: (val) => {
      const n = Number(String(val).trim());
      if (!Number.isFinite(n)) return 'Enter a number.';
      if (n < 0) return 'Fee cannot be negative.';
      return null;
    },
  });

  // Live readout on a $100 sample order.
  const sample = type === 'percentage' ? (100 * Number(value || 0)) / 100 : Number(value || 0);

  function toggleMethod(m: PaymentMethod) {
    setMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!v.validate()) return;
    const num = Number(value);
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
      <CardBody>
        <h3 className="text-xl font-semibold">{rule ? `Edit "${rule.name}"` : 'New surcharge'}</h3>
        <form onSubmit={onSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-row flex-wrap gap-3">
              <Field {...v.field('name')} className="min-w-[14rem] flex-1">
                <FieldLabel>Name</FieldLabel>
                <FieldControl
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Card processing fee"
                  {...v.control('name')}
                />
              </Field>
              <Field {...v.field('label')} className="min-w-[14rem] flex-1">
                <FieldLabel>Customer-facing line label</FieldLabel>
                <FieldControl
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Card processing fee"
                  {...v.control('label')}
                />
              </Field>
            </div>

            <div className="flex flex-row flex-wrap items-end gap-3">
              <Field className="min-w-[9rem] flex-1">
                <FieldLabel>Type</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect>
                      <option value="percentage">Percentage</option>
                      <option value="flat">Flat amount</option>
                    </NativeSelect>
                  }
                  value={type}
                  onChange={(e) => setType(e.target.value as SurchargeType)}
                />
              </Field>
              <Field {...v.field('value')} className="min-w-[8rem] flex-1">
                <FieldLabel>{type === 'percentage' ? 'Percent (%)' : 'Amount ($)'}</FieldLabel>
                <FieldControl
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  {...v.control('value')}
                />
              </Field>
              <Field className="min-w-[12rem] flex-1">
                <FieldLabel>Computed on</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect>
                      <option value="total">Order total (after tax)</option>
                      <option value="subtotal_plus_shipping">Subtotal + shipping</option>
                      <option value="subtotal">Subtotal only</option>
                    </NativeSelect>
                  }
                  value={basis}
                  onChange={(e) => setBasis(e.target.value as SurchargeBasis)}
                />
              </Field>
              <Field className="min-w-[8rem] flex-1">
                <FieldLabel>Cap ($, optional)</FieldLabel>
                <FieldControl
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  placeholder="none"
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-base-content/70 text-xs font-medium">Apply to payment methods</p>
              <div className="flex flex-row flex-wrap gap-4">
                {ALL_METHODS.map((m) => (
                  <label key={m} className="inline-flex items-center gap-2">
                    <Checkbox
                      color="module"
                      checked={methods.includes(m)}
                      onChange={() => toggleMethod(m)}
                      aria-label={METHOD_LABELS[m]}
                    />
                    <p className="text-sm">{METHOD_LABELS[m]}</p>
                  </label>
                ))}
              </div>
              <p className="text-base-content/70 text-xs">
                Card = any card-processor checkout; Net terms = B2B account orders. A card fee
                normally targets Card only.
              </p>
            </div>

            <div className="border-base-300 bg-base-200 flex flex-row items-center gap-3 rounded border p-3">
              <p className="text-base-content/70 text-sm">On a $100 order →</p>
              <p className="text-sm">
                fee <strong>{money.format(Math.max(0, sample))}</strong>
              </p>
              <div className="ml-auto flex flex-row items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Active" />
                <p className="text-sm">{isActive ? 'Active' : 'Off'}</p>
              </div>
            </div>

            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}

            <div className="flex flex-row justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" color="module" loading={pending}>
                {rule ? 'Save changes' : 'Create surcharge'}
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
