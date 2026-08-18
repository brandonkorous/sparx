'use client';

// The control: light, dark, or match my computer.
//
// ── WHY THIS IS A MENU AND NOT A TOGGLE ─────────────────────────────────────
//
// Every Piggles app had a single button that flipped between two states, with
// the glyph showing the one you would be switching TO — the convention every
// two-state view control uses. That convention has no third seat. `system` is
// not a darker light or a lighter dark; it is "stop deciding this, follow the
// machine", and a button that cycles three states makes a person click twice to
// find out where they are. Three items, one tick, and the choice is visible
// before it is made.
//
// ── THE TICK AND THE GLYPH SAY DIFFERENT THINGS, ON PURPOSE ─────────────────
//
// The tick marks the CHOICE. The glyph on the trigger shows what that choice
// currently MEANS — a sun, a moon, or, while following the machine, whichever of
// the two the machine is on. Somebody on "match my computer" at night sees a
// moon and the tick against "match my computer", which is both facts at once and
// is why the resolved theme is read off the document rather than assumed.
//
// ── COLORLESS ───────────────────────────────────────────────────────────────
//
// No `color`, deliberately. This is chrome: it does not distinguish one thing
// from another, it has no subject of its own, and on the marketing bar it must
// not compete with "Get Piggles" two elements along, which is the one pink thing
// there. A colorless `ghost` resolves to `base-content`, so the control wears the
// very appearance it sets.
//
// ── WHY THE GLYPHS ARE A PROP ───────────────────────────────────────────────
//
// This package deliberately does not depend on an icon set — `Icon` here takes a
// glyph structurally, and the apps own which family they draw from. Four glyphs
// passed in is the whole cost of that, and it keeps the words, the behaviour and
// the markup in one place, which is the part that was drifting.

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { Icon, type IconGlyph } from './icon';
import {
  APPEARANCE_OPTIONS,
  describeAppearance,
  type Appearance,
  type ResolvedAppearance,
} from './appearance';

export interface AppearanceGlyphs {
  /** Drawn for "match my computer" — a screen, because that is the thing being
   *  matched. */
  system: IconGlyph;
  light: IconGlyph;
  dark: IconGlyph;
  /** The tick beside the current choice. */
  check: IconGlyph;
}

interface AppearanceProps {
  choice: Appearance;
  /** What the choice resolves to right now — from `useAppearance().theme`. */
  theme: ResolvedAppearance;
  onChoose: (choice: Appearance) => void;
  glyphs: AppearanceGlyphs;
}

function glyphFor(
  choice: Appearance,
  theme: ResolvedAppearance,
  glyphs: AppearanceGlyphs
): IconGlyph {
  if (choice === 'system') return glyphs.system;
  return theme === 'dark' ? glyphs.dark : glyphs.light;
}

/**
 * The three items on their own, for chrome that already has a menu to put them
 * in — a phone header hangs everything off one account menu, because a bar the
 * height of a thumb has no room for a second trigger.
 */
export function AppearanceMenuItems({ choice, theme, onChoose, glyphs }: AppearanceProps) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Appearance</DropdownMenuLabel>
      {APPEARANCE_OPTIONS.map((option) => (
        <DropdownMenuItem
          key={option.choice}
          onClick={() => {
            onChoose(option.choice);
          }}
        >
          <span className="flex w-full items-center gap-2">
            <Icon glyph={glyphFor(option.choice, theme, glyphs)} className="size-4" />
            <span className="flex-1 truncate">{option.label}</span>
            {option.choice === choice ? <Icon glyph={glyphs.check} className="size-4" /> : null}
          </span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  );
}

/**
 * The whole control — trigger and menu — for chrome with room for its own
 * button.
 *
 * `shape` is a real silica prop rather than a rounding class from the call site:
 * the console's bar is a row of squares and the marketing bar's is a circle, and
 * that is a choice about the chrome around it, not a repaint of the control.
 */
export function AppearanceMenu({
  choice,
  theme,
  onChoose,
  glyphs,
  shape = 'square',
}: AppearanceProps & { shape?: 'square' | 'circle' }) {
  const described = describeAppearance(choice, theme);

  return (
    <DropdownMenu>
      <Tooltip content={described}>
        <DropdownMenuTrigger>
          <Button variant="ghost" shape={shape} aria-label={`Appearance: ${described}`}>
            <Icon glyph={glyphFor(choice, theme, glyphs)} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        <AppearanceMenuItems choice={choice} theme={theme} onChoose={onChoose} glyphs={glyphs} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
