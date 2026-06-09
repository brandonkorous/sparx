'use client';

import { useState } from 'react';
import {
  Button,
  Stack,
  Text,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sparx/ui';
import { createSupplier, updateSupplier } from '../_lib/actions';

interface Supplier {
  id: string;
  name: string;
  type: string;
  credentials: Record<string, string>;
  pricingRule: {
    type: string;
    value: number;
    roundTo?: string;
    maxMsrp?: string;
  } | null;
  notes: string | null;
}

interface Props {
  supplier?: Supplier;
  onSuccess: () => void;
  onCancel: () => void;
}

const SUPPLIER_TYPES = [
  { value: 'csv', label: 'CSV Feed' },
  { value: 'dsers', label: 'DSers' },
  { value: 'spocket', label: 'Spocket' },
  { value: 'faire', label: 'Faire' },
  { value: 'autods', label: 'AutoDS' },
  { value: 'custom', label: 'Custom' },
];

const PRICING_TYPES = [
  { value: 'percentage_markup', label: 'Percentage markup (cost × (1 + %))' },
  { value: 'multiplier', label: 'Multiplier (cost × x)' },
  { value: 'flat_markup', label: 'Flat markup (cost + fixed)' },
  { value: 'fixed_margin', label: 'Fixed margin (cost / (1 – %))' },
];

const ROUND_OPTIONS = [
  { value: 'cent', label: 'Nearest cent' },
  { value: 'dollar', label: 'Nearest dollar' },
  { value: 'five_dollar', label: 'Nearest $5' },
];

export function SupplierForm({ supplier, onSuccess, onCancel }: Props) {
  const [name, setName] = useState(supplier?.name ?? '');
  const [type, setType] = useState(supplier?.type ?? 'csv');
  // CSV credentials
  const [csvUrl, setCsvUrl] = useState(supplier?.credentials?.csvUrl ?? '');
  // DSers credentials
  const [dsersToken, setDsersToken] = useState(supplier?.credentials?.apiToken ?? '');
  const [dsersStoreId, setDsersStoreId] = useState(supplier?.credentials?.storeId ?? '');
  // Spocket credentials
  const [spocketKey, setSpocketKey] = useState(supplier?.credentials?.apiKey ?? '');
  const [notes, setNotes] = useState(supplier?.notes ?? '');

  const [hasPricingRule, setHasPricingRule] = useState(supplier?.pricingRule != null);
  const [pricingType, setPricingType] = useState(
    supplier?.pricingRule?.type ?? 'percentage_markup'
  );
  const [pricingValue, setPricingValue] = useState(String(supplier?.pricingRule?.value ?? '30'));
  const [roundTo, setRoundTo] = useState(supplier?.pricingRule?.roundTo ?? 'cent');
  const [capAtMsrp, setCapAtMsrp] = useState(
    supplier?.pricingRule?.maxMsrp === 'use_supplier_msrp'
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const value = parseFloat(pricingValue);
    if (hasPricingRule && isNaN(value)) {
      setError('Pricing rule value must be a number.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const credentials: Record<string, string> =
        type === 'csv'
          ? { csvUrl: csvUrl.trim() }
          : type === 'dsers'
            ? { apiToken: dsersToken.trim(), storeId: dsersStoreId.trim() }
            : type === 'spocket'
              ? { apiKey: spocketKey.trim() }
              : {};

      const pricingRule = hasPricingRule
        ? {
            type: pricingType,
            value,
            roundTo,
            ...(capAtMsrp && { maxMsrp: 'use_supplier_msrp' as const }),
          }
        : null;

      const body = {
        name: name.trim(),
        ...(supplier ? {} : { type }),
        credentials,
        pricingRule,
        notes: notes.trim() || null,
      };

      if (supplier) {
        const { error: err } = await updateSupplier(supplier.id, body);
        if (err) throw new Error(err);
      } else {
        const { error: err } = await createSupplier(body);
        if (err) throw new Error(err);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <Stack gap={5}>
        <Stack gap={2}>
          <Text size="sm" className="font-medium">
            Name <span className="text-[var(--color-danger)]">*</span>
          </Text>
          <Input
            placeholder="e.g. Main Warehouse CSV"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Stack>

        {!supplier && (
          <Stack gap={2}>
            <Text size="sm" className="font-medium">
              Supplier type
            </Text>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPLIER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Stack>
        )}

        {type === 'csv' && (
          <Stack gap={2}>
            <Text size="sm" className="font-medium">
              CSV feed URL <span className="text-[var(--color-danger)]">*</span>
            </Text>
            <Input
              type="url"
              placeholder="https://supplier.example.com/catalog.csv"
              value={csvUrl}
              onChange={(e) => setCsvUrl(e.target.value)}
            />
            <Text size="xs" className="text-[var(--color-muted-foreground)]">
              Must be a publicly accessible URL. The first row must be a header row.
            </Text>
          </Stack>
        )}

        {type === 'dsers' && (
          <Stack gap={3}>
            <Stack gap={2}>
              <Text size="sm" className="font-medium">
                DSers API token <span className="text-[var(--color-danger)]">*</span>
              </Text>
              <Input
                type="password"
                placeholder="Paste your DSers API token"
                value={dsersToken}
                onChange={(e) => setDsersToken(e.target.value)}
              />
            </Stack>
            <Stack gap={2}>
              <Text size="sm" className="font-medium">
                DSers store ID <span className="text-[var(--color-danger)]">*</span>
              </Text>
              <Input
                placeholder="e.g. 123456"
                value={dsersStoreId}
                onChange={(e) => setDsersStoreId(e.target.value)}
              />
            </Stack>
          </Stack>
        )}

        {type === 'spocket' && (
          <Stack gap={2}>
            <Text size="sm" className="font-medium">
              Spocket API key <span className="text-[var(--color-danger)]">*</span>
            </Text>
            <Input
              type="password"
              placeholder="Paste your Spocket API key"
              value={spocketKey}
              onChange={(e) => setSpocketKey(e.target.value)}
            />
            <Text size="xs" className="text-[var(--color-muted-foreground)]">
              Found in your Spocket dashboard under Settings → API.
            </Text>
          </Stack>
        )}

        <Stack gap={3}>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="rounded"
              checked={hasPricingRule}
              onChange={(e) => setHasPricingRule(e.target.checked)}
            />
            <Text size="sm" className="font-medium">
              Apply pricing rule to imported products
            </Text>
          </label>

          {hasPricingRule && (
            <Stack gap={3} className="border-l-2 border-[var(--color-border)] pl-6">
              <Stack gap={2}>
                <Text size="sm" className="font-medium">
                  Rule type
                </Text>
                <Select value={pricingType} onValueChange={setPricingType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Stack>

              <Stack gap={2}>
                <Text size="sm" className="font-medium">
                  {pricingType === 'percentage_markup' || pricingType === 'fixed_margin'
                    ? 'Percentage (%)'
                    : pricingType === 'multiplier'
                      ? 'Multiplier'
                      : 'Flat amount (cents)'}
                </Text>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={pricingType === 'multiplier' ? '1.5' : '30'}
                  value={pricingValue}
                  onChange={(e) => setPricingValue(e.target.value)}
                />
              </Stack>

              <Stack gap={2}>
                <Text size="sm" className="font-medium">
                  Round retail price to
                </Text>
                <Select value={roundTo} onValueChange={setRoundTo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUND_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Stack>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={capAtMsrp}
                  onChange={(e) => setCapAtMsrp(e.target.checked)}
                />
                <Text size="sm">Cap retail price at supplier MSRP</Text>
              </label>
            </Stack>
          )}
        </Stack>

        <Stack gap={2}>
          <Text size="sm" className="font-medium">
            Internal notes
          </Text>
          <Textarea
            placeholder="Optional notes about this supplier"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Stack>

        {error && (
          <Text size="sm" className="text-[var(--color-danger)]">
            {error}
          </Text>
        )}

        <Stack direction="row" gap={2} className="justify-end">
          <Button type="button" color="neutral" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" color="primary" disabled={submitting}>
            {submitting ? 'Saving…' : supplier ? 'Save changes' : 'Connect supplier'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
