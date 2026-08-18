'use client';

import { Alert, AlertContent, AlertDescription, AlertTitle } from '@wizeworks/silicaui-react';
import { faEyeLowVision } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { copyText } from '../lib/download';
import { PaletteBar } from './bar';
import { Stage } from './stage';
import { VISIONS, type Vision } from './vision';
import type { Assignment, ContentInk, Role } from './roles';
import type { Scheme } from './generate';
import type { usePalette } from './use-palette';

/** The bar, the colors, and what to do with them — the part of the page
 *  somebody actually plays with, kept together so the tool below it reads as a
 *  list of what happens next. */
export function PaletteEditor({
  palette: p,
  roles,
  ink,
  scheme,
  vision,
  onScheme,
  onVision,
  onInk,
  onResetInk,
}: {
  palette: ReturnType<typeof usePalette>;
  roles: Assignment;
  ink: ContentInk;
  scheme: Scheme;
  vision: Vision;
  onScheme: (scheme: Scheme) => void;
  onVision: (vision: Vision) => void;
  onInk: (role: Role, hex: string) => void;
  onResetInk: (role: Role) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PaletteBar
        count={p.palette.length}
        scheme={scheme}
        vision={vision}
        canUndo={p.canUndo}
        canRedo={p.canRedo}
        onShuffle={p.shuffle}
        onUndo={p.undo}
        onRedo={p.redo}
        onScheme={onScheme}
        onVision={onVision}
        onAdd={p.add}
        onRemove={() => p.remove(p.palette[p.palette.length - 1]!.id)}
      />

      <Stage
        palette={p.palette}
        roles={roles}
        ink={ink}
        vision={vision}
        onCopy={(hex) => void copyText(hex)}
        onLock={p.toggleLock}
        onChange={p.setHex}
        onRemove={p.remove}
        onReorder={p.reorder}
        onDragStart={p.beginDrag}
        onDragEnd={p.endDrag}
        onInk={onInk}
        onResetInk={onResetInk}
      />

      <p className="text-base">
        <strong>The job belongs to the position, not to the color.</strong> Drag a swatch under a
        different heading to give it that job — move your pink to the front and it becomes{' '}
        <span className="font-mono font-semibold">primary</span>, which is{' '}
        <span className="font-mono font-semibold">--color-primary</span> in every export below.
        Keeping a color pins it to the job it is doing, so shuffling leaves both alone.
      </p>

      {/* A real Alert, not a bordered div. `role="status"` because nothing has
          gone wrong — this reports the mode the stage is being shown in. */}
      {vision !== 'normal' ? (
        <Alert color="info" role="status">
          <Icon glyph={faEyeLowVision} aria-hidden />
          <AlertContent>
            <AlertTitle>{VISIONS[vision].label}</AlertTitle>
            <AlertDescription>
              {VISIONS[vision].blurb} The codes on each color have not changed — only what is on the
              screen has.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}
    </div>
  );
}
