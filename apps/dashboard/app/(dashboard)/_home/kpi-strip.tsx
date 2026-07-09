import Link from 'next/link';
import { ModuleProvider, Sparkline, Stat } from '@sparx/ui';

import { Icon } from './icons';
import type { Kpi } from './types';

// The headline KPI strip — priority-filled metric tiles, each a deep link to its
// module, wearing that module's hue on the icon + sparkline (the tile surface
// stays neutral). Built on @sparx/ui's <Stat> (label · value · delta · chart).

function KpiTile({ kpi }: { kpi: Kpi }) {
  return (
    <ModuleProvider module={kpi.module}>
      <Link
        href={kpi.href}
        className="focus-visible:outline-module block rounded-lg transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Stat
          label={kpi.label}
          value={kpi.value}
          delta={kpi.delta}
          hint={kpi.hint}
          icon={<Icon name={kpi.icon} className="h-3.5 w-3.5" />}
          chart={
            kpi.spark && kpi.spark.length > 1 ? (
              <Sparkline data={kpi.spark} color="module" height={32} />
            ) : (
              // Reserve the chart slot so every tile is the same height even
              // when a metric has no trend series (e.g. MRR).
              <div className="h-8" aria-hidden />
            )
          }
        />
      </Link>
    </ModuleProvider>
  );
}

export function KpiStrip({ kpis }: { kpis: Kpi[] }) {
  if (kpis.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiTile key={kpi.key} kpi={kpi} />
      ))}
    </div>
  );
}
