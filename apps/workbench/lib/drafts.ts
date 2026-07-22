// The draft store — how two panes look at the same unsaved work.
//
// This is the piece that makes "surfaces, never compositions" actually workable.
// An invoice editor and an invoice preview must agree on a document that has not
// been saved yet, and the obvious way to do that is for the editor to own the
// preview as a child panel — which is exactly the coupling this app exists to
// remove. So they never meet. The editor publishes its draft here; the preview
// subscribes. Neither knows the other exists, neither can position the other,
// and either can be closed, moved, or torn into another window with no effect on
// the other beyond the preview going quiet.
//
// The rule that follows, and it is the one to hold the line on:
// PANES COORDINATE THROUGH SHARED STATE, NEVER THROUGH LAYOUT.
//
// A preview torn onto a second monitor keeps updating as the operator types,
// but NOT because of the channel below — dockview portals a popout group out of
// the main window's React tree, so a detached pane shares this module instance
// by reference and the in-memory map alone is enough.
//
// The broadcast is for the case that isn't a dockview popout: a second
// independently-opened workbench tab, which has its own module instance. Cheap
// insurance rather than the load-bearing mechanism, and worth keeping only
// because getting it wrong looks like "the preview silently stopped following".

/** A draft is opaque here — the store is a transport, not a schema owner. */
export type DraftValue = Record<string, unknown>;

type Listener = (value: DraftValue | null) => void;

const drafts = new Map<string, DraftValue>();
const listeners = new Map<string, Set<Listener>>();

/**
 * Draft traffic rides its own channel rather than the main workbench bus:
 * it is high-frequency (every keystroke) and every message is disposable, so
 * keeping it off the channel that carries pane/window lifecycle avoids
 * drowning those in noise.
 */
const DRAFT_CHANNEL = 'sparx-workbench-drafts';

interface DraftMessage {
  key: string;
  value: DraftValue | null;
}

let channel: BroadcastChannel | null = null;

function ensureChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  channel ??= new BroadcastChannel(DRAFT_CHANNEL);
  return channel;
}

function notify(key: string, value: DraftValue | null): void {
  const set = listeners.get(key);
  if (!set) return;
  for (const listener of set) listener(value);
}

// Apply drafts published by other windows.
if (typeof BroadcastChannel !== 'undefined') {
  const incoming = ensureChannel();
  if (incoming) {
    incoming.addEventListener('message', (event: MessageEvent<DraftMessage>) => {
      const { key, value } = event.data;
      if (value === null) drafts.delete(key);
      else drafts.set(key, value);
      notify(key, value);
    });
  }
}

/** Stable key for a draft. `id` is 'new' for a document that doesn't exist yet. */
export function draftKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

export function publishDraft(key: string, value: DraftValue): void {
  drafts.set(key, value);
  notify(key, value);
  ensureChannel()?.postMessage({ key, value } satisfies DraftMessage);
}

/** Clears a draft — on save, or when the editing pane closes. */
export function clearDraft(key: string): void {
  drafts.delete(key);
  notify(key, null);
  ensureChannel()?.postMessage({ key, value: null } satisfies DraftMessage);
}

export function readDraft(key: string): DraftValue | null {
  return drafts.get(key) ?? null;
}

export function subscribeDraft(key: string, listener: Listener): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);

  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}
