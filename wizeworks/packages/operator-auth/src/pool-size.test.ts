import { describe, expect, it } from 'vitest';
import { DEFAULT_OPERATOR_POOL_MAX, operatorPoolMax } from './pool-size';

describe('operatorPoolMax', () => {
  it('uses OPERATOR_DB_POOL_MAX when the Deployment sets it', () => {
    expect(operatorPoolMax('2')).toBe(2);
  });

  it('keeps the old default of 5 when unset or invalid', () => {
    expect(operatorPoolMax(undefined)).toBe(DEFAULT_OPERATOR_POOL_MAX);
    expect(operatorPoolMax('0')).toBe(5);
    expect(operatorPoolMax('x')).toBe(5);
  });
});
