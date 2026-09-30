'use client';

// SERVICES — what people can book you for, how long each takes, and what it costs.
//
// A table, like every other list. A service is an identity (its name and what
// kind of booking it is) plus two facts you scan down a column — how long it
// lasts, and its price. The columns disclose with @container: docked narrow you
// see the name and its state; given room the kind, the length and the price come
// back. The name cell is the one that GIVES, so the state badge is never shoved
// off the right edge.
//
// Every narrowing — the search, the booking kind, "active only" — is a SERVER
// filter, so a page of results is always the answer to the whole question and
// never fifty rows sieved in the browser.
//
// ── The way back ──────────────────────────────────────────────────────────
//
// Removing a service only ever stamped the row; the server has always been able
// to put it back. The console could not: the list hid removed services and the
// remove confirm said "This cannot be undone" (issue 145). "Removed" widens the
// list to include them, and a removed row carries the one action it can take.

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  NativeSelect,
  SearchInput,
  Table,
  ToggleGroup,
  ToggleGroupItem,
  useToast,
} from '@wizeworks/silicaui-react';
import { Briefcase, EyeOff, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  BOOKING_TYPES,
  bookingTypeLabel,
  formatDuration,
  formatMoney,
  schedulingErrorMessage,
  serviceState,
  useRestoreService,
  useServices,
  type BookingType,
  type SchedulingService,
} from './setup-data';
import { RowOpenHint } from '../../components/row-open-hint';

const DETAIL_KEY = 'scheduling.services.detail';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** What to try when nothing matched — naming ONLY what is actually narrowing the
 *  list, so no one hunts for a filter they never set. */
function emptyAdvice(
  search: string,
  typeLabel: string | null,
  activeOnly: boolean,
  showRemoved: boolean
): string {
  const parts: string[] = [];
  if (search) parts.push('Try part of a service’s name.');
  if (typeLabel) parts.push(`You are only seeing “${typeLabel}” bookings. Switch to every kind.`);
  if (activeOnly) parts.push('Switched-off services are hidden: include those to see them.');
  if (!showRemoved) {
    parts.push('Anything you have removed is hidden too. Turn on Removed to see it.');
  }
  return parts.join(' ');
}

