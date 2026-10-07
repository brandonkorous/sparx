import type { MascotPoseId } from '@piggles/mascot';
import { BEATS } from './beats';

/** Beat 0 is the cold open: an empty desk and the headline. */
export const OPENING = 420;

/** Who stands on the empty desk before the film starts; the site's first mascot. */
export const OPENING_POSE: MascotPoseId = 'laptop-coffee';
export const STOPS = [OPENING, ...BEATS.map((b) => b.at)];

export const clockOf = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** Which apps are lit by the time you reach `beat`. */
export const litBy = (beat: number) => new Set(BEATS.slice(0, beat).flatMap((b) => b.lights));

/** The beat a scroll fraction lands on, and the clock on the way into it. The
 *  clock ramps INTO a beat then holds at its stated time, so the title bar and
 *  the sentence beside it never disagree while somebody is reading them. */
export function settleAt(p: number) {
  const clamped = Math.min(1, Math.max(0, p));
  const beat = Math.min(STOPS.length - 1, Math.floor(clamped * STOPS.length));
  const f = Math.min(STOPS.length - 0.0001, clamped * STOPS.length);
  const i = Math.floor(f);
  const ramp = Math.min(1, (f - i) / 0.3);
  const from = STOPS[i - 1] ?? STOPS[0]!;
  return { beat, mins: Math.round(from + ramp * (STOPS[i]! - from)) };
}

/** How far through its own scroll the desk is, 0 to 1. */
export const deskProgress = (desk: HTMLDivElement) =>
  desk.scrollTop / (desk.scrollHeight - desk.clientHeight);
