// The session — every document a site has open, in one place.
//
// This is the layer that makes multi-window worth having. A pane does not own a
// document; it asks the session for one, and two panes asking for the same
// document get the SAME store. So the theme pane and three page panes share one
// theme: edit a token and every canvas repaints, with no copy to reconcile, no
// second draft to save, and nothing round-tripping through a socket.
//
// It also owns the two facts no single pane can answer — what the site's chrome
// and theme currently are — because that is what a page canvas has to resolve
// through to draw itself.

import type { ComponentDoc, DocumentRef, LayoutDoc, StudioDoc, ThemeDoc } from '../documents/types';
import { docKey } from '../documents/types';
import type { SymbolDef } from '@wizeworks/silicaui-html';
import { DocumentStore } from './document-store';

/** What the site currently wears. Both ids may be null on a site that has never
 *  been through the editor — the canvas falls back to the starter chrome and the
 *  brand-derived theme, exactly as the storefront does. */
export interface SiteContext {
  propertyId: string;
  layoutId: string | null;
  themeId: string | null;
}

export interface SessionSnapshot {
  context: SiteContext;
  /** Open documents with unsaved work. The shell's one dirty indicator reads this. */
  dirty: readonly DocumentRef[];
}

export class StudioSession {
  private readonly stores = new Map<string, DocumentStore>();
  private readonly unsubscribes = new Map<string, () => void>();
  private readonly listeners = new Set<() => void>();
  private readonly library = new Map<string, ComponentDoc>();
  private context: SiteContext;
  private snapshot: SessionSnapshot;
  private dirtyKey = '';

  constructor(context: SiteContext) {
    this.context = context;
    this.snapshot = { context, dirty: [] };
  }

  getSnapshot = (): SessionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Open a document, or hand back the store already holding it.
   *
   * Already-open wins, and the loaded copy is discarded. A second pane must never
   * replace a document another pane may have unsaved edits in — the whole point
   * of one store per document is that there is nothing to reconcile.
   */
  open<D extends StudioDoc>(doc: D): DocumentStore<D> {
    const key = docKey(doc);
    const existing = this.stores.get(key);
    if (existing) return existing as DocumentStore<D>;

    const store = new DocumentStore(doc);
    this.stores.set(key, store);
    this.unsubscribes.set(
      key,
      store.subscribe(() => this.refresh())
    );
    if (doc.kind === 'component') this.library.set(doc.id, doc);
    this.refresh(true);
    return store;
  }

  store(ref: DocumentRef): DocumentStore | undefined {
    return this.stores.get(docKey(ref));
  }

  /**
   * Close a document. Refuses while it has unsaved work — the caller confirms
   * with the author first, then calls `close(ref, { discard: true })`.
   */
  close(ref: DocumentRef, opts: { discard?: boolean } = {}): boolean {
    const key = docKey(ref);
    const store = this.stores.get(key);
    if (!store) return true;
    if (store.dirty && !opts.discard) return false;

    this.unsubscribes.get(key)?.();
    this.unsubscribes.delete(key);
    this.stores.delete(key);
    this.refresh(true);
    return true;
  }

  setContext(context: SiteContext): void {
    this.context = context;
    this.refresh(true);
  }

  /** The theme the site wears, when it is open. */
  themeStore(): DocumentStore<ThemeDoc> | undefined {
    if (!this.context.themeId) return undefined;
    return this.stores.get(docKey({ kind: 'theme', id: this.context.themeId })) as
      | DocumentStore<ThemeDoc>
      | undefined;
  }

  /** The site's chrome, when it is open. */
  layoutStore(): DocumentStore<LayoutDoc> | undefined {
    if (!this.context.layoutId) return undefined;
    return this.stores.get(docKey({ kind: 'layout', id: this.context.layoutId })) as
      | DocumentStore<LayoutDoc>
      | undefined;
  }

  /**
   * The whole saved-piece library, loaded up front rather than per pane.
   *
   * A page can hold an instance of any component, so a canvas cannot draw itself
   * from the components that happen to be OPEN — an unopened master would render
   * as a hole in the page. Masters being edited come from their live store, so an
   * open component pane still propagates.
   */
  loadLibrary(components: readonly ComponentDoc[]): void {
    for (const doc of components) this.library.set(doc.id, doc);
    this.refresh(true);
  }

  /** The symbol map `flattenSymbols` and the canvas resolve instances through. */
  symbols(): Record<string, SymbolDef> {
    const out: Record<string, SymbolDef> = {};
    for (const [id, doc] of this.library) {
      const live = this.stores.get(docKey({ kind: 'component', id }));
      const source = (live?.current as ComponentDoc | undefined) ?? doc;
      out[id] = { id, name: source.name, root: source.root };
    }
    return out;
  }

  get openRefs(): DocumentRef[] {
    return [...this.stores.values()].map((store) => store.ref);
  }

  get dirtyRefs(): DocumentRef[] {
    return [...this.stores.values()].filter((store) => store.dirty).map((store) => store.ref);
  }

  get hasUnsavedWork(): boolean {
    for (const store of this.stores.values()) if (store.dirty) return true;
    return false;
  }

  /**
   * Rebuild the snapshot — but only publish a new one when something a session
   * SUBSCRIBER can see has changed. Without that check every keystroke in any
   * pane would re-render every consumer of the session, which is most of the
   * shell.
   */
  private refresh(force = false): void {
    const dirty = this.dirtyRefs;
    const key = dirty.map(docKey).sort().join('|');
    if (!force && key === this.dirtyKey) return;
    this.dirtyKey = key;
    this.snapshot = { context: this.context, dirty };
    for (const listener of this.listeners) listener();
  }
}
