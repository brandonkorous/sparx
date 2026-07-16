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
} from '@wizeworks/silicaui-react';
import {
  SelectionList,
  toast,
  useConfirm,
  type SelectionCard,
  type SelectionColumn,
} from '@sparx/ui';
import { CalendarRange, MoreHorizontal, XCircle } from 'lucide-react';

import type { BookingSeriesDetail, BookingSeriesSummary } from '../../_lib/types';
import { formatDateTime } from '../../_lib/format';
import { cancelBookingSeriesAction, getBookingSeriesAction } from '../../_lib/actions';

// Recurring-series index list — rendered through the shared `SelectionList`
// dual-view substrate (docs/34 §7) so it gains the Table/Cards toggle.
// Read-only selection: each row's actions (view occurrences / cancel) live
// in a dropdown.

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

const STATUS_COLOR: Record<string, 'success' | 'neutral' | 'danger'> = {
  active: 'success',
  completed: 'neutral',
  cancelled: 'danger',
};

interface SeriesListProps {
  series: BookingSeriesSummary[];
  view: 'table' | 'card';
}

export function SeriesList({ series, view }: SeriesListProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [detail, setDetail] = useState<BookingSeriesDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function viewOccurrences(id: string) {
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

  const statusBadge = (s: BookingSeriesSummary) => (
    <Badge color={STATUS_COLOR[s.status] ?? 'neutral'} variant="soft">
      {s.status}
    </Badge>
  );

  const actionsMenu = (s: BookingSeriesSummary) => (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" shape="square" size="sm" aria-label="Series actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void viewOccurrences(s.id)}>
          <CalendarRange className="mr-2 h-4 w-4" />
          View occurrences
        </DropdownMenuItem>
        {s.status === 'active' ? (
          <>
            <DropdownMenuItem onClick={() => void cancel(s, 'future')} className="text-danger">
              <XCircle className="mr-2 h-4 w-4" />
              Cancel future occurrences
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void cancel(s, 'all')} className="text-danger">
              <XCircle className="mr-2 h-4 w-4" />
              Cancel entire series
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: SelectionColumn<BookingSeriesSummary>[] = [
    {
      header: 'Service',
      cell: (s) => <span className="font-medium">{s.serviceName ?? 'Service'}</span>,
    },
    {
      header: 'Pattern',
      cell: (s) => <span className="text-base-content">{describeRrule(s.rrule)}</span>,
    },
    { header: 'Status', cell: statusBadge },
    { header: 'Upcoming', cell: (s) => s.upcomingBookings },
    { header: 'Total', cell: (s) => s.totalBookings },
    { header: '', align: 'right', cell: actionsMenu },
  ];

  const card: SelectionCard<BookingSeriesSummary> = {
    title: (s) => <p className="font-medium">{s.serviceName ?? 'Service'}</p>,
    subtitle: (s) => <p className="text-base-content text-xs">{describeRrule(s.rrule)}</p>,
    badge: statusBadge,
    body: (s) => (
      <div className="flex flex-row items-center justify-between gap-2">
        <p className="text-base-content text-sm">
          {s.upcomingBookings} upcoming · {s.totalBookings} total
        </p>
        {actionsMenu(s)}
      </div>
    ),
  };

  return (
    <>
      <SelectionList
        items={series}
        view={view}
        getId={(s) => s.id}
        getRowLabel={(s) => s.serviceName ?? 'Series'}
        entityLabelPlural="series"
        selectable={false}
        columns={columns}
        card={card}
      />

      <Dialog open={detail !== null || loadingDetail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <div>
            <DialogTitle>{detail ? (detail.serviceName ?? 'Series') : 'Loading…'}</DialogTitle>
          </div>
          {loadingDetail ? (
            <div className="text-base-content flex items-center gap-2 px-1 py-6 text-sm">
              <Loading size="sm" /> Loading occurrences…
            </div>
          ) : detail ? (
            <div className="max-h-[60vh] overflow-y-auto px-1 py-2">
              <p className="text-base-content mb-3 text-sm">
                {describeRrule(detail.rrule)} · {detail.bookings.length} occurrence
                {detail.bookings.length === 1 ? '' : 's'}
              </p>
              <ul className="flex flex-col gap-1">
                {detail.bookings.map((b) => (
                  <li
                    key={b.id}
                    className="border-base-300 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
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
