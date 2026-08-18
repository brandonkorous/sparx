import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import { Toaster, toast } from './toast';

/**
 * A REGRESSION GUARD FOR A DEPENDENCY, not a test of our own code.
 *
 * `@base-ui-components/react@1.0.0-rc.0` called `ReactDOM.flushSync` inside
 * `ToastRoot`'s `recalculateHeight`, and two of that function's call sites were
 * layout effects. React is already in the commit phase there, so it refused to
 * flush and logged an error for EVERY toast, on every render — a console full of
 * noise that real errors then hide in. We carried a pnpm patch for it.
 *
 * Fixed upstream, and better than the patch did it: `@base-ui/react@1.7.0` gives
 * `recalculateHeight` an explicit `flushSync?: boolean`, calls it bare from the
 * layout effect and `recalculateHeight(true)` from the ResizeObserver /
 * MutationObserver paths, which run after paint and genuinely need the flush.
 * The patch and `pnpm.patchedDependencies` were removed on 2026-08-18 with the
 * move to `@base-ui/react` (silicaui 0.55 switched to it).
 *
 * These tests stay. They never really tested the patch — they test that firing a
 * toast from outside React renders it and logs nothing, which is the behaviour
 * we care about under any version, and the cheapest way to notice if a future
 * bump puts the flush back.
 */

const FLUSH_SYNC_MESSAGE = 'flushSync';

describe('Toaster', () => {
  /** Everything React logged, one entry per call, with each call's arguments
   *  flattened — React interpolates `%s` format strings across arguments, so a
   *  message split over several of them still has to be searchable. */
  let logged: string[] = [];

  beforeEach(() => {
    logged = [];
    const capture = (...args: unknown[]): void => {
      logged.push(args.map((arg) => String(arg)).join(' '));
    };
    vi.spyOn(console, 'error').mockImplementation(capture);
    vi.spyOn(console, 'warn').mockImplementation(capture);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function loggedText(): string {
    return logged.join('\n');
  }

  it('shows a toast that was fired from outside React', async () => {
    render(<Toaster />);
    toast.success('Stock level saved');
    expect(await screen.findByText('Stock level saved')).toBeInTheDocument();
  });

  it('does not log the Base UI flushSync error when a toast mounts', async () => {
    render(<Toaster />);
    toast.success('Stock level saved');
    await screen.findByText('Stock level saved');

    expect(loggedText()).not.toContain(FLUSH_SYNC_MESSAGE);
  });

  it('stays quiet when several toasts stack', async () => {
    render(<Toaster />);
    toast.success('First');
    toast.error('Second');
    toast.info('Third');

    await screen.findByText('Third');
    expect(loggedText()).not.toContain(FLUSH_SYNC_MESSAGE);
  });
});
