import { describe, expect, it } from 'vitest';
import type { Theme } from '@wizeworks/silicaui-html';
import { StudioSession } from '../session/session';
import { resolveCanvas } from './chain';
import { findNode } from '../tree/walk';
import { componentDoc, layoutDoc, pageDoc, themeDoc, THEME } from '../testing/fixtures';
import { NO_FRAME } from '../documents/types';

const FALLBACK: Theme = { name: 'brand', tokens: { '--color-primary': '#000000' } };

function siteSession() {
  const session = new StudioSession({
    propertyId: 'property-1',
    layoutId: 'layout-1',
    themeId: 'theme-1',
  });
  session.open(themeDoc());
  session.open(layoutDoc());
  return session;
}

describe('the theme → layout → page chain', () => {
  it('draws a page inside its chrome, with only the body editable', () => {
    const session = siteSession();
    const page = pageDoc();
    session.open(page);

    const resolved = resolveCanvas(session, page, { fallbackTheme: FALLBACK });

    // The chrome is really there…
    expect(findNode(resolved.root, 'header')).toBeDefined();
    expect(findNode(resolved.root, 'footer')).toBeDefined();
    // …and the page body landed where the Outlet was.
    expect(findNode(resolved.root, 'hero')).toBeDefined();
    // Everything outside this subtree is context: inert, unselectable, undroppable.
    expect(resolved.editableRootId).toBe('body-root');
  });

  it('draws a frameless page bare', () => {
    const session = siteSession();
    const page = pageDoc({ frame: NO_FRAME });
    session.open(page);

    const resolved = resolveCanvas(session, page, { fallbackTheme: FALLBACK });
    expect(findNode(resolved.root, 'header')).toBeUndefined();
    expect(findNode(resolved.root, 'hero')).toBeDefined();
  });

  it('reports a dangling layout instead of quietly restoring the default', () => {
    const session = siteSession();
    const page = pageDoc({ frame: 'layout-gone' });
    session.open(page);

    const resolved = resolveCanvas(session, page, { fallbackTheme: FALLBACK });
    // Silently falling back would put back the header this page was deliberately
    // moved away from.
    expect(resolved.missingLayoutId).toBe('layout-gone');
    expect(findNode(resolved.root, 'header')).toBeUndefined();
  });

  it('reads the theme live, and falls back to the brand theme when the site wears none', () => {
    const session = siteSession();
    const page = pageDoc();
    session.open(page);
    expect(resolveCanvas(session, page, { fallbackTheme: FALLBACK }).theme).toEqual(THEME);

    const themeless = new StudioSession({
      propertyId: 'property-1',
      layoutId: null,
      themeId: null,
    });
    themeless.open(page);
    expect(resolveCanvas(themeless, page, { fallbackTheme: FALLBACK }).theme).toEqual(FALLBACK);
  });

  it('repaints a page when the theme document is edited', () => {
    const session = siteSession();
    const page = pageDoc();
    session.open(page);

    session
      .store({ kind: 'theme', id: 'theme-1' })
      ?.apply('Recolour', [
        { kind: 'theme.setToken', mode: 'light', token: '--color-primary', value: '#00A0A0' },
      ]);

    // No copy to reconcile and no socket in between — the page pane resolves through
    // the same store the theme pane is editing.
    const resolved = resolveCanvas(session, page, { fallbackTheme: FALLBACK });
    expect(resolved.theme.tokens['--color-primary']).toBe('#00A0A0');
  });

  it('draws a layout as itself, Outlet and all', () => {
    const session = siteSession();
    const layout = layoutDoc();
    const resolved = resolveCanvas(session, layout, { fallbackTheme: FALLBACK });
    expect(resolved.root).toBe(layout.root);
    expect(resolved.editableRootId).toBeUndefined();
  });
});

describe('the saved-piece library', () => {
  it('prefers a live master over the loaded copy', () => {
    const session = siteSession();
    session.loadLibrary([componentDoc()]);
    expect(session.symbols()['component-1']?.name).toBe('Opening hours');

    const store = session.open(componentDoc());
    store.apply('Rename', [{ kind: 'doc.rename', value: 'Hours' }]);

    // An open component pane has to propagate into every page drawing its instances.
    expect(session.symbols()['component-1']?.name).toBe('Hours');
  });

  it('holds masters that are not open, so an instance never renders as a hole', () => {
    const session = siteSession();
    session.loadLibrary([componentDoc()]);
    expect(session.symbols()['component-1']?.root).toBeDefined();
  });
});

describe('one document, one store', () => {
  it('hands the same store to a second pane', () => {
    const session = siteSession();
    const first = session.open(pageDoc());
    const second = session.open(pageDoc({ name: 'A stale copy' }));

    // Already-open wins. A second pane must never replace a document the first may
    // have unsaved edits in.
    expect(second).toBe(first);
    expect(second.current.name).toBe('Home');
  });

  it('refuses to close a document with unsaved work unless told to discard', () => {
    const session = siteSession();
    const store = session.open(pageDoc());
    store.apply('Set class', [{ kind: 'node.setClass', id: 'hero', value: 'py-16' }]);

    expect(session.close({ kind: 'page', id: 'page-1' })).toBe(false);
    expect(session.close({ kind: 'page', id: 'page-1' }, { discard: true })).toBe(true);
  });

  it('reports every dirty document for the shell’s one indicator', () => {
    const session = siteSession();
    session.open(pageDoc());
    session
      .store({ kind: 'page', id: 'page-1' })
      ?.apply('Edit', [{ kind: 'node.setClass', id: 'hero', value: 'py-16' }]);
    session
      .store({ kind: 'theme', id: 'theme-1' })
      ?.apply('Edit', [{ kind: 'theme.setName', value: 'House v2' }]);

    expect(session.hasUnsavedWork).toBe(true);
    expect(session.dirtyRefs.map((ref) => ref.kind).sort()).toEqual(['page', 'theme']);
  });
});
