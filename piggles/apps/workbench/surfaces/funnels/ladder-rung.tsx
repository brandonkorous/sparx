'use client';

// One step of the report, and the drop above it.
//
// The bar is silica's `<Progress>` rather than a styled div, so the shape is
// announced to a screen reader as well as drawn.

import { Badge, Heading, Progress, Text } from '@wizeworks/silicaui-react';
import { faArrowDown } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { STAGE_KIND_LABEL, countLabel, moneyLabel, rateLabel } from './presentation';
import type { LadderRung } from './types';

/**
 * How long this step's bar runs, as a share of everyone who started.
 *
 * Null for an uncounted step, which draws NO bar: a zero-length bar is
 * indistinguishable from "nobody got here", and those are different facts.
 */
function barValue(rung: LadderRung): number | null {
  if (rung.entered === null) return null;
  if (rung.conversionFromEntry === null) return rung.entered > 0 ? 100 : 2;
  // The floor keeps a step with a handful of people from vanishing.
  return Math.max(2, rung.conversionFromEntry * 100);
}

/** The step between two steps — the number somebody came here to read. */
export function DropStep({ rate }: { rate: number | null }) {
  return (
    <div className="flex items-center gap-1.5 py-1 pl-3">
      <Icon glyph={faArrowDown} className="size-3.5 shrink-0" aria-hidden />
      <Text className="text-sm">
        {rate === null ? 'Nothing to compare yet' : `${rateLabel(rate)} carried on`}
      </Text>
    </div>
  );
}

/** The notes under the bar: which page it counts, why it has no number, and
 *  what it was worth. Split out to keep `Rung` readable. */
function RungNotes({ rung, isFirst }: { rung: LadderRung; isFirst: boolean }) {
  return (
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
  );
}

export function Rung({ rung, isFirst }: { rung: LadderRung; isFirst: boolean }) {
  const value = barValue(rung);
  // The converting step is the outcome, so it wears the app's own hue.
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

      <RungNotes rung={rung} isFirst={isFirst} />
    </div>
  );
}
