// ONE PICTURE PER KIND of thing a booking uses (sparx persona issue 086).
//
// "Bay 1 (light duty)" is a room or space. Its pane tab showed the same people
// icon as the technician booked beside it, because every resource surface had
// `faUsers` written in by hand. On a screen that lists a bay and a person
// together, the picture was saying they were the same kind of thing.
//
// So the picture is looked up from the kind, in one place, and every surface that
// lists a resource reads it from here: a new kind gets a picture once, and a
// changed picture changes everywhere.

import {
  faBoxesStacked,
  faDoorOpen,
  faKey,
  faUser,
  faUtensils,
  faWrench,
} from '@fortawesome/pro-solid-svg-icons';
import type { PigglesIcon } from '@piggles/ui';

/** Keyed by the stored kind (`scheduling_resources.kind`). */
const KIND_ICONS: Readonly<Record<string, PigglesIcon>> = {
  /** A person. */
  staff: faUser,
  /** A room or space: a treatment room, a studio, a service bay. */
  space: faDoorOpen,
  /** A table a party is seated at. */
  table: faUtensils,
  /** A machine or tool. */
  equipment: faWrench,
  /** Something hired out: a bike, a kayak, a trailer. */
  asset: faKey,
};

/** The picture for a kind. A kind this console has not heard of gets a "things"
 *  picture rather than a person: guessing "person" is the mistake this file
 *  exists to stop. */
export function resourceKindIcon(kind: string | null | undefined): PigglesIcon {
  return (kind ? KIND_ICONS[kind] : undefined) ?? faBoxesStacked;
}
