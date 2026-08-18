'use client';

// Reactive state for the chat realtime layer, kept in a LEAF module on purpose.
//
// The socket manager (live.ts) writes here; the data hooks (data.ts) read
// `isChatLive()` to relax their polling while the socket is healthy; the thread
// surface reads the typing signal. Putting it here — importing neither data.ts
// nor live.ts — is what lets data.ts depend on the live status without a cycle
// (data → live-status, live → live-status + data, and nothing points back).

import { useEffect, useState, useSyncExternalStore } from 'react';

/* ── Connection status ────────────────────────────────────────────────────── */

let connected = false;
const statusListeners = new Set<() => void>();

/** Set by the socket manager on connect/disconnect. */
export function setChatLive(next: boolean): void {
  if (connected === next) return;
  connected = next;
  for (const listener of statusListeners) listener();
}

/** Synchronous read — used by the poll cadences in data.ts, which must decide an
 *  interval without a hook. True only while the socket is actually connected. */
export function isChatLive(): boolean {
  return connected;
}

function subscribeStatus(onChange: () => void): () => void {
  statusListeners.add(onChange);
  return () => statusListeners.delete(onChange);
}

/** Live connection state for chrome that wants to show "Live" vs "Reconnecting". */
export function useChatConnected(): boolean {
  return useSyncExternalStore(
    subscribeStatus,
    () => connected,
    () => false
  );
}

/* ── Typing signal ────────────────────────────────────────────────────────── */

// A per-conversation pub-sub. The socket manager calls notifyTyping when a
// `typing` event arrives; each open thread subscribes to its own id. Kept as a
// plain emitter rather than a store snapshot because the value is a transient
// pulse (auto-clearing after a few seconds), not durable state.

const typingListeners = new Map<string, Set<() => void>>();

/** Fired by the socket manager for every inbound `typing` event. */
export function notifyTyping(conversationId: string): void {
  const listeners = typingListeners.get(conversationId);
  if (listeners) for (const listener of listeners) listener();
}

function onTypingFor(conversationId: string, onPulse: () => void): () => void {
  let set = typingListeners.get(conversationId);
  if (!set) {
    set = new Set();
    typingListeners.set(conversationId, set);
  }
  set.add(onPulse);
  return () => {
    set.delete(onPulse);
    if (set.size === 0) typingListeners.delete(conversationId);
  };
}

/** How long a single `typing` pulse keeps the indicator up. The other side
 *  re-emits every couple of seconds while it keeps typing, so this only has to
 *  outlast that cadence — long enough not to flicker, short enough to clear
 *  promptly once they stop or send. */
const TYPING_LINGER_MS = 3500;

/**
 * True while the other participant in `conversationId` is typing. Undefined id
 * (an unopened thread) is always false. Self-authored typing never reaches here:
 * api-rest only broadcasts a typing event to the OTHER sockets in the room.
 */
export function useTypingIndicator(conversationId: string | undefined): boolean {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    setTyping(false);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = onTypingFor(conversationId, () => {
      setTyping(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setTyping(false), TYPING_LINGER_MS);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [conversationId]);

  return typing;
}
