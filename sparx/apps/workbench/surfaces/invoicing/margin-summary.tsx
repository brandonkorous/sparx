'use client';

// The margin on the whole document, under its total (sparx persona issue 086).
//
// It counts only lines that have a cost and says plainly how many do not. A
// line with no cost is never added in at $0: that would report a 100% margin on
// it and flatter the margin the whole quote is being priced against.
//
// It sits inside the Summary card so it pins with the total while the lines
// scroll. Staff only: it is the business's own figure and is never on anything
// the customer receives.

import { Badge, Heading, Text } from '@wizeworks/silicaui-react';
import { documentMargin, uncostedSentence } from './line-margin';
import type { DraftLine } from './totals';
import { formatMoney } from './types';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <Text as="span" className="text-sm">
        {label}
      </Text>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function MarginSummary({ lines, currency }: { lines: DraftLine[]; currency: string }) {
  const margin = documentMargin(lines);
  if (margin.costedLines === 0 && margin.uncostedLines === 0) return null;
  const notCounted = uncostedSentence(margin.uncostedLines);

  return (
    <section aria-label="Your margin" className="border-base-300 flex flex-col gap-2 border-t pt-3">
      <div className="flex flex-col gap-0.5">
        <Heading level={3} className="text-base font-semibold">
          Your margin
        </Heading>
        <Text className="text-sm">
          Worked out from the line amounts before tax. Only you see this.
        </Text>
      </div>

      {margin.costCents !== null && margin.profitCents !== null && margin.tone !== null ? (
        <div className="flex flex-col gap-1">
          <Row label="Cost to you" value={formatMoney(margin.costCents / 100, currency)} />
          <Row
            label={margin.profitCents < 0 ? 'Loss' : 'Profit'}
            value={formatMoney(Math.abs(margin.profitCents) / 100, currency)}
          />
          <Row
            label="Margin"
            value={
              <Badge color={margin.tone} variant="soft">
                {margin.profitCents < 0 || margin.marginPct === null
                  ? 'Below cost'
                  : `${String(margin.marginPct)}%`}
              </Badge>
            }
          />
        </div>
      ) : (
        <Text className="text-sm">
          No line has a cost yet, so there is no margin to show. Open a line and add what it cost
          you.
        </Text>
      )}

      {notCounted && margin.costedLines > 0 ? <Text className="text-sm">{notCounted}</Text> : null}
    </section>
  );
}
