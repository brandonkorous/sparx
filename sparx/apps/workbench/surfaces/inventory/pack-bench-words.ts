// Two lines on the pack bench that said something the bench does not do or mean
// (sparx persona issue 356).

/** The empty box. It said "type a quantity against a line below", and the lines
 *  below have no box to type in: a number box appears once a line is IN the box. */
export const EMPTY_BOX_WORDS =
  'Scan the first item, or press “Add all” on a line below. Once it is in the box, you can change how many.';

/** What nobody found while picking, for the line under "Still to pack". "It"
 *  is one thing: four injectors read "Nobody could find it". */
export function nobodyFound(short: number, remaining: number): string {
  if (short === remaining) return remaining === 1 ? 'it' : 'any of these';
  return `${String(short)} of these`;
}
