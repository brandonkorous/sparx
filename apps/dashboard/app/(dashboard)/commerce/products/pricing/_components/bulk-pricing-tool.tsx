'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Play, Plus, Search, Sparkles, X } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Heading,
  Input,
  NativeSelect,
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
        <CardContent>
          <Text variant="muted" className="py-6 text-center">
            No catalog markup rules yet.{' '}
            <a className="underline" href="/commerce/markup-rules">
              Create one
            </a>{' '}
            to reprice products from their cost.
          </Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack gap={5}>
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

      <Card>
        <CardHeader>
          <Heading level={3}>Choose a rule &amp; scope</Heading>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack direction="row" gap={3} wrap align="end">
              <Field label="Markup rule" className="min-w-[14rem] flex-1">
                <NativeSelect value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Apply to" className="min-w-[12rem] flex-1">
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
            </Stack>

            {scopeMode === 'collection' && (
              <CollectionPicker
                collections={collections}
                selected={collectionIds}
                onChange={setCollectionIds}
              />
            )}

            {(scopeMode === 'product_type' || scopeMode === 'vendor') && (
              <Field
                label={scopeMode === 'vendor' ? 'Vendor' : 'Product type'}
                className="max-w-sm"
              >
                <Input
                  value={scopeText}
                  onChange={(e) => setScopeText(e.target.value)}
                  placeholder={scopeMode === 'vendor' ? 'Bosch' : 'Injectors'}
                />
              </Field>
            )}

            {scopeMode === 'products' && (
              <ProductPicker selected={selectedProducts} onChange={setSelectedProducts} />
            )}

            <Stack direction="row" gap={2} justify="end">
              <Button
                type="button"
                variant="outline"
                leftIcon={<Sparkles className="h-4 w-4" />}
                onClick={onPreview}
                loading={busy === 'preview'}
                disabled={busy !== null || !ruleId}
              >
                Preview
              </Button>
              <Button
                type="button"
                color="module"
                leftIcon={<Play className="h-4 w-4" />}
                onClick={onApply}
                loading={busy === 'apply'}
                disabled={busy !== null || !ruleId}
              >
                Apply markup
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {preview && <PreviewTable preview={preview} />}
    </Stack>
  );
}

// ─── Preview table ────────────────────────────────────────────────────────

function PreviewTable({ preview }: { preview: MarkupPreviewResult }) {
  return (
    <Card>
      <CardHeader>
        <Stack direction="row" align="center" justify="between" wrap gap={3}>
          <Heading level={3}>Preview</Heading>
          <Stack direction="row" gap={2} align="center" wrap>
            <Badge color="module" variant="outline">
              {preview.totalVariants} in scope
            </Badge>
            <Badge color="success" variant="outline">
              {preview.pricedVariants} priced
            </Badge>
            {preview.unpriceableVariants > 0 && (
              <Badge variant="outline">{preview.unpriceableVariants} skipped</Badge>
            )}
          </Stack>
        </Stack>
      </CardHeader>
      <CardContent>
        {preview.truncated && (
          <Text size="sm" variant="muted" className="mb-3">
            Showing the first {preview.lines.length} of {preview.totalVariants}. Applying covers the
            whole scope (up to 5,000 per run).
          </Text>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="text-right">Markup</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.lines.map((l) => (
              <TableRow key={l.variantId}>
                <TableCell>
                  <Text size="sm" weight="medium">
                    {l.sku}
                  </Text>
                </TableCell>
                <TableCell>
                  <Text size="sm" variant="muted">
                    {l.title ?? '—'}
                  </Text>
                </TableCell>
                <TableCell className="text-right">{fmt(l.costCents)}</TableCell>
                <TableCell className="text-right">{fmt(l.currentPriceCents)}</TableCell>
                <TableCell className="text-right">
                  {l.unpriceable ? (
                    <Text size="sm" variant="muted">
                      no cost
                    </Text>
                  ) : (
                    <PriceDelta from={l.currentPriceCents} to={l.newPriceCents} />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {l.marginPct == null ? '—' : `${l.marginPct}%`}
                </TableCell>
                <TableCell className="text-right">
                  {l.markupPct == null ? '—' : `${l.markupPct}%`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PriceDelta({ from, to }: { from: number; to: number | null }) {
  if (to == null) return <span>—</span>;
  const up = to > from;
  const down = to < from;
  return (
    <Stack direction="row" gap={1} justify="end" align="center">
      <Text size="sm" weight="medium">
        {fmt(to)}
      </Text>
      {(up || down) && (
        <Text size="xs" variant={up ? 'success' : 'danger'}>
          {up ? '▲' : '▼'}
        </Text>
      )}
    </Stack>
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
      <Text size="xs" variant="muted">
        No collections yet — create one under Collections, or scope by product type / vendor.
      </Text>
    );
  }
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <Stack
      gap={1}
      className="max-h-48 overflow-auto rounded border border-[var(--color-border-default)] p-3"
    >
      {collections.map((c) => (
        <label key={c.id} className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={selected.includes(c.id)}
            onCheckedChange={() => toggle(c.id)}
            aria-label={c.name}
          />
          <Text size="sm">{c.name}</Text>
        </label>
      ))}
    </Stack>
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
    <Stack gap={3}>
      <Field label="Find products" className="max-w-md">
        <Stack direction="row" gap={2} align="center">
          <Search className="h-4 w-4 text-[var(--color-fg-muted)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the catalog by name…"
          />
        </Stack>
      </Field>

      {query.trim().length >= 2 && (
        <Stack
          gap={1}
          className="max-h-56 overflow-auto rounded border border-[var(--color-border-default)] p-2"
        >
          {searching && (
            <Text size="sm" variant="muted" className="px-1 py-1">
              Searching…
            </Text>
          )}
          {!searching && results.length === 0 && (
            <Text size="sm" variant="muted" className="px-1 py-1">
              No matches.
            </Text>
          )}
          {results.map((p) => (
            <Stack
              key={p.id}
              direction="row"
              align="center"
              justify="between"
              gap={2}
              className="rounded px-1 py-1 hover:bg-[var(--color-bg-subtle)]"
            >
              <Text size="sm">{p.title}</Text>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                color="module"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => add(p)}
                disabled={selectedIds.has(p.id)}
              >
                {selectedIds.has(p.id) ? 'Added' : 'Add'}
              </Button>
            </Stack>
          ))}
        </Stack>
      )}

      {selected.length > 0 && (
        <Stack direction="row" gap={2} wrap>
          {selected.map((p) => (
            <Badge key={p.id} variant="soft" color="module">
              <Stack direction="row" gap={1} align="center">
                {p.title}
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label={`Remove ${p.title}`}
                  className="ml-1 inline-flex"
                >
                  <X className="h-3 w-3" />
                </button>
              </Stack>
            </Badge>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Stack gap={1} className={className}>
      <Text size="xs" variant="muted" weight="medium">
        {label}
      </Text>
      {children}
    </Stack>
  );
}
