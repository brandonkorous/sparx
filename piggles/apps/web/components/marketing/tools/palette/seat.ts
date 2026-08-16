import { hexToOklch } from '@wizeworks/silicaui-react';
import { roleAt, type Role } from './roles';
import type { Palette } from './model';

/**
 * How well a colour suits the slot it is being considered for.
 *
 * Lower is better. Position IS the role, so a shuffle that returns the right
 * five colours in the wrong order returns a broken theme — a dark green sitting
 * in the `base-100` slot is a page nobody can read. This is the measurement that
 * used to run at paint time, moved to where it can actually fix the problem.
 */
function cost(role: Role, oklch: { l: number; c: number } | null): number {
  if (!oklch) return 99;
  switch (role) {
    // The page wants the lightest thing there is.
    case 'base-100':
      return 1 - oklch.l;
    // Chrome wants the least colourful thing, and a dark one — it is also where
    // the page's writing comes from. This used to prefer LIGHT, which was right
    // while a separate `base-content` slot was taking the dark tone and is
    // exactly backwards now that neutral supplies it.
    case 'neutral':
      return oklch.c * 4 + oklch.l * 0.6;
    // The colour roles want colour, in descending order of how much.
    case 'primary':
      return 1 - oklch.c * 3;
    case 'accent':
      return 1 - oklch.c * 3 + 0.05;
    default:
      return 1 - oklch.c * 3 + 0.1;
  }
}

/**
 * Put the colours in the slots that suit them.
 *
 * A LOCKED SWATCH KEEPS ITS SLOT, which is what makes a lock mean "this colour,
 * in this job" rather than merely "this colour, somewhere". Everything else is
 * dealt into the slots that are left, cheapest fit first — so pressing shuffle
 * always lands a page in the page slot without anybody arranging it.
 */
export function seat(palette: Palette): Palette {
  const free = palette.map((s, i) => ({ s, i })).filter(({ s }) => !s.locked);
  const openSlots = palette.map((_, i) => i).filter((i) => !palette[i]!.locked);

  const pairs = free.flatMap(({ s, i }) =>
    openSlots.map((slot) => ({
      from: i,
      slot,
      cost: cost(roleAt(slot) ?? 'secondary', hexToOklch(s.hex)),
    }))
  );
  pairs.sort((a, b) => a.cost - b.cost);

  const seated = [...palette];
  const usedSlot = new Set<number>();
  const usedFrom = new Set<number>();
  for (const p of pairs) {
    if (usedSlot.has(p.slot) || usedFrom.has(p.from)) continue;
    seated[p.slot] = palette[p.from]!;
    usedSlot.add(p.slot);
    usedFrom.add(p.from);
  }
  return seated;
}
