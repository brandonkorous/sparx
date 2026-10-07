// "Where did you hear about Piggles?" The answers, and the one place they are
// checked. Stored at `settings.acquisition.heardAbout`, read by the signups board.

export const HEARD_ABOUT_OPTIONS = [
  { value: 'tv-event', label: 'On TV or at a live event' },
  { value: 'search', label: 'Searching online' },
  { value: 'friend', label: 'A friend or another business owner' },
  { value: 'social', label: 'Social media' },
  { value: 'other', label: 'Somewhere else' },
] as const;

export type HeardAbout = (typeof HEARD_ABOUT_OPTIONS)[number]['value'];

const VALUES = new Set<string>(HEARD_ABOUT_OPTIONS.map((o) => o.value));

/** The answer if it is one we offered, else null (skipped, or a tampered form). */
export function heardAboutAnswer(raw: string | null | undefined): HeardAbout | null {
  return raw && VALUES.has(raw) ? (raw as HeardAbout) : null;
}
