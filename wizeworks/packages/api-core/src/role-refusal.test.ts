import { describe, expect, it } from 'vitest';

import { roleRefusal } from './auth';

// A refusal is read by a person, in a toast, in a console, or through an AI
// client. It said "Requires admin role or higher.", which names a ladder nobody
// at a business has seen, and does not say who CAN do it (sparx persona issue
// 168: Alyssa, a bookkeeper, pressed "Set up billing").

describe('what a refused person is told', () => {
  it('says who can do it, in words, for each rung', () => {
    expect(roleRefusal('owner')).toBe('Only the owner of this business can do this.');
    expect(roleRefusal('admin')).toBe(
      'Only an owner or an admin of this business can do this. Ask one of them.'
    );
    expect(roleRefusal('editor')).toBe(
      'Your role here lets you look, not change things. Ask an owner or an admin.'
    );
  });

  it('never names the ladder', () => {
    for (const min of ['owner', 'admin', 'editor', 'viewer', 'api'] as const) {
      expect(roleRefusal(min)).not.toMatch(/role or higher|requires/i);
    }
  });
});
