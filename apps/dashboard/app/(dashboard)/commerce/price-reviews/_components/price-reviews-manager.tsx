'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, X } from 'lucide-react';

import { useConfirm } from '@sparx/ui';
import { Badge, Button, Card, CardBody, Checkbox, Table } from 'silicaui-react';

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
    <div className="flex flex-row flex-wrap items-center gap-1">
      <p className="text-base-content/70 text-sm tabular-nums line-through">{fmt(from)}</p>
      <ArrowRight className="h-3 w-3 text-[var(--color-fg-muted)]" />
      <p className="text-sm font-medium tabular-nums">{fmt(to)}</p>
      <Badge color={up ? 'success' : 'danger'} variant="soft">
        {up ? '+' : ''}
        {deltaPct(from, to) ?? '—'}%
      </Badge>
    </div>
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
        <CardBody>
          <p className="text-base-content/70 py-10 text-center text-base">
            No price changes waiting for review. Cost-driven changes within a rule’s tolerance apply
            automatically; anything beyond it shows up here.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <p className="text-success text-sm" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      )}

      {selected.size > 0 && (
        <div className="flex flex-row flex-wrap items-center justify-between gap-3 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
          <p className="text-sm">{selected.size} selected</p>
          <div className="flex flex-row gap-2">
            <Button
              size="sm"
              color="module"
              loading={bulkBusy}
              iconStart={<Check className="h-4 w-4" />}
              onClick={() => void onBulk('approve')}
            >
              Approve selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              color="danger"
              disabled={bulkBusy}
              iconStart={<X className="h-4 w-4" />}
              onClick={() => void onBulk('reject')}
            >
              Reject selected
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardBody>
          <Table>
            <thead>
              <tr>
                <th className="w-10">
                  <Checkbox checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
                <th>Variant</th>
                <th>Rule</th>
                <th>Cost</th>
                <th>Price</th>
                <th className="text-right">New margin</th>
                <th>Reason</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialReviews.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={`Select ${r.variantSku}`}
                    />
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">{r.variantTitle ?? r.variantSku}</p>
                      <code className="text-xs text-[var(--color-fg-muted)]">{r.variantSku}</code>
                    </div>
                  </td>
                  <td>
                    <p className="text-base-content/70 text-sm">{r.ruleName ?? '—'}</p>
                  </td>
                  <td>
                    <Movement from={r.oldCostCents ?? r.newCostCents} to={r.newCostCents} />
                  </td>
                  <td>
                    <Movement from={r.oldPriceCents} to={r.newPriceCents} />
                  </td>
                  <td className="text-right tabular-nums">
                    {r.marginPct == null ? '—' : `${r.marginPct}%`}
                  </td>
                  <td>
                    <Badge color="neutral" variant="soft" size="sm">
                      {reasonLabel(r.reason)}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <div className="flex flex-row justify-end gap-1">
                      <Button
                        size="xs"
                        color="module"
                        variant="soft"
                        disabled={busyId === r.id || bulkBusy}
                        iconStart={<Check className="h-3.5 w-3.5" />}
                        onClick={() => void onApprove(r)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="danger"
                        disabled={busyId === r.id || bulkBusy}
                        iconStart={<X className="h-3.5 w-3.5" />}
                        onClick={() => void onReject(r)}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
