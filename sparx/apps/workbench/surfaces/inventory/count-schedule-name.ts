// The name a new counting schedule carries until someone types their own
// (persona issue 253). It was a fixed "Top-value stock, monthly", so a schedule
// switched to count everything was saved under a name that said the opposite.

import type { AbcClass, CountCadence } from './planning-data';

const WHAT: Record<'' | AbcClass, string> = {
  '': 'Everything here',
  A: 'Top-value stock',
  B: 'Mid-value stock',
  C: 'The long tail',
};

function when(cadence: CountCadence, intervalDays: number): string {
  switch (cadence) {
    case 'weekly':
      return 'weekly';
    case 'monthly':
      return 'monthly';
    case 'quarterly':
      return 'every quarter';
    case 'annually':
      return 'once a year';
    case 'custom':
      return `every ${String(intervalDays)} days`;
  }
}

export function suggestedScheduleName(choices: {
  abcClass: '' | AbcClass;
  zoneName: string;
  cadence: CountCadence;
  intervalDays: number;
}): string {
  const zone = choices.zoneName.trim();
  const what = zone ? `${WHAT[choices.abcClass]} in ${zone}` : WHAT[choices.abcClass];
  return `${what}, ${when(choices.cadence, choices.intervalDays)}`;
}
