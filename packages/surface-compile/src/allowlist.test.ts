import { describe, expect, it } from 'vitest';
import { isClassAllowed, validateClasses } from './allowlist';

describe('isClassAllowed', () => {
  it('allows safe layout / flex / grid / sizing utilities', () => {
    for (const c of [
      'flex',
      'grid',
      'grid-cols-4',
      'relative',
      'sticky',
      'absolute',
      'z-50',
      'gap-6',
      'p-4',
      'w-full',
      'items-center',
      'hidden',
      'content-center',
    ])
      expect(isClassAllowed(c)).toBe(true);
  });

  it('allows variant-prefixed safe utilities (breakpoint / state / dark / motion)', () => {
    for (const c of [
      'md:flex-row',
      '@md:grid-cols-2',
      'hover:bg-primary',
      'dark:bg-base-200',
      'motion-reduce:animate-none',
    ])
      expect(isClassAllowed(c)).toBe(true);
  });

  it('blocks position: fixed, including under a variant', () => {
    expect(isClassAllowed('fixed')).toBe(false);
    expect(isClassAllowed('md:fixed')).toBe(false);
  });

  it('blocks arbitrary z-index escalation but allows the bounded scale', () => {
    expect(isClassAllowed('z-[9999]')).toBe(false);
    expect(isClassAllowed('z-50')).toBe(true);
  });

  it('blocks arbitrary url() and content injection', () => {
    expect(isClassAllowed('bg-[url(https://evil.test/x.png)]')).toBe(false);
    expect(isClassAllowed("content-['x']")).toBe(false);
    expect(isClassAllowed("before:content-['x']")).toBe(false);
  });
});

describe('validateClasses', () => {
  it('partitions a list into allowed vs blocked', () => {
    const { allowed, blocked } = validateClasses(['flex', 'fixed', 'z-[9999]', 'gap-4']);
    expect(allowed).toEqual(['flex', 'gap-4']);
    expect(blocked).toEqual(['fixed', 'z-[9999]']);
  });
});
