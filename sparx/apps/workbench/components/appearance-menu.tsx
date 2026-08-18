'use client';

// Light, dark, or whatever the computer is set to.
//
// ── WHY THIS IS A MENU AND NOT A TOGGLE ─────────────────────────────────────
//
// It was a single button that flipped between two states, with the glyph
// showing the one you would be switching TO — the convention every two-state
// view control uses. That convention has no third seat. `system` is not a
// darker light or a lighter dark; it is "stop deciding this, follow the
// machine", and a button that cycles three states makes a person click twice to
// find out where they are. Three items, one tick, and the choice is visible
// before it is made.
//
// ── THE TICK AND THE GLYPH SAY DIFFERENT THINGS, ON PURPOSE ─────────────────
//
// The tick marks the CHOICE. The glyph on the trigger shows what that choice
// currently MEANS — a sun, a moon, or, while following the machine, whichever
// of the two the machine is on. Somebody on "match my computer" at night sees a
// moon and the tick against "match my computer", which is both facts at once and
// is why the resolved theme is read off the document rather than passed in.
//
// ── COLORLESS ───────────────────────────────────────────────────────────────
//
// No `color`, deliberately. This is chrome: it does not distinguish one thing
// from another and it has no subject of its own. A colorless `ghost` resolves to
// `base-content`, so the control wears the very appearance it sets.

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
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useDocumentTheme } from '../lib/use-document-theme';
import type { Theme, ThemeChoice } from '../lib/theme';

/**
 * The three choices, in the order they are offered — the default first, because
 * it is the one most people should stay on and the one they come back to.
 */
export const APPEARANCE_OPTIONS: { choice: ThemeChoice; label: string }[] = [
  { choice: 'system', label: 'Match my computer' },
  { choice: 'light', label: 'Light' },
  { choice: 'dark', label: 'Dark' },
];

function labelFor(choice: ThemeChoice): string {
  return APPEARANCE_OPTIONS.find((option) => option.choice === choice)?.label ?? 'Light';
}

/** The glyph for a choice, once it is known what that choice resolves to. */
function Glyph({ choice, theme }: { choice: ThemeChoice; theme: Theme }) {
  if (choice === 'system') return <Monitor className="size-4" aria-hidden />;
  return theme === 'dark' ? (
    <Moon className="size-4" aria-hidden />
  ) : (
    <Sun className="size-4" aria-hidden />
  );
}

/** Said in full, for the tooltip and the screen reader — the choice AND, when it
 *  is being followed rather than pinned, what it currently comes out as. */
function describe(choice: ThemeChoice, theme: Theme): string {
  if (choice === 'system') return `Matching your computer, which is ${theme} right now`;
  return `${labelFor(choice)}, whatever your computer is set to`;
}

interface AppearanceProps {
  choice: ThemeChoice;
  onSetTheme: (choice: ThemeChoice) => void;
}

/**
 * The three items on their own, for a shell that already has a menu to put them
 * in — the mobile shell hangs everything off one account menu, because a bar the
 * height of a thumb has no room for a second trigger.
 */
export function AppearanceMenuItems({ choice, onSetTheme }: AppearanceProps) {
  const theme = useDocumentTheme();

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Appearance</DropdownMenuLabel>
      {APPEARANCE_OPTIONS.map((option) => (
        <DropdownMenuItem
          key={option.choice}
          onClick={() => {
            onSetTheme(option.choice);
          }}
        >
          <span className="flex w-full items-center gap-2">
            <Glyph choice={option.choice} theme={theme} />
            <span className="flex-1 truncate">{option.label}</span>
            {option.choice === choice ? <Check className="size-4" aria-hidden /> : null}
          </span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  );
}

/** The whole control — trigger and menu — for the desktop toolbar, where
 *  appearance sits with the other whole-window preferences. */
export function AppearanceMenu({ choice, onSetTheme }: AppearanceProps) {
  const theme = useDocumentTheme();

  return (
    <DropdownMenu>
      <Tooltip content={describe(choice, theme)}>
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            aria-label={`Appearance: ${describe(choice, theme)}`}
          >
            <Glyph choice={choice} theme={theme} />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        <AppearanceMenuItems choice={choice} onSetTheme={onSetTheme} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
