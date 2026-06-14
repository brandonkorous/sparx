import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardBody, CardTitle, CardActions } from './card';

describe('Card', () => {
  it('renders the default card container', () => {
    const { container } = render(<Card>content</Card>);
    const el = container.querySelector('.st-card');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('st-card', 'st-card--sz-md');
  });

  it('maps the style axis to border / dash classes', () => {
    const { container, rerender } = render(<Card border="solid">x</Card>);
    expect(container.querySelector('.st-card')).toHaveClass('st-card--border');
    rerender(<Card border="dashed">x</Card>);
    expect(container.querySelector('.st-card')).toHaveClass('st-card--dash');
  });

  it('maps the modifier axis to side / image-full classes', () => {
    const { container, rerender } = render(<Card modifier="side">x</Card>);
    expect(container.querySelector('.st-card')).toHaveClass('st-card--side');
    rerender(<Card modifier="image-full">x</Card>);
    expect(container.querySelector('.st-card')).toHaveClass('st-card--image-full');
  });

  it('maps color to the shared role-var class and the xs…xl size scale', () => {
    const { container } = render(
      <Card color="primary" size="xl">
        x
      </Card>
    );
    expect(container.querySelector('.st-card')).toHaveClass('st-c-primary', 'st-card--sz-xl');
  });

  it('renders parts with their semantic classes via the compound API', () => {
    render(
      <Card>
        <Card.Body>
          <Card.Title>Model 3</Card.Title>
          <Card.Actions>
            <button>Order</button>
          </Card.Actions>
        </Card.Body>
      </Card>
    );
    const title = screen.getByText('Model 3');
    expect(title).toHaveClass('st-card-title');
    expect(title.tagName).toBe('H3');
    expect(screen.getByRole('button', { name: 'Order' }).parentElement).toHaveClass(
      'st-card-actions'
    );
  });

  it('exposes the parts as named exports, with a configurable title level', () => {
    render(
      <CardBody>
        <CardTitle as="h2">Title</CardTitle>
        <CardActions>actions</CardActions>
      </CardBody>
    );
    const title = screen.getByText('Title');
    expect(title.tagName).toBe('H2');
    expect(title).toHaveClass('st-card-title');
  });
});
