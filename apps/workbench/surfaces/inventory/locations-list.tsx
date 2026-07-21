'use client';

// LOCATIONS — every place you keep stock: a warehouse, a shop floor, a van.
//
// ── Cards, not a table ───────────────────────────────────────────────────
//
// The house rule: a short list of one-line-ish things is cards, not a table.
// Locations are exactly that — most businesses have a handful, each one an
// identity (a name and the code on its shelf labels) plus two facts (what kind
// of place it is, and where it is). A table here would invent columns to justify
// itself and repeat a header strip no one reads; a card per location puts the
// name first and the state badge on the right, which is the whole of what you
// scan for. A business with fifty 3PLs is rare enough that it is not worth
// trading that clarity away — and the search and kind filters handle scale.
//
// ── Every narrowing is a SERVER filter ───────────────────────────────────
//
// Search, the kind of place, "show closed", and the paging all go to the API.
// Filtering the loaded window in the browser would answer "which of my 3PLs" by
// sieving the fifty rows that happen to be in hand.
//
// ── Three empty states, three different problems ─────────────────────────
//
// Nothing matches the search or filters · nothing exists yet · the load failed.
// Telling someone to set up their first location when they have twelve and
// mistyped is the worse of the mistakes, so the narrowed case says so instead.

import { useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  NativeSelect,
  SearchInput,
  Text,
  ToggleGroup,
  ToggleGroupItem,
  ToolbarSeparator,
} from '@wizeworks/silicaui-react';
import { EyeOff, MapPin, Plus, Warehouse } from 'lucide-react';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  LOCATION_TYPES,
  locationPlace,
  locationState,
  locationTypeLabel,
  useLocations,
  type Location,
} from './locations-data';

const DETAIL_KEY = 'inventory.warehouses.detail';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** What to try when nothing matched — naming ONLY what is actually narrowing the
 *  list, so no one goes hunting for a filter they never set. */
function emptyAdvice(search: string, typeLabel: string | null, includeClosed: boolean): string {
  const parts: string[] = [];
  if (search) parts.push('Try part of a location’s name or its code.');
  if (typeLabel) parts.push(`You are only seeing “${typeLabel}” places — switch to every kind.`);
  if (!includeClosed) parts.push('Closed locations are hidden — turn them on to include those.');
  return parts.join(' ');
}

function LocationCard({
  location,
  onOpen,
}: {
  location: Location;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const state = locationState(location);
  const place = locationPlace(location);

  return (
    // A real <button>: the whole card opens the location, and it must be
    // keyboard-reachable as one target rather than a div wearing a role.
    <button
      type="button"
      className="card bg-base-100 hover:bg-base-200 flex cursor-pointer flex-col gap-2 p-4 text-left"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Warehouse className="text-base-content size-4 shrink-0" aria-hidden />
          {/* The name is what a person recognises; it leads and nothing else on
              the card gets to be its size. A styled span, not a heading — an
              interactive card is a <button>, and a heading may not sit inside one. */}
          <span className="min-w-0 truncate text-lg font-semibold">{location.name}</span>
        </div>
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* The code is how the shelves are labelled, so it earns a place beside
            the name — set in mono because it is a code, not prose. */}
        <span className="font-mono text-sm">{location.code}</span>
        <span aria-hidden>·</span>
        <Text as="span" className="text-sm">
          {locationTypeLabel(location.type)}
        </Text>
      </div>

      {place ? (
        <div className="flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <Text as="span" className="min-w-0 truncate text-sm">
            {place}
          </Text>
        </div>
      ) : null}
    </button>
  );
}

