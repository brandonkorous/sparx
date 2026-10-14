// Only a shared board can be the one Dashboards opens on, because it opens for
// everyone (persona issue 264). The two switches move together so the form never
// asks for what the server refuses.

interface BoardSwitches {
  isDefault: boolean;
  shared: boolean;
}

/** "Open this board first": turning it on shares the board too. */
export function withOpensFirst<T extends BoardSwitches>(draft: T, on: boolean): T {
  return { ...draft, isDefault: on, shared: on ? true : draft.shared };
}

/** "Share it with your team": turning it off stops the board opening first. */
export function withShared<T extends BoardSwitches>(draft: T, on: boolean): T {
  return { ...draft, shared: on, isDefault: on ? draft.isDefault : false };
}

export const OPENS_FIRST_WORDS =
  'The one Dashboards opens on, for everyone, so it is shared too. Turning it on here turns it off wherever it was.';

export const SHARED_WORDS =
  'Everyone can open it. Off keeps it to you, and then it cannot be the one Dashboards opens on.';
