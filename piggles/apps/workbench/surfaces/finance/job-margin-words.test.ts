import { describe, expect, it } from 'vitest';
import {
  marginHeadline,
  marginSubline,
  marginsAreMeasured,
  uncostedMarginNote,
  type JobCostEvidence,
} from './job-margin-words';

function evidence(over: Partial<JobCostEvidence> = {}): JobCostEvidence {
  // Juniper Row: two jobs, no cost of goods anywhere, 68 uncosted items.
  return { jobs: 2, cogsCents: 0, uncostedItems: 68, uncostedUnits: 375, ...over };
}

describe('whether the margins rest on anything', () => {
  it('is false when nothing was costed and the shelves have no costs on them', () => {
    // THE DEFECT. Both of Devi's jobs read 100.0% margin and the card read
    // "Every job in this period made money", over a shop where not one item has
    // ever had a cost recorded.
    expect(marginsAreMeasured(evidence())).toBe(false);
  });

  it('is true once any cost of goods has been recorded in the period', () => {
    expect(marginsAreMeasured(evidence({ cogsCents: 1 }))).toBe(true);
  });

  it('leaves a real zero alone', () => {
    // A service business has no cost of goods and its margins genuinely are
    // 100%. Told apart by the STOCK, never by the sum — the same rule the
    // cost-of-goods note settled on.
    expect(marginsAreMeasured(evidence({ cogsCents: 0, uncostedItems: 0 }))).toBe(true);
  });
});

describe('what the summary card says', () => {
  it('will not claim every job made money when nothing was taken off', () => {
    const e = evidence();
    expect(marginHeadline(e)).toBe('What these jobs cost has not been measured');
    expect(marginHeadline(e)).not.toContain('made money');
    expect(marginSubline(e)).toContain('pure profit');
  });

  it('says it plainly when the margins are real', () => {
    const e = evidence({ cogsCents: 40_000 });
    expect(marginHeadline(e)).toBe('Every job in this period made money');
    expect(marginSubline(e)).toBe('Sort by Worst first to see which came closest to not.');
  });
});

describe('the warning', () => {
  it('names the count, the units and what it does to the ranking', () => {
    const note = uncostedMarginNote(evidence()) ?? '';
    expect(note).toContain('68 things');
    expect(note).toContain('375 units');
    expect(note).toContain('the ranking cannot mean anything yet');
  });

  it('reads differently at one than at many', () => {
    const one = uncostedMarginNote(evidence({ uncostedItems: 1, uncostedUnits: 1 })) ?? '';
    const many = uncostedMarginNote(evidence({ uncostedItems: 2, uncostedUnits: 2 })) ?? '';
    expect(one).toContain('1 thing on your shelves, 1 unit in all');
    expect(one.replace(/\d+/g, 'N')).not.toBe(many.replace(/\d+/g, 'N'));
  });

  it('says nothing when the margins are real', () => {
    expect(uncostedMarginNote(evidence({ cogsCents: 40_000 }))).toBeNull();
    expect(uncostedMarginNote(evidence({ uncostedItems: 0 }))).toBeNull();
  });
});
