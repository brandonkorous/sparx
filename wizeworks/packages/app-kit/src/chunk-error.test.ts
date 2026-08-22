import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, reloadOnceForStaleBuild } from './chunk-error';

// The regression this file exists for: between the Next 16 upgrade and
// 2026-07-27 the detector matched only webpack's wording, so every stale-build
// recovery path in every app was silently dead and each release dumped operators
// on a generic crash screen. Nothing failed — a regex just stopped matching.
//
// So these are not "does the regex work" tests. Each message below is a VERBATIM
// shape a real bundler emits, pinned so a bundler swap or a tidy-up of the
// pattern breaks a test instead of breaking production a release later.

describe('isChunkLoadError', () => {
  // `Failed to load chunk ${chunkUrl} ${loadReason}${error ? `: ${error}` : ''}`
  // — turbopack-ecmascript-runtime, thrown as a plain Error. Note the name is
  // 'Error', so nothing but the message identifies it.
  describe('Turbopack (next build default since Next 16 — what ships today)', () => {
    it('recognises a script chunk requested by a module', () => {
      expect(
        isChunkLoadError(
          new Error(
            'Failed to load chunk static/chunks/9f2a1c8d.js from module [project]/apps/workbench/lib/surfaces/registry.ts'
          )
        )
      ).toBe(true);
    });

    it('recognises a CSS chunk pulled in as a runtime dependency', () => {
      expect(
        isChunkLoadError(
          new Error(
            'Failed to load chunk static/chunks/apps_workbench_app_globals_c3f1.css as a runtime dependency of chunk static/chunks/main.js'
          )
        )
      ).toBe(true);
    });

    it('recognises the form that wraps an underlying reason', () => {
      const inner = new TypeError('Failed to fetch');
      expect(
        isChunkLoadError(
          new Error(
            `Failed to load chunk static/chunks/ab12.js from module 4711: ${String(inner)}`,
            {
              cause: inner,
            }
          )
        )
      ).toBe(true);
    });
  });

  describe('webpack (next build --webpack)', () => {
    it('recognises it by name alone, message unmatched', () => {
      const error = new Error('something the pattern does not cover');
      error.name = 'ChunkLoadError';
      expect(isChunkLoadError(error)).toBe(true);
    });

    it('recognises the classic message', () => {
      expect(
        isChunkLoadError(
          new Error(
            'Loading chunk 4711 failed.\n(missing: https://app.sparx.works/_next/static/chunks/4711.js)'
          )
        )
      ).toBe(true);
    });
  });

  describe('native ESM import()', () => {
    it('recognises the browser wording', () => {
      expect(
        isChunkLoadError(
          new Error(
            'Failed to fetch dynamically imported module: https://app.sparx.works/_next/static/x.js'
          )
        )
      ).toBe(true);
    });
  });

  describe('inputs that are not Errors', () => {
    it('accepts a bare message string, as a window error event supplies', () => {
      expect(isChunkLoadError('Failed to load chunk static/chunks/ab12.js from module 4711')).toBe(
        true
      );
    });

    it('finds a chunk failure nested behind an unrelated wrapper', () => {
      expect(
        isChunkLoadError(
          new Error('Rendering the pane failed', {
            cause: new Error('Failed to load chunk static/chunks/ab12.js from module 4711'),
          })
        )
      ).toBe(true);
    });

    it('survives a cyclic cause chain instead of hanging the tab', () => {
      const a = new Error('a');
      const b = new Error('b', { cause: a });
      (a as { cause?: unknown }).cause = b;
      expect(isChunkLoadError(a)).toBe(false);
    });

    it.each([undefined, null, '', 42, {}, new Error('')])('ignores %p', (input) => {
      expect(isChunkLoadError(input)).toBe(false);
    });
  });

  // A false positive is worse than a miss: it reloads a tab mid-edit, over and
  // over, for a bug a reload cannot fix.
  describe('ordinary application errors', () => {
    it.each([
      "Cannot read properties of undefined (reading 'map')",
      'Failed to fetch',
      'NetworkError when attempting to fetch resource.',
      'Minified React error #418',
      'Failed to load resource: the server responded with a status of 500',
    ])('does not treat %p as a stale build', (message) => {
      expect(isChunkLoadError(new Error(message))).toBe(false);
    });
  });
});

// The loop this file did NOT catch until 2026-08-19: `reloadOnceForStaleBuild`
// was a sliding 10s cooldown that re-stamped its own timestamp on every reload,
// so "once" meant "every ten seconds, forever". A storefront tab whose chunks a
// rebuild had purged sat there reloading itself while its owner watched. The
// detector had tests; the recovery — the half that actually touches the tab —
// had none, so nothing failed when it stopped meaning what its name said.
//
// These pin the budget itself: how many reloads an episode gets, when a new
// episode starts, and that dev never gets one at all.
describe('reloadOnceForStaleBuild', () => {
  const KEY = 'sparx:chunk-reload';

  let store: Map<string, string>;
  let reloads: number;

  beforeEach(() => {
    store = new Map();
    reloads = 0;
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      location: {
        reload: () => {
          reloads += 1;
        },
      },
    });
    vi.useFakeTimers();
    // Well clear of epoch, so "no prior reload" (at: 0) reads as long-settled
    // rather than as a reload that happened moments ago.
    vi.setSystemTime(new Date('2026-08-19T12:00:00Z'));
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reloads on the first stale-build error', () => {
    expect(reloadOnceForStaleBuild()).toBe(true);
    expect(reloads).toBe(1);
  });

  it('gives up rather than looping when the build is still broken', () => {
    expect(reloadOnceForStaleBuild()).toBe(true);
    expect(reloadOnceForStaleBuild()).toBe(true);
    expect(reloadOnceForStaleBuild()).toBe(false);
    expect(reloads).toBe(2);
  });

  // The exact regression: the old cooldown let the budget refill on the clock,
  // so waiting out the window bought another reload — and another, and another.
  it('does not refill the budget merely because time passed', () => {
    reloadOnceForStaleBuild();
    reloadOnceForStaleBuild();
    vi.advanceTimersByTime(60_000);
    expect(reloadOnceForStaleBuild()).toBe(false);
    expect(reloads).toBe(2);
  });

  // A page that ran for five minutes proves the build works, so the next chunk
  // error is a fresh deploy — not the same one throwing again.
  it('starts a new budget once a page has settled', () => {
    reloadOnceForStaleBuild();
    reloadOnceForStaleBuild();
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(reloadOnceForStaleBuild()).toBe(true);
    expect(reloads).toBe(3);
  });

  it('never reloads outside production, where a purged chunk is just HMR', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(reloadOnceForStaleBuild()).toBe(false);
    expect(reloads).toBe(0);
  });

  it('reloads anyway when sessionStorage refuses to persist the budget', () => {
    store = new Map();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
      },
      location: {
        reload: () => {
          reloads += 1;
        },
      },
    });
    expect(reloadOnceForStaleBuild()).toBe(true);
    expect(reloads).toBe(1);
  });

  it('treats a corrupt stored budget as no prior reload', () => {
    store.set(KEY, 'not json');
    expect(reloadOnceForStaleBuild()).toBe(true);
    expect(reloads).toBe(1);
  });
});
