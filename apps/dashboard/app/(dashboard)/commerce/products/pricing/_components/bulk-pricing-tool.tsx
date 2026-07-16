'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Play, Plus, Search, Sparkles, X } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Table,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '@sparx/ui';

import {
  applyMarkupRuleAction,
  previewMarkupRuleAction,
  searchScopeProductsAction,
  type MarkupPreviewResult,
  type ScopeProductOption,
} from '../../../markup-actions';

// ─── Public shapes (from the markupService rule row) ───────────────────

interface RuleScope {
  type: 'all' | 'collection' | 'product_type' | 'vendor' | 'products';
  value?: string;
  ids?: string[];
}
export interface BulkRule {
  id: string;
  name: string;
  method: 'percentage' | 'multiplier' | 'flat' | 'margin_target' | 'matrix';
  appliesTo: 'catalog' | 'document' | 'both';
  scope: RuleScope;
}
export interface CollectionOption {
  id: string;
  name: string;
}

type ScopeMode = 'rule' | 'all' | 'collection' | 'product_type' | 'vendor' | 'products';
type ScopeOverride = RuleScope | undefined;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fmt = (cents: number | null | undefined) => (cents == null ? '—' : money.format(cents / 100));

function scopeSummary(s: RuleScope): string {
  switch (s.type) {
    case 'all':
      return 'all products';
    case 'collection':
      return `${s.ids?.length ?? 0} collection(s)`;
    case 'product_type':
      return `type “${s.value}”`;
    case 'vendor':
      return `vendor “${s.value}”`;
    case 'products':
      return `${s.ids?.length ?? 0} product(s)`;
  }
}

// ─── Tool ───────────────────────────────────────────────────────────────

