// Presentation + form vocabulary for the header notice bar.
//
// The surface writes rows that three PUBLIC apps then render, so everything an
// operator picks from is a closed list: a brand nobody operates, a surface
// nothing reads, or a tone silica has no class for would all save cleanly and
// then show up as a notice that is simply absent. The lists here are the same
// ones api-rest validates against — one vocabulary, stated on both sides of the
// wire, so a mismatch is a type error rather than an empty bar.

import type {
  OperatorAnnouncement,
  OperatorAnnouncementSurface,
  OperatorAnnouncementTone,
} from '@wizeworks/operator';

export const BRAND_OPTIONS = [
  { value: 'piggles', label: 'Piggles' },
  { value: 'sparx', label: 'sparx' },
] as const;

/** What each surface actually IS, in the words of somebody deciding where a
 *  sentence belongs — a route name would make them guess. */
export const SURFACE_OPTIONS: {
  value: OperatorAnnouncementSurface;
  label: string;
  hint: string;
}[] = [
  { value: 'marketing', label: 'Marketing site', hint: 'Where people read about the product' },
  { value: 'account', label: 'Sign-up & account', hint: 'Signing up, signing in, the bill' },
  { value: 'console', label: 'The working console', hint: 'Where customers run their business' },
];

/** Tone doubles as meaning: an operator picks what the notice IS, and the bar's
 *  color follows. Naming them by urgency rather than by hue is what stops
 *  "warning" being chosen because amber looked nice. */
export const TONE_OPTIONS: { value: OperatorAnnouncementTone; label: string }[] = [
  { value: 'primary', label: 'Announcement — an offer, a launch, news' },
  { value: 'info', label: 'Information — a change worth knowing about' },
  { value: 'success', label: 'Good news — something is back, or is done' },
  { value: 'warning', label: 'Heads-up — planned work, a deadline' },
  { value: 'danger', label: 'Urgent — an outage or something broken' },
];

export const SURFACE_LABELS: Record<OperatorAnnouncementSurface, string> = {
  marketing: 'Marketing site',
  account: 'Sign-up & account',
  console: 'Console',
};

export const BRAND_LABELS: Record<string, string> = {
  piggles: 'Piggles',
  sparx: 'sparx',
};

/**
 * The one word that says where a notice stands, and the tone that carries it.
 *
 * FOUR states, not two, because "on" and "off" cannot describe this record: a
 * notice can be switched on and not yet started, switched on and finished, or
 * never switched on at all, and an operator who sees only a green "Active" pill
 * on a row that expired last week will go looking for a bug in the website.
 * Every state here is derived from `live` plus the window — nothing is guessed.
 *
 * `tone: undefined` on Draft is a COLOURLESS badge, not a grey one. A draft is
 * the one state here that carries no signal — it is not good, not urgent, and
 * not waiting on anything — so it gets no `color` prop and inherits the surface
 * ink. That is different from naming `neutral`, which is a colour choice.
 */
export function announcementState(a: OperatorAnnouncement): {
  label: string;
  tone?: 'success' | 'info' | 'warning';
} {
  if (a.live) return { label: 'On screen', tone: 'success' };
  if (!a.isActive) return { label: 'Draft' };
  const now = Date.now();
  if (a.startsAt && new Date(a.startsAt).getTime() > now) {
    return { label: 'Scheduled', tone: 'info' };
  }
  if (a.endsAt && new Date(a.endsAt).getTime() <= now) {
    return { label: 'Finished', tone: 'warning' };
  }
  // Switched on, inside its window, and still not live: impossible unless the
  // two definitions have drifted. Say so rather than rendering a confident lie.
  return { label: 'Not showing', tone: 'warning' };
}

/** ISO → the `datetime-local` value an `<input>` will accept, in the operator's
 *  own zone. Chopped rather than formatted: the input wants exactly
 *  `YYYY-MM-DDTHH:mm` and rejects the seconds and the `Z` an ISO string carries. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `datetime-local` value → ISO, or null when the field was left empty.
 *  Empty means OPEN-ENDED here, never "the epoch". */
export function fromLocalInput(value: FormDataEntryValue | null): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
