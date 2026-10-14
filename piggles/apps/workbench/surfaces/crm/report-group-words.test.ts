// A report breakdown names its groups in this console's own words (persona
// issue 247), and money prints as money (251).

import { describe, expect, it } from 'vitest';

import { emptyAnswer, formatCell, groupName } from './report-group-words';

const none = undefined;
const ctx = (objectKey: string, field: string) => ({ objectKey, field, groupLabels: none });

describe('the name of a group in a breakdown', () => {
  it('uses the name the server looked up for an id', () => {
    const groupLabels = { 'd516b43a-95d3-4a07-a303-234f81c01fa7': 'Quote sent' };
    expect(
      groupName('d516b43a-95d3-4a07-a303-234f81c01fa7', {
        objectKey: 'deal',
        field: 'stageId',
        groupLabels,
      })
    ).toBe('Quote sent');
  });

  it("uses this console's own words for a coded value", () => {
    expect(groupName('retail', ctx('contact', 'type'))).toBe('Individual');
    expect(groupName('b2b', ctx('contact', 'type'))).toBe('Wholesale');
    expect(groupName('lead', ctx('contact', 'lifecycleStage'))).toBe('Lead');
    expect(groupName('customer', ctx('contact', 'lifecycleStage'))).toBe('Customer');
    expect(groupName('attempted_to_contact', ctx('contact', 'leadStatus'))).toBe(
      'Attempted to contact'
    );
    expect(groupName('credit_hold', ctx('company', 'status'))).toBe('Credit hold');
    expect(groupName('prepay', ctx('company', 'paymentTerms'))).toBe('Pay before dispatch');
    expect(groupName('net30', ctx('company', 'paymentTerms'))).toBe('30 days to pay');
    expect(groupName('api', ctx('ticket', 'source'))).toBe('Another system');
    expect(groupName('urgent', ctx('ticket', 'priority'))).toBe('Urgent');
    expect(groupName('cancelled', ctx('task', 'status'))).toBe('Canceled');
    expect(groupName('open', ctx('task', 'status'))).toBe('To do');
    expect(groupName('high', ctx('task', 'priority'))).toBe('High');
  });

  it('leaves text the business typed, and anything not a string, as it is', () => {
    expect(groupName('Kestrel Paper Co.', ctx('contact', 'company'))).toBeNull();
    expect(groupName('not-a-stage', ctx('contact', 'lifecycleStage'))).toBeNull();
    expect(groupName(42, { objectKey: 'deal', field: 'stageId', groupLabels: none })).toBeNull();
  });
});

describe('a number in a report (persona issue 251)', () => {
  it('prints money as money, in the business currency', () => {
    expect(formatCell(61250.5, { kind: 'currency', currency: 'USD' })).toBe('$61,250.50');
    expect(formatCell(9840, { kind: 'currency', currency: 'USD' })).toBe('$9,840.00');
  });

  it('groups every plain number the same way, cents or not', () => {
    expect(formatCell(61250.5, { kind: 'number' })).toBe('61,250.5');
    expect(formatCell(9840)).toBe('9,840');
  });
});

describe('an empty answer (sparx persona issue 255)', () => {
  it('only suggests loosening when something is narrowing it', () => {
    expect(emptyAnswer({ narrowed: true, labelPlural: 'Deals' })).toBe(
      'Nothing matches yet. Loosen a filter, or widen the period.'
    );
    expect(emptyAnswer({ narrowed: false, labelPlural: 'Deals' })).toBe(
      'There are no deals to count yet.'
    );
  });
});
