'use client';

// Booking-policy editor (docs/79 §9) — deposits, cancellation window, late-cancel
// + no-show fees, reminder cadence, and the policy text a customer accepts at
// booking. A service attaches a policy to opt into deposits/holds + reminders.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Grid, Input, Label, NativeSelect, Stack, Textarea, toast } from '@sparx/ui';

import type { BookingPolicy, DepositType, FeeType } from '../../_lib/types';
import { createBookingPolicyAction, updateBookingPolicyAction } from '../../_lib/actions';

interface Props {
  policy?: BookingPolicy;
  onSuccess: () => void;
  onCancel: () => void;
}

const DEPOSIT_TYPES: { value: DepositType; label: string }[] = [
  { value: 'none', label: 'No deposit' },
  { value: 'card_hold', label: 'Card hold (charge only on no-show / late cancel)' },
  { value: 'deposit', label: 'Deposit (partial charge up front)' },
  { value: 'prepay', label: 'Prepay (full price up front)' },
];

type FeeMode = 'none' | 'fixed' | 'percent';

/** Split a stored fee (type + value) into the form's mode + display value (dollars
 *  for a fixed fee, the percent for a percent fee). */
function feeToForm(type: FeeType | null, value: number | null): { mode: FeeMode; display: number } {
  if (!type) return { mode: 'none', display: 0 };
  return { mode: type, display: type === 'fixed' ? (value ?? 0) / 100 : (value ?? 0) };
}

/** Build the {type, value} pair the API wants from the form's mode + display. */
function formToFee(mode: FeeMode, display: number): { type: FeeType | null; value: number | null } {
  if (mode === 'none') return { type: null, value: null };
  return { type: mode, value: mode === 'fixed' ? Math.round(display * 100) : Math.round(display) };
}

export function PolicyForm({ policy, onSuccess, onCancel }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(policy?.name ?? '');
  const [depositType, setDepositType] = useState<DepositType>(policy?.depositType ?? 'none');
  const [depositDollars, setDepositDollars] = useState((policy?.depositAmountCents ?? 0) / 100);
  const [depositPercent, setDepositPercent] = useState(policy?.depositPercent ?? 0);
  const [cancelWindow, setCancelWindow] = useState(policy?.cancellationWindowHours ?? 24);

  const initialLate = feeToForm(
    policy?.lateCancelFeeType ?? null,
    policy?.lateCancelFeeValue ?? null
  );
  const [lateMode, setLateMode] = useState<FeeMode>(initialLate.mode);
  const [lateValue, setLateValue] = useState(initialLate.display);

  const initialNoShow = feeToForm(policy?.noShowFeeType ?? null, policy?.noShowFeeValue ?? null);
  const [noShowMode, setNoShowMode] = useState<FeeMode>(initialNoShow.mode);
  const [noShowValue, setNoShowValue] = useState(initialNoShow.display);

  const [reminders, setReminders] = useState(
    (policy?.reminderOffsetsMin ?? [1440, 120]).join(', ')
  );
  const [policyText, setPolicyText] = useState(policy?.policyText ?? '');

  const showDepositAmount = depositType === 'deposit' || depositType === 'card_hold';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    const late = formToFee(lateMode, lateValue);
    const noShow = formToFee(noShowMode, noShowValue);
    const reminderOffsetsMin = reminders
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0);
    const body = {
      name: name.trim(),
      depositType,
      depositAmountCents:
        showDepositAmount && depositDollars > 0 ? Math.round(depositDollars * 100) : null,
      depositPercent: showDepositAmount && depositPercent > 0 ? Math.round(depositPercent) : null,
      cancellationWindowHours: cancelWindow,
      lateCancelFeeType: late.type,
      lateCancelFeeValue: late.value,
      noShowFeeType: noShow.type,
      noShowFeeValue: noShow.value,
      reminderOffsetsMin,
      policyText: policyText.trim() || null,
    };
    const result = policy
      ? await updateBookingPolicyAction(policy.id, body)
      : await createBookingPolicyAction(body);
    setSaving(false);
    if (result.ok) {
      toast.success(policy ? 'Policy updated' : 'Policy created');
      onSuccess();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack gap={4} className="px-1 py-2">
        <div>
          <Label htmlFor="pol-name">Name</Label>
          <Input
            id="pol-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard, Premium (deposit required)"
            required
          />
        </div>

        <div>
          <Label htmlFor="pol-deposit">Deposit</Label>
          <NativeSelect
            id="pol-deposit"
            value={depositType}
            onChange={(e) => setDepositType(e.target.value as DepositType)}
          >
            {DEPOSIT_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        {showDepositAmount ? (
          <Grid cols={2} gap={3}>
            <div>
              <Label htmlFor="pol-dep-amt">Deposit amount ($)</Label>
              <Input
                id="pol-dep-amt"
                type="number"
                min={0}
                step="0.01"
                value={depositDollars}
                onChange={(e) => setDepositDollars(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="pol-dep-pct">…or percent of price (%)</Label>
              <Input
                id="pol-dep-pct"
                type="number"
                min={0}
                max={100}
                value={depositPercent}
                onChange={(e) => setDepositPercent(Number(e.target.value) || 0)}
              />
            </div>
          </Grid>
        ) : null}

        <div>
          <Label htmlFor="pol-window">Cancellation notice window (hours)</Label>
          <Input
            id="pol-window"
            type="number"
            min={0}
            value={cancelWindow}
            onChange={(e) => setCancelWindow(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>

        <FeeField
          label="Late-cancel fee"
          mode={lateMode}
          value={lateValue}
          onMode={setLateMode}
          onValue={setLateValue}
        />
        <FeeField
          label="No-show fee"
          mode={noShowMode}
          value={noShowValue}
          onMode={setNoShowMode}
          onValue={setNoShowValue}
        />

        <div>
          <Label htmlFor="pol-reminders">Reminder offsets (minutes before, comma-separated)</Label>
          <Input
            id="pol-reminders"
            value={reminders}
            onChange={(e) => setReminders(e.target.value)}
            placeholder="1440, 120"
          />
        </div>

        <div>
          <Label htmlFor="pol-text">Policy text (shown + accepted at booking)</Label>
          <Textarea
            id="pol-text"
            value={policyText}
            onChange={(e) => setPolicyText(e.target.value)}
            rows={2}
            placeholder="Please give at least 24 hours notice to cancel or reschedule."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" color="module" loading={saving}>
            {policy ? 'Save changes' : 'Create policy'}
          </Button>
        </div>
      </Stack>
    </form>
  );
}

function FeeField({
  label,
  mode,
  value,
  onMode,
  onValue,
}: {
  label: string;
  mode: FeeMode;
  value: number;
  onMode: (m: FeeMode) => void;
  onValue: (n: number) => void;
}) {
  return (
    <Grid cols={2} gap={3}>
      <div>
        <Label>{label}</Label>
        <NativeSelect value={mode} onChange={(e) => onMode(e.target.value as FeeMode)}>
          <option value="none">None</option>
          <option value="fixed">Fixed ($)</option>
          <option value="percent">Percent of price (%)</option>
        </NativeSelect>
      </div>
      {mode !== 'none' ? (
        <div>
          <Label>{mode === 'fixed' ? 'Amount ($)' : 'Percent (%)'}</Label>
          <Input
            type="number"
            min={0}
            step={mode === 'fixed' ? '0.01' : '1'}
            value={value}
            onChange={(e) => onValue(Number(e.target.value) || 0)}
          />
        </div>
      ) : null}
    </Grid>
  );
}
