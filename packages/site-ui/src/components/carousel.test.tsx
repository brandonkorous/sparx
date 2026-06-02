import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Carousel } from './carousel';

const slides = [<p key="a">Slide A</p>, <p key="b">Slide B</p>, <p key="c">Slide C</p>];

describe('Carousel', () => {
  it('renders nothing with no slides', () => {
    const { container } = render(<Carousel slides={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single slide without arrows or dots', () => {
    render(<Carousel slides={[<p key="only">Only</p>]} />);
    expect(screen.getByText('Only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next slide' })).toBeNull();
  });

  it('advances on the next arrow and marks the active dot', () => {
    render(<Carousel slides={slides} autoplay={false} />);
    const dots = screen.getAllByRole('button', { name: /Go to slide/ });
    expect(dots[0]).toHaveAttribute('aria-current', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(dots[1]).toHaveAttribute('aria-current', 'true');
    expect(dots[0]).toHaveAttribute('aria-current', 'false');
  });

  it('wraps from the first slide backwards to the last', () => {
    render(<Carousel slides={slides} autoplay={false} />);
    const dots = screen.getAllByRole('button', { name: /Go to slide/ });
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(dots[2]).toHaveAttribute('aria-current', 'true');
  });

  it('jumps directly to a dot', () => {
    render(<Carousel slides={slides} autoplay={false} />);
    const dots = screen.getAllByRole('button', { name: /Go to slide/ });
    fireEvent.click(dots[2]!);
    expect(dots[2]).toHaveAttribute('aria-current', 'true');
  });
});
