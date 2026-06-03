import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Browser } from './browser';
import { Code } from './code';
import { Phone } from './phone';
import { Window } from './window';

describe('Browser', () => {
  it('renders the toolbar URL + content', () => {
    const { container } = render(<Browser url="https://sparx.works">page</Browser>);
    expect(container.querySelector('.sf-mockup-browser__url')).toHaveTextContent(
      'https://sparx.works'
    );
    expect(container.querySelector('.sf-mockup-browser__content')).toHaveTextContent('page');
    expect(container.querySelectorAll('.sf-mockup__dots > span')).toHaveLength(3);
  });
});

describe('Code', () => {
  it('renders lines with a gutter prefix + highlight', () => {
    const { container } = render(
      <Code>
        <Code.Line prefix="$">npm i</Code.Line>
        <Code.Line highlight>done</Code.Line>
      </Code>
    );
    const lines = container.querySelectorAll('.sf-mockup-code__line');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute('data-prefix', '$');
    expect(lines[1]).toHaveClass('sf-mockup-code__line--hl');
  });
});

describe('Phone', () => {
  it('renders a camera + display', () => {
    const { container } = render(<Phone>screen</Phone>);
    expect(container.querySelector('.sf-mockup-phone__camera')).toBeInTheDocument();
    expect(container.querySelector('.sf-mockup-phone__display')).toHaveTextContent('screen');
  });
});

describe('Window', () => {
  it('renders the title bar + content', () => {
    const { container } = render(<Window title="Untitled">body</Window>);
    expect(container.querySelector('.sf-mockup-window__title')).toHaveTextContent('Untitled');
    expect(container.querySelector('.sf-mockup-window__content')).toHaveTextContent('body');
  });
});
