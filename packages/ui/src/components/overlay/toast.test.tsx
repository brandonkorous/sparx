import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import { Toaster, toast } from './toast';

/**
 * A REGRESSION GUARD FOR A PATCHED DEPENDENCY, not a test of our own code.
 *
 * `@base-ui-components/react@1.0.0-rc.0` calls `ReactDOM.flushSync` inside
 * `ToastRoot`'s `recalculateHeight`, and two of that function's call sites are
 * layout effects. React is already in the commit phase there, so it refuses to
 * flush and logs an error for EVERY toast, on every render — a console full of
 * noise that real errors then hide in.
 *
 * We patch it: `patches/@base-ui-components__react@1.0.0-rc.0.patch` marks the
 * two layout-effect paths and skips the flush on them (the flush is redundant
 * there — a setState in a layout effect already re-renders synchronously before
 * paint) while keeping it on the ResizeObserver / MutationObserver paths, which
 * run after paint and genuinely need it.
 *
 * A patch is invisible until it silently stops applying — a dependency bump, a
 * lockfile regeneration, a merge that drops `pnpm.patchedDependencies`. This
 * test is the thing that notices. **If it fails, check the patch still applies
 * before touching anything here**: `pnpm why @base-ui-components/react` should
 * show a `_patch_hash=` segment in the store path.
 *
 * Delete both the patch and this file when the fix lands upstream. rc.0 was the
 * newest published version on 2026-08-13.
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
