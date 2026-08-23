'use client';

// Light or Dark — which of the theme's two palettes a pane is showing.
//
// ONE control, because every pane that can show both has to agree about what the
// choice is called and what it does. It began as a private pair of buttons in the
// theme builder, which is why for a long time a theme's dark colors could only be
// SEEN in the pane where they were typed: an author set them, went to look at a
// page, and saw the day palette with nothing to say otherwise.
//
// Light and Dark, not day and night. Dark mode is a setting a visitor chooses and
// keeps — plenty of people are on it at nine in the morning — so naming it after a
// time of day describes the wrong thing.
//
// A theme pane EDITS the mode it is switched to; a page, layout or piece pane only
// LOOKS at it. Same words either way, because it is the same question about the
// same two bags of color.

import { Button } from '@wizeworks/silicaui-react';
import { StudioIcon } from './icon';

/** Which palette is on screen. Never a theme's NAME: silica emits its dark delta
 *  under `[data-theme="dark"]` and under a `prefers-color-scheme` media query
 *  guarded by `:not([data-theme="light"])`, so anything else fails the guard and
 *  a dark-mode computer silently repaints the canvas in night colors. */
export type StudioMode = 'light' | 'dark';

export function ModeSwitch({
  mode,
  onMode,
  compact,
}: {
  mode: StudioMode;
  onMode: (mode: StudioMode) => void;
  /** Icon-only, for a toolbar that already carries a row of device buttons. */
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <ModeButton
        icon="sun"
        label="Light"
        compact={compact}
        selected={mode === 'light'}
        onSelect={() => onMode('light')}
      />
      <ModeButton
        icon="moon"
        label="Dark"
        compact={compact}
        selected={mode === 'dark'}
        onSelect={() => onMode('dark')}
      />
    </div>
  );
}

function ModeButton({
  icon,
  label,
  selected,
  compact,
  onSelect,
}: {
  icon: string;
  label: string;
  selected: boolean;
  compact?: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      size="sm"
      aria-pressed={selected}
      aria-label={label}
      title={compact ? `Show the ${label.toLowerCase()} colors` : undefined}
      {...(compact ? { shape: 'square' as const } : {})}
      {...(selected ? { color: 'primary' as const } : {})}
      onClick={onSelect}
    >
      <StudioIcon name={icon} className="text-base" />
      {compact ? null : label}
    </Button>
  );
}
