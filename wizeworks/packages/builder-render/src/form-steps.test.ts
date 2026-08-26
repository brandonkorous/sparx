// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { formSteps, showStep, stepIsValid, valuesUpTo } from './form-steps';

/** The shape the multi-step catalog entry produces: a real form whose step
 *  containers carry the walker's `data-sx-item` marker. */
function mount(html: string): HTMLFormElement {
  document.body.innerHTML = `<form>${html}</form>`;
  return document.body.firstElementChild as HTMLFormElement;
}

const THREE_STEPS = `
  <div data-sx-item>
    <input name="name" value="Jordan Avery" />
    <input name="email" type="email" value="jordan@example.com" />
  </div>
  <div data-sx-item>
    <input name="phone" value="555-0199" />
  </div>
  <div data-sx-item>
    <textarea name="message"></textarea>
  </div>`;

describe('formSteps — finding the steps', () => {
  it('finds the marked containers in document order', () => {
    const steps = formSteps(mount(THREE_STEPS));
    expect(steps).toHaveLength(3);
    expect(steps[0]!.querySelector('input')!.name).toBe('name');
  });

  it('finds none in an ordinary form, which is what keeps those unchanged', () => {
    expect(formSteps(mount('<input name="email" />'))).toHaveLength(0);
  });

  it('ignores an item belonging to some other behavior', () => {
    document.body.innerHTML = `
      <div data-sx-item>not in the form</div>
      <form><div data-sx-item><input name="email" /></div></form>`;
    const form = document.body.querySelector('form')!;
    expect(formSteps(form)).toHaveLength(1);
  });
});

describe('showStep — one at a time', () => {
  it('shows only the active step', () => {
    const steps = formSteps(mount(THREE_STEPS));
    showStep(steps, 1);
    expect(steps.map((s) => s.hidden)).toEqual([true, false, true]);
  });

  it('hides rather than unmounts, so going back finds the answers still there', () => {
    const form = mount(THREE_STEPS);
    const steps = formSteps(form);
    showStep(steps, 2);
    // The first step is hidden, but its input is still in the form and still
    // holds what was typed — which is also why the final FormData sees it.
    expect(form.querySelector<HTMLInputElement>('[name="email"]')!.value).toBe(
      'jordan@example.com'
    );
    expect(new FormData(form).get('email')).toBe('jordan@example.com');
  });
});

describe('stepIsValid — only what they can see', () => {
  it('passes when the visible fields are filled', () => {
    const steps = formSteps(mount(THREE_STEPS));
    expect(stepIsValid(steps[0])).toBe(true);
  });

  it('fails on a required field on the visible step', () => {
    const steps = formSteps(
      mount('<div data-sx-item><input name="email" required value="" /></div>')
    );
    expect(stepIsValid(steps[0])).toBe(false);
  });

  it('ignores a required field on a step nobody has been shown yet', () => {
    const steps = formSteps(
      mount(`
        <div data-sx-item><input name="email" type="email" value="a@b.com" /></div>
        <div data-sx-item><input name="detail" required value="" /></div>`)
    );
    // Otherwise the form refuses to advance and shows no reason why, because the
    // offending field is three screens away.
    expect(stepIsValid(steps[0])).toBe(true);
  });

  it('treats a form with no steps as valid', () => {
    expect(stepIsValid(undefined)).toBe(true);
  });
});

describe('valuesUpTo — only what they have actually answered', () => {
  it('collects the completed steps', () => {
    const steps = formSteps(mount(THREE_STEPS));
    expect(valuesUpTo(steps, 1)).toEqual({
      name: 'Jordan Avery',
      email: 'jordan@example.com',
      phone: '555-0199',
    });
  });

  it('does not reach forward into steps they have not filled in', () => {
    const steps = formSteps(mount(THREE_STEPS));
    expect(valuesUpTo(steps, 0)).toEqual({
      name: 'Jordan Avery',
      email: 'jordan@example.com',
    });
  });

  it('omits empty fields rather than sending blanks', () => {
    const steps = formSteps(mount(THREE_STEPS));
    // Sending `message: ''` would blank a real answer when a resumed form
    // merges this over what is already stored.
    expect(valuesUpTo(steps, 2)).not.toHaveProperty('message');
  });

  it('skips an unchecked box and keeps a checked one', () => {
    const steps = formSteps(
      mount(`
        <div data-sx-item>
          <input name="wants" type="checkbox" value="calls" />
          <input name="wants" type="checkbox" value="email" checked />
        </div>`)
    );
    expect(valuesUpTo(steps, 0)).toEqual({ wants: 'email' });
  });

  it('accumulates a repeated name the way the final submit does', () => {
    const steps = formSteps(
      mount(`
        <div data-sx-item>
          <input name="wants" type="checkbox" value="calls" checked />
          <input name="wants" type="checkbox" value="email" checked />
        </div>`)
    );
    expect(valuesUpTo(steps, 0)).toEqual({ wants: 'calls, email' });
  });

  it('skips a file input, which has no value worth recording', () => {
    const steps = formSteps(
      mount(
        '<div data-sx-item><input name="plan" type="file" /><input name="email" value="a@b.com" /></div>'
      )
    );
    expect(valuesUpTo(steps, 0)).toEqual({ email: 'a@b.com' });
  });

  it('trims, so a field of spaces is not mistaken for an answer', () => {
    const steps = formSteps(mount('<div data-sx-item><input name="name" value="   " /></div>'));
    expect(valuesUpTo(steps, 0)).toEqual({});
  });
});
