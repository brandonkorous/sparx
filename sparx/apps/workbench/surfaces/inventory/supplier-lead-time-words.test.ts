// THE SENTENCE MAY NOT CONTRADICT THE CARD IT SITS UNDER.
//
// Ashcombe Mills, measured: 2 deliveries, 0 of 2 late, grade A · 99, and
// underneath "No delivery from them has been measured yet".

import { describe, expect, it } from 'vitest';

import { MIN_RELIABLE_SAMPLES, leadTimeLine, type LeadTimeFacts } from './supplier-lead-time-words';

/** Ashcombe Mills as the database has her: measured, but never timed. */
const ashcombe: LeadTimeFacts = {
  meanDays: null,
  sample: 0,
  promisedDays: null,
  varianceDays: null,
  deliveries: 2,
  statedDays: 21,
};

const facts = (over: Partial<LeadTimeFacts> = {}): LeadTimeFacts => ({ ...ashcombe, ...over });

describe('the sentence under the four measures', () => {
  it('does not deny deliveries the card above it just counted', () => {
    const line = leadTimeLine(ashcombe);
    expect(line.text).not.toContain('No delivery from them has been measured');
    expect(line.text).toContain('2 deliveries from them have arrived');
  });

  it('names what is actually missing, which is the time and not the delivery', () => {
    expect(leadTimeLine(ashcombe).text).toContain('How long they actually take');
  });

  it('offers the pass that would fill it', () => {
    // The card's own "Measure now" recomputes scorecards, which COPY the lead
    // time. Only the planning sweep works it out, so the button has to be here.
    expect(leadTimeLine(ashcombe).measure).toBe('Work out delivery times');
  });

  it('says what planning is using in the meantime, by its real number', () => {
    expect(leadTimeLine(ashcombe).text).toContain('the 21 days typed in on their record');
  });
});

describe('one outcome, two causes', () => {
  it('tells apart nobody ran the pass from nothing ever arrived', () => {
    const ranNothing = leadTimeLine(facts({ deliveries: 2 }));
    const nothingCame = leadTimeLine(facts({ deliveries: 0 }));
    expect(ranNothing.text).not.toBe(nothingCame.text);
  });

  it('offers the button only where pressing it would produce something', () => {
    // A pass over zero deliveries produces zero deliveries. Offering the button
    // there sends somebody to press a thing that cannot help.
    expect(leadTimeLine(facts({ deliveries: 0 })).measure).toBe(null);
    for (const deliveries of [1, 2, 9]) {
      expect(leadTimeLine(facts({ deliveries })).measure, `at ${String(deliveries)}`).toBe(
        'Work out delivery times'
      );
    }
  });

  it('says nothing arrived when nothing arrived', () => {
    const line = leadTimeLine(facts({ deliveries: 0 }));
    expect(line.text).toContain('Nothing has arrived from them yet');
    expect(line.text).not.toContain('have arrived');
  });

  it('counts one delivery in the singular', () => {
    const line = leadTimeLine(facts({ deliveries: 1 }));
    expect(line.text).toContain('1 delivery from them has arrived');
  });
});

describe('what planning falls back to', () => {
  it('does not promise a typed-in time when nothing was typed in', () => {
    // `resolveLeadTimeOnTx` goes measured, then stated, then the stock level's
    // own, then a flat default. With nothing stated, "planning still uses
    // whatever delivery time was typed in on their record" described a step
    // that does not happen.
    for (const statedDays of [null, 0]) {
      const line = leadTimeLine(facts({ statedDays }));
      expect(line.text, `stated ${String(statedDays)}`).not.toContain('typed in on their record.');
      expect(line.text, `stated ${String(statedDays)}`).toContain('a general figure');
    }
  });

  it('names the stated number when there is one', () => {
    expect(leadTimeLine(facts({ statedDays: 21 })).text).toContain('the 21 days');
    expect(leadTimeLine(facts({ statedDays: 1 })).text).toContain('the 1 day typed in');
  });
});

describe('a measured figure says how much to trust it', () => {
  const timed = (over: Partial<LeadTimeFacts>): string =>
    leadTimeLine(
      facts({ meanDays: 11.4, sample: 14, promisedDays: 10, varianceDays: 1.4, ...over })
    ).text;

  it('still reports the average and the gap against what they said', () => {
    const line = timed({});
    expect(line).toContain('Deliveries take 11.4 days on average, measured across 14 deliveries');
    expect(line).toContain('they say 10, so they run slower than stated by 1.4 days');
  });

  it('reads faster when they beat what they said', () => {
    expect(timed({ meanDays: 8, promisedDays: 10, varianceDays: -2 })).toContain(
      'faster than stated by 2 days'
    );
  });

  it('says so when there is nothing they stated to compare against', () => {
    expect(timed({ promisedDays: null, varianceDays: null })).toContain(
      'never stated a delivery time to compare it against'
    );
  });

  it('warns that a thin sample is not what planning is using', () => {
    // The rule is written down one screen over and this panel did not follow
    // it: below the threshold the join in `resolveLeadTimeOnTx` misses and the
    // stated days win, so a confident-looking variance was decorating a figure
    // nothing reads.
    for (const sample of [1, MIN_RELIABLE_SAMPLES - 1]) {
      const line = timed({ sample });
      expect(line, `sample ${String(sample)}`).toContain('too few deliveries to plan on');
      expect(line, `sample ${String(sample)}`).toContain('the 21 days typed in on their record');
    }
  });

  it('drops the warning once the sample is one planning will use', () => {
    for (const sample of [MIN_RELIABLE_SAMPLES, 14]) {
      expect(timed({ sample }), `sample ${String(sample)}`).not.toContain('too few deliveries');
    }
  });

  it('never offers the button once there is a figure', () => {
    expect(leadTimeLine(facts({ meanDays: 11.4, sample: 14 })).measure).toBe(null);
  });

  it('holds the threshold the server joins on', () => {
    // Duplicated from `wizeworks/packages/inventory/src/services/lead-times.ts`
    // because no endpoint exposes it. This is the line that has to change too.
    expect(MIN_RELIABLE_SAMPLES).toBe(3);
  });
});
