'use client';

// Every color the theme declares, with the ink that will sit on it.
//
// A chip here is a real `bg-<role>` element wearing its own `-content`
// foreground, so a role that has no legible ink LOOKS unreadable rather than
// being reported as a number somewhere else. That is the whole reason the board
// shows colors as blocks of text instead of squares.
//
// `neutral` appears because the theme defines it. This is the specimen sheet: a
// palette missing a role it really has would be a worse lie than an unused chip.

import { Badge } from '@wizeworks/silicaui-react';
import { rolesOf } from '@wizeworks/silicaui-html';
import type { ThemeDoc } from '../../../documents/types';
import { useDoc } from '../../context';
import { COLOR_GROUPS, customRoleSample, isKnownColorToken, roleOf } from '../tokens';
import { BoardTile, Specimen } from './tile';

const ROLES = COLOR_GROUPS.flatMap((group) => group.roles);

export function PaletteTile() {
  const doc = useDoc<ThemeDoc>();
  // A color the author invented belongs on the board as much as a built-in one —
  // it is the same kind of thing, and leaving it off makes the board a partial
  // answer to the only question it exists to answer.
  const invented = rolesOf(doc.theme)
    .map((role) => `--color-${role}`)
    .filter((token) => !isKnownColorToken(token))
    .map((token) => ({
      token,
      label: roleOf(token),
      hint: '',
      sample: customRoleSample(roleOf(token)),
    }));

  return (
    <BoardTile
      title="Your palette"
      hint="Each block is the color, and the text on it is the ink your site will really use."
    >
      <div className="grid grid-cols-2 gap-2">
        {[...ROLES, ...invented].map((role) => (
          <div key={role.token} className={`${role.sample} rounded-box px-3 py-2`}>
            <p className="text-base font-semibold">{role.label}</p>
            <p className="text-sm">{roleOf(role.token)}</p>
          </div>
        ))}
      </div>

      <Specimen label="The same colors, softened — how they look behind a label">
        <Badge color="primary" variant="soft">
          Main
        </Badge>
        <Badge color="secondary" variant="soft">
          Second
        </Badge>
        <Badge color="accent" variant="soft">
          Highlight
        </Badge>
        <Badge color="info" variant="soft">
          Information
        </Badge>
        <Badge color="success" variant="soft">
          Went through
        </Badge>
        <Badge color="warning" variant="soft">
          Needs a look
        </Badge>
        <Badge color="error" variant="soft">
          Went wrong
        </Badge>
        <Badge color="neutral" variant="soft">
          Neutral
        </Badge>
      </Specimen>
    </BoardTile>
  );
}
