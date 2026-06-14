import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Heading, type HeadingLevel } from './heading';
import { Text, type TextVariant } from './text';
import { Divider } from './divider';
import { PriceTag } from './price-tag';
import { Image } from './image';
import { Logo } from './logo';
import { NavMenu } from './nav-menu';
import { SocialLinks } from './social-links';
import { Stat } from './stat';

describe('Heading', () => {
  it('renders the matching tag + size class per level', () => {
    const cases: Record<HeadingLevel, string> = { h1: 'st-h--1', h2: 'st-h--2', h3: 'st-h--3' };
    for (const [level, cls] of Object.entries(cases) as [HeadingLevel, string][]) {
      const { unmount } = render(<Heading level={level}>{level}</Heading>);
      const el = screen.getByText(level);
      expect(el.tagName).toBe(level.toUpperCase());
      expect(el).toHaveClass('st-h', cls);
      unmount();
    }
  });

  it('defaults to h2', () => {
    render(<Heading>Title</Heading>);
    expect(screen.getByText('Title').tagName).toBe('H2');
  });
});

describe('Text', () => {
  it('maps each variant to its class on a <p>', () => {
    const cases: Record<TextVariant, string> = {
      body: 'st-text--body',
      eyebrow: 'st-text--eyebrow',
      meta: 'st-text--meta',
    };
    for (const [variant, cls] of Object.entries(cases) as [TextVariant, string][]) {
      const { unmount } = render(<Text variant={variant}>{variant}</Text>);
      const el = screen.getByText(variant);
      expect(el.tagName).toBe('P');
      expect(el).toHaveClass('st-text', cls);
      unmount();
    }
  });
});

describe('Divider', () => {
  it('renders an <hr> with the divider class', () => {
    const { container } = render(<Divider />);
    const hr = container.querySelector('hr');
    expect(hr).toHaveClass('st-divider');
  });
});

describe('PriceTag', () => {
  it('formats a finite amount with the currency symbol', () => {
    render(<PriceTag amount={12.5} />);
    expect(screen.getByText('$12.50')).toBeInTheDocument();
  });

  it('renders nothing for a missing amount', () => {
    const { container } = render(<PriceTag amount={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Image', () => {
  it('renders an <img> when src is set', () => {
    render(<Image src="/hero.jpg" alt="Hero" ratio="square" />);
    const img = screen.getByRole('img', { name: 'Hero' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveClass('st-img', 'st-img--square');
    expect(img).toHaveAttribute('src', '/hero.jpg');
  });

  it('renders an accessible placeholder when src is missing', () => {
    render(<Image alt="Missing" />);
    const ph = screen.getByRole('img', { name: 'Missing' });
    expect(ph.tagName).toBe('DIV');
    expect(ph).toHaveClass('st-img--placeholder', 'st-img--wide');
  });
});

describe('Logo', () => {
  it('renders the wordmark fallback when there is no image', () => {
    render(<Logo name="Acme" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/');
    expect(screen.getByText('Acme')).toHaveClass('st-logo__name');
  });

  it('renders the logo image when src is set', () => {
    render(<Logo name="Acme" src="/logo.svg" />);
    expect(screen.getByRole('img', { name: 'Acme' })).toHaveAttribute('src', '/logo.svg');
  });
});

describe('NavMenu', () => {
  it('renders one link per item and skips empty labels', () => {
    render(
      <NavMenu
        orientation="stack"
        items={[
          { label: 'Home', url: '/' },
          { label: '', url: '/hidden' },
          { label: 'Shop', url: '/shop' },
        ]}
      />
    );
    expect(screen.getByRole('navigation')).toHaveClass('st-nav', 'st-nav--stack');
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/shop');
  });
});

describe('SocialLinks', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<SocialLinks items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels each link by platform', () => {
    render(<SocialLinks items={[{ platform: 'instagram', url: 'https://ig.test' }]} />);
    expect(screen.getByRole('link', { name: 'instagram' })).toHaveAttribute(
      'href',
      'https://ig.test'
    );
  });
});

describe('Stat', () => {
  it('renders value, label, and caption', () => {
    render(<Stat value="396 mi" label="Range" caption="EPA est." />);
    expect(screen.getByText('396 mi')).toHaveClass('st-stat__value');
    expect(screen.getByText('Range')).toHaveClass('st-stat__label');
    expect(screen.getByText('EPA est.')).toHaveClass('st-stat__caption');
  });

  it('omits label/caption when not provided', () => {
    const { container } = render(<Stat value="100%" />);
    expect(container.querySelector('.st-stat__label')).toBeNull();
    expect(container.querySelector('.st-stat__caption')).toBeNull();
  });
});
