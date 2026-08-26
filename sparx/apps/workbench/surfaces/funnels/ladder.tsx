'use client';

// The ladder — the report this whole module exists to produce.
//
// It answers one sentence: "1,840 people saw the page, 210 gave us an address,
// and 34 of those became customers." Everything here serves that sentence.
//
// ── WHY A BAR PER RUNG AND NOT A CHART ─────────────────────────────────────
//
// The shape of a funnel IS the finding. A row of numbers makes you do the
// arithmetic; a chart makes you learn its legend. A bar whose length is the
// share of the first rung shows the narrowing directly, and the drop between two
// rungs is then the visible gap between two bars — which is what somebody opened
// this to see. Silica's `<Progress>` is that bar: it already has the ARIA
// progressbar role and the right value bounds, so the shape is announced rather
// than only drawn.
//
// ── AND WHY NOTHING HERE PRINTS 0% ─────────────────────────────────────────
//
// Every rate arrives as `number | null`. Null means the rung above was empty, so
// a share of it does not exist — and a `view` rung whose page was deleted has no
// count at all. Both render as words, never as a zero. "0%" on a campaign that
// launched yesterday reads as failure rather than as silence, and that one wrong
// character is enough to make somebody switch off a campaign that was working.
// `rateLabel` / `countLabel` own that; nothing here formats a percentage itself.

import { Badge, Heading, Progress, Text } from '@wizeworks/silicaui-react';
import { ArrowDown } from 'lucide-react';
import {
  STAGE_KIND_LABEL,
  countLabel,
  moneyLabel,
  rateLabel,
  type Ladder,
  type LadderRung,
} from './data';

/**
 * How long this rung's bar runs, as a share of everyone who started.
 *
 * Null for an uncounted rung, which renders as NO bar rather than an empty one:
 * a bar of zero length is indistinguishable from "nobody got here", and those
 * are different facts. The floor of 2 keeps a rung with a handful of people
 * visible instead of vanishing into the track.
 */
function barValue(rung: LadderRung): number | null {
  if (rung.entered === null) return null;
  if (rung.conversionFromEntry === null) return rung.entered > 0 ? 100 : 2;
  return Math.max(2, rung.conversionFromEntry * 100);
}

/** The step between two rungs — the number a person actually came here to read. */
function DropStep({ rate }: { rate: number | null }) {
  return (
    <div className="flex items-center gap-1.5 py-1 pl-3">
      <ArrowDown className="size-3.5 shrink-0" aria-hidden />
      <Text className="text-sm">
        {rate === null ? 'Nothing to compare yet' : `${rateLabel(rate)} carried on`}
      </Text>
    </div>
  );
}

function Rung({ rung, isFirst }: { rung: LadderRung; isFirst: boolean }) {
  const value = barValue(rung);
  // The converting rung is the outcome the campaign exists for, so it wears the
  // module's own hue. Every rung above it is a step on the way there.
  const converts = rung.kind === 'convert';

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Heading level={3} className="text-base font-semibold">
          {rung.name}
        </Heading>
        <Badge color={converts ? 'module' : 'info'} variant="soft" size="sm">
          {STAGE_KIND_LABEL[rung.kind]}
        </Badge>
        <div className="flex-1" />
        <span className="text-xl font-semibold tabular-nums">{countLabel(rung.entered)}</span>
      </div>

      {value === null ? null : (
        <Progress
          color={converts ? 'module' : 'info'}
          value={value}
          aria-label={`${rung.name}: ${countLabel(rung.entered)}`}
        />
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {rung.path ? (
          <Text className="text-sm">
            Counts visits to <span className="font-medium">{rung.path}</span>
          </Text>
        ) : null}
        {rung.entered === null ? (
          <Text className="text-sm">
            This step counts visits to a page that no longer exists, so nobody can say.
          </Text>
        ) : null}
        {!isFirst && rung.conversionFromEntry !== null ? (
          <Text className="text-sm">
            {rateLabel(rung.conversionFromEntry)} of everyone who started
          </Text>
        ) : null}
        {rung.valueCents > 0 ? (
          <Text className="text-sm">Worth {moneyLabel(rung.valueCents)}</Text>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The headline pair: how many finished, and what that was worth.
 *
 * Two facts, not six. A report that opens with a wall of tiles makes somebody
 * hunt for the one that answers "did this work", and the answer is always these
 * two.
 */
function Headline({ ladder }: { ladder: Ladder }) {
  const convert = ladder.rungs.find((r) => r.kind === 'convert');
  return (
    <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
      <div className="border-base-300 bg-module bg-soft flex flex-col gap-0.5 rounded-xl border p-4">
        <span className="text-3xl font-semibold tabular-nums">{rateLabel(ladder.overallRate)}</span>
        <Text className="text-sm">
          {ladder.overallRate === null
            ? 'Nobody has started this campaign in this period.'
            : `${countLabel(convert?.entered ?? null)} of everyone who started got all the way through.`}
        </Text>
      </div>
      <div className="border-base-300 bg-base-100 flex flex-col gap-0.5 rounded-xl border p-4">
        <span className="text-3xl font-semibold tabular-nums">{moneyLabel(ladder.valueCents)}</span>
        <Text className="text-sm">
          {ladder.valueCents === 0
            ? 'Nothing has been recorded as worth anything yet.'
            : 'What this campaign has brought in.'}
        </Text>
      </div>
    </div>
  );
}

export function LadderReport({ ladder }: { ladder: Ladder }) {
  return (
    <div className="flex flex-col gap-4">
      <Headline ladder={ladder} />

      <ol className="flex flex-col">
        {ladder.rungs.map((rung, index) => (
          <li key={rung.key} className="flex flex-col">
            {index > 0 ? <DropStep rate={rung.conversionFromPrevious} /> : null}
            <Rung rung={rung} isFirst={index === 0} />
          </li>
        ))}
      </ol>
    </div>
  );
}
