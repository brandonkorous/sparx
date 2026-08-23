'use client';

// HOW TO OPEN A ROW, said once.
//
// Every list in the workbench honours the same contract — click opens a tab,
// shift opens alongside, alt tears off a window — and 87 surfaces each wrote
// their own sentence about it. Same fact, five wordings, and no way to change
// any of them at once.
//
// Two things were wrong with it, and neither could be fixed at 87 call sites:
//
//   • IT IS NONSENSE ON A PHONE. There is no shift key, no alt key and no
//     second window on the device the mobile shell was built for, so a third of
//     the footer of every list was instructions for hardware the reader does not
//     have. The pane knows its own width; the sentence should not appear below
//     the width where the modifiers exist. `@md`, the same container query the
//     rest of the pane responds to.
//   • IT WAS 12px in half the call sites. `text-xs` on prose, under the 14px
//     caption floor, in a line nobody could read on the small screen it was
//     uselessly appearing on.
//
// `what` names what a row IS, which is the only part that ever varied: "a design
// to preview it", "an author to edit". Everything after it is the contract, and
// the contract is not a per-surface decision.
//
// The Piggles console carries the same component under the same name — the two
// consoles are one product shape, and check:console-parity holds them level.

import { Text } from '@wizeworks/silicaui-react';

export function RowOpenHint({ what, className }: { what?: string; className?: string }) {
  return (
    <Text className={`hidden shrink-0 px-1 text-sm @md:block ${className ?? ''}`}>
      Click {what ?? 'to open'} · Shift-click alongside · Alt-click in a new window
    </Text>
  );
}
