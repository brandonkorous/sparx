'use client';

// Bulk price adjustment modal (docs/69 B-3). Two steps in one dialog:
//   1. Configure — percentage / fixed-amount (increase or decrease) / set-to.
//   2. Preview — a dry-run before→after table per product; nothing is written
//      until "Apply". Apply records a 30-minute undo (surfaced as a banner on
//      the products list).

import * as React from 'react';
import { ArrowDown, ArrowUp, DollarSign, Percent, Tag } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Spinner,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { applyBulkPriceAction, previewBulkPriceAction } from '../../product-actions';
import type { BulkPricePreview, PriceAdjustment } from '../_lib/bulk-price-types';

type Mode = 'percent' | 'fixed' | 'set';
type Direction = 'increase' | 'decrease';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  onApplied: () => void;
}

const MODES: { value: Mode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'percent', label: 'Percentage', icon: Percent },
  { value: 'fixed', label: 'Fixed amount', icon: DollarSign },
  { value: 'set', label: 'Set price', icon: Tag },
];

export function BulkPriceAdjustModal({ open, onOpenChange, productIds, onApplied }: Props) {
  const [mode, setMode] = React.useState<Mode>('percent');
  const [direction, setDirection] = React.useState<Direction>('increase');
  const [amount, setAmount] = React.useState('');
  const [preview, setPreview] = React.useState<BulkPricePreview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setMode('percent');
    setDirection('increase');
    setAmount('');
    setPreview(null);
    setError(null);
    setBusy(false);
  }

  // Reset on close so the next open starts fresh (no prop→state effect needed).
  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  const amountNum = Number(amount);
  const amountFilled = amount.trim() !== '' && Number.isFinite(amountNum) && amountNum >= 0;
  // A decrease can't exceed 100 %.
  const amountValid =
    amountFilled && !(mode === 'percent' && direction === 'decrease' && amountNum > 100);

  function buildAdjustment(): PriceAdjustment {
    if (mode === 'set') return { mode: 'set', priceCents: Math.round(amountNum * 100) };
    const sign = direction === 'increase' ? 1 : -1;
    if (mode === 'percent') return { mode: 'percent', percent: sign * amountNum };
    return { mode: 'fixed', amountCents: sign * Math.round(amountNum * 100) };
  }

  async function runPreview() {
    setBusy(true);
    setError(null);
    const res = await previewBulkPriceAction(productIds, buildAdjustment());
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setPreview(res.data);
  }

  async function runApply() {
    setBusy(true);
    setError(null);
    const res = await applyBulkPriceAction(productIds, buildAdjustment());
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    onApplied();
    handleOpenChange(false);
  }

  const unit = mode === 'percent' ? '%' : '$';
  const amountLabel = mode === 'set' ? 'New price' : mode === 'percent' ? 'Percentage' : 'Amount';

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>Adjust prices</ModalTitle>
          <ModalDescription>
            {productIds.length} product{productIds.length === 1 ? '' : 's'} selected. Changes apply
            to every variant and can be undone for 30 minutes.
          </ModalDescription>
        </ModalHeader>

        {preview ? (
          <PreviewStep preview={preview} />
        ) : (
          <Stack gap={5} className="py-2">
            <Stack gap={2}>
              <Label>Adjustment</Label>
              <Stack direction="row" gap={2} wrap>
                {MODES.map((m) => (
                  <Button
                    key={m.value}
                    type="button"
                    size="sm"
                    color="module"
                    variant={mode === m.value ? 'solid' : 'outline'}
                    leftIcon={<m.icon className="h-4 w-4" />}
                    onClick={() => setMode(m.value)}
                  >
                    {m.label}
                  </Button>
                ))}
              </Stack>
            </Stack>

            {mode !== 'set' ? (
              <Stack gap={2}>
                <Label>Direction</Label>
                <Stack direction="row" gap={2}>
                  <Button
                    type="button"
                    size="sm"
                    color={direction === 'increase' ? 'success' : 'neutral'}
                    variant={direction === 'increase' ? 'solid' : 'outline'}
                    leftIcon={<ArrowUp className="h-4 w-4" />}
                    onClick={() => setDirection('increase')}
                  >
                    Increase
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    color={direction === 'decrease' ? 'danger' : 'neutral'}
                    variant={direction === 'decrease' ? 'solid' : 'outline'}
                    leftIcon={<ArrowDown className="h-4 w-4" />}
                    onClick={() => setDirection('decrease')}
                  >
                    Decrease
                  </Button>
                </Stack>
              </Stack>
            ) : null}

            <Stack gap={2}>
              <Label htmlFor="bulk-price-amount">{amountLabel}</Label>
              <Stack direction="row" align="center" gap={2}>
                {unit === '$' ? (
                  <Text size="sm" variant="muted">
                    $
                  </Text>
                ) : null}
                <Input
                  id="bulk-price-amount"
                  type="number"
                  min={0}
                  step={mode === 'percent' ? 1 : 0.01}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={mode === 'percent' ? '10' : '0.00'}
                  className="max-w-40"
                />
                {unit === '%' ? (
                  <Text size="sm" variant="muted">
                    %
                  </Text>
                ) : null}
              </Stack>
              {amountFilled && !amountValid ? (
                <Text size="xs" className="text-[var(--color-danger)]">
                  A decrease can’t be more than 100%.
                </Text>
              ) : null}
            </Stack>
          </Stack>
        )}

        {error ? (
          <Text size="sm" className="text-[var(--color-danger)]">
            {error}
          </Text>
        ) : null}

        <ModalFooter>
          {preview ? (
            <>
              <Button
                variant="outline"
                color="neutral"
                onClick={() => setPreview(null)}
                disabled={busy}
              >
                Back
              </Button>
              <Button
                color="module"
                onClick={() => void runApply()}
                disabled={busy || preview.changedVariantCount === 0}
                leftIcon={busy ? <Spinner className="h-4 w-4" /> : undefined}
              >
                Apply to {preview.changedVariantCount} variant
                {preview.changedVariantCount === 1 ? '' : 's'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" color="neutral" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                color="module"
                onClick={() => void runPreview()}
                disabled={busy || !amountValid}
                leftIcon={busy ? <Spinner className="h-4 w-4" /> : undefined}
              >
                Preview changes
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function PreviewStep({ preview }: { preview: BulkPricePreview }) {
  return (
    <Stack gap={3} className="py-2">
      <Text size="sm" variant="muted">
        <span className="font-medium text-[var(--color-text-primary)]">{preview.label}.</span>{' '}
        {preview.changedVariantCount} of {preview.variantCount} variant
        {preview.variantCount === 1 ? '' : 's'} across {preview.productCount} product
        {preview.productCount === 1 ? '' : 's'} will change.
      </Text>
      <div className="max-h-80 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">New</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.products.map((p) => {
              const changed =
                p.newMinCents !== p.currentMinCents || p.newMaxCents !== p.currentMaxCents;
              return (
                <TableRow key={p.productId}>
                  <TableCell>
                    <Text size="sm" className="font-medium">
                      {p.title}
                    </Text>
                    <Text size="xs" variant="muted">
                      {p.variantCount} variant{p.variantCount === 1 ? '' : 's'}
                    </Text>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Text size="sm" variant="muted">
                      {priceRange(p.currentMinCents, p.currentMaxCents)}
                    </Text>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Text
                      size="sm"
                      className={changed ? 'font-medium text-[var(--module-active)]' : undefined}
                      variant={changed ? undefined : 'muted'}
                    >
                      {priceRange(p.newMinCents, p.newMaxCents)}
                    </Text>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Stack>
  );
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function priceRange(minCents: number | null, maxCents: number | null): string {
  if (minCents == null) return '—';
  if (maxCents == null || minCents === maxCents) return money(minCents);
  return `${money(minCents)}–${money(maxCents)}`;
}
