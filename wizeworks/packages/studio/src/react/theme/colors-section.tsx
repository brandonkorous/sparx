'use client';

// Every color the theme carries — including the ones this package has never heard
// of.
//
// `rolesOf` is the open list: the eight silica names plus anything a look brought
// with it, read from the dark bag as well as the light one. Rendering only the
// hardcoded groups would leave a color that really is in the theme invisible in
// the one screen that exists to edit it.

import { useMemo } from 'react';
import { rolesOf } from '@wizeworks/silicaui-html';
import type { ThemeDoc } from '../../documents/types';
import { useDoc } from '../context';
import { AddColor } from './add-color';
import { ColorTile } from './color-tile';
import { RailSection } from './rail-section';
import { RemoveColor } from './remove-color';
import {
  COLOR_GROUPS,
  customRoleSample,
  isKnownColorToken,
  roleOf,
  type ColorRole,
} from './tokens';

export function ColorsSection() {
  const doc = useDoc<ThemeDoc>();
  const extras = useExtraRoles(doc);

  return (
    <RailSection icon="droplet" title="Colors">
      {COLOR_GROUPS.map((group) => (
        <div key={group.label} className="mb-5 last:mb-0">
          <h4 className="text-base-content text-base font-semibold">{group.label}</h4>
          <p className="text-base-content mb-1 text-sm">{group.hint}</p>
          <ul>
            {group.roles.map((role) => (
              <ColorTile key={role.token} role={role} />
            ))}
          </ul>
        </div>
      ))}

      <div className="border-base-300 border-t pt-4">
        <h4 className="text-base-content text-base font-semibold">Your own colors</h4>
        <p className="text-base-content mb-2 text-sm">
          Name a color and it works everywhere the built-in ones do — buttons, badges, alerts, tabs.
          Nothing has to be rebuilt for it.
        </p>
        {extras.length ? (
          <ul className="mb-3">
            {extras.map((role) => (
              <ColorTile
                key={role.token}
                role={role}
                extra={<RemoveColor token={role.token} label={role.label} />}
              />
            ))}
          </ul>
        ) : null}
        <AddColor />
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
          hint: 'Yours. It behaves exactly like the built-in colors.',
          sample: customRoleSample(roleOf(token)),
          contentToken: `${token}-content`,
        })),
    [doc.theme]
  );
}
