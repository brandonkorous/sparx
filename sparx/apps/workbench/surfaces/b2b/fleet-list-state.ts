// Where the vehicle editor stands with the shop's own fitment lists.
//
// The editor waits for those lists before it offers a picker, and when it has
// none it says so: the shop has no list yet, so the vehicle is typed in by hand.
// That sentence is a claim about the business. It must only be printed when the
// lists were READ and there were none, never because the read failed.
// [[feedback_never_present_absence_as_measurement]]

/** What the editor draws in the list's place. */
export type FleetListState = 'loading' | 'failed' | 'none' | 'ready';

export function fleetListState(
  query: { isPending: boolean; isError: boolean },
  usableLists: number
): FleetListState {
  if (query.isPending) return 'loading';
  if (query.isError) return 'failed';
  return usableLists === 0 ? 'none' : 'ready';
}
