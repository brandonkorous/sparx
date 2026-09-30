'use client';

// HOW THE FLOOR IS RUNNING — pick and pack throughput.
//
// ── Four numbers, and the fourth is the one that pays ─────────────────────
//
// Units per hour is the number every warehouse system leads with, and on its own
// it is the least useful thing here: it tells a manager how fast people are
// going and nothing about whether the going is worth anything. The number that
// pays is the SHELF table at the bottom — a shelf that keeps coming up empty is a
// put-away problem, a signage problem or a theft problem, and it will never show
// up in a per-person view.
//
// So the layout puts people first because that is what people look for, and then
// spends the rest of the screen on where the stock numbers are actually wrong.
//
// ── "Scan-verified", not "accuracy" ───────────────────────────────────────
//
// We can measure how many lines were confirmed by a trigger pull rather than a
// tap. We cannot measure what was picked wrong and never noticed, and a metric
// called "accuracy" would claim we can. Naming it honestly costs a nicer-sounding
// dashboard and buys a number nobody has to caveat.

import { useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Badge, Card, EmptyState, NativeSelect, Text } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import {
  faBarcodeRead,
  faChartColumn,
  faExclamationTriangle,
  faGauge,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon, type PigglesIcon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { plural, useStockLocations } from './data';
import {
  pickingRate,
  ratePercent,
  shortReasonLabel,
  usePickThroughput,
  type RateFigure,
} from './picking-data';
import { InlineWaiting } from '../../components/inline-waiting';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

const WINDOWS: { value: string; label: string; days: number }[] = [
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '90', label: 'Last 90 days', days: 90 },
];

/** The color a rate wears. A short-pick rate is bad when high; a scan-verified
 *  rate is bad when low — so they cannot share one helper, and pretending they
 *  can is how a dashboard ends up green on the wrong thing. */
function shortTone(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 10) return 'danger';
  if (rate >= 3) return 'warning';
  return 'success';
}

/**
 * What to call whoever did the work.
 *
 * The ledger stamps an IDENTITY — a login id when somebody is signed in, the
 * walk's assignee text when nobody is — and this screen used to print it. The
 * Picker column read `db9c1296-1ed4-4109-90ba-adfc090adf50` on the one report a
 * shop owner opens to see who is quick and who keeps coming up short.
 *
 * The server names it where it can. Where it cannot, the row says so in words
 * rather than falling back to the hex, because a business owner reading a
 * thirty-six character string learns nothing and cannot act on it. The raw value
 * stays on the row as its `title`, for whoever is chasing it down.
 */
function whoDidIt(id: string | null, name: string | null): string {
  if (name !== null && name.trim() !== '') return name;
  if (id === null) return 'Not signed in';
  return 'Somebody this account cannot name';
}

function verifiedTone(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 90) return 'success';
  if (rate >= 50) return 'warning';
  return 'danger';
}

