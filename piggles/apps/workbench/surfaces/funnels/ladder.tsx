'use client';

// The report this module exists to produce: how many people reached each step,
// and where they stopped.
//
// The SHAPE is the finding, so it is drawn as narrowing bars rather than a table
// of numbers somebody has to do arithmetic on.

import { Text } from '@wizeworks/silicaui-react';
import { countLabel, moneyLabel, rateLabel } from './presentation';
import { DropStep, Rung } from './ladder-rung';
import type { Ladder } from './types';

/**
 * The headline pair: how many finished, and what that was worth.
 *
 * Two facts, not six. A wall of tiles makes somebody hunt for the one that
 * answers "did this work", and the answer is always these two.
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
