import type { ReactNode } from 'react';
import { Text } from '@wizeworks/silicaui-react';
import { getModuleColor } from './primitives';

/**
 * The shared vocabulary for /inventory — the small pieces every device on the
 * page renders, defined once.
 *
 * THE PAGE HAS ONE DEVICE AND IT IS A LEDGER LINE. That is not a stylistic
 * choice: the whole argument of the module (docs/146 §5) is that on-hand is not
 * a stored number but a sum that can always be redone, so the page has to SHOW
 * a sum being redone rather than assert that one could be. Every section that
 * carries a figure carries it as a row of this kind, and by the third section a
 * reader knows how to read one without a legend.
 *
 * The three tones are the movement's DIRECTION, not the module's identity —
 * stock coming in, stock going out, and the counted line the arithmetic starts
 * from. Direction is a state axis, so it wears semantic colors (DESIGN.md §3);
 * amber stays the module's own identity and is spent on the turn.
 */
export const M = getModuleColor('inventory');

/** Which way a ledger line moved the number. `count` is the opening figure a
 *  person put there by walking to the shelf — neither a receipt nor a sale, and
 *  the only line in the list nothing else derives. */
export type Flow = 'in' | 'out' | 'count';

const FLOW_TONE: Record<Flow, string> = {
  in: 'text-success',
  out: 'text-error',
  count: 'text-base-content',
};

export function flowTone(flow: Flow): string {
  return FLOW_TONE[flow];
}

/**
 * One line of a stock derivation: what happened, when, and the signed quantity.
 *
 * `tabular-nums` is load-bearing rather than decorative here. These rows are a
 * column of figures a reader is invited to add up themselves — that is the
 * entire point of the device — and proportional digits mean the column does not
 * line up, which on a page arguing for arithmetic reads as carelessness about
 * exactly the thing being sold.
 */
export function LedgerLine({
  what,
  when,
  qty,
  flow = 'out',
  note,
  emphasis,
  running,
}: {
  what: ReactNode;
  /** The day, or the count of events this line collapses ("3 deliveries"). */
  when?: string;
  /** Rendered as written, sign included — the sign is the reader's cue. */
  qty: string;
  flow?: Flow;
  note?: string;
  /** A subtotal — the running balance owns the row. */
  emphasis?: boolean;
  /** The figure this line ARRIVES at, shown alongside a subtotal. */
  running?: string;
}) {
  return (
    <div
      className={[
        'flex items-baseline justify-between gap-6',
        emphasis ? 'border-base-300 mt-1 border-t pt-3.5 pb-1' : 'py-2',
      ].join(' ')}
    >
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5">
        <Text as="span" className={emphasis ? 'font-medium' : undefined}>
          {what}
        </Text>
        {when ? (
          <Text as="span" className="font-mono">
            {when}
          </Text>
        ) : null}
        {note ? (
          <Text as="span" className="font-mono">
            · {note}
          </Text>
        ) : null}
      </span>
      <span
        className={[
          'shrink-0 tabular-nums',
          emphasis ? 'text-2xl font-medium' : 'text-md',
          emphasis ? '' : flowTone(flow),
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {running ?? qty}
      </span>
    </div>
  );
}
