'use client';

// New-document form (docs/87 §6). Creates the header — workflow, who it bills,
// currency, tax rate, optional due date + notes. Lines are composed in the editor
// the form redirects to, so this stays a quick "start a document" step.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Stack,
  Text,
  Textarea,
} from '@sparx/ui';

import { createDocumentAction } from '../../../document-actions';

interface Option {
  id: string;
  label: string;
}

interface NewDocumentFormProps {
  workflows: (Option & { isDefault: boolean })[];
  customers: Option[];
  b2bAccounts: Option[];
  preselectedCustomerId: string | null;
  preselectedAccountId: string | null;
}

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]';

export function NewDocumentForm({
  workflows,
  customers,
  b2bAccounts,
  preselectedCustomerId,
  preselectedAccountId,
}: NewDocumentFormProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const defaultWorkflow = workflows.find((w) => w.isDefault) ?? workflows[0];

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    // Tax rate is entered as a percentage (8.75) and stored as a fraction (0.0875).
    const taxPct = numOrZero(form.get('taxRatePct'));
    const input = {
      workflowId: nonEmpty(form.get('workflowId')),
      customerId: nonEmpty(form.get('customerId')),
      b2bAccountId: nonEmpty(form.get('b2bAccountId')),
      currency: (nonEmpty(form.get('currency')) ?? 'USD').toUpperCase(),
      taxRate: Math.min(1, Math.max(0, taxPct / 100)),
      dueAt: toIsoDateTime(form.get('dueAt')),
      notes: nonEmpty(form.get('notes')),
    };

    if (!input.customerId && !input.b2bAccountId) {
      setError('Choose a customer or a B2B account to bill.');
      return;
    }

    startTransition(async () => {
      const result = await createDocumentAction(input);
      if (result.ok) {
        router.push(`/invoicing/documents/${result.data.id}`);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  if (workflows.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <Text variant="muted">
            No document workflows are set up yet. They seed automatically when the Invoicing module
            is activated — if you just enabled it, give it a moment and refresh.
          </Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap={6}>
        <Card>
          <CardHeader>
            <CardTitle>Document</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap={4}>
              <Stack gap={2}>
                <Label htmlFor="workflowId">Workflow</Label>
                <select
                  id="workflowId"
                  name="workflowId"
                  defaultValue={defaultWorkflow?.id ?? ''}
                  className={SELECT_CLASS}
                >
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
                <Text size="xs" variant="muted">
                  The workflow sets the stages and the customer-facing label (Estimate, Invoice,
                  Work Order…).
                </Text>
              </Stack>

              <Stack direction="row" gap={4}>
                <Stack gap={2} className="flex-1">
                  <Label htmlFor="customerId">Customer</Label>
                  <select
                    id="customerId"
                    name="customerId"
                    defaultValue={preselectedCustomerId ?? ''}
                    className={SELECT_CLASS}
                  >
                    <option value="">(none)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Stack>
                <Stack gap={2} className="flex-1">
                  <Label htmlFor="b2bAccountId">B2B account</Label>
                  <select
                    id="b2bAccountId"
                    name="b2bAccountId"
                    defaultValue={preselectedAccountId ?? ''}
                    className={SELECT_CLASS}
                  >
                    <option value="">(none)</option>
                    {b2bAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </Stack>
              </Stack>
              <Text size="xs" variant="muted">
                Bill a retail customer or a B2B account — at least one is required.
              </Text>

              <Stack direction="row" gap={4}>
                <Stack gap={2} className="w-32">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    name="currency"
                    defaultValue="USD"
                    maxLength={3}
                    className="uppercase"
                  />
                </Stack>
                <Stack gap={2} className="w-32">
                  <Label htmlFor="taxRatePct">Tax rate %</Label>
                  <Input
                    id="taxRatePct"
                    name="taxRatePct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.0001"
                    defaultValue={0}
                  />
                </Stack>
                <Stack gap={2} className="flex-1">
                  <Label htmlFor="dueAt">Due date</Label>
                  <Input id="dueAt" name="dueAt" type="date" />
                </Stack>
              </Stack>

              <Stack gap={2}>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} />
              </Stack>
            </Stack>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" asChild>
              <Link href="/invoicing">Cancel</Link>
            </Button>
            <Button type="submit" color="module" disabled={pending} loading={pending}>
              Create document
            </Button>
          </CardFooter>
        </Card>

        {error && (
          <Text size="sm" variant="danger" role="alert" aria-live="polite">
            {error}
          </Text>
        )}
      </Stack>
    </form>
  );
}

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function numOrZero(value: FormDataEntryValue | null): number {
  const s = typeof value === 'string' ? value.trim() : '';
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function toIsoDateTime(value: FormDataEntryValue | null): string | undefined {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return undefined;
  return new Date(`${s}T00:00:00Z`).toISOString();
}
