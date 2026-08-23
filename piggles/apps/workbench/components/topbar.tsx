'use client';

// The top bar — where you are on the left, who you are on the right.
//
// The left half answers "which business, which site": the Piggles lockup, the
// business name, and the SITE — the one control that changes what everything
// else on screen means. A business can own more than one site and they are
// genuinely different businesses to the person walking in the door, so the
// switcher is prominent rather than buried in settings.
//
// There is deliberately NO breadcrumb. A breadcrumb narrates one location, and
// this app is in several at once — the tabs are the orientation. What earns a
// place up here is only what applies to the whole window.
//
// Each control owns its own file under components/topbar/; this states the shape
// of the bar and nothing else (RULE #0.5).

import {
  Button,
  Kbd,
  Navbar,
  NavbarCenter,
  NavbarEnd,
  NavbarStart,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { faCopy, faGrid, faMagnifyingGlass } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Logo } from '@piggles/brand/react';
import { PRODUCT } from '@piggles/config';
import { useTenant } from '@/lib/api/shell-data';
import { AppearanceMenu } from '@/components/appearance-menu';
import { NotificationCenter } from '@/components/notification-center';
import { FeedbackButton } from '@/components/feedback/button';
import { BusinessSwitcher } from '@/components/topbar/business-switcher';
import { QuickAdd } from '@/components/topbar/quick-add';
import { SiteSwitcher } from '@/components/topbar/site-switcher';
import { ViewerMenu } from '@/components/topbar/viewer-menu';
import type { Theme, ThemeChoice } from '@/lib/theme';
import type { WindowMode } from '@/lib/window-mode';

interface TopbarProps {
  userName: string;
  userEmail: string;
  /** The APPEARANCE the person picked, which is not the same as the one on
   *  screen: `system` is a choice, and it resolves to one of the other two. The
   *  control below shows both — the tick marks the choice, the glyph shows what
   *  it currently means. */
  themeChoice: ThemeChoice;
  /** What that choice resolves to right now — read off the document by the
   *  appearance hook, so the glyph can never disagree with the screen. */
  theme: Theme;
  /** Canonical layout key for the current site — see the shell's boot. */
  siteKey: string;
  /**
   * Where the account app lives, e.g. `https://getpiggles.com`.
   *
   * Threaded down from the server rather than computed here: the origin comes
   * from `PIGGLES_ACCOUNT_ORIGIN`, and the helper that reads it imports
   * @wizeworks/db — reaching for it from a client component would pull Prisma
   * into the browser bundle to answer a question the server already knew.
   */
  accountOrigin: string;
  /** Windows or tabs — how open panes are presented. Piggles chrome; sparx has
   *  no equivalent and is not offered one. */
  windowMode: WindowMode;
  onChangeWindowMode: (mode: WindowMode) => void;
  onSetTheme: (choice: ThemeChoice) => void;
  onOpenLauncher: () => void;
}

/** Windows ⇄ tabs. An icon toggle rather than two buttons: it is one setting
 *  with two states, and the icon shows the state you would be switching TO. */
function WindowModeToggle({
  windowMode,
  onChangeWindowMode,
}: {
  windowMode: WindowMode;
  onChangeWindowMode: (mode: WindowMode) => void;
}) {
  const toTabs = windowMode === 'windows';
  return (
    <Tooltip
      content={
        toTabs
          ? 'Tidy everything back into a grid'
          : 'Show each thing in its own window you can move around'
      }
    >
      <Button
        variant="ghost"
        shape="square"
        aria-label={toTabs ? 'Switch to a tidy grid' : 'Switch to movable windows'}
        aria-pressed={windowMode === 'windows'}
        onClick={() => {
          onChangeWindowMode(toTabs ? 'tabs' : 'windows');
        }}
      >
        <Icon glyph={toTabs ? faGrid : faCopy} className="size-4" aria-hidden />
      </Button>
    </Tooltip>
  );
}

export function Topbar({
  userName,
  userEmail,
  themeChoice,
  theme,
  siteKey,
  accountOrigin,
  windowMode,
  onChangeWindowMode,
  onSetTheme,
  onOpenLauncher,
}: TopbarProps) {
  const { data: tenant } = useTenant();

  return (
    <Navbar className="border-base-300 bg-base-100 min-h-0 shrink-0 gap-2 border-b py-1.5 pr-3 pl-0">
      <NavbarStart className="gap-1">
        {/* The delivered lockup — one <svg> on the lockup canvas, never the mark
            and the wordmark set side by side with a guessed gap. Their padded
            boxes overlap in the real artwork. See @piggles/brand's marks.ts. */}
        <span className="flex shrink-0 justify-center" data-guide="business">
          <Logo className="mx-3 h-7 w-auto" title={PRODUCT.name} />
        </span>

        {/* "Business", never "tenant" (piggles/CLAUDE.md RULE #3). Rendered as a
            switcher only when there is more than one, so the majority who have
            exactly one see a name rather than a control implying a choice they
            do not have. */}
        <BusinessSwitcher siteKey={siteKey} fallbackName={tenant?.name ?? null} />
        <SiteSwitcher siteKey={siteKey} />
      </NavbarStart>

      <NavbarCenter className="min-w-0 flex-1">
        {/* The launcher's front door: "What do you want to do?" rather than
            "Search". The wording is the point — this audience does not arrive
            thinking "I will search for the invoices screen", they arrive
            thinking "I need to bill someone".

            A Button, not an Input, because it OPENS something: a real field that
            cannot be typed into is a worse lie than a button shaped like one. */}
        <div className="mx-auto flex w-full max-w-2xl" data-guide="search">
          <Button className="w-full justify-start gap-2.5 font-normal" onClick={onOpenLauncher}>
            <Icon glyph={faMagnifyingGlass} className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate text-left">What do you want to do?</span>
            <Kbd>⌘K</Kbd>
          </Button>
        </div>
      </NavbarCenter>

      <NavbarEnd className="gap-1">
        <WindowModeToggle windowMode={windowMode} onChangeWindowMode={onChangeWindowMode} />
        <QuickAdd />

        {/* The favourite control lives on each pane's TAB, not here. A star in
            the app toolbar acts on "whichever pane has focus", which in a
            workbench holding five panes is a control with no visible subject. */}

        <NotificationCenter />

        {/* Help opens a real conversation with a real person at the other end —
            deliberately not a link to a help site, because there isn't one. */}
        <FeedbackButton />

        <AppearanceMenu choice={themeChoice} theme={theme} onSetTheme={onSetTheme} />
        <ViewerMenu userName={userName} userEmail={userEmail} accountOrigin={accountOrigin} />
      </NavbarEnd>
    </Navbar>
  );
}
