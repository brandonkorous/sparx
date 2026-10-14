// A business address is kept the way it is printed: one line per line of the
// envelope. Inside a sentence the line breaks fold into spaces, so "Collect it
// from 14812 Heritagecrest Way Bluffdale, UT 84065" ran the street into the town
// (sparx persona issue 191). In a sentence the lines are joined with commas.

/** "14812 Heritagecrest Way\nBluffdale, UT 84065" → "14812 Heritagecrest Way,
 *  Bluffdale, UT 84065". Blank lines and a comma already ending a line are not
 *  doubled. */
export function addressOnOneLine(address: string): string {
  return address
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/,$/, ''))
    .filter((line) => line.length > 0)
    .join(', ');
}
