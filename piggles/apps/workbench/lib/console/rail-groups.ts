'use client';

// Which sections of the rail are folded shut.
//
// Per DEVICE, not per account: how much rail you can afford to give navigation
// is a fact about the screen in front of you, and syncing a laptop's folded rail
// onto a 27" monitor would be wrong on both. Same reasoning as the layout store
// next door (lib/workbench/persistence.ts).
//
// ── THREE STATES, BECAUSE THE DEFAULT IS NOT THE SAME EVERYWHERE ────────────
//
// App groups default OPEN — a rail that greets a new person with five shut
// drawers is hiding the product from the one person who has not learned it yet.
// Recent defaults SHUT, because it is automatic history rather than a place: it
// was costing five rows above the fifteen apps it sits on top of, and nobody
// chose to put it there.
//
// So "folded" and "not folded" are not enough. A person who opens Recent has to
// stay opened, which means the store has to distinguish "they said open" from
// "nobody has said".

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

const KEY = 'piggles-rail-folded';

/** `true` = they folded it, `false` = they opened it. Absent means nobody has
 *  said, so `defaultFolded` decides. */
type Choices = Record<string, boolean>;

/** Sections whose default is FOLDED. Everything else defaults open. */
const DEFAULT_FOLDED = new Set(['recent']);

export const RECENT_GROUP = 'recent';

function read(): Choices {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    // Migrates the original shape — a bare array of folded ids — so an existing
    // rail does not spring open on the upgrade.
    if (Array.isArray(parsed)) {
      return Object.fromEntries(
        parsed.filter((g): g is string => typeof g === 'string').map((g) => [g, true])
      );
    }
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === 'boolean'
      )
    );
  } catch {
    // A corrupt or unreadable store means "nobody has chosen", never a thrown rail.
    return {};
  }
}

/**
 * The remembered choices, read AFTER mount.
 *
 * NEVER during render. There is no localStorage on the server, so a render-time
 * read makes the first client paint disagree with the HTML React was given and
 * the whole tree is thrown away with a hydration error. The first paint uses the
 * defaults and this snaps to what the person chose.
 */
export function useGroupChoices(): [Choices, Dispatch<SetStateAction<Choices>>] {
  const [choices, setChoices] = useState<Choices>({});
  useEffect(() => {
    setChoices(read());
  }, []);
  return [choices, setChoices];
}

export function isGroupFolded(group: string, choices: Choices): boolean {
  return choices[group] ?? DEFAULT_FOLDED.has(group);
}

export function setGroupFolded(group: string, folded: boolean): Choices {
  const next = { ...read(), [group]: folded };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing and full quotas both land here. The fold still applies
    // for this session; only remembering it is lost.
  }
  return next;
}
