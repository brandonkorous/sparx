import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';
import { type ColorKey, type SizeKey, type TreatmentKey } from './_recipes/variants';

describe('Button', () => {
  it('renders a <button> with the default four-axis classes', () => {
    render(<Button>Order now</Button>);
    const el = screen.getByRole('button', { name: 'Order now' });
    expect(el.tagName).toBe('BUTTON');
    expect(el).toHaveClass('sf-btn', 'sf-c-primary', 'sf-v-solid', 'sf-btn--sz-md');
    expect(el).toHaveAttribute('type', 'button');
  });

  it('maps the color axis to a sf-c-{color} role-var class', () => {
    const colors: ColorKey[] = [
      'primary',
      'secondary',
      'accent',
      'neutral',
      'info',
      'success',
      'warning',
      'danger',
      'surface',
    ];
    for (const color of colors) {
      const { unmount } = render(<Button color={color}>{color}</Button>);
      expect(screen.getByRole('button', { name: color })).toHaveClass(`sf-c-${color}`);
      unmount();
    }
  });

  it('accepts a runtime custom color name', () => {
    render(<Button color="brand-mint">Custom</Button>);
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveClass('sf-c-brand-mint');
  });

  it('maps the variant axis to a shared sf-v-{variant} treatment class', () => {
    const variants: TreatmentKey[] = [
      'solid',
      'soft',
      'outline',
      'dashed',
      'ghost',
      'link',
      'glass',
    ];
    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole('button', { name: variant })).toHaveClass(`sf-v-${variant}`);
      unmount();
    }
  });

  it('maps the size axis to a sf-btn--sz-{size} class', () => {
    const sizes: SizeKey[] = ['sm', 'md', 'lg'];
    for (const size of sizes) {
      const { unmount } = render(<Button size={size}>{size}</Button>);
      expect(screen.getByRole('button', { name: size })).toHaveClass(`sf-btn--sz-${size}`);
      unmount();
    }
  });

  it('composes the old scrim CTAs as glass × neutral and glass × surface', () => {
    render(
      <>
        <Button variant="glass" color="neutral">
          Order Now
        </Button>
        <Button variant="glass" color="surface">
          Learn More
        </Button>
      </>
    );
    expect(screen.getByRole('button', { name: 'Order Now' })).toHaveClass(
      'sf-v-glass',
      'sf-c-neutral'
    );
    expect(screen.getByRole('button', { name: 'Learn More' })).toHaveClass(
      'sf-v-glass',
      'sf-c-surface'
    );
  });

  it('renders an <a> when href is set, carrying the same classes', () => {
    render(
      <Button href="/order" color="neutral" variant="glass" target="_blank" rel="noopener">
        Reserve
      </Button>
    );
    const el = screen.getByRole('link', { name: 'Reserve' });
    expect(el.tagName).toBe('A');
    expect(el).toHaveAttribute('href', '/order');
    expect(el).toHaveAttribute('target', '_blank');
    expect(el).toHaveClass('sf-btn', 'sf-c-neutral', 'sf-v-glass');
    expect(el).not.toHaveAttribute('type');
  });

  it('respects an explicit native button type', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit');
  });

  it('merges a caller className and forwards aria-label', () => {
    render(
      <Button className="mt-4" aria-label="Buy">
        Buy
      </Button>
    );
    expect(screen.getByRole('button', { name: 'Buy' })).toHaveClass(
      'sf-btn',
      'sf-c-primary',
      'mt-4'
    );
  });
});
