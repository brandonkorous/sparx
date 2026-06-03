import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Link } from './link';
import { Status } from './status';
import { Kbd } from './kbd';
import { Steps, Step } from './steps';
import { RadialProgress } from './radial-progress';
import { ChatBubble } from './chat-bubble';
import { Range } from './range';
import { Rating } from './rating';

describe('Link', () => {
  it('maps color + underline', () => {
    render(
      <Link href="/x" color="accent" underline="always">
        Go
      </Link>
    );
    const el = screen.getByRole('link', { name: 'Go' });
    expect(el).toHaveClass('sf-link', 'sf-c-accent', 'sf-link--ul-always');
    expect(el).toHaveAttribute('href', '/x');
  });
});

describe('Status', () => {
  it('maps color + size and pulses', () => {
    render(<Status color="success" size="lg" pulse label="Online" />);
    const el = screen.getByRole('status', { name: 'Online' });
    expect(el).toHaveClass('sf-status', 'sf-c-success', 'sf-status--sz-lg', 'sf-status--pulse');
  });
});

describe('Kbd', () => {
  it('renders a key with the size class', () => {
    render(<Kbd size="lg">Esc</Kbd>);
    expect(screen.getByText('Esc')).toHaveClass('sf-kbd', 'sf-kbd--sz-lg');
  });
});

describe('Steps', () => {
  it('maps orientation + color and per-step state', () => {
    const { container } = render(
      <Steps orientation="vertical" color="info">
        <Step state="complete">One</Step>
        <Step state="active">Two</Step>
        <Step>Three</Step>
      </Steps>
    );
    expect(container.querySelector('.sf-steps')).toHaveClass('sf-steps--vertical', 'sf-c-info');
    expect(screen.getByText('One').closest('.sf-step')).toHaveClass('sf-step--complete');
    expect(screen.getByText('Two').closest('.sf-step')).toHaveClass('sf-step--active');
    expect(screen.getByText('Three').closest('.sf-step')).toHaveClass('sf-step--upcoming');
  });
});

describe('RadialProgress', () => {
  it('renders a progressbar with the color class and value var', () => {
    render(<RadialProgress value={30} max={60} color="warning" />);
    const el = screen.getByRole('progressbar');
    expect(el).toHaveClass('sf-radial', 'sf-c-warning');
    expect(el).toHaveAttribute('aria-valuenow', '30');
    expect(el.style.getPropertyValue('--sf-radial-value')).toBe('50');
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});

describe('ChatBubble', () => {
  it('maps placement and a colored message bubble', () => {
    const { container } = render(
      <ChatBubble placement="end">
        <ChatBubble.Message color="primary">Hi</ChatBubble.Message>
      </ChatBubble>
    );
    expect(container.querySelector('.sf-chat')).toHaveClass('sf-chat--end');
    expect(screen.getByText('Hi')).toHaveClass(
      'sf-chat__bubble',
      'sf-c-primary',
      'sf-chat__bubble--colored'
    );
  });
});

describe('Range', () => {
  it('renders a range input with color + size', () => {
    render(<Range color="accent" size="lg" aria-label="vol" />);
    const el = screen.getByLabelText('vol');
    expect(el).toHaveAttribute('type', 'range');
    expect(el).toHaveClass('sf-range', 'sf-c-accent', 'sf-range--sz-lg');
  });
});

describe('Rating', () => {
  it('renders a readOnly display with filled stars', () => {
    const { container } = render(<Rating name="r" value={3} readOnly />);
    expect(container.querySelectorAll('.sf-rating__star')).toHaveLength(5);
    expect(container.querySelectorAll('.sf-rating__star--on')).toHaveLength(3);
  });

  it('renders interactive radios', () => {
    render(<Rating name="stars" count={5} value={4} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(screen.getByRole('radio', { name: '4 stars' })).toBeChecked();
  });
});
