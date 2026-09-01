// The form node check is an AUTHORIZATION check, not a convenience: it is the only
// thing standing between the public submit endpoint and a script that POSTs at any
// tenant it likes. If `findSilicaFormNode` says yes to something that isn't a live
// form, the endpoint stores a submission and mails whoever the row names.

import { describe, expect, it } from 'vitest';

import {
  collectSilicaFormIds,
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

// Finding every form on a page (issue 355).
//
// The picker that lists a site's forms used to read `FormDefinition` ROWS, and a
// row is written the first time somebody SAVES settings — so it listed exactly
// the forms that had already been configured, which on every real site was none
// of them. Walking the tree is what makes "every form on this site" true.
describe('collectSilicaFormIds', () => {
  const formNode = (id: string) => ({
    id,
    kind: 'element',
    tag: 'form',
    behavior: { type: 'form' },
    data: { kind: 'action', ref: 'contact' },
    children: [],
  });

  it('finds a form however deeply it is buried', () => {
    const page = {
      kind: 'element',
      tag: 'section',
      children: [
        { kind: 'element', tag: 'h2', children: ['Talk to me'] },
        { kind: 'element', tag: 'div', children: [formNode('deep-one')] },
      ],
    };
    expect(collectSilicaFormIds(page as never)).toEqual(['deep-one']);
  });

  it('finds every form on a page, in document order', () => {
    const page = {
      kind: 'element',
      tag: 'div',
      children: [
        formNode('first'),
        { kind: 'element', tag: 'div', children: [formNode('second')] },
      ],
    };
    expect(collectSilicaFormIds(page as never)).toEqual(['first', 'second']);
  });

  it('ignores a form that posts somewhere else', () => {
    // The email sign-up carries `email-signup`, which the storefront routes to the
    // mailing list rather than the submissions inbox. It is a real form and it is
    // not one of these — offering it here would put a contact form's recipients and
    // autoresponder on a subscription.
    const signup = { ...formNode('signup'), data: { kind: 'action', ref: 'email-signup' } };
    expect(collectSilicaFormIds(signup as never)).toEqual([]);
  });

  it('ignores markup that only LOOKS like a form', () => {
    // Both marks are required. A bare <form> an author pasted in has no behavior
    // and reaches no host, so it has nothing to configure.
    const bare = { id: 'bare', kind: 'element', tag: 'form', children: [] };
    expect(collectSilicaFormIds(bare as never)).toEqual([]);
  });

  it('skips a form with no id, because there is nothing to address it by', () => {
    const anonymous = {
      kind: 'element',
      tag: 'form',
      behavior: { type: 'form' },
      data: { kind: 'action', ref: 'contact' },
      children: [],
    };
    expect(collectSilicaFormIds(anonymous as never)).toEqual([]);
  });

  it('returns nothing for a page with no forms at all', () => {
    expect(collectSilicaFormIds({ kind: 'element', tag: 'div', children: [] } as never)).toEqual(
      []
    );
  });
});
