'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Table,
} from '@wizeworks/silicaui-react';
import { useFieldValidation } from '@sparx/forms';
import { addApprovalRule, deleteApprovalRule } from '../../_lib/actions';

// A non-negative dollar amount held as string state (currency chars stripped
// before parsing). `@sparx/forms` ships no numeric builder, so this stays local —
// promotion candidate alongside tier-create-form's `nonNegativeNumber`.
const positiveAmount =
  (message: string) =>
  (value: unknown): string | null => {
    const s = typeof value === 'string' ? value.replace(/[^0-9.]/g, '') : '';
    const n = parseFloat(s);
    return s !== '' && Number.isFinite(n) && n >= 0 ? null : message;
  };

interface ApprovalRule {
  id: string;
  accountId: string | null;
  accountName: string | null;
  minAmountCents: number;
  minAmountFormatted: string;
  requiredApproverUserId: string | null;
  requiredApproverName: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Props {
  accountId: string;
  rules: ApprovalRule[];
}

export function ApprovalRulesEditor({ accountId, rules }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [minAmount, setMinAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const v = useFieldValidation(
    { minAmount },
    { minAmount: positiveAmount('Enter a valid amount of 0 or more.') }
  );

  async function handleAdd() {
    if (!v.validate()) return;
    const dollars = parseFloat(minAmount.replace(/[^0-9.]/g, ''));
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await addApprovalRule(accountId, Math.round(dollars * 100));
      if (err) throw new Error(err);
      setMinAmount('');
      setShowAdd(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add rule');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ruleId: string) {
    setDeleting(ruleId);
    try {
      await deleteApprovalRule(ruleId);
      startTransition(() => router.refresh());
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {rules.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <th>Threshold</th>
              <th>Required approver</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>
                  <p className="text-sm font-medium tabular-nums">
                    Orders over {rule.minAmountFormatted}
                  </p>
                </td>
                <td>
                  <p
                    className={
                      rule.requiredApproverName ? 'text-sm' : 'text-base-content/70 text-sm'
                    }
                  >
                    {rule.requiredApproverName ?? 'Any staff member'}
                  </p>
                </td>
                <td>
                  <Badge color={rule.isActive ? 'success' : 'neutral'} variant="soft">
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td>
                  <Button
                    size="sm"
                    color="danger"
                    variant="ghost"
                    disabled={deleting === rule.id || isPending}
                    onClick={() => void handleDelete(rule.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="text-base-content/70 text-sm">
          No approval rules. Orders from this account are placed immediately.
        </p>
      )}

      {showAdd ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-row items-end gap-3">
            <Field {...v.field('minAmount')}>
              <FieldLabel>Require approval for orders over</FieldLabel>
              <FieldControl
                name="minAmount"
                type="text"
                placeholder="e.g. 500"
                value={minAmount}
                onChange={(e) => {
                  setMinAmount(e.target.value);
                  setError(null);
                }}
                className="w-40"
                disabled={saving}
                {...v.control('minAmount')}
              />
            </Field>
            <Button
              color="module"
              size="sm"
              disabled={saving || isPending}
              onClick={() => void handleAdd()}
            >
              {saving ? 'Saving…' : 'Add Rule'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => {
                setShowAdd(false);
                setMinAmount('');
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
          {error && (
            <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
              {error}
            </FieldStatus>
          )}
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          color="module"
          className="self-start"
          iconStart={<Plus className="h-3.5 w-3.5" />}
          onClick={() => setShowAdd(true)}
        >
          Add approval rule
        </Button>
      )}
    </div>
  );
}
