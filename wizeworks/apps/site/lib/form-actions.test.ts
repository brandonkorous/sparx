import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTACT_FORM_ACTIONS as SERVER_CONTACT_ACTIONS } from '@wizeworks/builder-schemas';
import {
  CONTACT_FORM_ACTIONS,
  HANDLED_ACTIONS,
  isContactAction,
  isHandledAction,
  isSignupAction,
} from './form-actions';

const DESIGNS = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'marketplace-catalog',
  'blueprints'
);

/** Every form action a design's site file names, with the designs that name it. */
function designActions(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const design of readdirSync(DESIGNS)) {
    const file = join(DESIGNS, design, 'site.json');
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    // A form names its job as the Form component's `action` prop, or as an action
    // marker (`"kind": "action", "ref": ...`) on a plain <form>.
    const named = [
      ...text.matchAll(/"action":\s*"([^"]+)"/g),
      ...text.matchAll(/"kind":\s*"action",\s*"ref":\s*"([^"]+)"/g),
      ...text.matchAll(/"ref":\s*"([^"]+)",\s*"kind":\s*"action"/g),
    ];
    for (const match of named) {
      const action = match[1] ?? '';
      found.set(action, [...(found.get(action) ?? []), design]);
    }
  }
  return found;
}

describe('form actions', () => {
  it('reads the designs it checks', () => {
    // A path that stops resolving would make the next test pass on nothing.
    expect(designActions().size).toBeGreaterThan(0);
  });

  // P09: 47 designs ship their newsletter form as `subscribe`, the site did not
  // know the name, and every sign-up read "Submitted." and went nowhere.
  it('handles every action a design ships', () => {
    const unhandled = [...designActions()].filter(([action]) => !isHandledAction(action));
    expect(
      unhandled.map(
        ([action, designs]) => `${action}: ${designs[0]} and ${designs.length - 1} more`
      )
    ).toEqual([]);
  });

  it('treats a subscribe form as a sign-up', () => {
    expect(isSignupAction('subscribe')).toBe(true);
    expect(isSignupAction('contact')).toBe(false);
  });

  // The designs' Contact pages name their form `submit`; the server must accept the
  // same names the browser sends, or the message is refused after a thank-you.
  it('knows a contact form by the same names as the server', () => {
    expect([...CONTACT_FORM_ACTIONS].sort()).toEqual([...SERVER_CONTACT_ACTIONS].sort());
    expect(isContactAction('submit')).toBe(true);
  });

  it('names nothing it does not do', () => {
    expect(isHandledAction(null)).toBe(false);
    expect(isHandledAction('donate')).toBe(false);
    expect(HANDLED_ACTIONS).toContain('contact');
  });
});
