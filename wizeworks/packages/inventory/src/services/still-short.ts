// How many of an order line nobody could find while picking, still (sparx persona
// issue 355).
//
// An order can be walked more than once: a line that came up short is asked for
// again on the next walk, and that walk records its own short. So the walks do
// not add up. Gillett's O-000008 was walked three times for six injectors (6, 6,
// then 4 short with 2 found) and the pack bench said "Nobody could find 16 of
// these". The newest walk is the one that says what is missing now.

/** The short on the newest walk over the line, from each walk's short newest
 *  first. Nothing when it was never walked. */
export function stillShort(walkShortsNewestFirst: readonly number[] | null | undefined): number {
  const newest = walkShortsNewestFirst?.[0];
  return typeof newest === 'number' && newest > 0 ? newest : 0;
}
