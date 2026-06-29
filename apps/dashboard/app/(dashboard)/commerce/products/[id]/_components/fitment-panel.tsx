'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, Plus, Trash } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  Input,
  Label,
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

import type {
  FitmentDimension,
  ProductFitmentRangeRow,
  ProductFitmentRow,
} from '../../../fitment-actions';
import { deleteFitmentAction, setProductFitmentAction } from '../../../fitment-actions';
import { FitmentNodeDrill } from '../../_components/fitment-node-drill';

interface DomainOption {
  id: string;
  slug: string;
  displayName: string;
  dimensions: FitmentDimension[];
}

interface Props {
  productId: string;
  productTitle: string;
  fitments: ProductFitmentRow[];
  domains: DomainOption[];
}

// Per-product fitment editor. Each row is one applicability rule = a node (the
// deepest level the product fits, e.g. "Ford / F-250 / 6.7L"; blank deeper
// levels = wildcard; no node = the whole domain) + a numeric window per range
// dimension (Year 2011–2016). Rules combine OR on the storefront, so one product
// fits many compatibility windows.

function levelsOf(d: DomainOption): FitmentDimension[] {
  return d.dimensions.filter((dim) => dim.kind === 'level');
}
function rangesOf(d: DomainOption): FitmentDimension[] {
  return d.dimensions.filter((dim) => dim.kind === 'range');
}

