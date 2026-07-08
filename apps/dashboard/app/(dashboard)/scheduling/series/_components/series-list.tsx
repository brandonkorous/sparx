'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogTitle,
  Loading,
  Table,
} from 'silicaui-react';
import { toast, useConfirm } from '@sparx/ui';
import { CalendarRange, MoreHorizontal, XCircle } from 'lucide-react';

import type { BookingSeriesDetail, BookingSeriesSummary } from '../../_lib/types';
import { formatDateTime } from '../../_lib/format';
import { cancelBookingSeriesAction, getBookingSeriesAction } from '../../_lib/actions';

const DAY_NAME: Record<string, string> = {
  SU: 'Sun',
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
};
const FREQ_BASE: Record<string, string> = {
  DAILY: 'day',
  WEEKLY: 'week',
  MONTHLY: 'month',
  YEARLY: 'year',
};

/** Humanize an RRULE for the table (e.g. "Every 2 weeks on Mon, Wed · 8 times"). */
function describeRrule(rrule: string): string {
  const parts: Record<string, string> = {};
  for (const seg of rrule.split(';')) {
    const i = seg.indexOf('=');
    if (i > 0) parts[seg.slice(0, i).toUpperCase()] = seg.slice(i + 1);
  }
  const interval = Math.max(1, Number(parts.INTERVAL ?? '1') || 1);
  const base = FREQ_BASE[parts.FREQ ?? ''] ?? (parts.FREQ ?? '').toLowerCase();
  let out = interval > 1 ? `Every ${interval} ${base}s` : `Every ${base}`;
  if (parts.BYDAY) {
    out += ` on ${parts.BYDAY.split(',')
      .map((d) => DAY_NAME[d.trim().toUpperCase()] ?? d)
      .join(', ')}`;
  }
  if (parts.COUNT) out += ` · ${parts.COUNT} times`;
  else if (parts.UNTIL) out += ` · until ${parts.UNTIL.slice(0, 8)}`;
  return out;
}

const STATUS_COLOR: Record<string, string> = {
  active: 'success',
  completed: 'neutral',
  cancelled: 'danger',
};

export function SeriesList({ series }: { series: BookingSeriesSummary[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [detail, setDetail] = useState<BookingSeriesDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function view(id: string) {
    setLoadingDetail(true);
    const result = await getBookingSeriesAction(id);
    setLoadingDetail(false);
    if (result.ok) setDetail(result.data);
    else toast.error(result.error);
  }

  async function cancel(s: BookingSeriesSummary, scope: 'future' | 'all') {
    const ok = await confirm({
      title: scope === 'all' ? 'Cancel the entire series?' : 'Cancel future occurrences?',
      description:
        scope === 'all'
          ? 'Every upcoming and in-progress booking in this series is cancelled and customers are notified. Past bookings are kept. This cannot be undone.'
          : 'Not-yet-started bookings are cancelled and the series stops recurring. Past and in-progress bookings are kept.',
      confirmLabel: 'Cancel series',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await cancelBookingSeriesAction(s.id, scope);
    if (result.ok) {
      toast.success(
        `Cancelled ${result.data.cancelled} booking${result.data.cancelled === 1 ? '' : 's'}`
      );
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <Table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Pattern</th>
            <th>Status</th>
            <th>Upcoming</th>
            <th>Total</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.id}>
              <td className="font-medium">{s.serviceName ?? 'Service'}</td>
              <td className="text-[var(--color-muted-foreground)]">{describeRrule(s.rrule)}</td>
              <td>
                <Badge color={STATUS_COLOR[s.status] ?? 'neutral'} variant="soft">
                  {s.status}
                </Badge>
              </td>
              <td>{s.upcomingBookings}</td>
              <td>{s.totalBookings}</td>
              <td>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="ghost" shape="square" size="sm" aria-label="Series actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void view(s.id)}>
                      <CalendarRange className="mr-2 h-4 w-4" />
                      View occurrences
                    </DropdownMenuItem>
                    {s.status === 'active' ? (
                      <>
                        <DropdownMenuItem
                          onClick={() => void cancel(s, 'future')}
                          className="text-[var(--color-danger)]"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel future occurrences
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void cancel(s, 'all')}
                          className="text-[var(--color-danger)]"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel entire series
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Dialog open={detail !== null || loadingDetail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <div>
            <DialogTitle>{detail ? (detail.serviceName ?? 'Series') : 'Loading…'}</DialogTitle>
          </div>
          {loadingDetail ? (
            <div className="flex items-center gap-2 px-1 py-6 text-sm text-[var(--color-muted-foreground)]">
              <Loading size="sm" /> Loading occurrences…
            </div>
          ) : detail ? (
            <div className="max-h-[60vh] overflow-y-auto px-1 py-2">
              <p className="mb-3 text-sm text-[var(--color-muted-foreground)]">
                {describeRrule(detail.rrule)} · {detail.bookings.length} occurrence
                {detail.bookings.length === 1 ? '' : 's'}
              </p>
              <ul className="flex flex-col gap-1">
                {detail.bookings.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  >
                    <span>{formatDateTime(b.startAt)}</span>
                    <Badge color={STATUS_COLOR[b.status] ?? 'neutral'} variant="soft">
                      {b.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
