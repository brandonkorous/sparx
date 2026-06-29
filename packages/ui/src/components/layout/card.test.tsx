import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './card';

describe('Card', () => {
  it('renders header / title / content / footer composition', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Hello</CardTitle>
        </CardHeader>
        <CardContent>Body text</CardContent>
        <CardFooter>Footer text</CardFooter>
      </Card>
    );
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
    expect(screen.getByText('Footer text')).toBeInTheDocument();
  });

  it('tints the background with the active module on variant="module"', () => {
    const { container } = render(<Card variant="module" data-testid="card" />);
    const card = container.firstElementChild as HTMLElement;
    // The module card mixes its module color into the surface as the whole
    // background (no top stripe). With no accent it reads --module-active DIRECTLY
    // so it follows the nearest <ModuleProvider> and is immune to an inherited
    // --c-bg.
    expect(card.className).toMatch(/bg-\[color-mix\(in_oklab,var\(--module-active\)_\d+%/);
    expect(card.className).not.toMatch(/border-t-\[3px\]/);
    // It must NOT read the shared, inheritable --c-bg role var when un-accented
    // (the leak path).
    expect(card.className).not.toMatch(/var\(--c-bg/);
  });

  it('recolors the module tint via the accent prop', () => {
    const { container } = render(<Card variant="module" accent="commerce" />);
    const card = container.firstElementChild as HTMLElement;
    // accent sets --c-bg ON this card via its role class, so the mix reads it.
    expect(card.className).toMatch(/sx-c-commerce/);
    expect(card.className).toMatch(/bg-\[color-mix\(in_oklab,var\(--c-bg\)_\d+%/);
  });

  it('omits the module tint on the default variant', () => {
    const { container } = render(<Card />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).not.toMatch(/color-mix/);
  });

  it('passes through arbitrary HTML attributes', () => {
    render(<Card data-testid="custom" aria-label="settings card" />);
    const card = screen.getByTestId('custom');
    expect(card).toHaveAttribute('aria-label', 'settings card');
  });
});
