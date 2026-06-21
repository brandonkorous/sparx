'use client';

// Scheduling analytics view (docs/79 §12) — KPI cards + outcome mix + busiest
// services over a selectable date range. Server-rendered with a default 30-day
// window; range presets refetch via the report action.

import { useState } from 'react';
import { Button, Card, toast } from '@sparx/ui';

import type { SchedulingReport } from '../../_lib/types';
import { money } from '../../_lib/format';
import { getSchedulingReportAction } from '../../_lib/actions';

const RANGES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
];

const OUTCOMES: { key: keyof SchedulingReport['totals']; label: string; color: string }[] = [
  { key: 'completed', label: 'Completed', color: 'var(--color-success)' },
  { key: 'confirmed', label: 'Confirmed', color: 'var(--color-info)' },
  { key: 'requested', label: 'Requested', color: 'var(--color-warning)' },
  { key: 'cancelled', label: 'Cancelled', color: 'var(--color-danger)' },
  { key: 'noShow', label: 'No-show', color: 'var(--color-muted-foreground)' },
];

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}

export function ReportView({ initial }: { initial: SchedulingReport | null }) {
  const [report, setReport] = useState(initial);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  async function pick(nextDays: number) {
    setDays(nextDays);
    setLoading(true);
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - nextDays);
    const result = await getSchedulingReportAction(from.toISOString(), to.toISOString());
    setLoading(false);
    if (result.ok) setReport(result.data);
    else toast.error(result.error);
  }

  if (!report) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Reports aren&rsquo;t available yet — once bookings come in they&rsquo;ll show here.
      </p>
    );
  }

  const t = report.totals;
  const maxOutcome = Math.max(1, ...OUTCOMES.map((o) => t[o.key]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Button
            key={r.days}
            type="button"
            size="sm"
            color="module"
            variant={days === r.days ? 'solid' : 'outline'}
            disabled={loading}
            onClick={() => void pick(r.days)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Bookings" value={String(t.all)} />
        <Kpi label="Completed" value={String(t.completed)} />
        <Kpi label="Upcoming" value={String(report.upcomingCount)} />
        <Kpi label="No-show rate" value={`${report.noShowRatePct}%`} />
        <Kpi label="Completed revenue" value={money(report.revenueCents, 'usd')} />
      </div>

      <Card className="p-4">
        <p className="mb-3 text-sm font-medium">Outcomes</p>
        <div className="flex flex-col gap-2">
          {OUTCOMES.map((o) => (
            <div key={o.key} className="flex items-center gap-3">
              <span className="w-20 text-xs text-[var(--color-muted-foreground)]">{o.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(t[o.key] / maxOutcome) * 100}%`, background: o.color }}
                />
              </div>
              <span className="w-8 text-right text-sm tabular-nums">{t[o.key]}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <p className="mb-3 text-sm font-medium">Busiest services</p>
        {report.topServices.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">No bookings in this range.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {report.topServices.map((s) => (
              <li key={s.serviceId} className="flex items-center justify-between text-sm">
                <span>{s.name}</span>
                <span className="text-[var(--color-muted-foreground)] tabular-nums">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
