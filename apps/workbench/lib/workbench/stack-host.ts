// PaneHost for small screens — one surface at a time, with a switcher.
//
// The whole host is an ordered list of pane ids plus which one is showing. No
// grid, no tabs strip, no windows. That is not a reduced dock; it is the
// arrangement a phone actually has, and saying so in the type system is what
// lets every surface run unchanged on both.
//
// Ordering rules, which are the only real design decisions here:
//   • `beside` and `tab` both mean "after the pane that asked" — on a phone the
//     distinction is meaningless, but the ADJACENCY is not. Opening a preview
//     from an invoice should land next to that invoice in the switcher, so
//     swiping between the two is the gesture it was on desktop.
//   • Closing the visible pane falls to its NEIGHBOUR, not to the end of the
//     list. Falling to the end teleports you somewhere unrelated.

import type { PaneDescriptor } from '../surfaces/descriptor';
import type { AddPaneOptions, PaneHost, PaneHostCapabilities } from './pane-host';

export interface StackState {
  /** Pane ids in switcher order. */
  readonly order: readonly string[];
  /** The pane filling the screen, or null when nothing is open. */
  readonly activeId: string | null;
}

const EMPTY: StackState = { order: [], activeId: null };

export class StackPaneHost implements PaneHost {
  // No split, no popout — and stated rather than implied, so chrome omits both
  // instead of rendering controls that cannot work.
  readonly capabilities: PaneHostCapabilities = { split: false, popout: false };

  private order: string[] = [];
  private activeId: string | null = null;
  private readonly titles = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  /** Stable between emits — useSyncExternalStore re-renders forever otherwise. */
  private snapshot: StackState = EMPTY;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): StackState => this.snapshot;

  /** Server render has no panes; a separate constant keeps the reference stable. */
  getServerSnapshot = (): StackState => EMPTY;

  private emit(): void {
    this.snapshot = { order: [...this.order], activeId: this.activeId };
    for (const listener of this.listeners) listener();
  }

  /** Pane titles, for the switcher. Kept here because the host is what the
   *  switcher renders from, and it already owns pane identity. */
  titleOf(paneId: string): string {
    return this.titles.get(paneId) ?? 'Untitled';
  }

  /** Show a pane the operator picked from the switcher. */
  show(paneId: string): void {
    if (!this.order.includes(paneId) || this.activeId === paneId) return;
    this.activeId = paneId;
    this.emit();
  }

  /** Restores a persisted pane set. Order is the stored order; the first pane
   *  shows, because there is no meaningful "last active" across devices. */
  hydrate(paneIds: readonly string[], titles: Record<string, string>): void {
    this.order = [...paneIds];
    this.titles.clear();
    for (const [id, title] of Object.entries(titles)) this.titles.set(id, title);
    this.activeId = this.order[0] ?? null;
    this.emit();
  }

  has(paneId: string): boolean {
    return this.order.includes(paneId);
  }

  add(descriptor: PaneDescriptor, title: string, options: AddPaneOptions): void {
    if (this.order.includes(descriptor.id)) return;
    this.titles.set(descriptor.id, title);

    const anchor = options.fromPaneId ? this.order.indexOf(options.fromPaneId) : -1;
    if (anchor >= 0) this.order.splice(anchor + 1, 0, descriptor.id);
    else this.order.push(descriptor.id);

    if (options.focus) this.activeId = descriptor.id;
    this.emit();
  }

  close(paneId: string): void {
    const index = this.order.indexOf(paneId);
    if (index < 0) return;
    this.order.splice(index, 1);
    this.titles.delete(paneId);

    if (this.activeId === paneId) {
      // The neighbour, preferring the one that was to the left — that is the
      // pane you were working next to.
      this.activeId = this.order[index - 1] ?? this.order[index] ?? null;
    }
    this.emit();
  }

  focus(paneId: string): void {
    this.show(paneId);
  }

  setTitle(paneId: string, title: string): void {
    if (!this.order.includes(paneId)) return;
    // Same idempotency rule the controller keeps — belt and braces, because an
    // emit-on-every-call here is an infinite render loop for any surface that
    // titles itself from an effect, and that is most of them.
    if (this.titles.get(paneId) === title) return;
    this.titles.set(paneId, title);
    this.emit();
  }

  retarget(paneId: string, title: string): void {
    this.setTitle(paneId, title);
  }

  /**
   * Null, and that is the entire point.
   *
   * A stack has no arrangement to save. Returning something here — an order, an
   * empty grid — would let a phone session overwrite a multi-pane desktop
   * layout with a flat list, so an arrangement built across two monitors would
   * be destroyed by checking one invoice at lunch. The controller writes only
   * the pane SET when serialize() is null (see persistence.savePanes).
   */
  serialize(): unknown {
    return null;
  }
}
