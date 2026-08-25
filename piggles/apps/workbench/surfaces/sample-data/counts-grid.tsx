'use client';

// What practice data actually put in the account, as figures.
//
// Two groups, because Remove treats them differently: everything in the first is
// taken away again, and the locations in the second stay. Showing them in one
// list would make the grid agree with a Remove that does not do what it says.

import { Text } from '@wizeworks/silicaui-react';
import { COUNT_LABELS, DURABLE_COUNT_LABELS, type SampleDataCounts } from './data';

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="border-base-300 flex flex-col gap-0.5 rounded-lg border p-3">
      <span className="text-2xl font-semibold tabular-nums">{String(value)}</span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** The non-zero counts as a grid of small figures — the proof that real records
 *  exist. Zeroes are dropped so the grid shows what is there, not a wall of 0s. */
export function CountsGrid({ counts }: { counts: SampleDataCounts }) {
  const present = COUNT_LABELS.filter(({ key }) => (counts[key] || 0) > 0);
  // Locations were the one thing practice data made that this grid never showed,
  // which left an owner with a place in her list and nothing anywhere saying it
  // came from here (issue 174).
  const durable = DURABLE_COUNT_LABELS.filter(({ key }) => (counts[key] || 0) > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 @sm:grid-cols-3">
        {present.map(({ key, label }) => (
          <Figure key={key} value={counts[key]} label={label} />
        ))}
      </div>

      {durable.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 @sm:grid-cols-3">
            {durable.map(({ key, label }) => (
              <Figure key={key} value={counts[key]} label={label} />
            ))}
          </div>
          <Text className="text-sm">
            Practice data added the location above, and Remove leaves it where it is. Places are
            yours to keep, in case you have renamed one or counted stock into it. Delete it in Stock
            if you do not want it.
          </Text>
        </div>
      ) : null}
    </div>
  );
}
