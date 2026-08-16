'use client';

// Choosing a look — the business's own, and the ready-made ones.
//
// Picking a ready-made look COPIES it. That is the difference between "use this"
// and "point at this": a copy is editable, and it cannot change under a live site
// because someone upstream revised it. The copy is made the moment it is chosen,
// so the author is always editing something of their own.

import { useState } from 'react';
import { Badge, Button, Dialog, DialogContent, DialogTitle } from '@wizeworks/silicaui-react';
import { faCheck, faPalette } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { buildSilicaThemeCssFromTheme } from '@sparx/site-themes';
import {
  useApplyTheme,
  useCreateTheme,
  useThemePresets,
  useThemes,
  type ThemeRow,
} from '../../lib/studio/data';

/** A slug safe to put in a CSS attribute selector. */
function swatchKey(groupKey: string, name: string): string {
  return `${groupKey}-${name}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function ThemeLibrary({
  appliedId,
  openId,
  onOpen,
}: {
  appliedId: string | null;
  openId: string | null;
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const themes = useThemes();
  const presets = useThemePresets();
  const applyTheme = useApplyTheme();
  const createTheme = useCreateTheme();

  const current = themes.data?.find((row) => row.id === openId);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Icon glyph={faPalette} className="size-4" aria-hidden />
        {current?.name ?? 'Choose a look'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Your look</DialogTitle>

          <section className="mt-4">
            <h3 className="text-base-content mb-2 text-sm font-medium">Yours</h3>
            {themes.data?.length ? (
              <ul className="flex flex-col gap-1">
                {themes.data.map((row) => (
                  <OwnRow
                    key={row.id}
                    row={row}
                    applied={row.id === appliedId}
                    onOpen={() => {
                      onOpen(row.id);
                      setOpen(false);
                    }}
                    onApply={() => void applyTheme.mutateAsync(row.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-base-content text-sm">
                Nothing saved yet. Start from one of the ready-made looks below.
              </p>
            )}
          </section>

          <section className="mt-6">
            <h3 className="text-base-content text-sm font-medium">Ready-made</h3>
            <p className="text-base-content mb-2 text-sm">
              Pick one and it becomes yours — a copy you can change however you like.
            </p>
            {/* One real stylesheet for the whole shelf, scoped per look. That is
                what lets each swatch below wear `bg-primary` and mean THAT look's
                primary — no inline style, and no class name computed at runtime
                (which Tailwind would never generate). */}
            <style>
              {(presets.data ?? [])
                .flatMap((group) =>
                  group.themes.map((theme) =>
                    buildSilicaThemeCssFromTheme(theme, {
                      rootSelector: `[data-look="${swatchKey(group.key, theme.name)}"]`,
                    })
                  )
                )
                .join('')}
            </style>
            <div className="flex max-h-72 flex-col gap-4 overflow-auto">
              {presets.data?.map((group) => (
                <div key={group.key}>
                  <h4 className="text-base-content mb-1 text-sm">{group.label}</h4>
                  <div className="flex flex-wrap gap-1">
                    {group.themes.map((theme) => (
                      <Button
                        key={theme.name}
                        size="sm"
                        data-look={swatchKey(group.key, theme.name)}
                        onClick={async () => {
                          const made = await createTheme.mutateAsync({
                            name: theme.name,
                            theme,
                            origin: 'preset',
                            sourceKey: theme.name,
                          });
                          await applyTheme.mutateAsync(made.id);
                          onOpen(made.id);
                          setOpen(false);
                        }}
                      >
                        <Swatch />
                        {theme.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OwnRow({
  row,
  applied,
  onOpen,
  onApply,
}: {
  row: ThemeRow;
  applied: boolean;
  onOpen: () => void;
  onApply: () => void;
}) {
  return (
    <li className="hover:bg-base-200 flex items-center gap-2 rounded px-2 py-1.5">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <span className="block truncate text-sm">{row.name}</span>
      </button>
      {applied ? (
        <Badge color="success" variant="soft" size="sm">
          <Icon glyph={faCheck} className="size-3" aria-hidden /> On your site
        </Badge>
      ) : (
        <Button size="sm" color="primary" variant="soft" onClick={onApply}>
          Use it
        </Button>
      )}
      {row.unpublished ? (
        <Badge color="warning" variant="soft" size="sm">
          Not live yet
        </Badge>
      ) : null}
    </li>
  );
}

/**
 * Three dots of a look, so the shelf is scannable by color before it is read.
 *
 * The classes are the ordinary token ones — they resolve to THIS look because the
 * button above carries `data-look` and the stylesheet scopes that look's tokens to
 * it. Literal class names, so Tailwind generates them; nothing computed, and no
 * inline style.
 */
function Swatch() {
  return (
    <span className="mr-1 inline-flex gap-0.5" aria-hidden>
      <span className="bg-primary border-base-300 inline-block size-2.5 rounded-full border" />
      <span className="bg-secondary border-base-300 inline-block size-2.5 rounded-full border" />
      <span className="bg-accent border-base-300 inline-block size-2.5 rounded-full border" />
    </span>
  );
}
