'use client';

// The Scheduling week grid — seven day columns over an hourly time axis, every
// booking drawn as a positioned block. It FILLS its container: the seven day
// columns share the full width (flex 1fr each) and the hour rows stretch to the
// full height (positions are percentages of the visible window, not fixed px), so
// the grid spans edge-to-edge and top-to-bottom. Events are bucketed and placed
// in the BROWSER's timezone (matching the staff member's wall clock), with
// overlapping bookings packed into side-by-side lanes. Week navigation pushes a
// `?from=YYYY-MM-DD` (week's Sunday) the server reads to fetch that week.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Button, Text } from '@sparx/ui';
import type { CalendarEvent, BookingStatus } from '../../_lib/types';
import { minuteOfDay, statusColor, STATUS_LABEL } from '../../_lib/format';

const DAY_MS = 86_400_000;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GRID_COLS = '64px repeat(7, minmax(0, 1fr))';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

interface Positioned {
  ev: CalendarEvent;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
}

// Greedy lane-packing within a single day: each cluster of mutually-overlapping
// events shares its width across as many lanes as its peak concurrency.
function packDay(events: { ev: CalendarEvent; startMin: number; endMin: number }[]): Positioned[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: Positioned[] = [];
  let cluster: Positioned[] = [];
  let clusterEnd = -1;
  const flush = (): void => {
    const lanes = cluster.reduce((m, c) => Math.max(m, c.lane + 1), 0);
    for (const c of cluster) c.lanes = lanes;
    out.push(...cluster);
    cluster = [];
  };
  for (const e of sorted) {
    if (cluster.length > 0 && e.startMin >= clusterEnd) flush();
    const laneEnds: number[] = [];
    for (const c of cluster) laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? 0, c.endMin);
    let lane = laneEnds.findIndex((end) => end <= e.startMin);
    if (lane === -1) lane = cluster.length === 0 ? 0 : laneEnds.length;
    cluster.push({ ...e, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, e.endMin);
  }
  if (cluster.length > 0) flush();
  return out;
}

const STATUS_VAR: Record<string, string> = {
  success: 'var(--color-success)',
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  neutral: 'var(--color-text-tertiary)',
};

