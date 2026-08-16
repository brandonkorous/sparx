'use client';

// Which app groups are folded shut.
//
// Per DEVICE, not per account: how much rail you can afford to give navigation
// is a fact about the screen in front of you, and syncing a laptop's folded rail
// onto a 27" monitor would be wrong on both. Same reasoning as the layout store
// next door (lib/workbench/persistence.ts).
//
// Defaults to OPEN. A rail that greets a new person with five shut drawers is
// hiding the product from the one person who has not learned it yet.

const KEY = 'piggles-rail-folded';

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === 'string') : [];
  } catch {
    // A corrupt or unreadable store means "nothing folded", never a thrown rail.
    return [];
  }
}

export function foldedGroups(): Set<string> {
  return new Set(read());
}

export function setGroupFolded(group: string, folded: boolean): Set<string> {
  const next = new Set(read());
  if (folded) next.add(group);
  else next.delete(group);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // Private browsing and full quotas both land here. The fold still applies
    // for this session; only remembering it is lost.
  }
  return next;
}
