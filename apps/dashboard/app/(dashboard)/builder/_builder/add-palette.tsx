'use client';

// The Add palette — opinionated composites and raw primitives in ONE palette,
// grouped Layout / Content & media / From your modules. Module-supplied
// components are tagged and color-coded; a component appears here because its
// module is on. Clicking drops it inside the current target container.

import * as React from 'react';
import { cn } from '@sparx/ui';

import { PALETTE, type ComponentDef, type PaletteGroup } from './registry';
import { MODULES, moduleColor } from './sample';

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
    </button>
  );
}

export function AddPalette({
  targetName,
  onAdd,
}: {
  targetName: string;
  onAdd: (type: string) => void;
}) {
  const offModules = MODULES.filter((m) => !m.on);
  return (
    <div className="bx-palette">
      <p className="bx-pal-target">
        Adds inside <strong>{targetName}</strong>
      </p>
      {GROUPS.map(({ group, label }) => {
        const defs = PALETTE.filter((d) => d.group === group);
        if (defs.length === 0) return null;
        return (
          <section key={group} className="bx-pal-group">
            <h4 className="bx-pal-label">{label}</h4>
            <div className="bx-tiles">
              {defs.map((def) => (
                <Tile key={def.type} def={def} onAdd={onAdd} />
              ))}
            </div>
            {group === 'data' && offModules.length > 0 ? (
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
    </div>
  );
}