export function LocationsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [includeClosed, setIncludeClosed] = useState(false);

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const skip = (page - 1) * pageSize;

  const { data, isPending, isFetching, dataUpdatedAt, isError, refetch } = useLocations({
    q: search.trim(),
    ...(type ? { type } : {}),
    includeClosed,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const typeLabel = type ? locationTypeLabel(type) : null;
  // Only an explicit search or kind filter counts as "narrowed". "Show closed"
  // is OFF by default, so treating that default as a narrowing would show a
  // brand-new account "Nothing matches that" instead of a first-run create
  // prompt — the empty-account case must reach the CTA, not the search advice.
  const narrowed = search.trim() !== '' || type !== '';

  /** Anything that changes which rows match returns to the first window —
   *  staying on page 5 of a set that now has two shows nothing. */
  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const openNew = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
  };

  const open = (location: Location, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: location.id }, { target: targetFor(event) });
  };

  const body = () => {
    // A failed load REPLACES the grid — never an empty grid under live filters,
    // which invites someone to conclude they have no locations.
    if (isError) {
      return (
        <EmptyState
          icon={<Warehouse className="size-6" aria-hidden />}
          title="Could not load your locations"
          description="This is a problem reaching the server. Your locations are unaffected — the list just could not be read just now."
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
          Loading locations…
        </p>
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          icon={<Warehouse className="size-6" aria-hidden />}
          title={narrowed ? 'Nothing matches that' : 'No locations yet'}
          description={
            narrowed
              ? emptyAdvice(search.trim(), typeLabel, includeClosed)
              : `A location is any place you keep stock — a warehouse, a shop, a garage, a van. Set up your first and you can start counting what is in it.${
                  includeClosed
                    ? ''
                    : ' If you have closed a location before, switch on “Show closed” to see it.'
                }`
          }
          actions={
            narrowed ? undefined : (
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  openNew({ shiftKey: false, altKey: false });
                }}
              >
                <Plus className="size-4" aria-hidden />
                New location
              </Button>
            )
          }
        />
      );
    }

    return (
      // One column in a narrow docked pane, two once there is room — driven by
      // PANE width, so a pane at 320px on a wide monitor still reads as a list.
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
        {rows.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            onOpen={(event) => {
              open(location, event);
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={PANE_SHELL}>
      {/* The toolbar does NOT wrap: a second line shoves the grid down and
          reflows as you type. Things give way instead — the kind picker shrinks,
          the "show closed" toggle sheds its label below @2xl — and the search box
          absorbs whatever is left. The primary action carries `ml-auto`. */}
      <PaneToolbar label="Locations list controls">
        {/* The width sits on a WRAPPER: SearchInput forwards className to its
            inner <input>, so a sizing class aimed at the control never reaches
            the element that lays out. */}
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search locations"
            placeholder="Name or code…"
            value={search}
            onValueChange={(next) => {
              setSearch(next);
              resetWindow();
            }}
          />
        </div>

        <ToolbarSeparator className="hidden @xl:block" />

        <NativeSelect
          size="sm"
          className="max-w-40 shrink"
          aria-label="Show only one kind of place"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            resetWindow();
          }}
        >
          <option value="">Every kind</option>
          {LOCATION_TYPES.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </NativeSelect>

        {/* One pressed button, not a chip pair: this is a single yes/no question,
            and two chips would read as two categories of location. It sheds its
            label below @2xl — the eye icon plus the tooltip carries it. */}
        <ToggleGroup
          size="sm"
          color="module"
          className="shrink-0"
          value={includeClosed ? ['closed'] : []}
          onValueChange={(next: unknown[]) => {
            setIncludeClosed(next.includes('closed'));
            resetWindow();
          }}
        >
          <ToggleGroupItem
            value="closed"
            aria-label="Also show closed locations"
            title="Also show closed locations"
          >
            <EyeOff className="size-4" aria-hidden />
            <span className="hidden @2xl:inline">Show closed</span>
          </ToggleGroupItem>
        </ToggleGroup>

        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0 whitespace-nowrap"
          title="New location — hold Shift to open alongside, Alt for a new window"
          onClick={openNew}
        >
          <Plus className="size-4" aria-hidden />
          <span className="hidden @lg:inline">New location</span>
        </Button>

        {/* ALWAYS the last child of a list toolbar — see RefreshButton. */}
        <RefreshButton
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      {/* Capped and centred — torn onto a second monitor this pane is 2000px
          wide, and uncapped the cards stretch into billboards. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl">{body()}</div>
      </div>

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
        {rows.length > 0 ? (
          <Text className="hidden px-1 pb-1 text-sm @xl:block">
            Click to open · Shift-click alongside · Alt-click new window
          </Text>
        ) : null}
      </div>
    </div>
  );
}
