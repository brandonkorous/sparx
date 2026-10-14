// Whose clock a chat's opening hours start on (piggles persona issue 991).
//
// Turning the hours on filled in THIS COMPUTER's zone. An owner in London setting up
// chat on a laptop set to Pacific time got hours that opened eight hours late, and
// the only way to see it was a box that said "America/Los_Angeles". The hours are the
// business's, so they start on the business's clock: its zone from Business details,
// or this computer's when it has none yet.

export function startingHoursZone(businessZone: string | null | undefined, device: string): string {
  return businessZone ?? device;
}
