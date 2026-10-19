// A core that paints itself with its node's class must not get that class twice.
//
// The chrome walk mounts every host core inside a `<div>` wearing the node's class, and
// three cores ALSO hand that class to their own element. The account link was therefore
// a button inside a button, double padded: "Brynn" measured 95px, and on a 360px phone
// that was enough to squeeze the logo out of the header (sparx persona issue 291).

import { HOST_KEYS } from '@wizeworks/silica-catalog';
import { describe, expect, it } from 'vitest';

import { CLASS_FORWARDING_CORES, hostWrapperClass } from './host-wrapper';

describe('the host wrapper in the chrome walk', () => {
  it('steps out of the layout for a core that wears its own class', () => {
    for (const component of [
      HOST_KEYS.siteBrand,
      HOST_KEYS.siteAccountLink,
      HOST_KEYS.siteSocialLinks,
    ]) {
      expect(hostWrapperClass({ component, class: 'btn btn-ghost btn-sm' })).toBe('contents');
    }
  });

  it('keeps the class for a core that leaves its styling to the wrapper', () => {
    expect(
      hostWrapperClass({ component: HOST_KEYS.siteThemeToggle, class: 'hidden @5xl:inline-flex' })
    ).toBe('hidden @5xl:inline-flex');
    expect(hostWrapperClass({ component: HOST_KEYS.cmsArticleBody, class: 'max-w-3xl' })).toBe(
      'max-w-3xl'
    );
  });

  it('adds no class to a node that has none', () => {
    expect(hostWrapperClass({ component: HOST_KEYS.siteBrand })).toBeUndefined();
  });

  it('lists exactly the cores the site renderer hands `node.class` to', async () => {
    // Read the renderer rather than trusting this list: a core that starts forwarding
    // its class without joining the set is the double-padding defect again.
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, 'silica-host-cores.tsx'), 'utf8');
    const forwarding = [
      ...source.matchAll(/case HOST_KEYS\.(\w+):[\s\S]*?(?=case HOST_KEYS\.|default:)/g),
    ]
      .filter((m) => m[0].includes('className: node.class'))
      .map((m) => HOST_KEYS[m[1] as keyof typeof HOST_KEYS])
      .sort();
    expect(forwarding).toEqual([...CLASS_FORWARDING_CORES].sort());
  });
});
