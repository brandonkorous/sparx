'use client';

// How many visits turned into orders — the shop's own funnel.
//
// `conversionFunnel()` has been computed and exposed for as long as it has
// existed and NOTHING drew it, so an owner could see their own conversion rate
// only by asking their AI (docs/152 A1). This is that gap closed.

import { Progress, Text } from '@wizeworks/silicaui-react';
import { faArrowDown } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { ConversionFunnel } from './reports-data';

const NUMBER = new Intl.NumberFormat();

/**
 * A rate as a person reads it, or the reason there is no number.
 *
 * Null renders as words, never 0%: a business selling at the counter or over the
 * phone has no web visits, and "0%" would call that a failing shop.
 */
function rate(value: number | null): string {
  if (value === null) return 'Nothing to compare yet';
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

interface Step {
  label: string;
  count: number;
  /** Share of the step above, or null when that step was empty. */
  fromPrevious: number | null;
  note: string;
}

/** The four steps, in the order a shopper walks them. */
function steps(funnel: ConversionFunnel): Step[] {
  return [
    {
      label: 'Visited the shop',
      count: funnel.sessions,
      fromPrevious: null,
      note: `${NUMBER.format(funnel.visitors)} ${funnel.visitors === 1 ? 'person' : 'people'}`,
    },
    {
      label: 'Put something in a basket',
      count: funnel.cartsCreated,
      fromPrevious: funnel.sessionToCartRate,
      note: 'of the visits',
    },
    {
      label: 'Started checking out',
      count: funnel.checkoutsStarted,
      fromPrevious: funnel.cartToCheckoutRate,
      note: 'of the baskets',
    },
    {
      label: 'Placed an order',
      count: funnel.ordersPlaced,
      fromPrevious: funnel.checkoutToOrderRate,
      note: 'of the checkouts',
    },
  ];
}

/** Each step as a share of the first. No bar when nothing reached the top — a
 *  full-width bar over zero visits would claim 100% of nothing. */
function shareOfTop(count: number, top: number): number | null {
  if (top <= 0) return null;
  return Math.max(2, (count / top) * 100);
}

function FunnelStep({
  step,
  width,
  isLast,
}: {
  step: Step;
  width: number | null;
  isLast: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-base font-semibold">{step.label}</span>
        <div className="flex-1" />
        <span className="text-xl font-semibold tabular-nums">{NUMBER.format(step.count)}</span>
      </div>
      {width === null ? null : (
        <Progress
          color={isLast ? 'module' : 'info'}
          value={width}
          aria-label={`${step.label}: ${NUMBER.format(step.count)}`}
        />
      )}
    </div>
  );
}

export function ConversionFunnelReport({ funnel }: { funnel: ConversionFunnel }) {
  const rows = steps(funnel);
  const top = rows[0]?.count ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="border-base-300 bg-module bg-soft flex flex-col gap-0.5 rounded-xl border p-4">
        <span className="text-3xl font-semibold tabular-nums">
          {rate(funnel.sessionToOrderRate)}
        </span>
        <Text className="text-sm">
          {funnel.sessionToOrderRate === null
            ? 'Nobody has visited the shop in this period, so there is no rate to work out.'
            : 'of visits ended in an order.'}
        </Text>
      </div>

      <ol className="flex flex-col">
        {rows.map((step, index) => (
          <li key={step.label} className="flex flex-col">
            {index > 0 ? (
              <div className="flex items-center gap-1.5 py-1 pl-3">
                <Icon glyph={faArrowDown} className="size-3.5 shrink-0" aria-hidden />
                <Text className="text-sm">
                  {step.fromPrevious === null
                    ? 'Nothing to compare yet'
                    : `${rate(step.fromPrevious)} ${step.note}`}
                </Text>
              </div>
            ) : null}
            <FunnelStep
              step={step}
              width={shareOfTop(step.count, top)}
              isLast={index === rows.length - 1}
            />
            {index === 0 ? <Text className="text-sm">{step.note}</Text> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
