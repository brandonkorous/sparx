import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from './text';

describe('Text', () => {
  it('renders as <p> by default', () => {
    render(<Text>body</Text>);
    expect(screen.getByText('body').tagName).toBe('P');
  });

  it('honors `as="label"` and forwards htmlFor', () => {
    render(
      <Text as="label" htmlFor="store-name">
        Store name
      </Text>
    );
    const label = screen.getByText('Store name');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', 'store-name');
  });

  // `muted` / `subtle` are ALIASES for the real ink, not a fading scale: opacity is a
  // filter, not a color, so `/70` composited against whatever sat behind it — the ink
  // drifted per module on a tinted card and went near-invisible on the neutral inverse
  // panel. Rank is carried by `size` and `weight`. The variant names survive only so
  // ~570 call sites don't churn. These assert the ALIAS, and guard the fade from
  // creeping back in.
  it.each(['muted', 'subtle'] as const)('resolves variant="%s" to the real ink', (variant) => {
    render(<Text variant={variant}>caption</Text>);
    const className = screen.getByText('caption').className;
    expect(className).toMatch(/\btext-base-content\b/);
    expect(className).not.toMatch(/text-base-content\/\d+/);
  });
});
