import { describe, expect, it } from 'vitest';
import { atom, el } from '@wizeworks/silicaui-html';

import { checkClassString } from './vocabulary-check';
import { repairDeadClasses, upgradePageBody } from './upgrade-page';

describe('repairDeadClasses', () => {
  it('replaces the dead token and leaves every other one alone, in order', () => {
    expect(repairDeadClasses('flex flex-col gap-1.5 p-4')).toBe('flex flex-col gap-2 p-4');
  });

  it('reports "nothing to do" as null, so a clean tree keeps its identity', () => {
    expect(repairDeadClasses('flex flex-col gap-2 p-4')).toBeNull();
    expect(repairDeadClasses('')).toBeNull();
  });

  it('heals a PREFIXED dead class — the variant is not what is broken, the step is', () => {
    expect(repairDeadClasses('@2xl:gap-1.5')).toBe('@2xl:gap-2');
    expect(repairDeadClasses('@2xl:hover:gap-1.5')).toBe('@2xl:hover:gap-2');
  });

  it('leaves arbitrary values alone — there is no known-correct replacement to make', () => {
    expect(repairDeadClasses('w-[347px] gap-1.5')).toBe('w-[347px] gap-2');
  });

  it('produces a class string the vocabulary actually accepts', () => {
    const healed = repairDeadClasses('flex flex-col gap-1.5 p-4')!;
    expect(checkClassString(healed)).toEqual([]);
    // …and the input genuinely was broken, so the test is not vacuous.
    expect(checkClassString('flex flex-col gap-1.5 p-4')).not.toEqual([]);
  });
});

describe('upgradePageBody', () => {
  /** The exact shape found on a real tenant's stored Home page. */
  const staleCard = () =>
    el('a', 'card bg-base-100', {
      children: [
        el('div', 'flex flex-col gap-1.5 p-4', {
          children: [el('h3', 'font-semibold', { text: 'Product name' })],
        }),
      ],
    });

  it('heals a dead class nested anywhere in the body', () => {
    const { root, changed } = upgradePageBody(
      el('section', '', { children: [el('div', '', { children: [staleCard()] })] })
    );
    expect(changed).toBe(true);
    expect(JSON.stringify(root)).toContain('gap-2');
    expect(JSON.stringify(root)).not.toContain('gap-1.5');
  });

  it('heals COMPONENT nodes too, not only elements', () => {
    const { root, changed } = upgradePageBody(
      el('div', '', { children: [atom('Image', 'gap-1.5 w-full', { alt: 'x' })] })
    );
    expect(changed).toBe(true);
    expect(JSON.stringify(root)).toContain('gap-2');
  });

  it('is a no-op on a clean tree — same object back, changed false', () => {
    const clean = el('div', 'flex gap-2', { children: [el('p', 'p-4', { text: 'hi' })] });
    const { root, changed } = upgradePageBody(clean);
    expect(changed).toBe(false);
    expect(root).toBe(clean);
  });

  it('is idempotent — healing twice is healing once', () => {
    const once = upgradePageBody(staleCard());
    const twice = upgradePageBody(once.root);
    expect(twice.changed).toBe(false);
    expect(twice.root).toEqual(once.root);
  });

  it('preserves everything else about the node it repairs', () => {
    const node = el('div', 'gap-1.5', { attrs: { id: 'keep' }, children: ['text'] });
    node.data = { kind: 'value', ref: 'title' };
    const { root } = upgradePageBody(node);
    expect(root).toMatchObject({
      tag: 'div',
      class: 'gap-2',
      attrs: { id: 'keep' },
      children: ['text'],
      data: { kind: 'value', ref: 'title' },
    });
  });

  it('leaves a subtree with nothing to repair as the SAME object', () => {
    const untouched = el('footer', 'p-4', { children: [el('p', '', { text: 'c' })] });
    const { root } = upgradePageBody(el('div', '', { children: [staleCard(), untouched] }));
    const kids = (root as { children: unknown[] }).children;
    expect(kids[1]).toBe(untouched);
  });
});
