'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  toast,
  useConfirm,
} from '@sparx/ui';
import type { OperatorInvoiceInput } from '@sparx/operator';
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

  async function submit() {
    if (parsedLines.length === 0) {
      toast.error('Add at least one line with a description and amount.');
      return;
    }
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
      tone: mode === 'issue' ? 'warning' : 'module',
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

  return (
    <Stack gap={4}>
      <Stack gap={2}>
        {lines.map((line, index) => (
          <Stack key={index} direction="row" gap={2} align="end">
            <Stack gap={2} className="flex-1">
              {index === 0 ? <Label htmlFor={`line-desc-${index}`}>Description</Label> : null}
              <Input
                id={`line-desc-${index}`}
                value={line.description}
                onChange={(e) => setLine(index, { description: e.target.value })}
                placeholder="e.g. Custom onboarding"
                maxLength={500}
              />
            </Stack>
            <Stack gap={2} className="w-32">
              {index === 0 ? <Label htmlFor={`line-amt-${index}`}>Amount ($)</Label> : null}
              <Input
                id={`line-amt-${index}`}
                type="number"
                inputMode="decimal"
                min={0}
                value={line.amount}
                onChange={(e) => setLine(index, { amount: e.target.value })}
                placeholder="0.00"
              />
            </Stack>
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
      </Stack>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stack gap={2}>
          <Label htmlFor="invoice-due">Due in (days)</Label>
          <Input
            id="invoice-due"
            type="number"
            min={1}
            max={365}
            value={daysUntilDue}
            onChange={(e) => setDaysUntilDue(e.target.value)}
          />
        </Stack>
        <Stack gap={2}>
          <Label htmlFor="invoice-mode">On create</Label>
          <NativeSelect
            id="invoice-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'issue' | 'draft')}
          >
            <option value="draft">Save as draft</option>
            <option value="issue">Issue immediately</option>
          </NativeSelect>
        </Stack>
      </div>

      <Stack gap={2}>
        <Label htmlFor="invoice-memo">Memo (optional)</Label>
        <Textarea
          id="invoice-memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Shown on the invoice."
          rows={2}
          maxLength={2000}
        />
      </Stack>

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
