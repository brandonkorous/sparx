'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { GitCompareArrows } from 'lucide-react';
import { Button, Join } from '@wizeworks/silicaui-react';
import { cn } from '@sparx/ui';

import { RANGE_OPTIONS, type RangeKey } from './range';
import type { PerfMetric } from './metrics';

// URL-driven dashboard controls. The home dashboard is a force-dynamic server
// component, so changing the range/metric/compare is a normal navigation that
// re-renders the screen with fresh reads — no client data fetching here, just a
// shallow router.push that patches the query string. A transition keeps the old
// screen interactive (dimmed) while the new one streams in.

function useQueryPatch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const patch = React.useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value == null) sp.delete(key);
        else sp.set(key, value);
      }
      const qs = sp.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router]
  );

  return { patch, pending, params };
}

/** The date-range segmented control + compare-to-previous toggle. */
export function RangeControl({ active }: { active: RangeKey }) {
  const { patch, pending, params } = useQueryPatch();
  const compare = params.get('compare') !== '0';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 transition-opacity',
        pending && 'opacity-60'
      )}
    >
      <Join>
        {RANGE_OPTIONS.map((opt) => {
          const isActive = opt.key === active;
          return (
            <Button
              key={opt.key}
              size="sm"
              color={isActive ? 'module' : 'neutral'}
              variant={isActive ? 'solid' : 'outline'}
              aria-pressed={isActive}
              title={opt.label}
              onClick={() => patch({ range: opt.key === '30d' ? null : opt.key })}
            >
              {opt.short}
            </Button>
          );
        })}
      </Join>

      <Button
        size="sm"
        color={compare ? 'module' : 'neutral'}
        variant={compare ? 'soft' : 'outline'}
        aria-pressed={compare}
        iconStart={<GitCompareArrows className="h-3.5 w-3.5" />}
        title={compare ? 'Comparing to previous period' : 'Compare to previous period'}
        onClick={() => patch({ compare: compare ? '0' : null })}
      >
        Compare
      </Button>
    </div>
  );
}

/** The metric switcher for the Performance panel. Only the tenant's available
 *  metrics are passed in, so a content-only tenant never sees Revenue. */
export function MetricSwitcher({ active, metrics }: { active: string; metrics: PerfMetric[] }) {
  const { patch, pending } = useQueryPatch();
  if (metrics.length < 2) return null;
  return (
    <div className={cn('transition-opacity', pending && 'opacity-60')}>
      <Join>
        {metrics.map((m) => {
          const isActive = m.key === active;
          return (
            <Button
              key={m.key}
              size="sm"
              color={isActive ? 'module' : 'neutral'}
              variant={isActive ? 'soft' : 'ghost'}
              aria-pressed={isActive}
              onClick={() => patch({ metric: m.key })}
            >
              {m.label}
            </Button>
          );
        })}
      </Join>
    </div>
  );
}
