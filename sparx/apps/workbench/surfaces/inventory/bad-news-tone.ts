// The color of a figure that is bad news only when there is some of it (persona
// issue 276). A zero in danger red says the opposite of what it means.

/** `tone` when `value` is above zero; nothing at zero, so a zero reads plain. */
export function badNewsTone(value: number, tone: string): string | undefined {
  return value > 0 ? tone : undefined;
}
