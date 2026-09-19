// WHEN THE CHAT BOX IS AWAY, AND WHETHER THE AWAY MESSAGE CAN EVER BE SEEN.
//
// Chat settings has an **Away message** box with one fixed sentence under it:
// "Shown when you are outside your available hours, so people know what to
// expect." Thirty lines further down, the **Set specific hours** switch is off by
// default, and ITS sentence already reads the state: "Chat is always available.
// There is no away state."
//
// So the same screen said both things at once. On 13 of the 14 shops with a chat
// box, there are no hours, so the away message can never be shown to anybody —
// and the box asking for it was still explaining when visitors would see it. The
// text in it is not even hers: it is the default the platform writes.
// [[feedback_never_present_absence_as_measurement]]
//
// The sentence that DOES read the state is in the same file, thirty lines below
// the one that does not. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// And the state the toggle's own sentence does not reach: hours ON with no day
// switched on. `isWithinOperatingHours` answers `if (!window) return false` for a
// day with no window, so a shop that turns the switch on and stops there has
// closed its chat every hour of the week. Seven day switches, all off, and a
// sentence promising "outside THESE hours" about hours that do not exist.

/** A day's window, or null for a day the shop does not answer. */
export type DayWindow = { open: string; close: string } | null;

/** How many days have a window. `days` is keyed '0'..'6', Sunday first. */
export function openDayCount(days: Record<string, DayWindow> | undefined): number {
  if (!days) return 0;
  return Object.values(days).filter((window) => window !== null).length;
}

/**
 * The sentence under the Away message box.
 *
 * Three states, because there are three: nobody can see it, everybody sees it,
 * or it does the job it describes.
 */
export function awayMessageNote(hoursOn: boolean, openDays: number): string {
  if (!hoursOn) {
    return (
      'Shown when you are outside your available hours. You have not set any, so nobody ever ' +
      'sees this. Turn on “Set specific hours” below to use it.'
    );
  }
  if (openDays === 0) {
    return (
      'Right now this is all a visitor gets. No day is switched on below, so the chat is away ' +
      'every hour of the week.'
    );
  }
  return 'Shown when you are outside your available hours, so people know what to expect.';
}

/**
 * The sentence under the Set specific hours switch.
 *
 * The middle state is the one that was missing, and it is the expensive one: the
 * switch is on, no day is, and the chat quietly answers nobody.
 */
export function hoursNote(hoursOn: boolean, openDays: number): string {
  if (!hoursOn) return 'Chat is always available. There is no away state.';
  if (openDays === 0) {
    return (
      'No day is switched on yet, so the chat is away all week and every visitor gets your away ' +
      'message. Switch on the days you answer.'
    );
  }
  return 'Outside these hours the chat shows your away message instead of a reply box.';
}

/**
 * Whether the hours section is in a state worth warning about, rather than
 * merely describing.
 *
 * Only the middle state. "No hours at all" is a perfectly good way to run a chat
 * box and needs no warning; "hours on, none of them" is a shop that thinks it is
 * open and is not.
 */
export function chatIsAwayAllWeek(hoursOn: boolean, openDays: number): boolean {
  return hoursOn && openDays === 0;
}
