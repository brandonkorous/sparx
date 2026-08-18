import { describe, expect, it } from 'vitest';
import {
  isClassAllowed,
  validateClasses,
  parseAllowlistConfig,
  type AllowlistConfig,
} from './allowlist';

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

describe('tenant allowlist config (governance, Phase 6b)', () => {
  it('an empty / absent config behaves exactly like base-only', () => {
    expect(isClassAllowed('animate-pulse')).toBe(true);
    expect(isClassAllowed('animate-pulse', { blocks: [] })).toBe(true);
  });

  it('a prefix rule tightens — drops the whole family (incl. variants), keeps the rest', () => {
    const config: AllowlistConfig = { blocks: [{ kind: 'prefix', value: 'animate-' }] };
    expect(isClassAllowed('animate-pulse', config)).toBe(false);
    expect(isClassAllowed('hover:animate-pulse', config)).toBe(false); // base utility matched
    expect(isClassAllowed('items-center', config)).toBe(true);
  });

  it('exact and substring rules', () => {
    const exact: AllowlistConfig = { blocks: [{ kind: 'exact', value: 'blur-sm' }] };
    expect(isClassAllowed('blur-sm', exact)).toBe(false);
    expect(isClassAllowed('blur-md', exact)).toBe(true); // not exact

    const sub: AllowlistConfig = { blocks: [{ kind: 'substring', value: '[100vw' }] };
    expect(isClassAllowed('w-[100vw]', sub)).toBe(false);
    expect(isClassAllowed('w-full', sub)).toBe(true);
  });

  it('the platform base rules still fire even with a tenant config present', () => {
    const config: AllowlistConfig = { blocks: [{ kind: 'prefix', value: 'animate-' }] };
    expect(isClassAllowed('fixed', config)).toBe(false);
    expect(isClassAllowed('bg-[url(https://evil.test/x.png)]', config)).toBe(false);
    expect(isClassAllowed('z-[9999]', config)).toBe(false);
  });

  it('validateClasses honors the config', () => {
    const config: AllowlistConfig = { blocks: [{ kind: 'prefix', value: 'animate-' }] };
    const { allowed, blocked } = validateClasses(
      ['flex', 'animate-spin', 'fixed', 'gap-4'],
      config
    );
    expect(allowed).toEqual(['flex', 'gap-4']);
    expect(blocked).toEqual(['animate-spin', 'fixed']);
  });
});

describe('parseAllowlistConfig', () => {
  it('returns undefined for null / non-object / missing or empty blocks', () => {
    expect(parseAllowlistConfig(null)).toBeUndefined();
    expect(parseAllowlistConfig(undefined)).toBeUndefined();
    expect(parseAllowlistConfig('nope')).toBeUndefined();
    expect(parseAllowlistConfig({})).toBeUndefined();
    expect(parseAllowlistConfig({ blocks: [] })).toBeUndefined();
    expect(parseAllowlistConfig({ blocks: 'x' })).toBeUndefined();
  });

  it('keeps only well-formed rules and drops garbage entries', () => {
    const parsed = parseAllowlistConfig({
      v: 1,
      blocks: [
        { kind: 'prefix', value: 'animate-' },
        { kind: 'bogus', value: 'x' }, // bad kind → dropped
        { kind: 'exact', value: '' }, // empty value → dropped
        { kind: 'substring', value: '[url' },
        null,
      ],
    });
    expect(parsed).toEqual({
      blocks: [
        { kind: 'prefix', value: 'animate-' },
        { kind: 'substring', value: '[url' },
      ],
    });
  });
});
