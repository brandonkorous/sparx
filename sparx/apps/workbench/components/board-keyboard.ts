// Moving a card between board columns with the keyboard.
//
// The board says "With the keyboard: tab to one, press space, move with the
// arrow keys, then space again", and none of it worked (issue 912):
//
//   1. The card's own key handler REPLACED the drag sensor's, so Space never
//      lifted anything.
//   2. The drop target was found with `pointerWithin`, which asks where the
//      POINTER is. A keyboard drag has no pointer, so every drop landed on
//      nothing.
//   3. The arrow keys used dnd-kit's default step of 25 pixels, and measuring
//      where the lifted card had got to was unreliable: in the dock, the
//      floating copy of the card measured about one column off before it had
//      moved at all, so one press read as two columns.
//
// So a keyboard move does not measure anything. The board remembers which
// column the card is in, starting from the one it was lifted out of, and each
// arrow press moves that by one column. Pure, so the stepping is pinned by a
// test rather than by a drag nobody can automate.

/**
 * The column one step left or right of `current`, among the columns a person
 * can see right now. Null when there is none that way, so the card stays put
 * rather than sliding off the board, or when `current` is not one of them.
 */
export function nextColumnId<T>(visible: readonly T[], current: T, step: 1 | -1): T | null {
  const index = visible.indexOf(current);
  if (index === -1) return null;
  return visible[index + step] ?? null;
}

/** Which way an arrow key moves a card, or null for a key that does not. */
export function columnStep(code: string): 1 | -1 | null {
  if (code === 'ArrowRight') return 1;
  if (code === 'ArrowLeft') return -1;
  return null;
}
