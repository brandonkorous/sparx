import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { topProgress, withTopProgress } from './top-progress-controller';

// FILL_HOLD_MS + FADE_MS from the controller — kept in sync with the source.
const FILL_HOLD = 180;
const FADE = 320;

describe('topProgress controller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    topProgress.reset();
  });
  afterEach(() => {
    topProgress.reset();
    vi.useRealTimers();
  });

  it('is inactive until something starts', () => {
    expect(topProgress.getState()).toMatchObject({ active: false, value: 0 });
    expect(topProgress.getServerState().active).toBe(false);
  });

  it('springs in at the minimum on start', () => {
    topProgress.start();
    const s = topProgress.getState();
    expect(s.active).toBe(true);
    expect(s.value).toBeCloseTo(0.08, 5);
    expect(s.finishing).toBe(false);
  });

  it('trickles upward but is capped below 1 while active', () => {
    topProgress.start();
    vi.advanceTimersByTime(220 * 40);
    const v = topProgress.getState().value;
    expect(v).toBeGreaterThan(0.08);
    expect(v).toBeLessThanOrEqual(0.994);
  });

  it('completes through fill → fade → inactive when the last job ends', () => {
    topProgress.start().done();
    expect(topProgress.getState()).toMatchObject({ value: 1, finishing: true, fading: false });
    vi.advanceTimersByTime(FILL_HOLD);
    expect(topProgress.getState().fading).toBe(true);
    vi.advanceTimersByTime(FADE);
    expect(topProgress.getState()).toMatchObject({ active: false, value: 0 });
  });

  it('stays active until every concurrent job ends', () => {
    const a = topProgress.start();
    const b = topProgress.start();
    a.done();
    expect(topProgress.getState()).toMatchObject({ active: true, finishing: false });
    b.done();
    expect(topProgress.getState().finishing).toBe(true);
  });

  it('treats the route job as one idempotent job', () => {
    topProgress.startRoute('commerce');
    topProgress.startRoute('commerce');
    expect(topProgress.getState().module).toBe('commerce');
    topProgress.endRoute();
    expect(topProgress.getState().finishing).toBe(true);
  });

  it('tints to the most recent module-bearing job', () => {
    topProgress.start({ id: 'route', module: 'cms' });
    expect(topProgress.getState().module).toBe('cms');
    topProgress.start({ module: 'crm' });
    expect(topProgress.getState().module).toBe('crm');
  });

  it('force-finishes via the timeout backstop', () => {
    topProgress.start({ timeout: 1000 });
    expect(topProgress.getState().active).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(topProgress.getState().finishing).toBe(true);
  });

  it('reset() aborts immediately', () => {
    topProgress.start();
    topProgress.start();
    topProgress.reset();
    expect(topProgress.getState()).toMatchObject({ active: false, value: 0, module: null });
  });

  it('withTopProgress resolves and finishes the bar', async () => {
    vi.useRealTimers(); // real microtasks for the await
    const result = await withTopProgress(() => Promise.resolve(42));
    expect(result).toBe(42);
    expect(topProgress.getState().active).toBe(true); // finishing/fading still on screen
    await expect(withTopProgress(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  });
});
