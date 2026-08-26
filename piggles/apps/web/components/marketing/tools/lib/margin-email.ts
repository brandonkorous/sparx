import { formatMoney } from './document';
import type { ToolResultLine } from '../tool-result-context';

export interface MarginNumbers {
  currency: string;
  cost: number;
  price: number;
  profit: number;
  margin: number;
  markup: number;
  fixedCosts: number;
  /** Units a month to cover the fixed costs, or null when nothing was entered
   *  to cover — never 0, which would read as "you are already ahead". */
  breakEven: number | null;
}

/** The answer as email lines. Margin AND markup go every time: confusing the
 *  two is the expensive mistake this tool exists to stop, and sending only the
 *  one that was asked for would let it happen again a week later. */
export function marginLines(n: MarginNumbers): ToolResultLine[] {
  const money = (value: number) => formatMoney(value, n.currency);

  return [
    { label: 'What it costs you', value: money(n.cost) },
    { label: 'What you charge', value: money(n.price) },
    { label: 'Profit on each one', value: money(n.profit) },
    { label: 'Margin, as a share of the price', value: `${n.margin.toFixed(1)}%` },
    { label: 'Markup, added to the cost', value: `${n.markup.toFixed(1)}%` },
    ...(n.breakEven !== null
      ? [
          {
            label: 'Break even',
            value: `${n.breakEven} a month to cover ${money(n.fixedCosts)} of fixed costs`,
          },
        ]
      : []),
  ];
}

export const MARGIN_NOTE =
  'Margin is measured against what you sold it for, markup against what it cost you. Aiming for a 50% margin by adding 50% leaves you short on every sale, which is why both are here.';