export function PickThroughputSurface({ ctx }: { ctx: SurfaceContext }) {
  const [windowKey, setWindowKey] = useState('30');
  const [locationId, setLocationId] = useState('');

  const days = WINDOWS.find((w) => w.value === windowKey)?.days ?? 30;

  const locations = useStockLocations();
  const activeLocations = (locations.data?.items ?? []).filter((l) => l.isActive);

  const { data, isLoading, isFetching, dataUpdatedAt, isError, refetch } = usePickThroughput({
    days,
    ...(locationId ? { warehouseId: locationId } : {}),
  });

  const body = () => {
    if (isError) {
      return (
        <EmptyState
          icon={<Icon glyph={faChartColumn} className="size-6" aria-hidden />}
          title="Could not load the numbers"
          description="This is a problem reaching the server. Nothing on the floor is affected."
        />
      );
    }
    if (isLoading || !data) {
      return <InlineWaiting label="Working out the numbers…" />;
    }
    if (data.totals.linesPicked === 0 && data.totals.linesShort === 0) {
      return (
        <EmptyState
          icon={<Icon glyph={faGauge} className="size-6" aria-hidden />}
          title="Nothing has been picked in this period"
          description="Generate a walk from an order and work it, and this fills in: how fast, how accurately, and which shelves keep coming up empty."
        />
      );
    }

    const t = data.totals;
    const rate = pickingRate(t.unitsPicked, t.activeMinutes);
    // Every line that was worked, short or not. The denominator the server
    // divides by, so the count shown below the floor is the same one.
    const pickedLines = t.linesPicked + t.linesShort;
    const scanned = ratePercent(
      Math.round((t.scanVerifiedRate / 100) * pickedLines),
      pickedLines,
      verifiedTone
    );
    const short = ratePercent(t.linesShort, pickedLines, shortTone, short1dp(pickedLines));
    const neverScanned = t.everScanned === false;
    // Whether ANY shelf has enough behind it to be called a habit rather than an
    // incident. Decides both the heading and whether it wears an alarm.
    const shelvesRepeating = data.bins.some((b) => binRate(b).enough);
    const scanHint = neverScanned
      ? 'Nothing here was confirmed by scan. If you pick with a barcode reader, this is where it shows.'
      : scanned.enough
        ? 'The rest were tapped, which we cannot verify'
        : 'The rest were tapped. Too few so far to read as a rate.';

    return (
      <div className="flex flex-col gap-3">
        {/* The headline four. Each carries its own color, because a short-pick
            rate of 14% and one of 0.4% are not the same news. */}
        <div className="grid gap-3 @lg:grid-cols-4">
          <Metric label="Units an hour" value={rate.value} hint={rate.hint} tone="text-module" />
          <Metric
            label="Walks finished"
            value={String(t.walksCompleted)}
            hint={`${plural(t.boxesPacked, 'box', 'boxes')} packed`}
            tone="text-info"
          />
          <Metric
            label="Confirmed by scan"
            value={scanned.text}
            hint={scanHint}
            /* A business that has never scanned anything is not failing at
               scanning. Red here tells a shop with no barcode reader to fix
               something it never bought. */
            tone={neverScanned ? null : scanned.tone}
          />
          <Metric
            label="Came up short"
            value={short.text}
            hint={
              short.enough
                ? `${plural(t.unitsShort, 'unit', 'units')} not where we said`
                : `${plural(t.unitsShort, 'unit', 'units')} not where we said, out of ${plural(pickedLines, 'line', 'lines')} so far`
            }
            tone={short.tone}
          />
        </div>

        {/* People. */}
        <Card>
          <div className="border-base-300 border-b p-3">
            <span className="font-medium">By picker</span>
          </div>
          {data.pickers.length === 0 ? (
            <p className="p-4 text-sm">Nobody has picked anything in this period.</p>
          ) : (
            <Table size="sm">
              <thead>
                <tr>
                  <th>Picker</th>
                  <th className="text-right whitespace-nowrap">Units/hr</th>
                  <th className="hidden text-right whitespace-nowrap @lg:table-cell">Lines</th>
                  <th className="hidden text-right whitespace-nowrap @xl:table-cell">Scanned</th>
                  <th className="text-right whitespace-nowrap">Short</th>
                </tr>
              </thead>
              <tbody>
                {data.pickers.map((picker) => (
                  <tr key={picker.pickedBy ?? 'unattributed'}>
                    <td className="w-full max-w-0 min-w-56">
                      <span className="flex min-w-0 flex-col">
                        <span
                          className="truncate font-medium"
                          {...(picker.pickedBy === null ? {} : { title: picker.pickedBy })}
                        >
                          {whoDidIt(picker.pickedBy, picker.pickerName)}
                        </span>
                        <span className="truncate text-sm @lg:hidden">
                          {plural(picker.linesPicked, 'line', 'lines')} ·{' '}
                          {plural(picker.unitsPicked, 'unit', 'units')}
                        </span>
                      </span>
                    </td>
                    {/* Same rule as the headline: a walk done too fast to
                        measure has no rate, and 0.0 is not the honest way to
                        say so. */}
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {pickingRate(picker.unitsPicked, picker.activeMinutes).value}
                    </td>
                    <td className="hidden text-right whitespace-nowrap tabular-nums @lg:table-cell">
                      {picker.linesPicked}
                    </td>
                    <td className="hidden text-right whitespace-nowrap @xl:table-cell">
                      <RateBadge
                        figure={ratePercent(
                          picker.linesScanVerified,
                          picker.linesPicked + picker.linesShort,
                          verifiedTone
                        )}
                        glyph={faBarcodeRead}
                      />
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <RateBadge
                        figure={ratePercent(
                          picker.linesShort,
                          picker.linesPicked + picker.linesShort,
                          shortTone,
                          short1dp(picker.linesPicked + picker.linesShort)
                        )}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Where the numbers are wrong. The table that pays for the phase. */}
        {data.bins.length > 0 ? (
          <Card>
            <div className="border-base-300 flex items-center gap-2 border-b p-3">
              {/* The alarm only when there is something to be alarmed about.
                  A warning triangle over one short pick is the same mistake as a
                  red zero. See `count-ink`. */}
              {shelvesRepeating ? (
                <Icon glyph={faExclamationTriangle} className="text-warning size-4" aria-hidden />
              ) : null}
              {/* "Keep" is a claim about repetition. One short pick from one
                  shelf is not a habit, and calling it one sends her to look at a
                  shelf that is fine. */}
              <span className="font-medium">
                {shelvesRepeating
                  ? 'Shelves that keep coming up empty'
                  : 'Where things came up empty'}
              </span>
            </div>
            <Table size="sm">
              <thead>
                <tr>
                  <th>Shelf</th>
                  <th className="hidden @lg:table-cell">Usual reason</th>
                  <th className="text-right whitespace-nowrap">Short</th>
                  <th className="text-right whitespace-nowrap">Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.bins.map((bin) => {
                  // The table the pane exists for, and the only one on it that
                  // did not open anything. A shelf that keeps coming up empty is
                  // a put-away problem, and the next thing she wants is the
                  // shelf. A row with no shelf recorded has nothing to open.
                  const binId = bin.binId;
                  const opens =
                    binId === null
                      ? {}
                      : {
                          className: 'hover:bg-base-200 cursor-pointer',
                          tabIndex: 0,
                          onClick: (event: { shiftKey: boolean; altKey: boolean }) => {
                            ctx.open(
                              'inventory.bins.detail',
                              { id: binId },
                              { target: targetFor(event) }
                            );
                          },
                          onKeyDown: (event: ReactKeyboardEvent) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              ctx.open('inventory.bins.detail', { id: binId }, { target: 'tab' });
                            }
                          },
                        };
                  return (
                    <tr key={binId ?? 'no-shelf'} {...opens}>
                      <td className="w-full max-w-0 min-w-56">
                        <span className="flex min-w-0 flex-col">
                          {/* A missing shelf is not a code, so it is not set in
                            the code face. The row is still worth showing: it says
                            nobody wrote down where the stock was meant to be. */}
                          <span
                            className={
                              bin.binCode === null
                                ? 'truncate font-medium'
                                : 'truncate font-mono font-medium'
                            }
                          >
                            {bin.binCode ?? 'No shelf recorded'}
                          </span>
                          {bin.zone ? (
                            <span className="truncate text-sm">Zone {bin.zone}</span>
                          ) : null}
                          <span className="truncate text-sm @lg:hidden">
                            {shortReasonLabel(bin.topReason)}
                          </span>
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap @lg:table-cell">
                        {shortReasonLabel(bin.topReason)}
                      </td>
                      <td className="text-right whitespace-nowrap tabular-nums">
                        {bin.linesShort} of {bin.linesTotal}
                      </td>
                      {/* Below the floor this cell would print "1 of 2", which the
                        column to its left already says. A rate it has not earned
                        is not worth saying twice. */}
                      <td className="text-right whitespace-nowrap">
                        {binRate(bin).enough ? (
                          <RateBadge figure={binRate(bin)} />
                        ) : (
                          <Text className="text-sm">&mdash;</Text>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        ) : null}

        {/* Why. Small, because it is a summary of the table above — but it is the
            sentence a manager repeats in a meeting. */}
        {data.shortReasons.length > 0 ? (
          <Card>
            <div className="border-base-300 border-b p-3">
              <span className="font-medium">Why things were not there</span>
            </div>
            <Table size="sm">
              <tbody>
                {data.shortReasons.map((reason) => (
                  <tr key={reason.reason}>
                    <td className="w-full max-w-0 min-w-56">
                      <span className="truncate">{shortReasonLabel(reason.reason)}</span>
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {plural(reason.lines, 'line', 'lines')}
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {plural(reason.units, 'unit', 'units')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ) : null}

        {/* The bench. */}
        {data.packers.length > 0 ? (
          <Card>
            <div className="border-base-300 border-b p-3">
              <span className="font-medium">By packer</span>
            </div>
            <Table size="sm">
              <thead>
                <tr>
                  <th>Packer</th>
                  <th className="text-right whitespace-nowrap">Boxes</th>
                  <th className="text-right whitespace-nowrap">Units</th>
                  <th className="text-right whitespace-nowrap">Scanned</th>
                </tr>
              </thead>
              <tbody>
                {data.packers.map((packer) => (
                  <tr key={packer.packedBy ?? 'unattributed'}>
                    <td className="w-full max-w-0 min-w-56">
                      <span
                        className="truncate font-medium"
                        {...(packer.packedBy === null ? {} : { title: packer.packedBy })}
                      >
                        {whoDidIt(packer.packedBy, packer.packerName)}
                      </span>
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {packer.boxesPacked}
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {packer.unitsPacked}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <RateBadge
                        figure={ratePercent(packer.unitsScanned, packer.unitsPacked, verifiedTone)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ) : null}
      </div>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Controls for how fast you pack"
        controls={
          <>
            <NativeSelect
              size="sm"
              className="max-w-40 shrink"
              aria-label="Period"
              value={windowKey}
              onChange={(event) => {
                setWindowKey(event.target.value);
              }}
            >
              {WINDOWS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              size="sm"
              className="shrink"
              aria-label="Location"
              value={locationId}
              onChange={(event) => {
                setLocationId(event.target.value);
              }}
            >
              <option value="">Every location</option>
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </NativeSelect>
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

      <div className="min-h-0 flex-1 overflow-y-auto">{body()}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  /** The alarm ink on the FIGURE, or null when there is nothing to alarm about.
   *  Must be a literal class: Tailwind reads source text. */
  tone: string | null;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-1 p-4">
        <Text className="text-sm">{label}</Text>
        <span
          className={
            tone === null
              ? 'text-3xl leading-none font-bold tabular-nums'
              : `text-3xl leading-none font-bold tabular-nums ${tone}`
          }
        >
          {value}
        </span>
        {/* A sentence, not a chip. This was a soft <Badge>, which is a fixed
            narrow box, so every hint on the card clipped: "1 unit picked, too
            clos...". The part that says WHY the figure is what it is was the
            part being cut. */}
        <Text className="text-sm">{hint}</Text>
      </div>
    </Card>
  );
}

/** A shelf's short rate, worked out the same way in both places that ask. */
function binRate(bin: { linesShort: number; linesTotal: number }): RateFigure {
  return ratePercent(bin.linesShort, bin.linesTotal, shortTone);
}

/** One decimal on a rate is a claim about precision. It is earned by a few
 *  hundred lines, not by twelve. */
function short1dp(lines: number): number {
  return lines >= 100 ? 1 : 0;
}

/** A rate in a table cell, colored only once it has enough behind it to mean
 *  something. Below the floor it is a plain count and wears no color, because
 *  one short pick out of two is not a shelf with a problem. */
function RateBadge({ figure, glyph }: { figure: RateFigure; glyph?: PigglesIcon }) {
  const icon = glyph ? <Icon glyph={glyph} className="size-3" aria-hidden /> : null;
  if (figure.tone === null) {
    return (
      <span className="inline-flex items-center gap-1 text-sm whitespace-nowrap tabular-nums">
        {icon}
        {figure.text}
      </span>
    );
  }
  return (
    <Badge color={figure.tone} variant="soft" size="sm">
      {icon}
      {figure.text}
    </Badge>
  );
}
