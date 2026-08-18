'use client';

// Every color the theme carries — including the ones this package has never heard
// of — as a grid of blocks, two to a color.
//
// `rolesOf` is the open list: the eight silica names plus anything a look brought
// with it or an author invented, read from the dark bag as well as the light one.
// Rendering only the hardcoded groups would leave a color that really is in the
// theme invisible in the one screen that exists to edit it.
//
// Four columns, so a pair always lands side by side: the fill and its ink read as
// one thing when they touch and as two unrelated squares when they wrap apart.

import { useMemo } from 'react';
import { rolesOf } from '@wizeworks/silicaui-html';
import type { ThemeDoc } from '../../documents/types';
import { useApply, useDoc } from '../context';
import { AddColor } from './add-color';
import { ColorGuide } from './color-guide';
import { ColorSwatch } from './color-swatch';
import { useThemeEdit } from './edit-context';
import { RailSection } from './rail-section';
import {
  COLOR_GROUPS,
  customRoleSample,
  isKnownColorToken,
  roleOf,
  tilesOf,
  type ColorRole,
} from './tokens';

export function ColorsSection() {
  const doc = useDoc<ThemeDoc>();
  const extras = useExtraRoles(doc);
  const remove = useRemoveColor();

  return (
    <RailSection icon="droplet" title="Colors" action={<ColorGuide extras={extras} />}>
      {COLOR_GROUPS.map((group) => (
        <div key={group.label} className="mb-4 last:mb-0">
          <h4 className="text-base-content mb-2 text-sm">{group.label}</h4>
          <div className="grid grid-cols-4 gap-2">
            {group.roles.flatMap((role) =>
              tilesOf(role).map((tile) => <ColorSwatch key={tile.token} tile={tile} />)
            )}
          </div>
        </div>
      ))}

      <div>
        <h4 className="text-base-content mb-2 text-sm">Your own colors</h4>
        <div className="grid grid-cols-4 gap-2">
          {extras.flatMap((role) =>
            tilesOf(role).map((tile) => (
              <ColorSwatch
                key={tile.token}
                tile={tile}
                // Removing is one action on the pair, so it hangs off the fill —
                // offering it on both halves would read as two separate deletes.
                onRemove={tile.ink ? undefined : () => remove(role)}
              />
            ))
          )}
          <AddColor />
        </div>
      </div>
    </RailSection>
  );
}

/** Roles the theme declares that the grouped table above does not name. */
function useExtraRoles(doc: ThemeDoc): ColorRole[] {
  return useMemo(
    () =>
      rolesOf(doc.theme)
        .map((role) => `--color-${role}`)
        .filter((token) => !isKnownColorToken(token))
        .map((token) => ({
          token,
          label: roleOf(token),
          short: roleOf(token),
          hint: 'Yours. It behaves exactly like the built-in colors.',
          sample: customRoleSample(roleOf(token)),
          contentToken: `${token}-content`,
        })),
    [doc.theme]
  );
}

/**
 * Take an invented color back out — both halves, in ONE batch.
 *
 * A stranded `--color-sale-content` generates a rule for a color that no longer
 * exists, and a role that is half-present is exactly the state nothing downstream
 * checks for. One batch, so putting it back is one action.
 */
function useRemoveColor(): (role: ColorRole) => void {
  const apply = useApply();
  const { mode } = useThemeEdit();
  return (role) => {
    apply(`Remove ${role.label}`, [
      { kind: 'theme.setToken', mode, token: role.token, value: undefined },
      ...(role.contentToken
        ? [
            {
              kind: 'theme.setToken' as const,
              mode,
              token: role.contentToken,
              value: undefined,
            },
          ]
        : []),
    ]);
  };
}