export function BulkPricingTool({
  rules,
  collections,
}: {
  rules: BulkRule[];
  collections: CollectionOption[];
}) {
  const router = useRouter();
  const confirm = useConfirm();

  const [ruleId, setRuleId] = React.useState(rules[0]?.id ?? '');
  const [scopeMode, setScopeMode] = React.useState<ScopeMode>('rule');
  const [collectionIds, setCollectionIds] = React.useState<string[]>([]);
  const [scopeText, setScopeText] = React.useState('');
  const [selectedProducts, setSelectedProducts] = React.useState<ScopeProductOption[]>([]);

  const [preview, setPreview] = React.useState<MarkupPreviewResult | null>(null);
  const [busy, setBusy] = React.useState<'preview' | 'apply' | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const rule = rules.find((r) => r.id === ruleId) ?? null;

  // Reset a stale preview whenever the rule or scope inputs change — the table
  // must never show before/after numbers for a different selection.
  React.useEffect(() => {
    setPreview(null);
    setNotice(null);
  }, [ruleId, scopeMode, collectionIds, scopeText, selectedProducts]);

  function buildScope(): ScopeOverride | 'invalid' {
    switch (scopeMode) {
      case 'rule':
        return undefined; // service falls back to the rule's stored scope
      case 'all':
        return { type: 'all' };
      case 'collection':
        return collectionIds.length > 0 ? { type: 'collection', ids: collectionIds } : 'invalid';
      case 'product_type':
        return scopeText.trim() ? { type: 'product_type', value: scopeText.trim() } : 'invalid';
      case 'vendor':
        return scopeText.trim() ? { type: 'vendor', value: scopeText.trim() } : 'invalid';
      case 'products':
        return selectedProducts.length > 0
          ? { type: 'products', ids: selectedProducts.map((p) => p.id) }
          : 'invalid';
    }
  }

  async function onPreview() {
    if (!rule) return;
    const scope = buildScope();
    if (scope === 'invalid') {
      setError('Finish choosing a scope before previewing.');
      return;
    }
    setError(null);
    setNotice(null);
    setBusy('preview');
    try {
      const res = await previewMarkupRuleAction(rule.id, scope);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setPreview(res.data);
    } finally {
      setBusy(null);
    }
  }

  async function onApply() {
    if (!rule) return;
    const scope = buildScope();
    if (scope === 'invalid') {
      setError('Finish choosing a scope before applying.');
      return;
    }

    // Always preview right before applying so the confirm dialog quotes live
    // counts even if the merchant skipped the Preview button.
    setBusy('apply');
    setError(null);
    setNotice(null);
    try {
      let pv = preview;
      if (!pv) {
        const res = await previewMarkupRuleAction(rule.id, scope);
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
        pv = res.data;
      }
      const ok = await confirm({
        title: `Apply “${rule.name}” to ${pv.totalVariants} variant(s)?`,
        description: `${pv.pricedVariants} will be repriced from cost${
          pv.unpriceableVariants > 0
            ? `, ${pv.unpriceableVariants} have no cost and will be skipped`
            : ''
        }${pv.truncated ? ' (the full scope is larger than the previewed sample)' : ''}. This rewrites their list price and binds them to the rule.`,
        confirmLabel: 'Apply markup',
        tone: 'module',
      });
      if (!ok) return;

      const applied = await applyMarkupRuleAction(rule.id, scope);
      if (!applied.ok) {
        setError(applied.error.message);
        return;
      }
      setNotice(
        `Repriced ${applied.data.applied} variant(s)${
          applied.data.skipped > 0 ? `, skipped ${applied.data.skipped} without a cost` : ''
        }${applied.data.capped ? ' (capped at 5,000 — re-run to finish the rest)' : ''}.`
      );
      // Refresh the preview so the table reflects the now-applied prices.
      const after = await previewMarkupRuleAction(rule.id, scope);
      if (after.ok) setPreview(after.data);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (rules.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-base-content py-6 text-center">
            No catalog markup rules yet.{' '}
            <a className="underline" href="/commerce/markup-rules">
              Create one
            </a>{' '}
            to reprice products from their cost.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {notice && (
        <FieldStatus status="success" attached={false} role="status">
          {notice}
        </FieldStatus>
      )}
      {error && (
        <FieldStatus status="error" attached={false} role="alert">
          {error}
        </FieldStatus>
      )}

      <Card>
        <CardBody>
          <h3 className="text-xl font-semibold">Choose a rule &amp; scope</h3>
          <div className="flex flex-col gap-4">
            <div className="flex flex-row flex-wrap items-end gap-3">
              <Field className="min-w-[14rem] flex-1">
                <FieldLabel>Markup rule</FieldLabel>
                <NativeSelect value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field className="min-w-[12rem] flex-1">
                <FieldLabel>Apply to</FieldLabel>
                <NativeSelect
                  value={scopeMode}
                  onChange={(e) => setScopeMode(e.target.value as ScopeMode)}
                >
                  <option value="rule">
                    {rule ? `Rule’s scope (${scopeSummary(rule.scope)})` : 'Rule’s saved scope'}
                  </option>
                  <option value="all">All products</option>
                  <option value="collection">A collection</option>
                  <option value="product_type">A product type</option>
                  <option value="vendor">A vendor</option>
                  <option value="products">Specific products</option>
                </NativeSelect>
              </Field>
            </div>

            {scopeMode === 'collection' && (
              <CollectionPicker
                collections={collections}
                selected={collectionIds}
                onChange={setCollectionIds}
              />
            )}

            {(scopeMode === 'product_type' || scopeMode === 'vendor') && (
              <Field className="max-w-sm">
                <FieldLabel>{scopeMode === 'vendor' ? 'Vendor' : 'Product type'}</FieldLabel>
                <FieldControl
                  value={scopeText}
                  onChange={(e) => setScopeText(e.target.value)}
                  placeholder={scopeMode === 'vendor' ? 'Bosch' : 'Injectors'}
                />
              </Field>
            )}

            {scopeMode === 'products' && (
              <ProductPicker selected={selectedProducts} onChange={setSelectedProducts} />
            )}

            <div className="flex flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                iconStart={<Sparkles className="h-4 w-4" />}
                onClick={onPreview}
                loading={busy === 'preview'}
                disabled={busy !== null || !ruleId}
              >
                Preview
              </Button>
              <Button
                type="button"
                color="module"
                iconStart={<Play className="h-4 w-4" />}
                onClick={onApply}
                loading={busy === 'apply'}
                disabled={busy !== null || !ruleId}
              >
                Apply markup
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {preview && <PreviewTable preview={preview} />}
    </div>
  );
}

// ─── Preview table ────────────────────────────────────────────────────────

function PreviewTable({ preview }: { preview: MarkupPreviewResult }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">Preview</h3>
          <div className="flex flex-row flex-wrap items-center gap-2">
            <Badge color="module" variant="soft" size="sm">
              {preview.totalVariants} in scope
            </Badge>
            <Badge color="success" variant="soft" size="sm">
              {preview.pricedVariants} priced
            </Badge>
            {preview.unpriceableVariants > 0 && (
              <Badge color="warning" variant="soft" size="sm">
                {preview.unpriceableVariants} skipped
              </Badge>
            )}
          </div>
        </div>
        {preview.truncated && (
          <p className="text-base-content mb-3 text-sm">
            Showing the first {preview.lines.length} of {preview.totalVariants}. Applying covers the
            whole scope (up to 5,000 per run).
          </p>
        )}
        <Table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Current</th>
              <th className="text-right">New</th>
              <th className="text-right">Margin</th>
              <th className="text-right">Markup</th>
            </tr>
          </thead>
          <tbody>
            {preview.lines.map((l) => (
              <tr key={l.variantId}>
                <td>
                  <span className="text-sm font-medium">{l.sku}</span>
                </td>
                <td>
                  <span className="text-base-content text-sm">{l.title ?? '—'}</span>
                </td>
                <td className="text-right">{fmt(l.costCents)}</td>
                <td className="text-right">{fmt(l.currentPriceCents)}</td>
                <td className="text-right">
                  {l.unpriceable ? (
                    <span className="text-base-content text-sm">no cost</span>
                  ) : (
                    <PriceDelta from={l.currentPriceCents} to={l.newPriceCents} />
                  )}
                </td>
                <td className="text-right">{l.marginPct == null ? '—' : `${l.marginPct}%`}</td>
                <td className="text-right">{l.markupPct == null ? '—' : `${l.markupPct}%`}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CardBody>
    </Card>
  );
}

function PriceDelta({ from, to }: { from: number; to: number | null }) {
  if (to == null) return <span>—</span>;
  const up = to > from;
  const down = to < from;
  return (
    <div className="flex flex-row items-center justify-end gap-1">
      <span className="text-sm font-medium">{fmt(to)}</span>
      {(up || down) && (
        <span className={up ? 'text-success text-xs' : 'text-danger text-xs'}>
          {up ? '▲' : '▼'}
        </span>
      )}
    </div>
  );
}

// ─── Scope sub-pickers ──────────────────────────────────────────────────

function CollectionPicker({
  collections,
  selected,
  onChange,
}: {
  collections: CollectionOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (collections.length === 0) {
    return (
      <p className="text-base-content text-xs">
        No collections yet — create one under Collections, or scope by product type / vendor.
      </p>
    );
  }
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div className="border-base-300 flex max-h-48 flex-col gap-1 overflow-auto rounded border p-3">
      {collections.map((c) => (
        <label key={c.id} className="flex cursor-pointer items-center gap-2">
          <Checkbox
            color="module"
            checked={selected.includes(c.id)}
            onChange={() => toggle(c.id)}
            aria-label={c.name}
          />
          <span className="text-sm">{c.name}</span>
        </label>
      ))}
    </div>
  );
}

function ProductPicker({
  selected,
  onChange,
}: {
  selected: ScopeProductOption[];
  onChange: (next: ScopeProductOption[]) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<ScopeProductOption[]>([]);
  const [searching, setSearching] = React.useState(false);

  // Debounced typeahead against the catalog.
  React.useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    setSearching(true);
    const handle = setTimeout(() => {
      void (async () => {
        const res = await searchScopeProductsAction(term);
        if (!live) return;
        setResults(res.ok ? res.data : []);
        setSearching(false);
      })();
    }, 300);
    return () => {
      live = false;
      clearTimeout(handle);
    };
  }, [query]);

  const selectedIds = new Set(selected.map((p) => p.id));

  function add(p: ScopeProductOption) {
    if (!selectedIds.has(p.id)) onChange([...selected, p]);
  }
  function remove(id: string) {
    onChange(selected.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <Field className="max-w-md">
        <FieldLabel>Find products</FieldLabel>
        <div className="flex flex-row items-center gap-2">
          <Search className="h-4 w-4 text-[var(--color-fg-muted)]" />
          <FieldControl
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the catalog by name…"
          />
        </div>
      </Field>

      {query.trim().length >= 2 && (
        <div className="border-base-300 flex max-h-56 flex-col gap-1 overflow-auto rounded border p-2">
          {searching && <p className="text-base-content px-1 py-1 text-sm">Searching…</p>}
          {!searching && results.length === 0 && (
            <p className="text-base-content px-1 py-1 text-sm">No matches.</p>
          )}
          {results.map((p) => (
            <div
              key={p.id}
              className="hover:bg-base-200 flex flex-row items-center justify-between gap-2 rounded px-1 py-1"
            >
              <span className="text-sm">{p.title}</span>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                color="module"
                iconStart={<Plus className="h-3.5 w-3.5" />}
                onClick={() => add(p)}
                disabled={selectedIds.has(p.id)}
              >
                {selectedIds.has(p.id) ? 'Added' : 'Add'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-row flex-wrap gap-2">
          {selected.map((p) => (
            <Badge key={p.id} variant="soft" color="module">
              <span className="inline-flex items-center gap-1">
                {p.title}
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label={`Remove ${p.title}`}
                  className="ml-1 inline-flex"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
