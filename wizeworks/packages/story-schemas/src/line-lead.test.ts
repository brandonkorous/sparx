import { describe, expect, it } from 'vitest';
import { lineLead } from './model';

// sparx persona issue 010: the screen said "I supply other businesses" for a business
// the owner already runs, and the prose saved as the record said "I’ll supply".
describe('lineLead', () => {
  it('speaks in the present for a business the owner already runs', () => {
    expect([0, 1, 2].map((i) => lineLead('current', i))).toEqual(['I', 'I also', 'I also']);
  });

  it('speaks in intent for a business the owner wants to start', () => {
    expect([0, 1].map((i) => lineLead('future', i))).toEqual(['I’ll', 'I’ll also']);
  });
});