export function ServicesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const toast = useToast();
  const restore = useRestoreService();

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const skip = (page - 1) * pageSize;

  const { data, isPending, isFetching, dataUpdatedAt, isError, refetch } = useServices({
    q: search.trim(),
    ...(type ? { bookingType: type as BookingType } : {}),
    activeOnly,
    includeRemoved: showRemoved,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const typeLabel = type ? bookingTypeLabel(type) : null;
  const narrowed = search.trim() !== '' || type !== '';

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const openNew = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
  };

  const open = (service: SchedulingService, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: service.id }, { target: targetFor(event) });
  };

  const putBack = (service: SchedulingService) => {
    restore.mutate(service.id, {
      onSuccess: () => {
        toast.add({
          title: `${service.name} is back`,
          description: 'It is on your booking page again, and people can book it.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not put it back',
          description: schedulingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  // The column only exists when there is something to put back, so the ordinary
  // list does not carry an empty column for a rare case.
  const anyRemoved = rows.some((service) => service.removedAt);

  const body = () => {
    if (isError) {
      return (
        <EmptyState
          icon={<Briefcase className="size-6" aria-hidden />}
          title="Could not load your services"
          description="This is a problem reaching the server. Your services are unaffected: the list just could not be read just now."
          actions={
            <Button
              size="sm"
              color="module"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      );
    }

    if (isPending) {
      return (
        <p className="p-4 text-sm" role="status">
          Loading services…
        </p>
      );
    }

    if (rows.length === 0) {
      return (
        <ListEmptyState
          filtered={narrowed}
          noResults={{
            icon: <Briefcase className="size-6" aria-hidden />,
            title: 'Nothing matches that',
            description: emptyAdvice(search.trim(), typeLabel, activeOnly, showRemoved),
          }}
          firstRun={{
            title: 'No services yet',
            description:
              'A service is anything a customer can book: a haircut, a class, a table, a hire. Set up your first and people can start booking it.',
            actions: (
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  openNew({ shiftKey: false, altKey: false });
                }}
              >
                <Plus className="size-4" aria-hidden />
                New service
              </Button>
            ),
          }}
        />
      );
    }

    return (
      <Table size="sm" hover>
        <thead>
          <tr>
            <th>Service</th>
            <th className="hidden whitespace-nowrap @lg:table-cell">Kind</th>
            <th className="hidden whitespace-nowrap @xl:table-cell">Length</th>
            <th className="hidden whitespace-nowrap @xl:table-cell">Price</th>
            <th>State</th>
            {anyRemoved ? <th className="text-right">Bring back</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((service) => {
            const state = serviceState(service);
            const removed = Boolean(service.removedAt);
            return (
              <tr
                key={service.id}
                // A removed service has no detail pane to open (every read but
                // this list filters it out, so it would open on "no longer
                // exists"), and its row holds a real button of its own. So the
                // row is not a button.
                {...(removed
                  ? {}
                  : {
                      className: 'cursor-pointer',
                      tabIndex: 0,
                      role: 'button',
                      onClick: (event: React.MouseEvent) => {
                        open(service, event);
                      },
                      onKeyDown: (event: React.KeyboardEvent) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        open(service, event);
                      },
                    })}
              >
                <td className="w-full max-w-0 min-w-56">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{service.name}</span>
                    <span className="truncate text-sm @lg:hidden">
                      {bookingTypeLabel(service.bookingType)} ·{' '}
                      {formatDuration(service.durationMinutes)}
                      {service.priceCents > 0
                        ? ` · ${formatMoney(service.priceCents, service.currency)}`
                        : ''}
                    </span>
                  </span>
                </td>
                <td className="hidden whitespace-nowrap @lg:table-cell">
                  {bookingTypeLabel(service.bookingType)}
                </td>
                <td className="hidden whitespace-nowrap tabular-nums @xl:table-cell">
                  {formatDuration(service.durationMinutes)}
                </td>
                <td className="hidden whitespace-nowrap tabular-nums @xl:table-cell">
                  {service.priceCents > 0
                    ? formatMoney(service.priceCents, service.currency)
                    : 'Free'}
                </td>
                <td>
                  <Badge color={state.tone} variant="soft" size="sm">
                    {state.label}
                  </Badge>
                </td>
                {anyRemoved ? (
                  <td className="text-right">
                    {removed ? (
                      <Button
                        size="sm"
                        variant="outline"
                        color="module"
                        className="whitespace-nowrap"
                        loading={restore.isPending && restore.variables === service.id}
                        disabled={restore.isPending}
                        onClick={() => {
                          putBack(service);
                        }}
                      >
                        <RotateCcw className="size-4" aria-hidden />
                        Put it back
                      </Button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </Table>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Services controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search services"
              placeholder="Service name…"
              value={search}
              onValueChange={(next) => {
                setSearch(next);
                resetWindow();
              }}
            />
          </div>
        }
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0 whitespace-nowrap"
            title="New service: hold Shift to open alongside, Alt for a new window"
            onClick={openNew}
          >
            <Plus className="size-4" aria-hidden />
            <span className="hidden @lg:inline">New service</span>
          </Button>
        }
        controls={
          <>
            <NativeSelect
              size="sm"
              className="max-w-44 shrink"
              aria-label="Show only one kind of booking"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                resetWindow();
              }}
            >
              <option value="">Every kind</option>
              {BOOKING_TYPES.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </NativeSelect>
            <ToggleGroup
              size="sm"
              color="module"
              className="shrink-0"
              value={activeOnly ? ['active'] : []}
              onValueChange={(next: unknown[]) => {
                setActiveOnly(next.includes('active'));
                resetWindow();
              }}
            >
              <ToggleGroupItem
                value="active"
                aria-label="Hide switched-off services"
                title="Hide switched-off services"
              >
                <EyeOff className="size-4" aria-hidden />
                <span className="hidden @2xl:inline">Active only</span>
              </ToggleGroupItem>
            </ToggleGroup>
            {/* Its own group, not a third state of the one above: that toggle
                narrows to what is live, this one widens to what is gone. */}
            <ToggleGroup
              size="sm"
              color="module"
              className="shrink-0"
              value={showRemoved ? ['removed'] : []}
              onValueChange={(next: unknown[]) => {
                setShowRemoved(next.includes('removed'));
                resetWindow();
              }}
            >
              <ToggleGroupItem
                value="removed"
                aria-label="Show services you have removed"
                title="Show services you have removed, so you can put one back"
              >
                <Trash2 className="size-4" aria-hidden />
                <span className="hidden @2xl:inline">Removed</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </>
        }
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <Card className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto">{body()}</Card>

      <div className="mx-auto w-full max-w-5xl shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : skip + 1}
          total={total}
          page={page}
          pageSize={pageSize}
          canLoadMore={take < MAX_TAKE}
          busy={isFetching}
          onLoadMore={() => {
            setTake((current) => Math.min(current + pageSize, MAX_TAKE));
          }}
          onPageChange={(next) => {
            setPage(next);
            setTake(pageSize);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setTake(size);
          }}
        />
        {rows.length > 0 ? <RowOpenHint /> : null}
      </div>
    </div>
  );
}
