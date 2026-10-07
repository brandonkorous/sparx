import { describe, expect, it } from 'vitest';
import { onePerApp } from './one-per-app';

const label = (slug: string) =>
  ({ commerce: 'Sell', channels: 'Sell', crm: 'Customers' })[slug] ?? slug;

describe('one chip per app', () => {
  it('names an app once when two of its modules are listed', () => {
    expect(onePerApp(['commerce', 'crm', 'channels'], label)).toEqual(['commerce', 'crm']);
  });

  it('keeps every module that has its own app', () => {
    expect(onePerApp(['crm', 'commerce'], label)).toEqual(['crm', 'commerce']);
  });
});
