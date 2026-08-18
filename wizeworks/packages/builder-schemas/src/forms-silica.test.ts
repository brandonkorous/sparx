// The form node check is an AUTHORIZATION check, not a convenience: it is the only
// thing standing between the public submit endpoint and a script that POSTs at any
// tenant it likes. If `findSilicaFormNode` says yes to something that isn't a live
// form, the endpoint stores a submission and mails whoever the row names.

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SILICA_FORM_CONFIG,
  findSilicaFormNode,
  isSilicaFormNode,
  readSilicaFormConfig,
} from './forms-silica';
import type { SilicaNode } from './site-sync';

/** A live form as silica's `contactSection` block actually authors one: the `form`
 *  behavior plus the `contact` action ref on the `Form` component's props. */
const liveForm = (id: string): SilicaNode =>
  ({
    id,
    kind: 'component',
    component: 'Form',
    behavior: { type: 'form' },
    props: { action: 'contact' },
    children: [],
  }) as unknown as SilicaNode;

const wrap = (children: unknown[]): SilicaNode =>
  ({ id: 'root', kind: 'element', tag: 'section', children }) as unknown as SilicaNode;

describe('isSilicaFormNode', () => {
  it('accepts a form carrying BOTH the behavior and the action ref', () => {
    expect(isSilicaFormNode(liveForm('f1'))).toBe(true);
  });

  it('accepts the action as an explicit data-marker (a hand-composed tree)', () => {
    const node = {
      id: 'f1',
      kind: 'element',
      tag: 'form',
      behavior: { type: 'form' },
      data: { kind: 'action', ref: 'contact' },
    } as unknown as SilicaNode;
    expect(isSilicaFormNode(node)).toBe(true);
  });

  it('REJECTS a form with the behavior but no action — it points nowhere', () => {
    const node = {
      id: 'f1',
      kind: 'component',
      component: 'Form',
      behavior: { type: 'form' },
      props: {},
    } as unknown as SilicaNode;
    expect(isSilicaFormNode(node)).toBe(false);
  });

  it('REJECTS a node that merely claims the action without the form behavior', () => {
    // e.g. a plain <div> an attacker-authored tree tagged with the ref. Without the
    // behavior it is not a form and must not resolve as one.
    const node = {
      id: 'f1',
      kind: 'element',
      tag: 'div',
      props: { action: 'contact' },
    } as unknown as SilicaNode;
    expect(isSilicaFormNode(node)).toBe(false);
  });

  it('REJECTS a form wired to some OTHER action (a newsletter signup is not this)', () => {
    const node = {
      id: 'f1',
      kind: 'component',
      component: 'Form',
      behavior: { type: 'form' },
      props: { action: 'email-signup' },
    } as unknown as SilicaNode;
    expect(isSilicaFormNode(node)).toBe(false);
  });
});

describe('findSilicaFormNode', () => {
  it('finds a form nested anywhere in the tree', () => {
    const tree = wrap([wrap([{ id: 'x', kind: 'element', tag: 'div' }, liveForm('target')])]);
    expect(findSilicaFormNode(tree, 'target')).not.toBeNull();
  });

  it('returns null for an id that is not in the tree — the anti-forgery case', () => {
    const tree = wrap([liveForm('real')]);
    expect(findSilicaFormNode(tree, 'made-up')).toBeNull();
  });

  it('returns null when the id matches a node that is NOT a form', () => {
    // The id existing is not enough. A submit naming a heading's id must not resolve.
    const tree = wrap([{ id: 'heading', kind: 'element', tag: 'h1', children: ['Hi'] }]);
    expect(findSilicaFormNode(tree, 'heading')).toBeNull();
  });

  it('survives a tree with bare text children', () => {
    const tree = wrap(['some text', liveForm('f1')]);
    expect(findSilicaFormNode(tree, 'f1')).not.toBeNull();
  });
});

describe('readSilicaFormConfig', () => {
  it('fills a complete config from an empty/absent blob — an unconfigured form works', () => {
    // The commonest flow is "drop the block, publish, done". That form has no row, and
    // it must still notify the account email rather than 404 or silently drop the lead.
    expect(readSilicaFormConfig(undefined)).toEqual(DEFAULT_SILICA_FORM_CONFIG);
    expect(readSilicaFormConfig({}).notify).toBe(true);
  });

  it('forces addToCrm when openDeal is set — a deal needs someone to attach to', () => {
    const cfg = readSilicaFormConfig({ openDeal: true, addToCrm: false });
    expect(cfg.openDeal).toBe(true);
    expect(cfg.addToCrm).toBe(true);
  });

  it('keeps the author’s values', () => {
    const cfg = readSilicaFormConfig({
      name: 'Quote request',
      notify: false,
      autoresponder: true,
      autoresponderSubject: 'Got it',
    });
    expect(cfg.name).toBe('Quote request');
    expect(cfg.notify).toBe(false);
    expect(cfg.autoresponder).toBe(true);
    expect(cfg.autoresponderSubject).toBe('Got it');
    // …and defaults the ones it didn't set.
    expect(cfg.autoresponderMessage).toBe(DEFAULT_SILICA_FORM_CONFIG.autoresponderMessage);
  });
});
