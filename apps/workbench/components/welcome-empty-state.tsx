'use client';

// The first-run empty state — sparky, welcoming you to make the first one.
//
// Reserved for GENUINE first-run: "you haven't created your first <thing> yet",
// where the natural next move is to make one. It is NOT the everywhere empty
// state — a zero-results search, a failed load, or a momentarily-cleared list
// keeps silica's <EmptyState> with a lucide glyph. The mascot earns its place by
// being rare: a welcome the first time, not a character stamped on every void.
// (See the loading counterpart, components/pane-waiting.tsx, and the rationale
// in the Loading-preview lab surface.)
//
// Mascot-first by design: the character gets real room (no icon chip), an
// inviting `neutral` face, and blink-but-no-bob — a persistent state shouldn't
// wobble at you the way a transient loader can. Headline, supporting copy, and a
// primary action sit beneath, same reading order as <EmptyState>.

import type { ReactNode } from 'react';
import { Heading, Text } from '@wizeworks/silicaui-react';
import { SparkMascot, type SparkExpression } from '@sparx/brand/react';
import { useDocumentTheme } from '../lib/use-document-theme';

export function WelcomeEmptyState({
  title,
  description,
  actions,
  expression = 'neutral',
  size = 88,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** The primary action(s) — a <Button color="module"> to create the first one. */
  actions?: ReactNode;
  /** Override the face for a state that wants a different welcome. */
  expression?: SparkExpression;
  size?: number;
}) {
  const tone = useDocumentTheme();

  return (
    // A self-contained centered block, not a full-height layout — the same
    // footprint silica's <EmptyState> has, so it drops in anywhere one sits
    // (top of a list's scroll area, a panel, a card) without a height contract.
    // Where a caller wants it vertically centered in a tall pane, it wraps this
    // exactly as it would <EmptyState> (grid h-full place-items-center).
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-10 text-center">
      {/* title="" — the surrounding copy names the state; a redundant "sparky"
          label read out here would just be noise to a screen reader. */}
      <SparkMascot expression={expression} tone={tone} size={size} blink bob={false} title="" />
      <div className="flex flex-col gap-1">
        <Heading visualLevel={4}>{title}</Heading>
        {description ? <Text>{description}</Text> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
