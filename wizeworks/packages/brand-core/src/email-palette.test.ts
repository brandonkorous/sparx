import { afterEach, describe, expect, it } from 'vitest';
import { PLAIN_EMAIL_PALETTE, resolveEmailPalette } from './email-palette';

// The contract this file pins is mostly about REFUSAL. A palette that half-parses
// is the failure mode that matters — one brand's accent on another brand's ink
// renders perfectly and looks like a design, which is how the original leak
// survived a fork — so every case below checks that a partial or malformed
// palette falls all the way back rather than being repaired into something
// plausible.

const VAR = 'TESTBRAND_EMAIL_PALETTE';

const COMPLETE = {
  accent: '#112233',
  accentContent: '#ffffff',
  ink: '#001122',
  inkContent: '#fefefe',
  paper: '#ffffff',
  canvas: '#eeeeee',
  well: '#f5f5f5',
  line: '#dddddd',
  heading: '#001122',
  body: '#333333',
  meta: '#777777',
};

function setPalette(value: string | undefined) {
  if (value === undefined) delete process.env[VAR];
  else process.env[VAR] = value;
}

afterEach(() => setPalette(undefined));

describe('resolveEmailPalette', () => {
  it('falls back to plain — not to any brand — when nothing is configured', () => {
    const { palette, source, reason } = resolveEmailPalette('testbrand');
    expect(source).toBe('plain');
    expect(palette).toEqual(PLAIN_EMAIL_PALETTE);
    // The reason names the variable, because the log line is the only way anyone
    // finds out. A silent fallback is one nobody fixes.
    expect(reason).toContain(VAR);
  });

  it('derives the variable name from the brand key, naming no brand itself', () => {
    process.env.A_THIRD_BRAND_EMAIL_PALETTE = JSON.stringify(COMPLETE);
    try {
      expect(resolveEmailPalette('a third brand').source).toBe('configured');
    } finally {
      delete process.env.A_THIRD_BRAND_EMAIL_PALETTE;
    }
  });

  it('accepts a complete palette and collapses the roles it does not state', () => {
    setPalette(JSON.stringify(COMPLETE));
    const { palette, source } = resolveEmailPalette('testbrand');

    expect(source).toBe('configured');
    expect(palette.accent).toBe('#112233');
    // Collapses are role REASSIGNMENT, never a computed tint: an unstated lead is
    // body copy, an unstated label is a heading, an unstated stronger hairline is
    // the ordinary one.
    expect(palette.lead).toBe(COMPLETE.body);
    expect(palette.label).toBe(COMPLETE.heading);
    expect(palette.lineStrong).toBe(COMPLETE.line);
    expect(palette.inkMeta).toBe(COMPLETE.inkContent);
    // `accentEdge === accent` and `accentWash === paper` are how a component
    // learns the brand published neither — a flat button, a hairline step chip.
    expect(palette.accentEdge).toBe(COMPLETE.accent);
    expect(palette.accentWash).toBe(COMPLETE.paper);
    // The semantic ramp is the platform's unless the brand overrides it. A green
    // that means "paid" is not a brand signal.
    expect(palette.success).toBe(PLAIN_EMAIL_PALETTE.success);
    // No dark theme stated → light-only, rather than a dark block that changes
    // nothing.
    expect(palette.dark).toBeNull();
  });

  it('lets a brand override one semantic without restating the ramp', () => {
    setPalette(JSON.stringify({ ...COMPLETE, danger: '#aa0000' }));
    const { palette } = resolveEmailPalette('testbrand');
    expect(palette.danger).toBe('#aa0000');
    expect(palette.dangerWash).toBe(PLAIN_EMAIL_PALETTE.dangerWash);
  });

  it('refuses the WHOLE palette when a required role is missing', () => {
    const { ink: _dropped, ...withoutInk } = COMPLETE;
    setPalette(JSON.stringify(withoutInk));
    const { palette, source, reason } = resolveEmailPalette('testbrand');

    // Not "keep the accent and borrow an ink" — that is the accent-on-the-wrong-
    // ink render this whole mechanism exists to prevent.
    expect(source).toBe('plain');
    expect(palette).toEqual(PLAIN_EMAIL_PALETTE);
    expect(reason).toContain('ink');
  });

  it.each([
    ['3-digit shorthand', '#abc'],
    ['8-digit alpha', '#11223344'],
    ['a named color', 'rebeccapurple'],
    ['nonsense', 'not a color'],
  ])('refuses %s, which would not paint in Outlook anyway', (_label, value) => {
    setPalette(JSON.stringify({ ...COMPLETE, accent: value }));
    const { source, reason } = resolveEmailPalette('testbrand');
    expect(source).toBe('plain');
    expect(reason).toContain('accent');
  });

  it('refuses a role it does not recognise, rather than ignoring it', () => {
    // A typo'd key is a value the author believes is set and is not. Silently
    // dropping it produces an email painted in a palette nobody reviewed.
    setPalette(JSON.stringify({ ...COMPLETE, mastheadColour: '#123456' }));
    const { source, reason } = resolveEmailPalette('testbrand');
    expect(source).toBe('plain');
    expect(reason).toContain('mastheadColour');
  });

  it.each([
    ['malformed JSON', '{"accent":'],
    ['a JSON array', '["#112233"]'],
    ['a bare string', '"#112233"'],
  ])('survives %s without throwing', (_label, value) => {
    setPalette(value);
    // Never throws: this runs inside an email worker, and a queue that stops is
    // worse than an email that is grey.
    expect(() => resolveEmailPalette('testbrand')).not.toThrow();
    expect(resolveEmailPalette('testbrand').source).toBe('plain');
  });

  describe('the dark half', () => {
    const DARK = {
      background: '#111827',
      foreground: '#e5e7eb',
      muted: '#0b1120',
      border: '#1f2937',
    };

    it('is carried through when complete', () => {
      setPalette(JSON.stringify({ ...COMPLETE, dark: { ...DARK, primary: '#ff0000' } }));
      const { palette, source } = resolveEmailPalette('testbrand');
      expect(source).toBe('configured');
      expect(palette.dark).toEqual({ ...DARK, primary: '#ff0000' });
    });

    it('takes the whole palette down when it is half-stated', () => {
      // A dark block missing its background is a dark email with a white card in
      // the middle of it. Better to send the light design everywhere.
      const { background: _dropped, ...halfDark } = DARK;
      setPalette(JSON.stringify({ ...COMPLETE, dark: halfDark }));
      const { source, reason } = resolveEmailPalette('testbrand');
      expect(source).toBe('plain');
      expect(reason).toContain('background');
    });
  });
});
