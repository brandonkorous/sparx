'use client';

// Booking-policy editor (docs/79 §9) — deposits, cancellation window, late-cancel
// + no-show fees, reminder cadence, and the policy text a customer accepts at
// booking. A service attaches a policy to opt into deposits/holds + reminders.
//
// On the standard form surface (docs/86 F layout): ONE component drives
// page / overlay / modal — see service-form.tsx for the shape. No detail view,
// so a created policy returns to the list; editing rides a self-owned modal.

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldLabel,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, toast, type SurfaceStepDef } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import type { BookingPolicy, DepositType, FeeType } from '../../_lib/types';
import { createBookingPolicyAction, updateBookingPolicyAction } from '../../_lib/actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

type Presentation = 'page' | 'overlay' | 'modal';

interface PolicyFormProps {
  presentation: Presentation;
  policy?: BookingPolicy;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function PolicyForm({ presentation, policy, open, onOpenChange }: PolicyFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const v = useFieldValidation({ name }, { name: rule.required('Name is required.') });

  const snapshot = () =>
    JSON.stringify({
      name,
      depositType,
      depositDollars,
      depositPercent,
      cancelWindow,
      lateMode,
      lateValue,
      noShowMode,
      noShowValue,
      reminders,
      policyText,
    });
  const [initial] = useState(snapshot);
  const dirty = snapshot() !== initial;

  const guardLeave = useUnsavedGuard(
    dirty,
    policy ? { kind: 'edit', noun: 'policy' } : { kind: 'create', noun: 'policy' }
  );

  const close = useCallback(() => {
    if (presentation === 'modal') {
      onOpenChange?.(false);
      return;
    }
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
      return;
    }
    router.push('/scheduling/policies');
  }, [presentation, onOpenChange, pathname, searchParams, router]);

  const cancel = useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function onRequestClose(): boolean {
    if (saving) return false;
    if (!dirty) return true;
    void Promise.resolve(guardLeave()).then((ok) => ok && close());
    return false;
  }
  function onCancelClick() {
    if (saving) return;
    void Promise.resolve(guardLeave()).then((ok) => ok && close());
  }

  async function submit() {
    if (!v.validate()) return;
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
      close();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const heading = policy ? 'Edit policy' : 'New booking policy';

  const body = (
    <SurfaceStep
      header={{
        title: heading,
        supporting: 'Deposits, cancellation rules, fees, and reminders a service can attach to.',
      }}
      actions={{
        onNext: () => void submit(),
        nextLabel: policy ? 'Save changes' : 'Create policy',
        nextLoading: saving,
        nextDisabled: saving,
      }}
    >
      <Card>
        <CardBody className="py-6">
          <CardTitle>Policy terms</CardTitle>
          <div className="flex flex-col gap-4">
            <Field {...v.field('name')}>
              <FieldLabel required>Name</FieldLabel>
              <FieldControl
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard, Premium (deposit required)"
                {...v.control('name')}
              />
            </Field>

            <Field>
              <FieldLabel>Deposit</FieldLabel>
              <NativeSelect
                value={depositType}
                onChange={(e) => setDepositType(e.target.value as DepositType)}
              >
                {DEPOSIT_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            {showDepositAmount ? (
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>Deposit amount ($)</FieldLabel>
                  <FieldControl
                    type="number"
                    min={0}
                    step="0.01"
                    value={depositDollars}
                    onChange={(e) => setDepositDollars(Number(e.target.value) || 0)}
                  />
                </Field>
                <Field>
                  <FieldLabel>…or percent of price (%)</FieldLabel>
                  <FieldControl
                    type="number"
                    min={0}
                    max={100}
                    value={depositPercent}
                    onChange={(e) => setDepositPercent(Number(e.target.value) || 0)}
                  />
                </Field>
              </div>
            ) : null}

            <Field>
              <FieldLabel>Cancellation notice window (hours)</FieldLabel>
              <FieldControl
                type="number"
                min={0}
                value={cancelWindow}
                onChange={(e) => setCancelWindow(Math.max(0, Number(e.target.value) || 0))}
              />
            </Field>

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

            <Field>
              <FieldLabel>Reminder offsets (minutes before, comma-separated)</FieldLabel>
              <FieldControl
                value={reminders}
                onChange={(e) => setReminders(e.target.value)}
                placeholder="1440, 120"
              />
            </Field>

            <Field>
              <FieldLabel>Policy text (shown + accepted at booking)</FieldLabel>
              <FieldControl
                value={policyText}
                onChange={(e) => setPolicyText(e.target.value)}
                render={
                  <Textarea
                    rows={2}
                    placeholder="Please give at least 24 hours notice to cancel or reschedule."
                  />
                }
              />
            </Field>
          </div>
        </CardBody>
      </Card>
    </SurfaceStep>
  );

  if (presentation === 'modal') {
    return (
      <ModuleProvider module="scheduling">
        <SurfaceFrame
          variant="modal"
          title={heading}
          steps={STEPS}
          current={0}
          open={open}
          onOpenChange={(next) => {
            if (!next) close();
          }}
          onRequestClose={onRequestClose}
          footer={
            <Button variant="ghost" color="neutral" size="sm" onClick={onCancelClick}>
              Cancel
            </Button>
          }
        >
          {body}
        </SurfaceFrame>
      </ModuleProvider>
    );
  }

  return (
    <ModuleProvider module="scheduling" className="h-full">
      <SurfaceFrame
        variant={presentation === 'overlay' ? 'inline' : 'embedded'}
        title={heading}
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        {body}
      </SurfaceFrame>
    </ModuleProvider>
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
    <div className="grid grid-cols-2 gap-3">
      <Field>
        <FieldLabel>{label}</FieldLabel>
        <NativeSelect value={mode} onChange={(e) => onMode(e.target.value as FeeMode)}>
          <option value="none">None</option>
          <option value="fixed">Fixed ($)</option>
          <option value="percent">Percent of price (%)</option>
        </NativeSelect>
      </Field>
      {mode !== 'none' ? (
        <Field>
          <FieldLabel>{mode === 'fixed' ? 'Amount ($)' : 'Percent (%)'}</FieldLabel>
          <FieldControl
            type="number"
            min={0}
            step={mode === 'fixed' ? '0.01' : '1'}
            value={value}
            onChange={(e) => onValue(Number(e.target.value) || 0)}
          />
        </Field>
      ) : null}
    </div>
  );
}
