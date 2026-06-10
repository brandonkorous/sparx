'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Textarea,
} from '@sparx/ui';
import {
  applyMarkupRule,
  type BandMethod,
  type MarkupResult,
  type MarkupRuleSpec,
} from '@sparx/commerce-schemas';
import { respondToQuote, type RespondLine } from '../../_lib/actions';

// A document-applicable markup rule, as returned by GET /v1/markup-rules. Only
// the fields the pure engine needs to recompute a line price (docs/48 §5).
export interface MarkupRuleSummary {
  id: string;
  name: string;
  method: MarkupRuleSpec['method'];
  value: number | null;
  bands: MarkupRuleSpec['bands'];
  rounding: MarkupRuleSpec['rounding'];
  floorProfitCents: number | null;
  floorMargin: number | null;
  ceilingSrc: MarkupRuleSpec['ceilingSrc'];
  ceilingValueCents: number | null;
}

interface QuoteItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: string | number;
  variantId: string | null;
  costCents: number | null;
}

interface Props {
  quoteId: string;
  items: QuoteItem[];
  rules: MarkupRuleSummary[];
}

type Mode = 'manual' | 'markup';
const ADHOC = 'adhoc';

interface LineState {
  mode: Mode;
  price: string; // manual unit price, dollars
  cost: string; // markup cost basis, dollars
  source: string; // a rule id, or ADHOC
  method: BandMethod; // ad-hoc method
  value: string; // ad-hoc value (percent, multiplier, or dollars per method)
}

// Per ad-hoc method: the input label + how the typed value maps to the engine's
// unitless `value` (percentage / margin_target are entered as percents).
const METHOD_META: Record<BandMethod, { label: string; toEngine: (n: number) => number }> = {
  percentage: { label: 'Markup %', toEngine: (n) => n / 100 },
  margin_target: { label: 'Target margin %', toEngine: (n) => n / 100 },
  multiplier: { label: 'Multiplier ×', toEngine: (n) => n },
  flat: { label: 'Add fixed $', toEngine: (n) => n },
};

