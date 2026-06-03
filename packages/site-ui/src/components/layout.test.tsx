import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Section } from './section';
import { Container } from './container';
import { Grid } from './grid';
import { Stack } from './stack';

describe('Section', () => {
  it('renders a <section> with default contained inner + padding', () => {
    const { container } = render(<Section>content</Section>);
    const sec = container.querySelector('section.sf-section');
    expect(sec).toBeInTheDocument();
    expect(sec).toHaveClass('sf-section--pad-lg');
    expect(container.querySelector('.sf-section__inner')).toHaveClass(
      'sf-section__inner--contained'
    );
  });

  it('maps the surface color to the shared role-var class', () => {
    const { container } = render(<Section surface="primary">x</Section>);
    expect(container.querySelector('.sf-section')).toHaveClass('sf-c-primary');
  });

  it('switches the inner to full-bleed and maps the padding scale', () => {
    const { container } = render(
      <Section contentWidth="full" padding="xs">
        x
      </Section>
    );
    expect(container.querySelector('.sf-section')).toHaveClass('sf-section--pad-xs');
    expect(container.querySelector('.sf-section__inner')).toHaveClass('sf-section__inner--full');
  });

  it('composes a background image via photoPanelStyle when image is set', () => {
    const { container } = render(
      <Section image="https://cdn.test/hero.jpg" overlay="dark" tone="light">
        x
      </Section>
    );
    const sec = container.querySelector<HTMLElement>('.sf-section')!;
    expect(sec.style.backgroundImage).toContain('hero.jpg');
    expect(sec.style.color).toBe('rgb(255, 255, 255)');
  });

  it('renders a custom element via `as`', () => {
    const { container } = render(<Section as="header">x</Section>);
    expect(container.querySelector('header.sf-section')).toBeInTheDocument();
  });
});

describe('Container', () => {
  it('defaults to the lg (token) width', () => {
    const { container } = render(<Container>x</Container>);
    expect(container.querySelector('.sf-container')).toHaveClass('sf-container--lg');
  });

  it('maps each width to its class', () => {
    const widths = ['sm', 'md', 'lg', 'full'] as const;
    for (const w of widths) {
      const { container, unmount } = render(<Container width={w}>x</Container>);
      expect(container.querySelector('.sf-container')).toHaveClass(`sf-container--${w}`);
      unmount();
    }
  });
});

describe('Grid', () => {
  it('renders the default 3-col / md gap grid', () => {
    const { container } = render(<Grid>x</Grid>);
    const el = container.querySelector('.sf-grid');
    expect(el).toHaveClass('sf-grid--cols-3', 'sf-grid--gap-md');
    expect(el).not.toHaveClass('sf-grid--fixed');
  });

  it('maps cols + gap + the fixed (non-responsive) modifier', () => {
    const { container } = render(
      <Grid cols={4} gap="lg" responsive={false}>
        x
      </Grid>
    );
    expect(container.querySelector('.sf-grid')).toHaveClass(
      'sf-grid--cols-4',
      'sf-grid--gap-lg',
      'sf-grid--fixed'
    );
  });
});

describe('Stack', () => {
  it('defaults to a vertical md-gap stack', () => {
    const { container } = render(<Stack>x</Stack>);
    expect(container.querySelector('.sf-stack')).toHaveClass(
      'sf-stack--vertical',
      'sf-stack--gap-md'
    );
  });

  it('maps direction, align, justify, and wrap', () => {
    const { container } = render(
      <Stack direction="horizontal" align="center" justify="between" wrap>
        x
      </Stack>
    );
    expect(container.querySelector('.sf-stack')).toHaveClass(
      'sf-stack--horizontal',
      'sf-stack--align-center',
      'sf-stack--justify-between',
      'sf-stack--wrap'
    );
  });

  it('renders via a custom element using the children', () => {
    render(
      <Stack as="nav">
        <span>nav child</span>
      </Stack>
    );
    expect(screen.getByText('nav child')).toBeInTheDocument();
  });
});
