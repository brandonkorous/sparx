import { describe, expect, it } from 'vitest';
import { DEFAULT_CONNECTION_LIMIT, eventWorkerPool, MIN_CONNECTION_LIMIT } from './boot-db-pool.js';

describe('eventWorkerPool', () => {
  it('uses DB_CONNECTION_LIMIT when the Deployment sets it', () => {
    expect(eventWorkerPool('4')).toBe(4);
    expect(eventWorkerPool(' 6 ')).toBe(6);
  });

  it('falls back to a default that fits the 35-slot budget, not 20', () => {
    expect(eventWorkerPool(undefined)).toBe(DEFAULT_CONNECTION_LIMIT);
    expect(eventWorkerPool('')).toBe(DEFAULT_CONNECTION_LIMIT);
    expect(eventWorkerPool('abc')).toBe(DEFAULT_CONNECTION_LIMIT);
    expect(DEFAULT_CONNECTION_LIMIT).toBeLessThan(20);
  });

  it('never drops below the floor the advisory tick lock needs', () => {
    expect(eventWorkerPool('1')).toBe(MIN_CONNECTION_LIMIT);
    expect(MIN_CONNECTION_LIMIT).toBe(2);
  });
});
