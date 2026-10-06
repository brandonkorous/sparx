// ONE PICTURE PER KIND of thing a booking uses (sparx persona issue 086).
//
// "Bay 1 (light duty)" is a room or space. Its pane heading and its tab showed
// the same person icon as Kirk Halvorsen, the technician booked beside it,
// because every resource surface had `Users` written in by hand. On a screen
// that lists a bay and a person together, the picture was saying they were the
// same kind of thing.
//
// So the picture is looked up from the kind, in one place, and every surface that
// lists a resource reads it from here: a new kind gets a picture once, and a
// changed picture changes everywhere. Plain `.ts` with `createElement` rather than
// JSX so the unit tests, which do not compile JSX, can read the map directly.

import { createElement, type ReactElement } from 'react';
import { Boxes, DoorOpen, KeyRound, UserRound, UtensilsCrossed, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Keyed by the stored kind (`scheduling_resources.kind`). */
const KIND_ICONS: Readonly<Record<string, LucideIcon>> = {
  /** A person. */
  staff: UserRound,
  /** A room or space: a treatment room, a studio, a service bay. */
  space: DoorOpen,
  /** A table a party is seated at. */
  table: UtensilsCrossed,
  /** A machine or tool. */
  equipment: Wrench,
  /** Something hired out: a bike, a kayak, a trailer. */
  asset: KeyRound,
};

/** The picture for a kind. A kind this console has not heard of gets a "things"
 *  picture rather than a person: guessing "person" is the mistake this file
 *  exists to stop. */
export function resourceKindIcon(kind: string | null | undefined): LucideIcon {
  return (kind ? KIND_ICONS[kind] : undefined) ?? Boxes;
}

/** The picture for a kind, drawn. Decorative: the kind or the name is always
 *  said in words beside it. */
export function resourceKindGlyph(
  kind: string | null | undefined,
  className: string
): ReactElement {
  return createElement(resourceKindIcon(kind), { className, 'aria-hidden': true });
}
