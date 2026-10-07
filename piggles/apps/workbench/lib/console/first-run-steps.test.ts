import { describe, expect, it } from 'vitest';
import { stepsForAnswer } from './first-run-steps';

describe('the first-day jobs follow what the business said it does (issue 941)', () => {
  it('asks a journal to publish, not to sell or invoice', () => {
    expect(stepsForAnswer(['web', 'people'])).toEqual(['article', 'customer']);
  });

  it('asks a shop that invoices for all three of the original jobs', () => {
    expect(stepsForAnswer(['web', 'sell', 'money'])).toEqual(['article', 'product', 'invoice']);
  });

  it('keeps the original three for a business that never answered', () => {
    expect(stepsForAnswer(null)).toEqual(['product', 'customer', 'invoice']);
    expect(stepsForAnswer([])).toEqual(['product', 'customer', 'invoice']);
  });

  it('keeps the original three when only groups with no job were ticked', () => {
    expect(stepsForAnswer(['run'])).toEqual(['product', 'customer', 'invoice']);
  });
});
