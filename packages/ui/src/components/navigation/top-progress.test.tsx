import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { TopProgress } from './top-progress';
import { topProgress } from './top-progress-controller';

describe('<TopProgress>', () => {
  afterEach(() => {
    topProgress.reset();
    cleanup();
  });

  it('wears the spectrum palette at platform scope', () => {
    const { container } = render(<TopProgress route="/" intercept={false} />);
    expect(container.querySelector('.sx-topbar--spectrum')).not.toBeNull();
    expect(container.querySelector('.sx-topbar--module')).toBeNull();
  });

  it('wears the module palette inside a module route and points --color-module at it', () => {
    const { container } = render(<TopProgress route="/commerce/products" intercept={false} />);
    const root = container.querySelector<HTMLElement>('.sx-topbar--module')!;
    expect(root).not.toBeNull();
    expect(root.style.getPropertyValue('--color-module')).toBe('var(--color-module-commerce)');
  });

  it('wears the tenant brand at brand tone, never the platform spectrum', () => {
    // A tenant storefront route looks like a platform route (no module segment),
    // so `auto` would fall through to sparx's spectrum. `brand` must not.
    const { container } = render(<TopProgress route="/products" tone="brand" intercept={false} />);
    const root = container.querySelector<HTMLElement>('.sx-topbar--module')!;
    expect(root).not.toBeNull();
    expect(root.style.getPropertyValue('--color-module')).toBe('var(--color-primary)');
    expect(container.querySelector('.sx-topbar--spectrum')).toBeNull();
  });

  it('ignores a module-named route segment at brand tone', () => {
    // `/b2b/...` exists on a storefront too; it must not tint the bar b2b's hue.
    const { container } = render(
      <TopProgress route="/b2b/quotes" tone="brand" intercept={false} />
    );
    const root = container.querySelector<HTMLElement>('.sx-topbar--module')!;
    expect(root.style.getPropertyValue('--color-module')).toBe('var(--color-primary)');
  });

  it('reflects controller activity in the bar width', () => {
    const { container } = render(<TopProgress route="/" intercept={false} />);
    const bar = () => container.querySelector<HTMLElement>('.sx-topbar__bar')!;
    expect(bar().style.width).toBe('0%');
    act(() => {
      topProgress.start();
    });
    expect(bar().style.width).toBe('8%');
    expect(bar().style.opacity).toBe('1');
  });
});
