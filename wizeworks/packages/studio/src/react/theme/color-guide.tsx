'use client';

// What every color in the theme is FOR — once, in a modal, rather than as a
// paragraph beside each of twelve swatches.
//
// The grid answers "what colour is this" without a word. This answers "which one
// should I change", which is a different question, asked far less often, and the
// only one that needs sentences.

import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogTitle } from '@wizeworks/silicaui-react';
import { StudioIcon } from '../icon';
import { formatRatio, readContrast } from './contrast';
import { useThemeEdit } from './edit-context';
import { ThemeChip } from './island';
import { COLOR_GROUPS, type ColorRole } from './tokens';

export function ColorGuide({ extras }: { extras: ColorRole[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <StudioIcon name="info" className="text-base" />
        What are these for?
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>What each color is for</DialogTitle>
          <div className="mt-2 max-h-[70vh] overflow-auto">
            {COLOR_GROUPS.map((group) => (
              <GuideGroup
                key={group.label}
                label={group.label}
                hint={group.hint}
                roles={group.roles}
              />
            ))}
            {extras.length ? (
              <GuideGroup
                label="Your own colors"
                hint="Colors you named. They behave exactly like the built-in ones."
                roles={extras}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GuideGroup({ label, hint, roles }: { label: string; hint: string; roles: ColorRole[] }) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="text-base-content text-base font-semibold">{label}</h3>
      <p className="text-base-content mb-2 text-sm">{hint}</p>
      <ul className="flex flex-col gap-2">
        {roles.map((role) => (
          <GuideRow key={role.token} role={role} />
        ))}
      </ul>
    </section>
  );
}

function GuideRow({ role }: { role: ColorRole }) {
  const { mode, values } = useThemeEdit();
  const reading = readContrast(role.token, values[role.token], values, role.contentToken);

  return (
    <li className="flex items-center gap-3">
      {/* Console chrome outside, theme colour inside — see `color-swatch`. */}
      <span className="border-base-300 block shrink-0 overflow-hidden rounded-lg border">
        <ThemeChip mode={mode} className="block">
          <span
            className={`${role.sample} flex size-12 items-center justify-center text-base font-semibold`}
          >
            Aa
          </span>
        </ThemeChip>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base-content text-base font-medium">{role.label}</p>
        <p className="text-base-content text-sm">{role.hint}</p>
      </div>
      {reading ? (
        <p className={reading.passes ? 'text-base-content text-sm' : 'text-warning text-sm'}>
          {formatRatio(reading.ratio)}
        </p>
      ) : null}
    </li>
  );
}
