import { describe, expect, it } from 'vitest';
import type { EmailBody } from '@wizeworks/silicaui-builder/email';
import { applyEmailOp } from './apply-email';
import type { EmailTreeOp } from './types';
import { findEmailNode, findEmailPlace } from '../email/walk';
import { emailBody, emailButton, emailSection, emailText } from '../testing/fixtures';

/** Apply an op, then the inverse it handed back. The tree must come out
 *  structurally identical — that property IS undo, so it is what every case here
 *  asserts rather than checking the shape of the inverse by hand. */
function roundTrip(root: EmailBody, op: EmailTreeOp): { after: EmailBody; restored: EmailBody } {
  const applied = applyEmailOp(root, op);
  expect(applied, `op ${op.kind} was refused`).toBeDefined();
  const undone = applyEmailOp(applied!.root, applied!.inverse);
  expect(undone, `inverse of ${op.kind} was refused`).toBeDefined();
  return { after: applied!.root, restored: undone!.root };
}

describe('structural ops', () => {
  it('inserts a block and mints an ordering key for it', () => {
    const applied = applyEmailOp(emailBody(), {
      kind: 'email.insert',
      parentId: 'intro',
      index: 1,
      node: emailText('sign-off', 'See you soon'),
    });
    const inserted = findEmailNode(applied!.root, 'sign-off');
    expect(inserted).toBeDefined();
    expect(inserted?.ord).toBeTypeOf('string');
    expect(findEmailPlace(applied!.root, 'sign-off')?.index).toBe(1);
  });

  it('round-trips an insert', () => {
    const { after, restored } = roundTrip(emailBody(), {
      kind: 'email.insert',
      parentId: 'intro',
      index: 0,
      node: emailText('sign-off', 'See you soon'),
    });
    expect(findEmailNode(after, 'sign-off')).toBeDefined();
    expect(findEmailNode(restored, 'sign-off')).toBeUndefined();
    expect(restored).toEqual(emailBody());
  });

  it('round-trips a removal back into the same slot', () => {
    const { after, restored } = roundTrip(emailBody(), { kind: 'email.remove', id: 'intro' });
    expect(findEmailNode(after, 'intro')).toBeUndefined();
    expect(findEmailPlace(restored, 'intro')?.index).toBe(0);
    expect(findEmailNode(restored, 'greeting')).toBeDefined();
  });

  it('round-trips a move between columns', () => {
    const { after, restored } = roundTrip(emailBody(), {
      kind: 'email.move',
      id: 'cta',
      parentId: 'left',
      index: 0,
    });
    expect(findEmailPlace(after, 'cta')?.parent?.id).toBe('left');
    expect(findEmailPlace(restored, 'cta')?.parent?.id).toBe('right');
  });

  it('refuses a move into the node’s own subtree', () => {
    expect(
      applyEmailOp(emailBody(), { kind: 'email.move', id: 'cols', parentId: 'left', index: 0 })
    ).toBeUndefined();
  });

  it('refuses a block the parent cannot hold', () => {
    // A section inside a column: `canHold` says no, and the type system says the
    // same — the runtime check is what stops a drag layer writing it anyway.
    expect(
      applyEmailOp(emailBody(), {
        kind: 'email.insert',
        parentId: 'left',
        index: 0,
        node: emailSection('nested', []),
      })
    ).toBeUndefined();
  });

  it('refuses an op addressed to an id that is not in the tree', () => {
    expect(applyEmailOp(emailBody(), { kind: 'email.remove', id: 'ghost' })).toBeUndefined();
  });

  it('refuses to remove the body', () => {
    expect(applyEmailOp(emailBody(), { kind: 'email.remove', id: 'body' })).toBeUndefined();
  });

  it('refuses to remove a locked block', () => {
    const root = emailBody();
    root.children[0]!.locked = 'host';
    expect(applyEmailOp(root, { kind: 'email.remove', id: 'intro' })).toBeUndefined();
  });

  it('round-trips a replace', () => {
    const { after, restored } = roundTrip(emailBody(), {
      kind: 'email.replace',
      id: 'greeting',
      node: emailButton('greeting', 'Track it'),
    });
    expect(findEmailNode(after, 'greeting')?.kind).toBe('button');
    expect(findEmailNode(restored, 'greeting')?.kind).toBe('text');
  });
});

describe('field ops', () => {
  it('round-trips a patch of several fields at once', () => {
    const { after, restored } = roundTrip(emailBody(), {
      kind: 'email.patch',
      id: 'greeting',
      patch: { html: 'Hi <b>there</b>', fontSize: 22, align: 'center' },
    });
    expect(after.children[0]!.children[0]).toMatchObject({ fontSize: 22, align: 'center' });
    expect(restored).toEqual(emailBody());
  });

  it('undoes a patch that ADDED a field by removing it again', () => {
    // The previous value of an absent key is `undefined`, which the patch reads as
    // "delete it" — without that, undo would leave a `colorAuto: undefined` behind
    // and the node would never again compare equal to the one that was saved.
    const { restored } = roundTrip(emailBody(), {
      kind: 'email.patch',
      id: 'greeting',
      patch: { colorAuto: true },
    });
    expect(Object.hasOwn(restored.children[0]!.children[0]!, 'colorAuto')).toBe(false);
  });

  it('refuses nothing but leaves identity and structure alone', () => {
    const applied = applyEmailOp(emailBody(), {
      kind: 'email.patch',
      id: 'intro',
      patch: { id: 'hijacked', kind: 'button', children: [], paddingY: 40 },
    });
    const section = applied!.root.children[0]!;
    expect(section.id).toBe('intro');
    expect(section.kind).toBe('section');
    expect(section.children).toHaveLength(1);
    expect(section.paddingY).toBe(40);
  });

  it('round-trips a data binding', () => {
    const { after, restored } = roundTrip(emailBody(), {
      kind: 'email.setData',
      id: 'greeting',
      value: { kind: 'value', ref: 'customer.firstName' },
    });
    expect(findEmailNode(after, 'greeting')?.data).toEqual({
      kind: 'value',
      ref: 'customer.firstName',
    });
    expect(findEmailNode(restored, 'greeting')?.data).toBeUndefined();
  });
});
