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

  it('applies the 3px module top stripe on variant="module"', () => {
    const { container } = render(<Card variant="module" data-testid="card" />);
    const card = container.firstElementChild as HTMLElement;
    // The stripe is the brand pattern from doc 23 §1; pinning the classes is
    // intentional. With no accent the stripe reads --module-active DIRECTLY so it
    // follows the nearest <ModuleProvider> and is immune to an inherited --c-bg.
    expect(card.className).toMatch(/border-t-\[3px\]/);
    expect(card.className).toMatch(/border-t-\[var\(--module-active\)\]/);
    // It must NOT read the shared --c-bg role var when un-accented (the leak path).
    expect(card.className).not.toMatch(/var\(--c-bg/);
  });

  it('recolors the module stripe via the accent prop', () => {
    const { container } = render(<Card variant="module" accent="commerce" />);
    const card = container.firstElementChild as HTMLElement;
    // accent sets --c-bg ON this card via its role class, so the stripe reads it.
    expect(card.className).toMatch(/sx-c-commerce/);
    expect(card.className).toMatch(/border-t-\[var\(--c-bg\)\]/);
  });

  it('omits the stripe on the default variant', () => {
    const { container } = render(<Card />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).not.toMatch(/border-t-\[3px\]/);
  });

  it('passes through arbitrary HTML attributes', () => {
    render(<Card data-testid="custom" aria-label="settings card" />);
    const card = screen.getByTestId('custom');
    expect(card).toHaveAttribute('aria-label', 'settings card');
  });
});
