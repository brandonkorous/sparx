// The cross-window message bus.
//
// A detached pane runs in its own `window`, with its own React root, its own
// query cache, and its own copy of every module. Nothing is shared by reference.
// So every fact that must look the same in two windows at once travels as a
// message on this channel:
//
//   • theme      — toggling dark mode in one window must repaint all of them
//   • data       — saving an invoice in a detached pane must refresh the list
//                  pane still sitting in the main window
//   • panes      — "open this in the main window", and tab hand-off between
//                  windows (see the drag caveat in lib/dock/cross-window-drag.ts)
//   • presence   — which windows are alive, so the main window can restore or
//                  garbage-collect layout state for windows that died
//
// BroadcastChannel is same-origin and reaches every context that opened the
// channel, INCLUDING contexts opened via window.open. It does not reach across
// browsers or devices — this is window coordination, not realtime sync. Server
// state still arrives over the API.

import type { PaneDescriptor } from './surfaces/descriptor';
import type { Theme } from './theme';

export const BUS_CHANNEL = 'sparx-workbench';

/**
 * Identifies one open window. Minted at bootstrap, never reused.
 *
 * `MAIN_WINDOW` is a reserved id meaning "whichever window owns the dock",
 * usable as a routing target before the sender knows the real id. It is a plain
 * string rather than a separate union member because WindowId IS string — a
 * `WindowId | 'main'` union collapses and buys no type safety.
 */
export type WindowId = string;

export const MAIN_WINDOW: WindowId = 'main';

export type BusMessage =
  /** Theme changed anywhere; every window repaints its own document. */
  | { type: 'theme.changed'; theme: Theme }
  /**
   * Server data changed. `keys` are query-key prefixes to invalidate. Sent after
   * every successful mutation so panes in other windows stop showing stale rows.
   */
  | { type: 'data.invalidated'; keys: string[][]; origin: WindowId }
  /** Ask a specific window — or MAIN_WINDOW — to open a surface. */
  | { type: 'pane.open'; target: WindowId; descriptor: PaneDescriptor }
  /**
   * A pane is being handed from one window to another. The source removes it
   * only after the target acknowledges, so a dropped message loses no work.
   */
  | { type: 'pane.transfer'; from: WindowId; to: WindowId; descriptor: PaneDescriptor }
  | { type: 'pane.transfer.ack'; from: WindowId; to: WindowId; paneId: string }
  /** Presence. `hello` announces; `roll-call` asks everyone to re-announce. */
  | { type: 'window.hello'; id: WindowId; role: 'main' | 'detached' }
  | { type: 'window.bye'; id: WindowId }
  | { type: 'window.roll-call' };

export type BusHandler = (message: BusMessage) => void;

/**
 * Opens the shared channel. Returns a `post` that never echoes to the caller
 * (BroadcastChannel already excludes the sending context) and a disposer.
 *
 * Returns a no-op bus when BroadcastChannel is unavailable — server render, and
 * older Safari. The workbench degrades to single-window behaviour rather than
 * throwing, because a missing bus must not take the whole app down.
 */
export function openBus(onMessage: BusHandler): {
  post: (message: BusMessage) => void;
  close: () => void;
} {
  if (typeof BroadcastChannel === 'undefined') {
    const noop = (): void => {
      // Intentionally inert: see the degradation note above.
    };
    return { post: noop, close: noop };
  }

  const channel = new BroadcastChannel(BUS_CHANNEL);
  channel.onmessage = (event: MessageEvent<BusMessage>) => {
    onMessage(event.data);
  };

  return {
    post: (message) => {
      channel.postMessage(message);
    },
    close: () => {
      channel.close();
    },
  };
}

/** Mints a window id. Crypto-random so two windows opened in the same tick can't collide. */
export function mintWindowId(): WindowId {
  return `w_${crypto.randomUUID()}`;
}
