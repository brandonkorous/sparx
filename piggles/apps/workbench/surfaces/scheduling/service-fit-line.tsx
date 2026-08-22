'use client';

// WHO FITS a requirement — the line under a skill box that says, in names, who can
// actually take the booking.
//
// An unmatched skill is otherwise indistinguishable from a matched one until
// somebody turns up at the chair (issue 088).

import { FieldDescription, FieldStatus } from '@wizeworks/silicaui-react';
import type { ResourceRequirement } from './setup-data';

/** Everyone this section reasons about. */
export interface FitPerson {
  name: string;
  kind: string;
  skillTags: string[];
  isActive: boolean;
}

/** Comma-separated skills → the list the engine matches with `hasEvery`. */
export function parseSkills(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Everyone of this kind who carries every skill asked for. */
function whoFits(requirement: ResourceRequirement, people: FitPerson[]): string[] {
  return people
    .filter((person) => person.isActive && person.kind === requirement.kind)
    .filter((person) => requirement.skillTags.every((tag) => person.skillTags.includes(tag)))
    .map((person) => person.name);
}

/** "Nia Okafor and Dara Bell" — a list a person reads, not one a machine does. */
function inWords(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
}

export function FitLine({
  requirement,
  people,
}: {
  requirement: ResourceRequirement;
  people: FitPerson[];
}) {
  if (people.length === 0) return null;
  const fits = whoFits(requirement, people);
  if (fits.length === 0) {
    return (
      <FieldStatus status="error">
        Nobody has {requirement.skillTags.length === 1 ? 'that' : 'all of those'}, so this cannot be
        booked at all. Add it under Skills or features on the person who does it.
      </FieldStatus>
    );
  }
  if (requirement.skillTags.length === 0) {
    return <FieldDescription>Anyone can take this booking.</FieldDescription>;
  }
  return (
    <FieldDescription>
      {fits.length === 1 ? 'Only ' : ''}
      {inWords(fits)} can take this booking.
    </FieldDescription>
  );
}
