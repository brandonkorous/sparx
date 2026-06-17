import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { TopProgress } from './top-progress';
import { siteProgress, withSiteProgress } from './top-progress-controller';

const FILL_HOLD = 180;
const FADE = 320;

describe('siteProgress controller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    siteProgress.reset();
  });
  afterEach(() => {
    siteProgress.reset();
    vi.useRealTimers();
  });

  it('springs in at the minimum and trickles below the cap', () => {
    siteProgress.start();
    expect(siteProgress.getState()).toMatchObject({ active: true });
    expect(siteProgress.getState().value).toBeCloseTo(0.08, 5);
    vi.advanceTimersByTime(220 * 40);
    expect(siteProgress.getState().value).toBeLessThanOrEqual(0.994);
    expect(siteProgress.getState().value).toBeGreaterThan(0.08);
  });

  it('completes through fill → fade → inactive', () => {
    siteProgress.start().done();
    expect(siteProgress.getState()).toMatchObject({ value: 1, finishing: true });
    vi.advanceTimersByTime(FILL_HOLD);
    expect(siteProgress.getState().fading).toBe(true);
    vi.advanceTimersByTime(FADE);
    expect(siteProgress.getState()).toMatchObject({ active: false, value: 0 });
  });

  it('stays active until every job ends and treats the route job as one', () => {
    siteProgress.startRoute();
    siteProgress.startRoute();
    const extra = siteProgress.start();
    siteProgress.endRoute();
    expect(siteProgress.getState().finishing).toBe(false);
    extra.done();
    expect(siteProgress.getState().finishing).toBe(true);
  });

  it('force-finishes via the timeout backstop', () => {
    siteProgress.start({ timeout: 1000 });
    vi.advanceTimersByTime(1000);
    expect(siteProgress.getState().finishing).toBe(true);
  });
});

describe('withSiteProgress', () => {
  afterEach(() => siteProgress.reset());

  it('resolves work and finishes the bar', async () => {
    const out = await withSiteProgress(() => Promise.resolve(7));
    expect(out).toBe(7);
    await expect(withSiteProgress(() => Promise.reject(new Error('nope')))).rejects.toThrow('nope');
  });
});

describe('<TopProgress> (storefront)', () => {
  afterEach(() => {
    siteProgress.reset();
    cleanup();
  });

  it('renders the tenant bar and reflects controller activity', () => {
    const { container } = render(<TopProgress route="/" intercept={false} />);
    const bar = () => container.querySelector<HTMLElement>('.st-topbar__bar')!;
    expect(container.querySelector('.st-topbar')).not.toBeNull();
    expect(bar().style.width).toBe('0%');
    act(() => {
      siteProgress.start();
    });
    expect(bar().style.width).toBe('8%');
    expect(bar().style.opacity).toBe('1');
  });
});
