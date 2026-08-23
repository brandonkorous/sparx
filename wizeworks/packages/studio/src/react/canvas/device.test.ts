import { describe, expect, it } from 'vitest';
import { buildSilicaThemeCssFromTheme } from '@wizeworks/site-themes';
import { DEVICE_CLASS } from './canvas';

/** The frame is a `@container`, so these widths are what decide the reflow.
 *  silica's three editable breakpoints sit at base, `@3xl` (768px) and `@5xl`
 *  (1024px) — a frame narrower than one cannot show what editing it does. */
const NEEDS = { mobile: 0, tablet: 768, desktop: 1024 };

describe('the width each device draws at', () => {
  it('never clamps to the pane', () => {
    // `desktop: w-full` plus `max-w-full` on the other two meant that in the
    // default docked layout — about 700px of canvas between the rails — Phone,
    // Tablet and Computer all rendered the SAME base design. Nothing errored: the
    // Inspector said "Editing what changes on desktop", the edit landed correctly
    // in the tree, and the canvas simply could not show it.
    for (const [device, className] of Object.entries(DEVICE_CLASS)) {
      expect(className, `${device} clamps to the pane`).not.toMatch(/max-w-full/);
      expect(className, `${device} takes the pane's width`).not.toBe('w-full');
    }
  });

  it('is wide enough for the breakpoint that device edits', () => {
    for (const [device, floor] of Object.entries(NEEDS)) {
      const className = DEVICE_CLASS[device as keyof typeof NEEDS];
      const width = Number(/\[(\d+)px\]/.exec(className)?.[1] ?? 0);
      expect(
        width,
        `${device} is ${width}px, under the ${floor}px it needs`
      ).toBeGreaterThanOrEqual(floor);
    }
  });

  it('keeps every width a LITERAL class', () => {
    // A computed width class is not in Tailwind's source scan, so it compiles to
    // nothing and the canvas silently stops resizing.
    for (const className of Object.values(DEVICE_CLASS)) {
      expect(className).not.toMatch(/\$\{|\+/);
    }
  });
});

describe('the palette the canvas paints in', () => {
  // Not a DOM test — the contract this guards lives in the CSS silica emits, and
  // this asserts the shape the canvas frame has to satisfy to be governed by it.
  it('is only escaped from prefers-color-scheme by the literal word "light"', () => {
    const css = buildSilicaThemeCssFromTheme(
      {
        name: 'workshop',
        tokens: { '--color-primary': '#111111' },
        dark: { '--color-primary': '#eeeeee' },
      },
      { rootSelector: '[data-studio-canvas="x"]' }
    );

    // The frame carried `data-theme={theme.name}` — "workshop" here. It is not
    // "light", so on a dark-mode machine this rule applied and every page, layout
    // and piece painted the theme's NIGHT colors while the theme pane showed day.
    expect(css).toContain('@media (prefers-color-scheme:dark)');
    expect(css).toContain(':not([data-theme="light"])');
    expect(css).not.toContain('data-theme="workshop"');
  });
});
