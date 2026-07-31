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
    // The tint is silica's universal `soft` treatment over the `module` color,
    // so it follows the nearest <ModuleProvider>. No top stripe, and no
    // hand-rolled color-mix — the mix percentage lives in silica.
    expect(card.className).toContain('bg-module');
    expect(card.className).toContain('bg-soft');
    expect(card.className).not.toMatch(/border-t-\[3px\]/);
  });

  it('recolors the module tint via the accent prop', () => {
    const { container } = render(<Card variant="module" accent="commerce" />);
    const card = container.firstElementChild as HTMLElement;
    // A per-module accent resolves to that module's PLUGIN color name, which
    // carries the `module-` prefix each app registers it under.
    expect(card.className).toContain('bg-module-commerce');
    expect(card.className).toContain('bg-soft');
  });

  it('names a semantic accent without the module- prefix', () => {
    const { container } = render(<Card variant="module" accent="success" />);
    expect((container.firstElementChild as HTMLElement).className).toContain('bg-success');
  });

  it('sets no inline style — the tint is a class, never a custom property', () => {
    const { container } = render(<Card variant="module" accent="commerce" />);
    expect(container.firstElementChild).not.toHaveAttribute('style');
  });

  it('omits the module tint on the default variant', () => {
    const { container } = render(<Card />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).not.toContain('bg-soft');
  });

  it('passes through arbitrary HTML attributes', () => {
    render(<Card data-testid="custom" aria-label="settings card" />);
    const card = screen.getByTestId('custom');
    expect(card).toHaveAttribute('aria-label', 'settings card');
  });
});
