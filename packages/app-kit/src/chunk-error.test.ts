import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from './chunk-error';

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
