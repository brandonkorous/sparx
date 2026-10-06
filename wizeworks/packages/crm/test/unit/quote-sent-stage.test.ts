// Sending a wholesale quote makes the offer, so it moves to Quoted, the one
// stage a buyer can accept from. Doty sent Wasatch Front its quote and Renée's
// account showed it as "Draft" with no Accept button (sparx persona issue 084).

import { describe, expect, it } from 'vitest';

import { stageAfterQuoteSent } from '../../src/services/b2b-quote-service';

// The system workflow: Draft 0, Submitted 1, Under Review 2, Quoted 3,
// Accepted 4, Declined 5, Expired 6.
const quoted = { id: 'quoted', sortOrder: 3 };

describe('stageAfterQuoteSent', () => {
  it('moves a quote still being worked on to Quoted', () => {
    expect(stageAfterQuoteSent({ sortOrder: 0, stageType: 'draft' }, quoted)).toBe('quoted');
    expect(stageAfterQuoteSent({ sortOrder: 2, stageType: 'draft' }, quoted)).toBe('quoted');
  });

  it('leaves a quote that is already Quoted or decided where it is', () => {
    expect(stageAfterQuoteSent({ sortOrder: 3, stageType: 'draft' }, quoted)).toBeNull();
    expect(stageAfterQuoteSent({ sortOrder: 4, stageType: 'committed' }, quoted)).toBeNull();
    expect(stageAfterQuoteSent({ sortOrder: 5, stageType: 'void' }, quoted)).toBeNull();
  });
});
