import { describe, expect, it } from 'vitest';
import { appendEmailSlot, resolveEmailDrop } from './drop';
import type { EmailNode } from '@wizeworks/silicaui-builder/email';
import { emailBody, emailButton, emailSection, emailText } from '../testing/fixtures';

describe('resolveEmailDrop', () => {
  it('drops beside the target when the parent can hold it', () => {
    expect(
      resolveEmailDrop(
        emailBody(),
        { targetId: 'greeting', position: 'after' },
        emailText('new', 'x')
      )
    ).toEqual({ parentId: 'intro', index: 1 });
  });

  it('drops inside an empty container', () => {
    const root = emailBody();
    root.children.push(emailSection('empty', []));
    expect(
      resolveEmailDrop(root, { targetId: 'empty', position: 'inside' }, emailText('new', 'x'))
    ).toEqual({ parentId: 'empty', index: 0 });
  });

  it('climbs to the first parent that can legally hold the block', () => {
    // A band aimed at a line of copy deep inside a column. Nothing down there can
    // hold a section, so it lands beside the band that contains it all.
    expect(
      resolveEmailDrop(
        emailBody(),
        { targetId: 'left-copy', position: 'after' },
        emailSection('band', [])
      )
    ).toEqual({ parentId: 'body', index: 2 });
  });

  it('gives up when nothing at or above the pointer can hold the block', () => {
    // A column is only ever held by a columns row, and there is none above a
    // top-level band — so this has nowhere legal to go.
    const root = emailBody();
    expect(
      resolveEmailDrop(
        root,
        { targetId: 'intro', position: 'after' },
        {
          kind: 'column',
          id: 'stray',
          widthPct: 50,
          children: [],
        }
      )
    ).toBeUndefined();
  });

  it('accounts for the dragged block leaving its own parent', () => {
    // Moving the first of two children to the end: index 1, not 2, because the
    // list is one shorter once the block has been lifted out.
    const root = emailBody();
    root.children[0]!.children.push(emailButton('second', 'Go'));
    expect(
      resolveEmailDrop(
        root,
        { targetId: 'second', position: 'after' },
        root.children[0]!.children[0]!,
        { id: 'greeting' }
      )
    ).toEqual({ parentId: 'intro', index: 1 });
  });

  it('never lands a block inside its own subtree', () => {
    // Dragging a columns row onto one of its own columns. The column CAN hold a
    // columns row, so only the descendant guard stops this — and without it the
    // tree stops containing its own root and every walk recurses forever.
    const root = emailBody();
    const cols = root.children[1]!.children[0]!;
    const landing = resolveEmailDrop(root, { targetId: 'left', position: 'inside' }, cols, {
      id: 'cols',
    });
    expect(landing?.parentId).not.toBe('left');
    expect(landing).toEqual({ parentId: 'row', index: 0 });
  });
});

describe('where a block lands with nothing selected', () => {
  const body = (): EmailNode =>
    ({
      kind: 'body',
      id: 'body',
      children: [
        { kind: 'section', id: 's1', children: [{ kind: 'text', id: 't1', html: 'one' }] },
        { kind: 'section', id: 's2', children: [{ kind: 'text', id: 't2', html: 'two' }] },
      ],
    }) as unknown as EmailNode;

  const text = (): EmailNode => ({ kind: 'text', id: 'new', html: 'hi' }) as unknown as EmailNode;
  const section = (): EmailNode =>
    ({ kind: 'section', id: 'new', children: [] }) as unknown as EmailNode;

  it('puts a text block in the LAST section, not the body it cannot sit in', () => {
    // A body holds sections. Appending a text block to it is illegal, so the obvious
    // act — open Insert, click Text — was refused outright and the row did nothing.
    expect(appendEmailSlot(body(), text())).toEqual({ parentId: 's2', index: 1 });
  });

  it('puts a section at the end of the body', () => {
    expect(appendEmailSlot(body(), section())).toEqual({ parentId: 'body', index: 2 });
  });

  it('says nowhere when the email holds nowhere it could go', () => {
    // A real answer, and the caller says it out loud rather than doing nothing.
    const empty = { kind: 'body', id: 'body', children: [] } as unknown as EmailNode;
    expect(appendEmailSlot(empty, text())).toBeUndefined();
  });
});
