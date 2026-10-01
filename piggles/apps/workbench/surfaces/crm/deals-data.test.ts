// Who a deal is with, as a board card and a list row say it.
//
// The card read the customer alone, so a deal made with a company and nobody at
// it said nothing about who it was with (issue 911).

import { describe, expect, it } from 'vitest';
import { dealWith } from './deals-data';

const person = { firstName: 'Ana', lastName: 'Lee', company: null, email: null };

describe('dealWith', () => {
  it('names the company when the deal is with a company alone', () => {
    expect(dealWith({ customer: null, company: { companyName: 'Thornbury Haberdashery' } })).toBe(
      'Thornbury Haberdashery'
    );
  });

  it('names the person when the deal is with a person alone', () => {
    expect(dealWith({ customer: person, company: null })).toBe('Ana Lee');
  });

  it('names both when it has both', () => {
    expect(dealWith({ customer: person, company: { companyName: 'Thornbury Haberdashery' } })).toBe(
      'Ana Lee · Thornbury Haberdashery'
    );
  });

  it('does not say a name twice when the person is known only by their company', () => {
    const byCompany = { firstName: null, lastName: null, company: 'Thornbury', email: null };
    expect(dealWith({ customer: byCompany, company: { companyName: 'Thornbury' } })).toBe(
      'Thornbury'
    );
  });

  it('says nothing when there is nobody', () => {
    expect(dealWith({ customer: null, company: null })).toBeNull();
  });
});
