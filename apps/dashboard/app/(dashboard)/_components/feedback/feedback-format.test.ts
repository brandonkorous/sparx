// Pure presentation helpers shared by the feedback compose form, history list,
// and thread (feedback-format.ts). They decide the at-a-glance title, the
// relative timestamp, and the per-category semantic hue — small branches, but
// they shape every row a user sees, so they're worth pinning. Node-env, no DOM:
// the module's only runtime import is the icon set.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_COLOR, CATEGORY_ICON, deriveTitle, timeAgo } from './feedback-format';

const CATEGORIES = ['idea', 'problem', 'question', 'praise'] as const;

describe('deriveTitle', () => {
  it('prefers an explicit subject, trimmed', () => {
    expect(deriveTitle({ subject: '  Add dark mode  ', body: 'long body text' })).toBe(
      'Add dark mode'
    );
  });

  it('falls back to the first non-empty line of the body', () => {
    expect(deriveTitle({ subject: null, body: 'First line\nSecond line' })).toBe('First line');
  });

  it('ignores a blank subject and uses the body', () => {
    expect(deriveTitle({ subject: '   ', body: 'Body wins' })).toBe('Body wins');
  });

  it('truncates a very long first line with an ellipsis', () => {
    const out = deriveTitle({ subject: null, body: 'x'.repeat(120) });
    expect(out).toHaveLength(78); // 77 chars + the single ellipsis glyph
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns a sensible default when there is nothing to show', () => {
    expect(deriveTitle({ subject: null, body: '' })).toBe('Feedback');
  });
});

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-29T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

  it('reads "just now" under a minute', () => {
    expect(timeAgo(minsAgo(0))).toBe('just now');
  });

  it('reads minutes, then hours, then days', () => {
    expect(timeAgo(minsAgo(5))).toBe('5m ago');
    expect(timeAgo(minsAgo(120))).toBe('2h ago');
    expect(timeAgo(minsAgo(60 * 24 * 3))).toBe('3d ago');
  });

  it('falls back to an absolute date beyond a month', () => {
    const out = timeAgo(minsAgo(60 * 24 * 45));
    expect(out).not.toMatch(/ago$/);
    expect(out).toContain('2026');
  });
});

describe('category styling', () => {
  it('maps each category to its semantic hue', () => {
    expect(CATEGORY_COLOR).toEqual({
      idea: 'primary',
      problem: 'warning',
      question: 'info',
      praise: 'success',
    });
  });

  it('has an icon for every category and no extras', () => {
    expect(Object.keys(CATEGORY_ICON).sort()).toEqual([...CATEGORIES].sort());
    for (const c of CATEGORIES) {
      expect(CATEGORY_ICON[c]).toBeTruthy();
    }
  });
});
