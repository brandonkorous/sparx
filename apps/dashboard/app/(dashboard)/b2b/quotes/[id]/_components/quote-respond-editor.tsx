'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Select,
  Table,
  Textarea,
} from '@wizeworks/silicaui-react';
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
    <div className="flex flex-col gap-4">
      <Table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Requested</th>
            <th>Pricing</th>
            <th className="text-right">Line total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const st = state[item.id]!;
            const result = st.mode === 'markup' ? markupResult(st) : null;
            const cents = unitPriceCents(item, st);
            const lineTotal = cents != null ? (cents / 100) * item.quantity : null;
            return (
              <tr key={item.id}>
                <td className="align-top">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm">{item.name}</p>
                    <p className="text-base-content/70 text-xs">{item.sku}</p>
                  </div>
                </td>
                <td className="align-top">
                  <p className="text-sm">{item.quantity}</p>
                </td>
                <td className="align-top">
                  <p className="text-base-content/70 text-sm">{fmt(Number(item.unitPrice))}</p>
                </td>
                <td className="align-top">
                  <div className="flex min-w-[16rem] flex-col gap-2">
                    <Select
                      value={st.mode}
                      onValueChange={(v) => patch(item.id, { mode: v as Mode })}
                      className="w-40"
                      items={{ manual: 'Manual price', markup: 'Price by markup' }}
                    />

                    {st.mode === 'manual' ? (
                      <Field className="w-32">
                        <FieldControl
                          type="number"
                          min={0}
                          step={0.01}
                          aria-label="Quoted unit price"
                          value={st.price}
                          onChange={(e) => patch(item.id, { price: e.target.value })}
                        />
                      </Field>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-row flex-wrap items-end gap-2">
                          <Field className="w-28">
                            <FieldLabel>
                              Cost {item.variantId ? '(blank = catalog cost)' : ''}
                            </FieldLabel>
                            <FieldControl
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder={item.variantId ? 'catalog' : '0.00'}
                              value={st.cost}
                              onChange={(e) => patch(item.id, { cost: e.target.value })}
                            />
                          </Field>
                          <Field className="w-44">
                            <FieldLabel>Markup</FieldLabel>
                            <Select
                              value={st.source}
                              onValueChange={(v) => patch(item.id, { source: v as string })}
                              items={[
                                ...rules.map((r) => ({ value: r.id, label: r.name })),
                                { value: ADHOC, label: 'Ad-hoc markup…' },
                              ]}
                            />
                          </Field>
                        </div>

                        {st.source === ADHOC && (
                          <div className="flex flex-row flex-wrap items-end gap-2">
                            <Field className="w-40">
                              <FieldLabel>Method</FieldLabel>
                              <Select
                                value={st.method}
                                onValueChange={(v) => patch(item.id, { method: v as BandMethod })}
                                items={{
                                  percentage: 'Markup %',
                                  margin_target: 'Target margin %',
                                  multiplier: 'Multiplier ×',
                                  flat: 'Add fixed $',
                                }}
                              />
                            </Field>
                            <Field className="w-28">
                              <FieldLabel>{METHOD_META[st.method].label}</FieldLabel>
                              <FieldControl
                                type="number"
                                step={0.01}
                                value={st.value}
                                onChange={(e) => patch(item.id, { value: e.target.value })}
                              />
                            </Field>
                          </div>
                        )}

                        {result ? (
                          <div className="flex flex-row flex-wrap items-center gap-2">
                            <Badge color="module" variant="soft">
                              {fmt(result.priceCents / 100)} / unit
                            </Badge>
                            <p className="text-base-content/70 text-xs">
                              {result.marginPct}% margin · {result.markupPct}% markup
                            </p>
                          </div>
                        ) : (
                          <p className="text-base-content/70 text-xs">
                            {item.variantId
                              ? 'Priced from catalog cost on send.'
                              : 'Enter a cost to preview the price.'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="text-right align-top">
                  <p className="text-sm">{lineTotal != null ? fmt(lineTotal) : '—'}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {error && (
        <div className="px-4">
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
        </div>
      )}

      <div className="flex flex-col gap-2 px-4 pb-4">
        <Field className="max-w-xl">
          <FieldLabel>Note to customer (optional)</FieldLabel>
          <FieldControl
            value={merchantNote}
            onChange={(e) => setMerchantNote(e.target.value)}
            render={
              <Textarea
                rows={2}
                placeholder="Any notes or conditions to include with the quoted prices…"
              />
            }
          />
        </Field>
        <div>
          <Button color="module" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Sending…' : 'Send quoted prices to customer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
