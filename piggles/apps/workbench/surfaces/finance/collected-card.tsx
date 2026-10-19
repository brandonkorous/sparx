'use client';

// Billed and collected, the last 30 days (sparx persona issue 360).
//
// Owed to you answers "how much is still out". This answers the question beside
// it: is the money coming in as fast as it is being billed? A pair of bars per
// day, billed in the info color and collected in the success color, read off the
// theme like the Profit chart's, with the two totals above.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Heading, Text } from '@wizeworks/silicaui-react';
import { Chart } from '@wizeworks/silicaui-charts';

import { collectedChartOption, everyDay } from './collected-chart-option';
import { COLLECTED_DAYS, useCollected } from './collected-data';
import { formatMoney } from './format';

const SERIES_TOKENS = ['--color-info', '--color-success'] as const;

export function CollectedCard() {
  const { data, isError, isPending } = useCollected();
  const ref = useRef<HTMLDivElement | null>(null);
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const cs = getComputedStyle(el);
      setColors(SERIES_TOKENS.map((name) => cs.getPropertyValue(name).trim()).filter(Boolean));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });
    return () => {
      observer.disconnect();
    };
  }, [data]);

  const option = useMemo(() => {
    if (!data) return null;
    const days = everyDay(data.points, data.range.from.slice(0, 10), COLLECTED_DAYS);
    const [billed, collected] = colors;
    return collectedChartOption(days, { billed, collected }, data.currency);
  }, [data, colors]);

  // Invoicing off for this business, or the report unreachable: the card is a
  // view of the invoicing module's own figures, so it is simply not here.
  if (isError) return null;
  if (isPending || !data || !option) {
    return (
      <Card className="p-4">
        <p className="text-sm" role="status">
          Loading what came in…
        </p>
      </Card>
    );
  }

  const nothing = data.totals.billedCents === 0 && data.totals.collectedCents === 0;
  return (
    <Card className="p-4">
      <Heading level={3} className="text-base font-semibold">
        Billed and collected, the last {COLLECTED_DAYS} days
      </Heading>
      {nothing ? (
        <Text className="mt-1">
          Nothing was billed or paid on an invoice in the last {COLLECTED_DAYS} days.
        </Text>
      ) : (
        <>
          <Text className="mt-1">
            {formatMoney(data.totals.collectedCents / 100, data.currency)} came in against{' '}
            {formatMoney(data.totals.billedCents / 100, data.currency)} billed.
          </Text>
          <div ref={ref} className="mt-3 w-full">
            <Chart
              option={option}
              className="h-56! w-full"
              aria-label={`Billed and collected per day, the last ${String(COLLECTED_DAYS)} days`}
            />
          </div>
        </>
      )}
    </Card>
  );
}
