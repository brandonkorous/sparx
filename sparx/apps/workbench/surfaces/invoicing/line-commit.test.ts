// A line priced by hand keeps the cost typed for it (sparx persona issue 086).
//
// The editor said the cost on a flat or labor line was "how you see your
// margin", and then committed the line with its cost set to null, so the row
// and the summary had nothing to work a margin out from until a save came back.

import { describe, expect, it } from 'vitest';
import { committedLine } from './line-commit';
import { lineMargin } from './line-margin';
import { blankLine, type DraftLine } from './totals';

const common = (over: Partial<DraftLine> = {}): DraftLine => ({
  ...blankLine(),
  description: 'Diagnose no-start',
  quantity: 2,
  // A cost the server stored earlier, now out of date.
  costCents: 5_000,
  ...over,
});

describe('committedLine', () => {
  it('keeps the cost typed on a line priced by hand', () => {
    const line = committedLine(common(), {
      markup: null,
      unitPrice: 145,
      explicitCostCents: 6_200,
      priceNote: null,
    });
    expect(line.explicitCostCents).toBe(6_200);
    expect(line.costCents).toBe(6_200);
    expect(lineMargin(line)?.profitCents).toBe(16_600);
  });

  it('has no cost when the box was left empty, so no margin is shown', () => {
    const line = committedLine(common(), {
      markup: null,
      unitPrice: 145,
      explicitCostCents: null,
      priceNote: null,
    });
    expect(line.costCents).toBeNull();
    expect(lineMargin(line)).toBeNull();
  });

  it('drops a markup directive when the line is priced by hand', () => {
    const line = committedLine(
      common({ markup: { kind: 'adhoc', method: 'percentage', value: 0.4 } }),
      {
        markup: null,
        unitPrice: 145,
        explicitCostCents: 6_200,
        priceNote: null,
      }
    );
    expect(line.markup).toBeNull();
    expect(line.appliedMarkup).toBeNull();
  });

  it('prices a markup line from its cost and keeps that cost', () => {
    const line = committedLine(common(), {
      markup: {
        priceCents: 8_680,
        explicitCostCents: 6_200,
        markup: { kind: 'adhoc', method: 'percentage', value: 0.4 },
      },
      unitPrice: 0,
      explicitCostCents: 6_200,
      priceNote: 'stale',
    });
    expect(line.unitPrice).toBe(86.8);
    expect(line.priceNote).toBeNull();
    expect(lineMargin(line)?.profitCents).toBe(4_960);
  });
});
