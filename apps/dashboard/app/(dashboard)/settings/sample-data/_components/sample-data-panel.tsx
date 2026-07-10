'use client';

// Sample-data panel — one card showing the industry dataset that applies, the
// modules it spans (each chip in its own module hue — color-follows-functionality,
// since the settings route has no module color of its own), and what's currently
// loaded. Load installs a full realistic dataset; Clear removes EXACTLY the sample
// rows (named in a destructive confirm) and nothing of the tenant's own.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, ModuleProvider, toast, useConfirm } from '@sparx/ui';
import { Badge, Button } from '@wizeworks/silicaui-react';

import {
  clearSampleDataAction,
  loadSampleDataAction,
  type SampleDataCounts,
  type SampleDataStatus,
} from '../actions';

const MODULE_LABELS: Record<string, string> = { crm: 'CRM', cms: 'CMS', b2b: 'B2B', ai: 'AI' };
const moduleLabel = (m: string): string =>
  MODULE_LABELS[m] ?? m.charAt(0).toUpperCase() + m.slice(1);

type SparxModuleName = React.ComponentProps<typeof ModuleProvider>['module'];

// Entity → [singular, plural], in display order. Only non-zero entries render.
const COUNT_LABELS: [keyof SampleDataCounts, string, string][] = [
  ['products', 'product', 'products'],
  ['categories', 'category', 'categories'],
  ['collections', 'collection', 'collections'],
  ['customers', 'customer', 'customers'],
  ['orders', 'order', 'orders'],
  ['returns', 'return', 'returns'],
  ['reviews', 'review', 'reviews'],
  ['questions', 'question', 'questions'],
  ['bookings', 'booking', 'bookings'],
  ['deals', 'deal', 'deals'],
  // Covers invoices AND quotes — quotes are billing documents too.
  ['billingDocuments', 'billing document', 'billing documents'],
  ['bundles', 'bundle', 'bundles'],
  ['articles', 'article', 'articles'],
  ['images', 'image', 'images'],
  ['movements', 'stock movement', 'stock movements'],
  ['aiPrompts', 'AI prompt', 'AI prompts'],
  ['toolCalls', 'AI tool call', 'AI tool calls'],
];

function summarizeCounts(counts: SampleDataCounts): string[] {
  return COUNT_LABELS.filter(([k]) => counts[k] > 0).map(
    ([k, s, p]) => `${counts[k]} ${counts[k] === 1 ? s : p}`
  );
}

interface Props {
  status: SampleDataStatus;
  canEdit: boolean;
}

export function SampleDataPanel({ status, canEdit }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState<'load' | 'clear' | null>(null);

  const hasPack = status.modules.length > 0;
  const loadedSummary = summarizeCounts(status.counts);

  function onLoad(): void {
    setBusy('load');
    void (async () => {
      try {
        const res = await loadSampleDataAction();
        if (res.ok) {
          const parts = summarizeCounts(res.data.counts);
          toast.success(`Sample data loaded`, {
            description: parts.length
              ? parts.join(' · ')
              : 'Nothing to load for your enabled modules.',
          });
          router.refresh();
        } else {
          toast.error("Couldn't load sample data", { description: res.error.message });
        }
      } finally {
        setBusy(null);
      }
    })();
  }

  function onClear(): void {
    void (async () => {
      const ok = await confirm({
        title: 'Clear sample data?',
        description: loadedSummary.length
          ? `This removes ${loadedSummary.join(', ')}. It only touches sample data — your own records are untouched — but it can't be undone.`
          : 'This removes any loaded sample data. Your own records are untouched.',
        confirmLabel: 'Clear sample data',
        tone: 'danger',
      });
      if (!ok) return;
      setBusy('clear');
      try {
        const res = await clearSampleDataAction();
        if (res.ok) {
          toast.success('Sample data cleared');
          router.refresh();
        } else {
          toast.error("Couldn't clear sample data", { description: res.error.message });
        }
      } finally {
        setBusy(null);
      }
    })();
  }

  // No pack applies — the tenant hasn't picked an industry (or none of its modules
  // overlap the pack). Point them at the Industry page first.
  if (!hasPack && !status.loaded) {
    return (
      <Card variant="subtle" padding="md">
        <div className="flex flex-col gap-2">
          <p className="font-medium">No sample dataset yet</p>
          <p className="text-base-content/70 text-sm">
            {status.industry
              ? `There's no sample dataset for "${status.industry}" yet, or none of its modules are enabled.`
              : 'Pick your industry first and we can load a matching dataset for it.'}
          </p>
          <div>
            <Button
              color="primary"
              variant="soft"
              size="sm"
              render={<Link href="/settings/industry" />}
            >
              Choose your industry
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="subtle" padding="md">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row items-center gap-2">
            <p className="flex-1 font-medium">{status.packLabel}</p>
            {status.loaded ? (
              <Badge color="success" variant="soft" size="sm">
                Loaded
              </Badge>
            ) : (
              <Badge variant="soft" size="sm">
                Not loaded
              </Badge>
            )}
          </div>
          <p className="text-base-content/70 text-sm">{status.packSummary}</p>
        </div>

        {hasPack && (
          <div className="flex flex-col gap-1">
            <p className="text-base-content/70 text-xs">Spans these enabled modules:</p>
            <div className="flex flex-row flex-wrap gap-1">
              {status.modules.map((m) => (
                <ModuleProvider key={m} module={m as SparxModuleName} className="inline-flex">
                  <Badge color="module" variant="soft" size="sm">
                    {moduleLabel(m)}
                  </Badge>
                </ModuleProvider>
              ))}
            </div>
          </div>
        )}

        {status.loaded && loadedSummary.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-base-content/70 text-xs">Currently loaded:</p>
            <p className="text-sm">{loadedSummary.join(' · ')}</p>
          </div>
        )}

        <div className="flex flex-row flex-wrap gap-2">
          <Button
            color="primary"
            variant="solid"
            size="sm"
            onClick={onLoad}
            loading={busy === 'load'}
            disabled={!canEdit || busy !== null}
          >
            {status.loaded ? 'Reload sample data' : 'Load sample data'}
          </Button>
          {status.loaded && (
            <Button
              color="danger"
              variant="soft"
              size="sm"
              onClick={onClear}
              loading={busy === 'clear'}
              disabled={!canEdit || busy !== null}
            >
              Clear sample data
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