export function WeekCalendar({
  weekStartYmd,
  events,
}: {
  weekStartYmd: string;
  events: CalendarEvent[];
}) {
  const router = useRouter();
  const weekStart = parseYmd(weekStartYmd);
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));
  const todayYmd = ymd(new Date());

  // Bucket events into local day columns and compute minute-of-day spans.
  const perDay: Positioned[][] = days.map((day) => {
    const key = ymd(day);
    const raw = events
      .map((ev) => ({ ev, s: new Date(ev.startAt), e: new Date(ev.endAt) }))
      .filter((x) => ymd(x.s) === key)
      .map((x) => {
        const startMin = x.s.getHours() * 60 + x.s.getMinutes();
        const endRaw = x.e.getHours() * 60 + x.e.getMinutes();
        return { ev: x.ev, startMin, endMin: Math.max(endRaw || 1440, startMin + 15) };
      });
    return packDay(raw);
  });

  // Hour window: tight to the day's events, padded to a sensible default day.
  const all = perDay.flat();
  const minH = all.length ? Math.floor(Math.min(...all.map((p) => p.startMin)) / 60) : 8;
  const maxH = all.length ? Math.ceil(Math.max(...all.map((p) => p.endMin)) / 60) : 19;
  const startHour = Math.max(0, Math.min(8, minH));
  const endHour = Math.min(24, Math.max(19, maxH));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const windowMin = (endHour - startHour) * 60;
  // Position as a percentage of the visible window so the grid fills any height.
  const pct = (min: number): number => ((min - startHour * 60) / windowMin) * 100;

  const go = (deltaWeeks: number): void => {
    const next = new Date(weekStart.getTime() + deltaWeeks * 7 * DAY_MS);
    router.push(`/scheduling/calendar?from=${ymd(next)}`);
  };
  const goToday = (): void => {
    const t = new Date();
    t.setDate(t.getDate() - t.getDay());
    router.push(`/scheduling/calendar?from=${ymd(t)}`);
  };

  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions): string =>
    new Intl.DateTimeFormat('en-US', opts).format(d);
  const rangeLabel = `${fmt(days[0]!, { month: 'short', day: 'numeric' })} – ${fmt(days[6]!, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
        <Text className="text-sm font-semibold">{rangeLabel}</Text>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={goToday}>
            Today
          </Button>
          <Button size="sm" variant="ghost" aria-label="Previous week" onClick={() => go(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Next week" onClick={() => go(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day header row */}
      <div
        className="grid shrink-0 border-b border-[var(--color-border)]"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        <div />
        {days.map((d) => {
          const isToday = ymd(d) === todayYmd;
          return (
            <div
              key={ymd(d)}
              className="border-l border-[var(--color-border)] px-2 py-2 text-center"
            >
              <div className="text-xs text-[var(--color-muted-foreground)]">{DOW[d.getDay()]}</div>
              <div
                className={`text-sm font-semibold ${isToday ? 'text-[var(--module-scheduling)]' : ''}`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid — fills the remaining height; scrolls only if it can't fit. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid h-full min-h-[520px]" style={{ gridTemplateColumns: GRID_COLS }}>
          {/* Hour gutter */}
          <div className="relative">
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] whitespace-nowrap text-[var(--color-muted-foreground)] tabular-nums"
                style={{ top: `${(i / hours.length) * 100}%` }}
              >
                {i === 0 ? '' : minuteOfDay(h * 60)}
              </div>
            ))}
          </div>

          {days.map((d, dayIdx) => {
            const key = ymd(d);
            const isToday = key === todayYmd;
            return (
              <div key={key} className="relative border-l border-[var(--color-border)]">
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-[var(--color-border)]/60"
                    style={{ top: `${(i / hours.length) * 100}%` }}
                  />
                ))}
                {isToday && nowMin >= startHour * 60 && nowMin <= endHour * 60 ? (
                  <div
                    className="absolute inset-x-0 z-10 border-t-2 border-[var(--module-scheduling)]"
                    style={{ top: `${pct(nowMin)}%` }}
                  />
                ) : null}
                {perDay[dayIdx]!.map((p) => (
                  <EventBlock key={p.ev.id} p={p} top={pct(p.startMin)} bottom={pct(p.endMin)} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventBlock({ p, top, bottom }: { p: Positioned; top: number; bottom: number }) {
  const muted = p.ev.status === 'cancelled' || p.ev.status === 'no_show';
  const accent = STATUS_VAR[statusColor(p.ev.status as BookingStatus)] ?? STATUS_VAR.neutral;
  const widthPct = 100 / p.lanes;
  const tall = bottom - top > 7;
  return (
    <Link
      href="/scheduling/bookings"
      className="absolute overflow-hidden rounded-md border-l-2 px-2 py-1 text-left hover:z-20 hover:shadow-md"
      style={{
        top: `calc(${top}% + 1px)`,
        height: `calc(${bottom - top}% - 2px)`,
        minHeight: '18px',
        left: `calc(${p.lane * widthPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        borderLeftColor: accent,
        background: `color-mix(in oklch, ${accent} 14%, var(--color-bg-surface))`,
        opacity: muted ? 0.55 : 1,
      }}
    >
      <div
        className={`truncate text-[11px] leading-tight font-semibold ${muted ? 'line-through' : ''}`}
      >
        {p.ev.serviceName}
      </div>
      <div className="truncate text-[10px] leading-tight text-[var(--color-muted-foreground)]">
        {minuteOfDay(p.startMin)}
        {p.ev.resourceNames.length ? ` · ${p.ev.resourceNames[0]}` : ''}
      </div>
      {tall ? (
        <div className="mt-1">
          <Badge color={statusColor(p.ev.status as BookingStatus)} variant="soft" size="sm">
            {STATUS_LABEL[p.ev.status as BookingStatus] ?? p.ev.status}
          </Badge>
        </div>
      ) : null}
    </Link>
  );
}