function ruleToSpec(r: MarkupRuleSummary): MarkupRuleSpec {
  return {
    method: r.method,
    value: r.value,
    bands: r.bands ?? [],
    rounding: r.rounding ?? null,
    floorProfitCents: r.floorProfitCents,
    floorMargin: r.floorMargin,
    ceilingSrc: r.ceilingSrc,
    ceilingValueCents: r.ceilingValueCents,
  };
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export function QuoteRespondEditor({ quoteId, items, rules }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const defaultSource = rules[0]?.id ?? ADHOC;

  const [state, setState] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        {
          mode: 'manual',
          price: String(Number(i.unitPrice)),
          cost: i.costCents != null ? String(i.costCents / 100) : '',
          source: defaultSource,
          method: 'percentage',
          value: '',
        } satisfies LineState,
      ])
    )
  );
  const [merchantNote, setMerchantNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ruleById = useMemo(() => new Map(rules.map((r) => [r.id, r])), [rules]);

  function patch(id: string, next: Partial<LineState>) {
    setState((prev) => ({ ...prev, [id]: { ...prev[id]!, ...next } }));
  }

  // The pure engine result for a markup line, or null when not yet priceable
  // (no cost entered, or ad-hoc value missing).
  function markupResult(st: LineState): MarkupResult | null {
    const costNum = parseFloat(st.cost);
    if (!st.cost || Number.isNaN(costNum) || costNum < 0) return null;
    const costCents = Math.round(costNum * 100);
    let spec: MarkupRuleSpec;
    if (st.source !== ADHOC) {
      const rule = ruleById.get(st.source);
      if (!rule) return null;
      spec = ruleToSpec(rule);
    } else {
      const num = parseFloat(st.value);
      if (!st.value || Number.isNaN(num)) return null;
      spec = { method: st.method, value: METHOD_META[st.method].toEngine(num) };
    }
    return applyMarkupRule(costCents, spec);
  }

  function unitPriceCents(item: QuoteItem, st: LineState): number | null {
    if (st.mode === 'manual') return Math.round((parseFloat(st.price) || 0) * 100);
    return markupResult(st)?.priceCents ?? null;
  }

  async function handleSubmit() {
    setError(null);

    const lines: RespondLine[] = [];
    for (const item of items) {
      const st = state[item.id]!;
      if (st.mode === 'manual') {
        lines.push({
          itemId: item.id,
          unitPriceCents: Math.round((parseFloat(st.price) || 0) * 100),
        });
        continue;
      }
      const costNum = parseFloat(st.cost);
      const hasCost = !!st.cost && !Number.isNaN(costNum) && costNum >= 0;
      if (!hasCost && !item.variantId) {
        setError(`Enter a cost for "${item.name}" — it has no catalog variant to price from.`);
        return;
      }
      if (st.source === ADHOC && (!st.value || Number.isNaN(parseFloat(st.value)))) {
        setError(`Enter a markup value for "${item.name}".`);
        return;
      }
      const markup: RespondLine['markup'] =
        st.source !== ADHOC
          ? { kind: 'rule', ruleId: st.source }
          : {
              kind: 'adhoc',
              method: st.method,
              value: METHOD_META[st.method].toEngine(parseFloat(st.value)),
            };
      lines.push({
        itemId: item.id,
        ...(hasCost ? { costCents: Math.round(costNum * 100) } : {}),
        markup,
      });
    }

    setSaving(true);
    try {
      const res = await respondToQuote(quoteId, lines, merchantNote || undefined);
      if (res.error) {
        setError(res.error);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap={4}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Pricing</TableHead>
            <TableHead className="text-right">Line total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const st = state[item.id]!;
            const result = st.mode === 'markup' ? markupResult(st) : null;
            const cents = unitPriceCents(item, st);
            const lineTotal = cents != null ? (cents / 100) * item.quantity : null;
            return (
              <TableRow key={item.id}>
                <TableCell className="align-top">
                  <Stack gap={1}>
                    <Text size="sm">{item.name}</Text>
                    <Text size="xs" variant="muted">
                      {item.sku}
                    </Text>
                  </Stack>
                </TableCell>
                <TableCell className="align-top">
                  <Text size="sm">{item.quantity}</Text>
                </TableCell>
                <TableCell className="align-top">
                  <Text size="sm" variant="muted">
                    {fmt(Number(item.unitPrice))}
                  </Text>
                </TableCell>
                <TableCell className="align-top">
                  <Stack gap={2} className="min-w-[16rem]">
                    <Select
                      value={st.mode}
                      onValueChange={(v) => patch(item.id, { mode: v as Mode })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual price</SelectItem>
                        <SelectItem value="markup">Price by markup</SelectItem>
                      </SelectContent>
                    </Select>

                    {st.mode === 'manual' ? (
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-32"
                        aria-label="Quoted unit price"
                        value={st.price}
                        onChange={(e) => patch(item.id, { price: e.target.value })}
                      />
                    ) : (
                      <Stack gap={2}>
                        <Stack direction="row" gap={2} align="end" wrap>
                          <Stack gap={1}>
                            <Text size="xs" variant="muted">
                              Cost {item.variantId ? '(blank = catalog cost)' : ''}
                            </Text>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className="w-28"
                              placeholder={item.variantId ? 'catalog' : '0.00'}
                              value={st.cost}
                              onChange={(e) => patch(item.id, { cost: e.target.value })}
                            />
                          </Stack>
                          <Stack gap={1}>
                            <Text size="xs" variant="muted">
                              Markup
                            </Text>
                            <Select
                              value={st.source}
                              onValueChange={(v) => patch(item.id, { source: v })}
                            >
                              <SelectTrigger className="w-44">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {rules.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.name}
                                  </SelectItem>
                                ))}
                                <SelectItem value={ADHOC}>Ad-hoc markup…</SelectItem>
                              </SelectContent>
                            </Select>
                          </Stack>
                        </Stack>

                        {st.source === ADHOC && (
                          <Stack direction="row" gap={2} align="end" wrap>
                            <Stack gap={1}>
                              <Text size="xs" variant="muted">
                                Method
                              </Text>
                              <Select
                                value={st.method}
                                onValueChange={(v) => patch(item.id, { method: v as BandMethod })}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percentage">Markup %</SelectItem>
                                  <SelectItem value="margin_target">Target margin %</SelectItem>
                                  <SelectItem value="multiplier">Multiplier ×</SelectItem>
                                  <SelectItem value="flat">Add fixed $</SelectItem>
                                </SelectContent>
                              </Select>
                            </Stack>
                            <Stack gap={1}>
                              <Text size="xs" variant="muted">
                                {METHOD_META[st.method].label}
                              </Text>
                              <Input
                                type="number"
                                step={0.01}
                                className="w-28"
                                value={st.value}
                                onChange={(e) => patch(item.id, { value: e.target.value })}
                              />
                            </Stack>
                          </Stack>
                        )}

                        {result ? (
                          <Stack direction="row" gap={2} align="center" wrap>
                            <Badge color="module" variant="soft">
                              {fmt(result.priceCents / 100)} / unit
                            </Badge>
                            <Text size="xs" variant="muted">
                              {result.marginPct}% margin · {result.markupPct}% markup
                            </Text>
                          </Stack>
                        ) : (
                          <Text size="xs" variant="muted">
                            {item.variantId
                              ? 'Priced from catalog cost on send.'
                              : 'Enter a cost to preview the price.'}
                          </Text>
                        )}
                      </Stack>
                    )}
                  </Stack>
                </TableCell>
                <TableCell className="text-right align-top">
                  <Text size="sm">{lineTotal != null ? fmt(lineTotal) : '—'}</Text>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {error && (
        <Text size="sm" variant="danger" className="px-4">
          {error}
        </Text>
      )}

      <Stack gap={2} className="px-4 pb-4">
        <Text size="sm" variant="muted">
          Note to customer (optional)
        </Text>
        <Textarea
          rows={2}
          placeholder="Any notes or conditions to include with the quoted prices…"
          value={merchantNote}
          onChange={(e) => setMerchantNote(e.target.value)}
          className="max-w-xl"
        />
        <div>
          <Button color="module" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Sending…' : 'Send quoted prices to customer'}
          </Button>
        </div>
      </Stack>
    </Stack>
  );
}
