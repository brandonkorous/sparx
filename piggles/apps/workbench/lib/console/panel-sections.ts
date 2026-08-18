'use client';

// Which sections of an app's panel are folded shut.
//
// Per DEVICE, not per account — the same reasoning as the rail's groups next
// door (./rail-groups.ts): how much column you can spend on navigation is a fact
// about the screen in front of you.
//
// Three states, not two. A section is folded because the person folded it, open
// because they opened it, or neither — in which case the DEFAULT decides, and
// the default differs per section (see `PIGGLES_QUIET_SECTIONS`). Storing only
// "folded" would make an explicitly-opened quiet section fold itself again on
// the next render, which reads as the panel forgetting.

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

const KEY = 'piggles-panel-folded';

/** `true` = the person folded it, `false` = the person opened it. Absent means
 *  nobody has said, so the section's own default applies. */
type Choices = Record<string, boolean>;

function read(): Choices {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === 'boolean'
      )
    );
  } catch {
    // A corrupt store means "nobody has chosen", never a thrown panel.
    return {};
  }
}

/** Keyed `${appId}:${section}` so two apps that both have a "Setting it up"
 *  fold independently. */
/**
 * The remembered choices, read AFTER mount.
 *
 * NEVER during render. There is no localStorage on the server, so a render-time
 * read makes the first client paint disagree with the HTML React was given and
 * the whole tree is thrown away with a hydration error. The first paint uses the
 * defaults and this snaps to what the person chose.
 */
export function useSectionChoices(): [Choices, Dispatch<SetStateAction<Choices>>] {
  const [choices, setChoices] = useState<Choices>({});
  useEffect(() => {
    setChoices(read());
  }, []);
  return [choices, setChoices];
}

export function sectionKey(appId: string, section: string): string {
  return `${appId}:${section}`;
}

export function setSectionFolded(appId: string, section: string, folded: boolean): Choices {
  const next = { ...read(), [sectionKey(appId, section)]: folded };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing and full quotas both land here. The fold still applies
    // for this session; only remembering it is lost.
  }
  return next;
}
