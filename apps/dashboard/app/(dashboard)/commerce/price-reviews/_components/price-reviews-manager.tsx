'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, X } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Stack,
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
  approvePriceReviewAction,
  bulkResolvePriceReviewsAction,
  rejectPriceReviewAction,
} from '../../price-review-actions';

export interface PriceReviewRow {
  id: string;
  variantId: string;
  variantSku: string;
  variantTitle: string | null;
  productId: string;
  ruleId: string;
  ruleName: string | null;
  oldCostCents: number | null;
  newCostCents: number;
  oldPriceCents: number;
  newPriceCents: number;
  marginPct: number | null;
  reason: string;
  status: string;
  createdAt: string;
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fmt = (cents: number | null | undefined) => (cents == null ? '—' : money.format(cents / 100));

function reasonLabel(reason: string): string {
  return reason === 'tolerance_exceeded' ? 'Beyond tolerance' : 'Review required';
}

function deltaPct(oldCents: number, newCents: number): number | null {
  if (oldCents <= 0) return null;
  return Math.round(((newCents - oldCents) / oldCents) * 1000) / 10;
}

// old → new money pair with the new value emphasised and a signed delta.
function Movement({ from, to }: { from: number; to: number }) {
  const up = to > from;
  return (
    <Stack direction="row" align="center" gap={1} wrap>
      <Text size="sm" variant="muted" className="tabular-nums line-through">
        {fmt(from)}
      </Text>
      <ArrowRight className="h-3 w-3 text-[var(--color-fg-muted)]" />
      <Text size="sm" weight="medium" className="tabular-nums">
        {fmt(to)}
      </Text>
      <Badge color={up ? 'success' : 'danger'} variant="soft">
        {up ? '+' : ''}
        {deltaPct(from, to) ?? '—'}%
      </Badge>
    </Stack>
  );
}

export function PriceReviewsManager({ initialReviews }: { initialReviews: PriceReviewRow[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const allSelected = initialReviews.length > 0 && selected.size === initialReviews.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(initialReviews.map((r) => r.id)));
  }
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onApprove(row: PriceReviewRow) {
    setError(null);
    setNotice(null);
    setBusyId(row.id);
    try {
      const res = await approvePriceReviewAction(row.id);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setNotice(`Updated ${row.variantSku} to ${fmt(row.newPriceCents)}.`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(row: PriceReviewRow) {
    setError(null);
    setNotice(null);
    setBusyId(row.id);
    try {
      const res = await rejectPriceReviewAction(row.id);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setNotice(`Kept ${row.variantSku} at ${fmt(row.oldPriceCents)}.`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onBulk(action: 'approve' | 'reject') {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirm({
      title:
        action === 'approve'
          ? `Apply ${ids.length} price change${ids.length === 1 ? '' : 's'}?`
          : `Reject ${ids.length} price change${ids.length === 1 ? '' : 's'}?`,
      description:
        action === 'approve'
          ? 'The selected variants will be repriced to their recomputed values. This updates live storefront prices.'
          : 'The selected variants keep their current prices; the proposed changes are discarded.',
      confirmLabel: action === 'approve' ? 'Apply changes' : 'Reject changes',
      tone: action === 'approve' ? 'module' : 'danger',
    });
    if (!ok) return;
    setError(null);
    setNotice(null);
    setBulkBusy(true);
    try {
      const res = await bulkResolvePriceReviewsAction(ids, action);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setNotice(
        `${action === 'approve' ? 'Applied' : 'Rejected'} ${res.data.resolved} change(s)${
          res.data.failed > 0 ? `, ${res.data.failed} failed` : ''
        }.`
      );
      setSelected(new Set());
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  if (initialReviews.length === 0) {
    return (
      <Card>
        <CardContent>
          <Text variant="muted" className="py-10 text-center">
            No price changes waiting for review. Cost-driven changes within a rule’s tolerance apply
            automatically; anything beyond it shows up here.
          </Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack gap={4}>
      {notice && (
        <Text size="sm" variant="success" role="status">
          {notice}
        </Text>
      )}
      {error && (
        <Text size="sm" variant="danger" role="alert">
          {error}
        </Text>
      )}

      {selected.size > 0 && (
        <Stack
          direction="row"
          align="center"
          justify="between"
          wrap
          gap={3}
          className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
        >
          <Text size="sm">{selected.size} selected</Text>
          <Stack direction="row" gap={2}>
            <Button
              size="sm"
              color="module"
              loading={bulkBusy}
              leftIcon={<Check className="h-4 w-4" />}
              onClick={() => void onBulk('approve')}
            >
              Approve selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              color="danger"
              disabled={bulkBusy}
              leftIcon={<X className="h-4 w-4" />}
              onClick={() => void onBulk('reject')}
            >
              Reject selected
            </Button>
          </Stack>
        </Stack>
      )}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right">New margin</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialReviews.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggle(r.id)}
                      aria-label={`Select ${r.variantSku}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack gap={1}>
                      <Text size="sm" weight="medium">
                        {r.variantTitle ?? r.variantSku}
                      </Text>
                      <code className="text-xs text-[var(--color-fg-muted)]">{r.variantSku}</code>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {r.ruleName ?? '—'}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Movement from={r.oldCostCents ?? r.newCostCents} to={r.newCostCents} />
                  </TableCell>
                  <TableCell>
                    <Movement from={r.oldPriceCents} to={r.newPriceCents} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.marginPct == null ? '—' : `${r.marginPct}%`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{reasonLabel(r.reason)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Stack direction="row" gap={1} justify="end">
                      <Button
                        size="xs"
                        color="module"
                        variant="soft"
                        disabled={busyId === r.id || bulkBusy}
                        leftIcon={<Check className="h-3.5 w-3.5" />}
                        onClick={() => void onApprove(r)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="danger"
                        disabled={busyId === r.id || bulkBusy}
                        leftIcon={<X className="h-3.5 w-3.5" />}
                        onClick={() => void onReject(r)}
                      >
                        Reject
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}
