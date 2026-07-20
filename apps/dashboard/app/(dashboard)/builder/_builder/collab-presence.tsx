'use client';

// Live co-editor presence for the studio toolbar (docs/126 Phase 4).
//
// The social half of multi-editor: per-node last-write-wins keeps concurrent edits
// CORRECT, and this keeps them from surprising anyone — an author who can see that a
// colleague is also in the site, and which page they're on, avoids the collision rather
// than discovering it after the fact. Nothing here gates editing; it is a signal.
//
// Built entirely on silicaui `Avatar`/`AvatarGroup`/`Tooltip` — a peer is a colored
// initials chip, ringed when they're on the SAME page as you (the collision that
// actually matters), plain when they're elsewhere in the site.

import { Avatar, AvatarGroup, Tooltip } from '@wizeworks/silicaui-react';

import type { CollabPeer } from './use-builder-collab';

/** First two initials of a display name — "Ada Lovelace" → "AL", "sam" → "S". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// A small fixed palette so the same person tends to keep a color within a session —
// derived from their id, not their position, so it's stable as peers come and go. These
// are registered silica color names (never hex), so they theme correctly.
const PEER_COLORS = ['primary', 'secondary', 'accent', 'info', 'success', 'warning'] as const;
type PeerColor = (typeof PEER_COLORS)[number];

function colorFor(userId: string): PeerColor {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return PEER_COLORS[h % PEER_COLORS.length]!;
}

export interface CollabPresenceProps {
  peers: CollabPeer[];
  /** The page THIS author is on, so peers sharing it can be marked. */
  activePageId: string;
}

export function CollabPresence({ peers, activePageId }: CollabPresenceProps) {
  // Solo editing shows nothing — an empty cluster would just be chrome with no signal.
  if (peers.length === 0) return null;

  // Cap the visible avatars; the rest fold into a "+N" chip so a busy site's toolbar
  // doesn't overflow. Same-page peers sort first — they're the ones worth seeing.
  const sorted = [...peers].sort((a, b) => {
    const aHere = a.activePage === activePageId ? 0 : 1;
    const bHere = b.activePage === activePageId ? 0 : 1;
    return aHere - bHere;
  });
  const MAX = 4;
  const shown = sorted.slice(0, MAX);
  const overflow = sorted.length - shown.length;

  return (
    <div className="flex items-center" aria-label={`${peers.length} other editor(s) here`}>
      <AvatarGroup>
        {shown.map((peer) => {
          const samePage = peer.activePage === activePageId;
          return (
            <Tooltip
              key={peer.socketId}
              content={samePage ? `${peer.name} — on this page` : peer.name}
            >
              <Avatar
                color={colorFor(peer.userId)}
                size="sm"
                // Ring marks the peer on the SAME page — the edit most likely to collide.
                ring={samePage}
                status="online"
                alt={peer.name}
              >
                {initials(peer.name)}
              </Avatar>
            </Tooltip>
          );
        })}
        {overflow > 0 && (
          <Tooltip
            content={sorted
              .slice(MAX)
              .map((p) => p.name)
              .join(', ')}
          >
            <Avatar color="neutral" size="sm" alt={`${overflow} more`}>
              +{overflow}
            </Avatar>
          </Tooltip>
        )}
      </AvatarGroup>
    </div>
  );
}
