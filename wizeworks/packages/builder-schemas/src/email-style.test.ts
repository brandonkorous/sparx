import { describe, expect, it } from 'vitest';
import { emailStyleFor, type EmailPalette } from './email-style';

const palette: EmailPalette = {
  primary: '#6366F1',
  primaryForeground: '#FFFFFF',
  accent: '#0EA5E9',
  background: '#FFFFFF',
  foreground: '#0F172A',
  muted: '#F8FAFC',
  border: '#E2E8F0',
};

describe('emailStyleFor', () => {
  it('returns an empty object for an empty / undefined class', () => {
    expect(emailStyleFor(undefined, palette)).toEqual({});
    expect(emailStyleFor('', palette)).toEqual({});
    expect(emailStyleFor('   ', palette)).toEqual({});
  });

  it('maps the typography subset to concrete inline values', () => {
    expect(emailStyleFor('text-2xl font-semibold leading-tight tracking-tight', palette)).toEqual({
      fontSize: 24,
      fontWeight: 600,
      lineHeight: 1.25,
      letterSpacing: '-0.025em',
    });
  });

  it('handles italics, transform, decoration, and alignment', () => {
    expect(emailStyleFor('italic uppercase underline text-center', palette)).toEqual({
      fontStyle: 'italic',
      textTransform: 'uppercase',
      textDecoration: 'underline',
      textAlign: 'center',
    });
  });

  it('resolves color tokens against the brand palette', () => {
    expect(emailStyleFor('text-base-content bg-primary', palette)).toEqual({
      color: '#0F172A',
      backgroundColor: '#6366F1',
    });
  });

  it('applies an /opacity modifier as an 8-digit hex alpha', () => {
    // 60% of 255 = 153 = 0x99.
    expect(emailStyleFor('text-base-content/60', palette)).toEqual({ color: '#0F172A99' });
    // 100 (or absent) leaves the color untouched.
    expect(emailStyleFor('text-primary/100', palette)).toEqual({ color: '#6366F1' });
  });

  it('maps the email-literal semantic colors and -content foregrounds', () => {
    expect(emailStyleFor('bg-success text-success-content', palette)).toEqual({
      backgroundColor: '#16A34A',
      color: '#FFFFFF',
    });
  });

  it('compiles spacing on the Tailwind 4px step', () => {
    expect(emailStyleFor('p-6', palette)).toEqual({ padding: 24 });
    expect(emailStyleFor('px-4 py-2', palette)).toEqual({
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 8,
      paddingBottom: 8,
    });
    expect(emailStyleFor('mt-3 mb-1', palette)).toEqual({ marginTop: 12, marginBottom: 4 });
  });

  it('centers with mx-auto', () => {
    expect(emailStyleFor('mx-auto w-full', palette)).toEqual({
      marginLeft: 'auto',
      marginRight: 'auto',
      width: '100%',
    });
  });

  it('composes a border from width + color + radius', () => {
    expect(emailStyleFor('border border-base-200 rounded-lg', palette)).toEqual({
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: '#F8FAFC',
      borderRadius: 8,
    });
    // A bare border-<color> implies a 1px solid edge.
    expect(emailStyleFor('border-primary', palette)).toEqual({
      borderColor: '#6366F1',
      borderStyle: 'solid',
      borderWidth: 1,
    });
  });

  it('maps the platform semantic radii to the fixed email scale', () => {
    expect(emailStyleFor('rounded-box', palette)).toEqual({ borderRadius: 8 });
    expect(emailStyleFor('rounded-field', palette)).toEqual({ borderRadius: 6 });
    expect(emailStyleFor('rounded-full', palette)).toEqual({ borderRadius: 9999 });
  });

  it('drops web-only tokens: states, breakpoints, flex/grid, position, arbitrary', () => {
    expect(
      emailStyleFor(
        'hover:bg-primary md:text-2xl @lg:p-8 dark:text-base-content flex grid absolute fixed sticky z-50 shadow-lg blur-sm w-[200px]',
        palette
      )
    ).toEqual({});
  });

  it('keeps base utilities while dropping their prefixed siblings', () => {
    // The base `text-lg` applies; the `md:` and `hover:` variants are ignored.
    expect(emailStyleFor('text-lg md:text-3xl hover:text-primary', palette)).toEqual({
      fontSize: 18,
    });
  });

  it('ignores an unknown color token rather than emitting a bad value', () => {
    expect(emailStyleFor('text-fuchsia-500 bg-not-a-token', palette)).toEqual({});
  });
});
