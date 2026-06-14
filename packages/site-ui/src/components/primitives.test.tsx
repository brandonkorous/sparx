import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';
import { Tag } from './tag';
import { Alert, AlertIcon, AlertTitle, AlertBody } from './alert';
import { Callout } from './callout';
import { Avatar, initials } from './avatar';
import { Label } from './label';
import { type ChipTreatmentKey, type ColorKey } from './_recipes/variants';

describe('Badge', () => {
  it('renders the default neutral/solid/md badge', () => {
    render(<Badge>New</Badge>);
    const el = screen.getByText('New');
    expect(el).toHaveClass('st-badge', 'st-c-neutral', 'st-v-solid', 'st-badge--sz-md');
  });

  it('maps color × chip treatment × size', () => {
    const colors: ColorKey[] = ['primary', 'success', 'danger', 'highlight'];
    for (const color of colors) {
      const { unmount } = render(<Badge color={color}>{color}</Badge>);
      expect(screen.getByText(color)).toHaveClass(`st-c-${color}`);
      unmount();
    }
    const variants: ChipTreatmentKey[] = ['solid', 'soft', 'outline', 'dashed'];
    for (const variant of variants) {
      const { unmount } = render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toHaveClass(`st-v-${variant}`);
      unmount();
    }
  });
});

describe('Tag', () => {
  it('defaults to neutral/soft and renders an optional dot', () => {
    const { container, rerender } = render(<Tag>Filter</Tag>);
    expect(screen.getByText('Filter')).toHaveClass('st-tag', 'st-c-neutral', 'st-v-soft');
    expect(container.querySelector('.st-tag__dot')).toBeNull();
    rerender(<Tag dot>Filter</Tag>);
    expect(container.querySelector('.st-tag__dot')).toBeInTheDocument();
  });
});

describe('Alert', () => {
  it('renders an alert role with color × treatment and the vertical modifier', () => {
    const { container, rerender } = render(<Alert>Heads up</Alert>);
    const el = screen.getByRole('alert');
    expect(el).toHaveClass('st-alert', 'st-c-info', 'st-v-soft');
    expect(el).not.toHaveClass('st-alert--vertical');
    rerender(
      <Alert color="warning" variant="outline" vertical>
        x
      </Alert>
    );
    expect(container.querySelector('.st-alert')).toHaveClass(
      'st-c-warning',
      'st-v-outline',
      'st-alert--vertical'
    );
  });

  it('exposes Icon/Title/Body via the compound API and as named exports', () => {
    render(
      <Alert>
        <Alert.Icon>!</Alert.Icon>
        <Alert.Body>
          <Alert.Title>Saved</Alert.Title>
          Done.
        </Alert.Body>
      </Alert>
    );
    expect(screen.getByText('Saved')).toHaveClass('st-alert__title');
    expect(screen.getByText('Done.')).toHaveClass('st-alert__body');

    const { container } = render(
      <div>
        <AlertIcon>i</AlertIcon>
        <AlertTitle>T</AlertTitle>
        <AlertBody>B</AlertBody>
      </div>
    );
    expect(container.querySelector('.st-alert__icon')).toBeInTheDocument();
    expect(container.querySelector('.st-alert__title')).toBeInTheDocument();
    expect(container.querySelector('.st-alert__body')).toBeInTheDocument();
  });
});

describe('Callout', () => {
  it('maps color × treatment and renders the title + body', () => {
    const { container } = render(
      <Callout color="success" variant="outline" title="Tip">
        Body copy
      </Callout>
    );
    expect(container.querySelector('.st-callout')).toHaveClass('st-c-success', 'st-v-outline');
    expect(screen.getByText('Tip')).toHaveClass('st-callout__title');
    expect(screen.getByText('Body copy')).toHaveClass('st-callout__body');
  });
});

describe('Avatar', () => {
  it('derives initials from a name', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('Cher')).toBe('C');
    expect(initials('  ')).toBe('');
    expect(initials(undefined)).toBe('');
  });

  it('renders an image when src is set', () => {
    render(<Avatar src="/me.jpg" name="Ada Lovelace" size="lg" shape="rounded" />);
    const img = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', '/me.jpg');
    expect(img.parentElement).toHaveClass('st-avatar', 'st-avatar--sz-lg', 'st-avatar--rounded');
  });

  it('renders an initials placeholder with the color role var when there is no image', () => {
    render(<Avatar name="Ada Lovelace" color="primary" />);
    const ph = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(ph.tagName).toBe('SPAN');
    expect(ph).toHaveClass('st-avatar--placeholder', 'st-c-primary');
    expect(screen.getByText('AL')).toHaveClass('st-avatar__initials');
  });

  it('renders a presence status dot', () => {
    const { container } = render(<Avatar name="Ada" status="online" />);
    expect(container.querySelector('.st-avatar__status--online')).toBeInTheDocument();
  });
});

describe('Label', () => {
  it('renders a <label> wired to a control with an optional required marker', () => {
    const { container, rerender } = render(<Label htmlFor="email">Email</Label>);
    const label = container.querySelector<HTMLLabelElement>('label.st-label')!;
    expect(label).toHaveAttribute('for', 'email');
    expect(container.querySelector('.st-label__required')).toBeNull();
    rerender(
      <Label htmlFor="email" required>
        Email
      </Label>
    );
    expect(container.querySelector('.st-label__required')).toBeInTheDocument();
  });
});
