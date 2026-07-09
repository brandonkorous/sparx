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
