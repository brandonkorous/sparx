// The color+opacity helpers carry a Tailwind alpha modifier (`text-primary/75`)
// on top of the exact-token group model, so they read/write OUTSIDE readClassGroup
// (docs/builder/04 §2.1). The slash handling + prefix-token disambiguation is
// subtle — these lock the round-trip and the per-layer behavior.

import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_CONTROL,
  TEXT_COLOR_CONTROL,
  applyColorOpacity,
  readColorOpacity,
} from './class-controls';

describe('readColorOpacity', () => {
  it('reads a bare color as fully opaque', () => {
    expect(readColorOpacity('st-btn bg-primary', BACKGROUND_CONTROL)).toEqual({
      value: 'primary',
      opacity: 100,
    });
  });

  it('reads a color + opacity modifier', () => {
    expect(readColorOpacity('bg-accent/50', BACKGROUND_CONTROL)).toEqual({
      value: 'accent',
      opacity: 50,
    });
  });

  it('does not confuse a longer prefix token (text-primary vs text-primary-content)', () => {
    // `on-primary` is text-primary-content — must NOT be read as `primary`.
    expect(readColorOpacity('text-primary-content', TEXT_COLOR_CONTROL).value).toBe('on-primary');
    expect(readColorOpacity('text-primary', TEXT_COLOR_CONTROL).value).toBe('primary');
  });

  it('reads only the matching layer', () => {
    expect(readColorOpacity('bg-primary hover:bg-accent', BACKGROUND_CONTROL, 'hover:')).toEqual({
      value: 'accent',
      opacity: 100,
    });
  });

  it('returns null/100 when no color is set', () => {
    expect(readColorOpacity('st-btn p-4', BACKGROUND_CONTROL)).toEqual({
      value: null,
      opacity: 100,
    });
  });
});

describe('applyColorOpacity', () => {
  it('writes a bare token at full opacity', () => {
    expect(applyColorOpacity('st-btn', BACKGROUND_CONTROL, 'primary', 100)).toBe(
      'st-btn bg-primary'
    );
  });

  it('appends the opacity modifier below 100', () => {
    expect(applyColorOpacity('', BACKGROUND_CONTROL, 'primary', 75)).toBe('bg-primary/75');
  });

  it('replaces an existing color + its modifier (no duplicates)', () => {
    expect(applyColorOpacity('bg-primary/50 p-4', BACKGROUND_CONTROL, 'accent', 100)).toBe(
      'p-4 bg-accent'
    );
  });

  it('clears the color with null, preserving other tokens', () => {
    expect(applyColorOpacity('p-4 bg-primary/50 flex', BACKGROUND_CONTROL, null, 100)).toBe(
      'p-4 flex'
    );
  });

  it('writes into a state layer without touching base', () => {
    expect(applyColorOpacity('bg-primary', BACKGROUND_CONTROL, 'accent', 60, 'hover:')).toBe(
      'bg-primary hover:bg-accent/60'
    );
  });

  it('round-trips through read', () => {
    const written = applyColorOpacity('st-btn', TEXT_COLOR_CONTROL, 'white', 25);
    expect(readColorOpacity(written, TEXT_COLOR_CONTROL)).toEqual({ value: 'white', opacity: 25 });
  });
});
