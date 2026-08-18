'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Stack, Text, toast, useConfirm } from '@wizeworks/ui';
import {
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@wizeworks/forms';
import type { OperatorInvoiceInput } from '@wizeworks/operator';
import { createInvoiceAction } from '../actions';
import { formatMoneyCents } from '@/lib/format';

interface DraftLine {
  description: string;
  amount: string;
}

const emptyLine = (): DraftLine => ({ description: '', amount: '' });

// Author an enterprise invoice: one or more line items, a due window, an optional
// memo, and whether to issue immediately or leave a draft. Confirmed before send
// (it creates a real Stripe invoice against the tenant's platform customer).
export function InvoiceForm({ tenantId }: { tenantId: string }) {
  const confirm = useConfirm();
  const [lines, setLines] = React.useState<DraftLine[]>([emptyLine()]);
  const [daysUntilDue, setDaysUntilDue] = React.useState('30');
  const [memo, setMemo] = React.useState('');
  const [mode, setMode] = React.useState<'issue' | 'draft'>('draft');
  const [pending, startTransition] = React.useTransition();

  function setLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }
  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const parsedLines = lines
    .map((l) => ({
      description: l.description.trim(),
      amountCents: Math.round(Number(l.amount) * 100),
    }))
    .filter((l) => l.description && Number.isFinite(l.amountCents) && l.amountCents > 0);
  const totalCents = parsedLines.reduce((sum, l) => sum + l.amountCents, 0);

  // `lineCount` is a synthetic field: the invoice needs at least one complete
  // line, but that's a whole-form rule with no single control — surface it as a
  // form-level FieldStatus (below the line editor) rather than per-input.
  const v = useFieldValidation(
    { daysUntilDue, lineCount: String(parsedLines.length) },
    {
      daysUntilDue: rule.number({
        min: 1,
        max: 365,
        integer: true,
        message: 'Enter a due window of 1–365 days.',
      }),
      lineCount: rule.number({
        gt: 0,
        message: 'Add at least one line with a description and amount.',
      }),
    }
  );

  async function submit() {
    if (!v.validate()) return;
    const ok = await confirm({
      title:
        mode === 'issue'
          ? `Issue invoice for ${formatMoneyCents(totalCents)}?`
          : 'Create draft invoice?',
      description:
        mode === 'issue'
          ? 'The invoice is finalized on Stripe and becomes payable by the tenant immediately.'
          : 'A draft invoice is created on Stripe — you can review and issue it there.',
      confirmLabel: mode === 'issue' ? 'Issue invoice' : 'Create draft',
      color: mode === 'issue' ? 'warning' : 'module',
    });
    if (!ok) return;

    const input: OperatorInvoiceInput = {
      tenantId,
      lines: parsedLines,
      daysUntilDue: Math.max(1, Number(daysUntilDue) || 30),
      autoFinalize: mode === 'issue',
      ...(memo.trim() ? { memo: memo.trim() } : {}),
    };
    startTransition(async () => {
      const res = await createInvoiceAction(input);
      if (res.ok) {
        toast.success(res.message);
        setLines([emptyLine()]);
        setMemo('');
      } else {
        toast.error(res.error);
      }
    });
  }

  const lineError = v.visibleError('lineCount');

  return (
    <Stack gap={4}>
      <Stack gap={2}>
        {lines.map((line, index) => (
          <Stack key={index} direction="row" gap={2} align="end">
            <Field className="flex-1">
              {index === 0 ? <FieldLabel>Description</FieldLabel> : null}
              <FieldControl
                name={`line-desc-${index}`}
                value={line.description}
                onChange={(e) => setLine(index, { description: e.target.value })}
                placeholder="e.g. Custom onboarding"
                maxLength={500}
              />
            </Field>
            <Field className="w-32">
              {index === 0 ? <FieldLabel>Amount ($)</FieldLabel> : null}
              <FieldControl
                name={`line-amt-${index}`}
                type="number"
                inputMode="decimal"
                min={0}
                value={line.amount}
                onChange={(e) => setLine(index, { amount: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeLine(index)}
              disabled={lines.length === 1}
              aria-label={`Remove line ${index + 1}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </Stack>
        ))}
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={addLine}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add line
          </Button>
        </div>
        {lineError ? (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {lineError}
          </FieldStatus>
        ) : null}
      </Stack>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field {...v.field('daysUntilDue')}>
          <FieldLabel>Due in (days)</FieldLabel>
          <FieldControl
            name="daysUntilDue"
            type="number"
            min={1}
            max={365}
            value={daysUntilDue}
            onChange={(e) => setDaysUntilDue(e.target.value)}
            {...v.control('daysUntilDue')}
          />
        </Field>
        <Field>
          <FieldLabel>On create</FieldLabel>
          <FieldControl
            name="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'issue' | 'draft')}
            render={
              <NativeSelect>
                <option value="draft">Save as draft</option>
                <option value="issue">Issue immediately</option>
              </NativeSelect>
            }
          />
        </Field>
      </div>

      <Field>
        <FieldLabel>Memo (optional)</FieldLabel>
        <FieldControl
          name="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={2000}
          render={<Textarea rows={2} placeholder="Shown on the invoice." />}
        />
      </Field>

      <Stack direction="row" align="center" justify="between" className="flex-wrap gap-2">
        <Text size="sm" variant="muted">
          Total: <span className="font-medium tabular-nums">{formatMoneyCents(totalCents)}</span>
        </Text>
        <Button type="button" color="primary" onClick={submit} disabled={pending} loading={pending}>
          {mode === 'issue' ? 'Issue invoice' : 'Create draft'}
        </Button>
      </Stack>
    </Stack>
  );
}
