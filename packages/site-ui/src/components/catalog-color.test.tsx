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
    expect(el).toHaveClass('st-link', 'st-c-accent', 'st-link--ul-always');
    expect(el).toHaveAttribute('href', '/x');
  });
});

describe('Status', () => {
  it('maps color + size and pulses', () => {
    render(<Status color="success" size="lg" pulse label="Online" />);
    const el = screen.getByRole('status', { name: 'Online' });
    expect(el).toHaveClass('st-status', 'st-c-success', 'st-status--sz-lg', 'st-status--pulse');
  });
});

describe('Kbd', () => {
  it('renders a key with the size class', () => {
    render(<Kbd size="lg">Esc</Kbd>);
    expect(screen.getByText('Esc')).toHaveClass('st-kbd', 'st-kbd--sz-lg');
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
    expect(container.querySelector('.st-steps')).toHaveClass('st-steps--vertical', 'st-c-info');
    expect(screen.getByText('One').closest('.st-step')).toHaveClass('st-step--complete');
    expect(screen.getByText('Two').closest('.st-step')).toHaveClass('st-step--active');
    expect(screen.getByText('Three').closest('.st-step')).toHaveClass('st-step--upcoming');
  });
});

describe('RadialProgress', () => {
  it('renders a progressbar with the color class and value var', () => {
    render(<RadialProgress value={30} max={60} color="warning" />);
    const el = screen.getByRole('progressbar');
    expect(el).toHaveClass('st-radial', 'st-c-warning');
    expect(el).toHaveAttribute('aria-valuenow', '30');
    expect(el.style.getPropertyValue('--st-radial-value')).toBe('50');
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
    expect(container.querySelector('.st-chat')).toHaveClass('st-chat--end');
    expect(screen.getByText('Hi')).toHaveClass(
      'st-chat__bubble',
      'st-c-primary',
      'st-chat__bubble--colored'
    );
  });
});

describe('Range', () => {
  it('renders a range input with color + size', () => {
    render(<Range color="accent" size="lg" aria-label="vol" />);
    const el = screen.getByLabelText('vol');
    expect(el).toHaveAttribute('type', 'range');
    expect(el).toHaveClass('st-range', 'st-c-accent', 'st-range--sz-lg');
  });
});

describe('Rating', () => {
  it('renders a readOnly display with filled stars', () => {
    const { container } = render(<Rating name="r" value={3} readOnly />);
    expect(container.querySelectorAll('.st-rating__star')).toHaveLength(5);
    expect(container.querySelectorAll('.st-rating__star--on')).toHaveLength(3);
  });

  it('renders interactive radios', () => {
    render(<Rating name="stars" count={5} value={4} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(screen.getByRole('radio', { name: '4 stars' })).toBeChecked();
  });
});
