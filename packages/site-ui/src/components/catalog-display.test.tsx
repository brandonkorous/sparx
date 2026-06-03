import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Countdown } from './countdown';
import { Diff } from './diff';
import { Hover3DCard } from './hover-3d-card';
import { HoverGallery } from './hover-gallery';
import { TextRotate } from './text-rotate';
import { Swap } from './swap';
import { FAB } from './fab';
import { Calendar, calendarMonth } from './calendar';
import { FileInput } from './file-input';
import { Filter } from './filter';
import { Validator } from './validator';

describe('Countdown', () => {
  it('renders only the provided units, zero-padded', () => {
    const { container } = render(<Countdown hours={9} minutes={5} />);
    expect(container.querySelectorAll('.sf-countdown__unit')).toHaveLength(2);
    expect(screen.getByText('09')).toBeInTheDocument();
    expect(screen.getByText('05')).toBeInTheDocument();
  });
});

describe('Diff', () => {
  it('renders the two items and resizer', () => {
    const { container } = render(
      <Diff>
        <Diff.Item1>a</Diff.Item1>
        <Diff.Item2>b</Diff.Item2>
        <Diff.Resizer />
      </Diff>
    );
    expect(container.querySelector('.sf-diff__item-1')).toHaveTextContent('a');
    expect(container.querySelector('.sf-diff__item-2')).toHaveTextContent('b');
    expect(container.querySelector('.sf-diff__resizer')).toBeInTheDocument();
  });
});

describe('Hover3DCard', () => {
  it('wraps content in the tilt inner', () => {
    const { container } = render(<Hover3DCard>card</Hover3DCard>);
    expect(container.querySelector('.sf-card3d__inner')).toHaveTextContent('card');
  });
});

describe('HoverGallery', () => {
  it('renders the first image as the main and a thumb per image', () => {
    const { container } = render(
      <HoverGallery
        images={[
          { src: '/a.jpg', alt: 'A' },
          { src: '/b.jpg', alt: 'B' },
        ]}
      />
    );
    expect(container.querySelector('.sf-hovergallery__img')).toHaveAttribute('src', '/a.jpg');
    expect(container.querySelectorAll('.sf-hovergallery__thumb')).toHaveLength(2);
  });
});

describe('TextRotate', () => {
  it('renders the first phrase', () => {
    render(<TextRotate items={['one', 'two']} />);
    expect(screen.getByText('one')).toHaveClass('sf-textrotate__item');
  });
});

describe('Swap', () => {
  it('renders a checkbox with on/off content', () => {
    const { container } = render(<Swap animation="rotate" on="ON" off="OFF" defaultChecked />);
    expect(container.querySelector('.sf-swap')).toHaveClass('sf-swap--rotate');
    expect(container.querySelector('.sf-swap__input')).toBeChecked();
    expect(screen.getByText('ON')).toHaveClass('sf-swap__on');
    expect(screen.getByText('OFF')).toHaveClass('sf-swap__off');
  });
});

describe('FAB', () => {
  it('renders the main button with the recipe + placement and reveals actions', () => {
    const { container } = render(
      <FAB aria-label="Add" placement="bottom-start" color="accent" actions={<span>act</span>}>
        +
      </FAB>
    );
    expect(container.querySelector('.sf-fab')).toHaveClass('sf-fab--bottom-start');
    expect(screen.getByRole('button', { name: 'Add' })).toHaveClass(
      'sf-fab__main',
      'sf-c-accent',
      'sf-v-solid'
    );
    expect(container.querySelector('.sf-fab__actions')).toHaveTextContent('act');
  });
});

describe('Calendar', () => {
  it('calendarMonth lays out a full month padded to weeks', () => {
    const cells = calendarMonth(2026, 5); // June 2026 — 30 days
    expect(cells.length % 7).toBe(0);
    expect(cells.filter((d) => d != null)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it('marks today and selected', () => {
    const { container } = render(<Calendar year={2026} month={5} today={2} selected={15} />);
    expect(container.querySelector('.sf-calendar__cell--today')).toHaveTextContent('2');
    expect(container.querySelector('.sf-calendar__cell--selected')).toHaveTextContent('15');
  });
});

describe('FileInput', () => {
  it('renders a styled file input with color + size', () => {
    render(<FileInput color="success" size="lg" aria-label="upload" />);
    const el = screen.getByLabelText('upload');
    expect(el).toHaveAttribute('type', 'file');
    expect(el).toHaveClass('sf-file', 'sf-c-success', 'sf-file--sz-lg');
  });
});

describe('Filter', () => {
  it('checks the reset chip when there is no value', () => {
    render(
      <Filter
        name="cat"
        color="primary"
        options={[
          { label: 'New', value: 'new' },
          { label: 'Sale', value: 'sale' },
        ]}
      />
    );
    expect(screen.getByRole('radiogroup', { name: 'Filter' })).toHaveClass(
      'sf-filter',
      'sf-c-primary'
    );
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });
});

describe('Validator', () => {
  it('renders the control and a hint element', () => {
    const { container } = render(
      <Validator hint="Required">
        <input required />
      </Validator>
    );
    expect(container.querySelector('.sf-validator')).toBeInTheDocument();
    expect(screen.getByText('Required')).toHaveClass('sf-validator__hint');
  });
});
