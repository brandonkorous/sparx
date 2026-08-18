import type { ReactNode } from 'react';
import { Badge, Text } from '@wizeworks/silicaui-react';
import { getModuleColor } from './primitives';

/**
 * The shared vocabulary for /staff — the small pieces every device on the page
 * renders, defined once.
 *
 * WAGES ARE BLUE HERE BECAUSE WAGES ARE BLUE IN THE PRODUCT. `costFill('wages')`
 * is imported from `finance-money` rather than re-picked, and that import is the
 * point rather than a shortcut: this page's whole argument is that hours become
 * the wages line in Finance, so the two pages must render that line in the same
 * color or the claim is contradicted by the pixels making it. A visitor who
 * signs up then meets the same blue on the real timesheet.
 *
 * THE OTHER RULE THIS FILE ENFORCES: an hour nobody can price is NOT zero.
 * `Unpriced` is the badge that says so, and it is `error` rather than a muted
 * grey — because a zero in a labour column becomes a zero in a profit figure,
 * and an owner reads that as a month where the work was free.
 */
export const M = getModuleColor('staff');

/**
 * One line of an hours breakdown: who, how long, at what, and what it cost.
 *
 * `tabular-nums` on every figure. Without it the digits are proportionally
 * spaced and a stacked column fails to line up — which on a page arguing that
 * your labour numbers are sloppy would be an unfortunate demonstration.
 */
export function HourRow({
  who,
  detail,
  hours,
  cost,
  emphasis,
  tone,
}: {
  who: ReactNode;
  /** The rate, or what the time was spent on. */
  detail?: string;
  hours?: string;
  cost: ReactNode;
  /** The totalled line — bigger, and it owns the row. */
  emphasis?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5">
      <span className="flex min-w-0 flex-col">
        <Text as="span" className={emphasis ? 'font-medium' : undefined}>
          {who}
        </Text>
        {detail ? <Text className="text-sm">{detail}</Text> : null}
      </span>
      <span className="flex shrink-0 items-baseline gap-5">
        {hours ? (
          <Text as="span" className="font-mono tabular-nums">
            {hours}
          </Text>
        ) : null}
        <span
          className={[
            'min-w-[8ch] text-right font-medium tabular-nums',
            emphasis ? 'text-2xl' : 'text-md',
            tone ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {cost}
        </span>
      </span>
    </div>
  );
}

/**
 * Hours that exist and cannot be costed.
 *
 * SOLID `error`, never a soft tint and never a dash on its own. This is the one
 * badge on the page whose job is to be impossible to skim past: the alternative
 * — printing $0.00 — is the single most expensive thing this module could do,
 * because it is indistinguishable from labour that genuinely cost nothing.
 */
export function Unpriced({ children }: { children: ReactNode }) {
  return (
    <Badge color="error" size="sm" className="shrink-0 tabular-nums">
      {children}
    </Badge>
  );
}

/** A state badge on a row — approved, waiting, on the clock. State is its own
 *  color axis and never the module's identity hue. */
export function HourState({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'info';
  children: ReactNode;
}) {
  return (
    <Badge color={tone} variant={tone === 'info' ? 'solid' : 'soft'} size="sm">
      {children}
    </Badge>
  );
}
