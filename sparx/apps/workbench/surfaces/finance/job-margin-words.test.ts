import { describe, expect, it } from 'vitest';
import {
  marginHeadline,
  marginSubline,
  marginsAreMeasured,
  openBookingsBody,
  openBookingsTitle,
  uncostedMarginNote,
  type JobCostEvidence,
} from './job-margin-words';

function evidence(over: Partial<JobCostEvidence> = {}): JobCostEvidence {
  // Juniper Row: two jobs, neither with its goods costed, 68 uncosted items.
  return { jobs: 2, unmeasuredJobs: 2, uncostedItems: 68, uncostedUnits: 375, ...over };
}

describe('whether the margins rest on anything', () => {
  it('is false when the jobs sold things nobody costed', () => {
    // Both of Devi's jobs read 100.0% margin and the card read "Every job in
    // this period made money", over a shop where not one item had a cost.
    expect(marginsAreMeasured(evidence())).toBe(false);
  });

  it('is still false when ONE job beside them was costed (persona issue 924)', () => {
    // The old test asked whether the period's goods cost was above zero. One
    // costed belt made it so, and the two dresses went back to 100% unwarned.
    expect(marginsAreMeasured(evidence({ jobs: 3, unmeasuredJobs: 2 }))).toBe(false);
  });

  it('leaves a real zero alone', () => {
    // A service business has no goods, so nothing on it is uncosted.
    expect(marginsAreMeasured(evidence({ unmeasuredJobs: 0, uncostedItems: 0 }))).toBe(true);
    // Uncosted stock on the shelves that these jobs did not sell is not their problem.
    expect(marginsAreMeasured(evidence({ unmeasuredJobs: 0 }))).toBe(true);
  });
});

describe('what the summary card says', () => {
  it('will not claim every job made money when nothing was taken off', () => {
    const e = evidence();
    expect(marginHeadline(e)).toBe('What these jobs cost has not been measured');
    expect(marginHeadline(e)).not.toContain('Every job in this period made money');
    expect(marginSubline(e)).toContain('pure profit');
  });

  it('speaks only for the measured jobs when some are not', () => {
    const e = evidence({ jobs: 3, unmeasuredJobs: 2 });
    expect(marginHeadline(e)).toBe('Every job with its costs recorded made money');
    expect(marginSubline(e)).toBe(
      '2 more jobs sold things with no cost recorded, so what they kept is not known. They are at the bottom of the list.'
    );
  });

  it('says it plainly when the margins are real', () => {
    const e = evidence({ unmeasuredJobs: 0 });
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

  it('says which rows are blank and how to fill them, when only some are', () => {
    const note = uncostedMarginNote(evidence({ jobs: 3, unmeasuredJobs: 1 })) ?? '';
    expect(note).toContain('1 job sold things whose cost was never recorded');
    expect(note).toContain('bottom of the list');
    expect(note).toContain('Put in what each one cost');
  });

  it('leaves out the shelves when nothing on them is uncosted now', () => {
    // A product costed after it was sold: the sale stays unmeasured, the shelf is fine.
    const note =
      uncostedMarginNote(
        evidence({ jobs: 3, unmeasuredJobs: 1, uncostedItems: 0, uncostedUnits: 0 })
      ) ?? '';
    expect(note).not.toContain('on your shelves');
    expect(note).not.toMatch(/\b0 /);
  });

  it('reads differently at one than at many', () => {
    const one = uncostedMarginNote(evidence({ uncostedItems: 1, uncostedUnits: 1 })) ?? '';
    const many = uncostedMarginNote(evidence({ uncostedItems: 2, uncostedUnits: 2 })) ?? '';
    expect(one).toContain('1 thing on your shelves, 1 unit in all');
    expect(one.replace(/\d+/g, 'N')).not.toBe(many.replace(/\d+/g, 'N'));
  });

  it('says nothing when the margins are real', () => {
    expect(uncostedMarginNote(evidence({ unmeasuredJobs: 0 }))).toBeNull();
  });
});

describe('appointments that happened and are still open (issue 926)', () => {
  it('says how many, and what to do, in one and in many', () => {
    expect(openBookingsTitle(1)).toBe('1 appointment has happened and is still open');
    expect(openBookingsTitle(22)).toBe('22 appointments have happened and are still open');
    expect(openBookingsBody(1)).toContain('It is still Confirmed or In progress, so what it made');
    expect(openBookingsBody(22)).toContain(
      'They are still Confirmed or In progress, so what they made'
    );
    expect(openBookingsBody(22)).toContain('mark it Completed, or Did not turn up');
  });
});
