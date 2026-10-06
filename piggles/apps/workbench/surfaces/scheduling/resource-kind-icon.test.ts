// A bay is not a person (sparx persona issue 086). Every kind of resource has
// its own picture, and none of them but a person's is a person.

import { describe, expect, it } from 'vitest';
import { faUser, faUsers } from '@fortawesome/pro-solid-svg-icons';

import { resourceKindIcon } from './resource-kind-icon';
import { RESOURCE_KINDS } from './setup-data';

describe('each kind of resource has its own picture', () => {
  it('draws a room or space differently from a person', () => {
    expect(resourceKindIcon('space')).not.toBe(resourceKindIcon('staff'));
  });

  it('gives every kind the console offers a different picture', () => {
    const icons = RESOURCE_KINDS.map((kind) => resourceKindIcon(kind.value));
    expect(new Set(icons).size).toBe(RESOURCE_KINDS.length);
  });

  it('draws only a person as a person', () => {
    for (const kind of RESOURCE_KINDS) {
      if (kind.value === 'staff') continue;
      expect(resourceKindIcon(kind.value)).not.toBe(faUser);
      expect(resourceKindIcon(kind.value)).not.toBe(faUsers);
    }
  });

  it('does not guess "person" for a kind it has not heard of', () => {
    expect(resourceKindIcon('hovercraft')).not.toBe(resourceKindIcon('staff'));
    expect(resourceKindIcon(null)).not.toBe(resourceKindIcon('staff'));
  });
});