export function FitmentPanel({ productId, productTitle, fitments, domains }: Props) {
  const domainsById = new Map(domains.map((d) => [d.id, d]));
  return (
    <Stack gap={4}>
      <Card variant="default">
        <CardHeader>
          <Stack direction="row" align="center" gap={2}>
            <Boxes className="h-4 w-4 text-[var(--module-active)]" />
            <Heading level={3}>Fitment rules</Heading>
            <Badge color="module" variant="soft">
              {fitments.length} rule{fitments.length === 1 ? '' : 's'}
            </Badge>
          </Stack>
          <CardDescription>
            Each row is one compatibility rule for {productTitle}. Narrower rows win on the
            storefront — match runs OR across rows. A brake pad that fits both the 6.7L Power Stroke
            2011–2016 and the 7.3L 1999–2003 is two rows; a dog harness fitting Labs 40–80 lb and
            Goldens 50–90 lb is also two.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {fitments.length === 0 ? (
            <Stack
              gap={2}
              align="center"
              className="border-t border-[var(--color-border-default)] py-10 text-center"
            >
              <Boxes className="h-5 w-5 text-[var(--color-text-muted)]" />
              <Text size="sm" variant="muted">
                No fitment rules yet. Add one below so storefront filters can find this product.
              </Text>
            </Stack>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Fits</TableHead>
                  <TableHead>Narrowing</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fitments.map((row) => (
                  <FitmentRowDisplay
                    key={row.id}
                    row={row}
                    productId={productId}
                    domain={domainsById.get(row.domainId)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card variant="default">
        <CardHeader>
          <Stack direction="row" align="center" gap={2}>
            <Plus className="h-4 w-4 text-[var(--module-active)]" />
            <Heading level={3}>Add fitment rule</Heading>
          </Stack>
          <CardDescription>
            Pick a domain, then drill as deep as the rule needs. Stop at any level — a rule that
            stops at the make fits every model under it. Add a year/size window to narrow further.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? (
            <Text size="sm" variant="muted">
              No fitment domains configured. Add one in <strong>Commerce → Fitment</strong> first.
            </Text>
          ) : (
            <NewFitmentForm productId={productId} fitments={fitments} domains={domains} />
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

function FitmentRowDisplay({
  row,
  productId,
  domain,
}: {
  row: ProductFitmentRow;
  productId: string;
  domain: DomainOption | undefined;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  async function onDelete() {
    const label = row.nodePath.length > 0 ? row.nodePath.join(' / ') : 'the whole domain';
    const ok = await confirm({
      title: `Remove fitment rule for ${label}?`,
      description:
        'This product will no longer appear when shoppers filter by this compatibility. Other fitment rules on this product are unaffected.',
      confirmLabel: 'Remove rule',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteFitmentAction(productId, row.id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <TableRow>
      <TableCell>
        <Text size="sm">{domain?.displayName ?? row.domainSlug}</Text>
      </TableCell>
      <TableCell>
        {row.nodePath.length > 0 ? (
          <Stack direction="row" gap={1} className="flex-wrap">
            {row.nodePath.map((name, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <Text size="xs" variant="muted">
                    /
                  </Text>
                )}
                <Text size="sm" weight={i === row.nodePath.length - 1 ? 'medium' : 'regular'}>
                  {name}
                </Text>
              </React.Fragment>
            ))}
          </Stack>
        ) : (
          <Badge variant="soft" size="sm">
            Any (whole domain)
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {row.ranges.length > 0 ? (
          <Stack direction="row" gap={1} className="flex-wrap">
            {row.ranges.map((r) => (
              <Badge key={r.dimensionKey} variant="soft" size="sm">
                {rangeLabel(domain, r)}
              </Badge>
            ))}
          </Stack>
        ) : (
          <Text size="sm" variant="muted">
            —
          </Text>
        )}
      </TableCell>
      <TableCell>
        <Text size="xs" variant="muted">
          {row.notes ?? '—'}
        </Text>
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void onDelete()}
          disabled={pending}
          leftIcon={<Trash className="h-3.5 w-3.5" />}
        >
          Remove
        </Button>
        {error && (
          <Text size="xs" variant="danger" className="mt-1">
            {error}
          </Text>
        )}
      </TableCell>
    </TableRow>
  );
}

function NewFitmentForm({
  productId,
  fitments,
  domains,
}: {
  productId: string;
  fitments: ProductFitmentRow[];
  domains: DomainOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [domainId, setDomainId] = React.useState<string>(domains[0]?.id ?? '');
  const domain = domains.find((d) => d.id === domainId);
  const ranges = domain ? rangesOf(domain) : [];

  // Deepest selected node id from the drill (null = whole domain).
  const [nodeId, setNodeId] = React.useState<string | null>(null);
  // Range windows keyed by dimension key.
  const [rangeInputs, setRangeInputs] = React.useState<
    Record<string, { min: string; max: string }>
  >({});
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    setNodeId(null);
    setRangeInputs({});
    setNotes('');
  }, [domainId]);

  function fitmentToInput(f: ProductFitmentRow) {
    return {
      domainId: f.domainId,
      nodeId: f.nodeId,
      ranges: f.ranges.map((r) => ({
        dimensionKey: r.dimensionKey,
        ...(r.min !== null ? { min: r.min } : {}),
        ...(r.max !== null ? { max: r.max } : {}),
      })),
      ...(f.notes ? { notes: f.notes } : {}),
    };
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!domainId) {
      setError('Pick a domain first.');
      return;
    }

    const builtRanges: { dimensionKey: string; min?: number; max?: number }[] = [];
    for (const dim of ranges) {
      const raw = rangeInputs[dim.key];
      const min = raw?.min.trim() ? Number.parseFloat(raw.min) : undefined;
      const max = raw?.max.trim() ? Number.parseFloat(raw.max) : undefined;
      if (min === undefined && max === undefined) continue;
      if (min !== undefined && max !== undefined && min > max) {
        setError(`${dim.label}: from must be ≤ to.`);
        return;
      }
      builtRanges.push({
        dimensionKey: dim.key,
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
      });
    }

    const newRow = {
      domainId,
      nodeId,
      ranges: builtRanges,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    const next = [...fitments.map(fitmentToInput), newRow];

    startTransition(async () => {
      const result = await setProductFitmentAction(productId, next);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      (e.target as HTMLFormElement).reset();
      setNodeId(null);
      setRangeInputs({});
      setNotes('');
      router.refresh();
    });
  }

  if (!domain) {
    return (
      <Text size="sm" variant="muted">
        Pick a domain to start.
      </Text>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap={3}>
        <Stack direction="row" gap={3} wrap>
          <Stack gap={1} className="min-w-[160px] flex-1">
            <Label htmlFor="fit-domain">Domain</Label>
            <NativeSelect
              id="fit-domain"
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
              required
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
            </NativeSelect>
          </Stack>
          <FitmentNodeDrill
            key={domainId}
            domainId={domain.id}
            levels={levelsOf(domain)}
            onChange={setNodeId}
          />
        </Stack>

        {ranges.length > 0 && (
          <Stack direction="row" gap={3} wrap>
            {ranges.map((dim) => (
              <Stack key={dim.key} direction="row" gap={2} align="end">
                <Stack gap={1} className="w-28">
                  <Label htmlFor={`fit-range-${dim.key}-min`}>
                    {dim.label} from{dim.unit ? ` (${dim.unit})` : ''}
                  </Label>
                  <Input
                    id={`fit-range-${dim.key}-min`}
                    type="number"
                    inputMode="decimal"
                    value={rangeInputs[dim.key]?.min ?? ''}
                    onChange={(e) =>
                      setRangeInputs((prev) => ({
                        ...prev,
                        [dim.key]: { min: e.target.value, max: prev[dim.key]?.max ?? '' },
                      }))
                    }
                  />
                </Stack>
                <Stack gap={1} className="w-28">
                  <Label htmlFor={`fit-range-${dim.key}-max`}>{dim.label} to</Label>
                  <Input
                    id={`fit-range-${dim.key}-max`}
                    type="number"
                    inputMode="decimal"
                    value={rangeInputs[dim.key]?.max ?? ''}
                    onChange={(e) =>
                      setRangeInputs((prev) => ({
                        ...prev,
                        [dim.key]: { min: prev[dim.key]?.min ?? '', max: e.target.value },
                      }))
                    }
                  />
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}

        <Stack gap={1} className="min-w-[200px]">
          <Label htmlFor="fit-notes">Notes</Label>
          <Input
            id="fit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. requires harness adapter, fleet-only"
          />
        </Stack>

        {error && (
          <Text size="sm" variant="danger" role="alert" aria-live="polite">
            {error}
          </Text>
        )}

        <Stack direction="row" justify="end">
          <Button
            type="submit"
            color="module"
            disabled={pending}
            loading={pending}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add rule
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}

function rangeLabel(domain: DomainOption | undefined, r: ProductFitmentRangeRow): string {
  const dim = domain?.dimensions.find((d) => d.key === r.dimensionKey);
  const name = dim?.label ?? r.dimensionKey;
  const unit = dim?.unit && dim.unit !== 'year' ? ` ${dim.unit}` : '';
  let window: string;
  if (r.min !== null && r.max !== null) window = r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
  else if (r.min !== null) window = `${r.min}+`;
  else if (r.max !== null) window = `≤${r.max}`;
  else window = 'any';
  return `${name} ${window}${unit}`;
}
