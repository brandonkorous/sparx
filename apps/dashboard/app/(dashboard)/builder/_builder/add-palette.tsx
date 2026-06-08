'use client';

// The Add palette — opinionated composites and raw primitives in ONE palette,
// grouped Layout / Content & media / From your modules. Module-supplied
// components are tagged and color-coded; a component appears here because its
// module is on. Clicking drops it inside the current target container.

import * as React from 'react';
import { Layers } from 'lucide-react';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { cn } from '@sparx/ui';
import { customType, type ComponentDto } from '@sparx/builder-schemas';

import {
  paletteForSurface,
  type ComponentDef,
  type EditorSurface,
  type PaletteGroup,
} from './registry';
import { moduleColor } from './binding-catalog';
import { MODULES } from './sample';

const GROUPS: { group: PaletteGroup; label: string }[] = [
  { group: 'layout', label: 'Layout' },
  { group: 'content', label: 'Content & media' },
  { group: 'data', label: 'From your modules' },
];

function Tile({ def, onAdd }: { def: ComponentDef; onAdd: (type: string) => void }) {
  const Icon = def.icon;
  const color = def.module ? moduleColor(def.module) : undefined;
  return (
    <button type="button" className="bx-tile" onClick={() => onAdd(def.type)}>
      {def.module ? (
        <span className="bx-tile__mod" style={{ background: color }}>
          {def.module.toUpperCase()}
        </span>
      ) : null}
      <Icon className="bx-tile__icon" aria-hidden />
      <span className="bx-tile__name">{def.label}</span>
      {def.composition === 'composite' ? (
        <span
          className="bx-tile__kind"
          title="Composite — built from other components"
          aria-label="Composite component"
        >
          <Layers aria-hidden />
        </span>
      ) : null}
    </button>
  );
}

// A tenant component tile (docs/53 P-B). Its icon is a lucide NAME (stored as a
// string), rendered via the lazy DynamicIcon; clicking drops a `custom:<key>`
// placement pinned to the component's latest version.
function CustomTile({ comp, onAdd }: { comp: ComponentDto; onAdd: (type: string) => void }) {
  return (
    <button
      type="button"
      className="bx-tile bx-tile--custom"
      onClick={() => onAdd(customType(comp.key))}
    >
      <span className="bx-tile__mod" style={{ background: 'var(--module-active)' }}>
        YOURS
      </span>
      <DynamicIcon name={comp.icon as IconName} className="bx-tile__icon" aria-hidden />
      <span className="bx-tile__name">{comp.name}</span>
    </button>
  );
}

export function AddPalette({
  targetName,
  onAdd,
  surface = 'page',
  customComponents,
}: {
  targetName: string;
  onAdd: (type: string) => void;
  /** Which editor this palette serves — gates which components show (docs/45). */
  surface?: EditorSurface;
  /** The tenant's custom components (docs/53 P-B). Shown under "Your components",
   *  filtered to those available on this surface. */
  customComponents?: ComponentDto[];
}) {
  const offModules = MODULES.filter((m) => !m.on);
  const palette = paletteForSurface(surface);
  const mine = (customComponents ?? []).filter((c) => c.surfaces.includes(surface));
  return (
    <div className="bx-palette">
      <p className="bx-pal-target">
        Adds inside <strong>{targetName}</strong>
      </p>
      {GROUPS.map(({ group, label }) => {
        const defs = palette.filter((d) => d.group === group);
        if (defs.length === 0) return null;
        return (
          <section key={group} className="bx-pal-group">
            <h4 className="bx-pal-label">{label}</h4>
            <div className="bx-tiles">
              {defs.map((def) => (
                <Tile key={def.type} def={def} onAdd={onAdd} />
              ))}
            </div>
            {group === 'data' && surface === 'page' && offModules.length > 0 ? (
              <div className="bx-tiles">
                {offModules.map((m) => (
                  <span key={m.key} className={cn('bx-tile', 'bx-tile--off')}>
                    <span
                      className="bx-tile__mod"
                      style={{ background: 'var(--color-text-muted)' }}
                    >
                      {m.label.toUpperCase()}
                    </span>
                    <span className="bx-tile__name">+ enable</span>
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}

      {/* Tenant components (docs/53). A component you built, dropped as a pinned
          reference — edits to the component update everywhere it's placed. */}
      {mine.length > 0 ? (
        <section className="bx-pal-group">
          <h4 className="bx-pal-label">Your components</h4>
          <div className="bx-tiles">
            {mine.map((comp) => (
              <CustomTile key={comp.key} comp={comp} onAdd={onAdd} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
