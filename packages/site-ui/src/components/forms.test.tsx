import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './input';
import { Textarea } from './textarea';
import { NativeSelect } from './native-select';
import { Checkbox } from './checkbox';
import { Radio, RadioGroup } from './radio';
import { Switch } from './switch';
import { Field } from './field';

describe('Input', () => {
  it('renders with the color (focus accent) + size classes and forwards props', () => {
    render(<Input name="email" placeholder="you@test" size="lg" />);
    const el = screen.getByPlaceholderText('you@test');
    expect(el.tagName).toBe('INPUT');
    expect(el).toHaveClass('sf-input', 'sf-c-primary', 'sf-input--sz-lg');
    expect(el).toHaveAttribute('name', 'email');
  });

  it('maps the ghost treatment and the invalid (danger) state', () => {
    render(<Input variant="ghost" invalid aria-label="x" />);
    const el = screen.getByLabelText('x');
    expect(el).toHaveClass('sf-fv-ghost', 'sf-input--invalid');
    expect(el).toHaveAttribute('aria-invalid', 'true');
  });

  it('defaults to the outline treatment', () => {
    render(<Input aria-label="y" />);
    expect(screen.getByLabelText('y')).toHaveClass('sf-fv-outline');
  });
});

describe('Textarea', () => {
  it('shares the input base + textarea class and forwards rows', () => {
    render(<Textarea aria-label="bio" rows={5} />);
    const el = screen.getByLabelText('bio');
    expect(el.tagName).toBe('TEXTAREA');
    expect(el).toHaveClass('sf-input', 'sf-textarea');
    expect(el).toHaveAttribute('rows', '5');
  });
});

describe('NativeSelect', () => {
  it('wraps a styled <select> with a chevron and renders options', () => {
    const { container } = render(
      <NativeSelect aria-label="qty" invalid>
        <option value="1">1</option>
        <option value="2">2</option>
      </NativeSelect>
    );
    const select = screen.getByLabelText('qty');
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveClass('sf-input', 'sf-select', 'sf-input--invalid');
    expect(container.querySelector('.sf-select__chevron')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2' })).toBeInTheDocument();
  });
});

describe('Checkbox / Radio / Switch', () => {
  it('renders a checkbox with the color + size classes', () => {
    render(<Checkbox color="success" size="lg" aria-label="agree" />);
    const el = screen.getByLabelText('agree');
    expect(el).toHaveAttribute('type', 'checkbox');
    expect(el).toHaveClass('sf-checkbox', 'sf-c-success', 'sf-checkbox--sz-lg');
  });

  it('renders radios inside a radiogroup', () => {
    render(
      <RadioGroup orientation="horizontal" aria-label="size">
        <Radio name="size" value="s" aria-label="S" />
        <Radio name="size" value="m" aria-label="M" />
      </RadioGroup>
    );
    const group = screen.getByRole('radiogroup', { name: 'size' });
    expect(group).toHaveClass('sf-radio-group', 'sf-radio-group--horizontal');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveClass('sf-radio', 'sf-c-primary');
  });

  it('renders a switch with role=switch', () => {
    render(<Switch color="accent" aria-label="notifications" />);
    const el = screen.getByRole('switch', { name: 'notifications' });
    expect(el).toHaveClass('sf-switch', 'sf-c-accent');
  });
});

describe('Field', () => {
  it('renders a label wired to the control and a hint', () => {
    render(
      <Field label="Email" htmlFor="email" hint="We never share it." required>
        <Input id="email" />
      </Field>
    );
    const label = screen.getByText('Email').closest('label');
    expect(label).toHaveAttribute('for', 'email');
    expect(screen.getByText('We never share it.')).toHaveClass('sf-field__hint');
  });

  it('shows the error instead of the hint when present', () => {
    const { container } = render(
      <Field label="Email" htmlFor="email" hint="hint text" error="Required">
        <Input id="email" invalid />
      </Field>
    );
    expect(screen.getByText('Required')).toHaveClass('sf-field__error');
    expect(container.querySelector('.sf-field__hint')).toBeNull();
  });
});
