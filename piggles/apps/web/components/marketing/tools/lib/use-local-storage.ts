'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * State that survives a refresh, kept on this device only.
 *
 * Used for the things somebody would otherwise retype on every visit — their
 * business details on the invoice and quote makers, their saved tracking links,
 * the last palette they were working on.
 *
 * ── WHY IT READS ON AN EFFECT RATHER THAN IN THE INITIALISER ────────────────
 *
 * The obvious version passes a function to `useState` that reads localStorage
 * straight away. On a server-rendered page that throws — there is no
 * localStorage during the render on the server — and if you guard the throw, you
 * get the subtler failure instead: the server renders the default, the client
 * renders the stored value, and React finds two different trees. It reports a
 * hydration mismatch, discards the client render, and the field flickers.
 *
 * So the first render is always the default, on both sides, and the stored value
 * arrives immediately afterwards. `hydrated` is returned so a caller can avoid
 * showing an empty state for one frame if that matters.
 *
 * ── AND WHY EVERY ACCESS IS IN A TRY ────────────────────────────────────────
 *
 * localStorage throws rather than returning null in two ordinary situations:
 * Safari's private browsing (historically) and any browser configured to block
 * site data. Both are somebody deliberately protecting their privacy, which is
 * precisely the person who should not have a tool crash on them.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Unreadable or unparseable — carry on with the default. A stored value
      // from an older shape of this tool is not worth an error screen.
    }
    setHydrated(true);
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Quota exceeded, or storage blocked. The value still works for this
          // session; it simply will not be here tomorrow. Not worth interrupting
          // somebody mid-invoice to say so.
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update, hydrated];
}

/** Forget everything a tool has saved on this device. Every tool that stores
 *  anything offers this — a tool that quietly keeps your business address
 *  forever, with no way to clear it, has not earned the assurance strip. */
export function clearStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do, and nothing was stored either way.
  }
}
