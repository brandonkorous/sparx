import Link from 'next/link';
import { Navbar, NavbarCenter, NavbarEnd, NavbarStart } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Logo, Mark } from '@piggles/brand/react';
import { accountUrl } from '@piggles/config';
import { ThemeToggle } from './theme-toggle';
import { HeaderMenu } from './header-menu';
import { HEADER_LINKS } from './header-links';

// Solid, not laid over the hero: the montage cuts between clips whose brightness
// is nothing alike, so a bar readable over one is unreadable over the next.
// Sticky, so the action survives a 7,000px page.

// `z-30`, never 40 or above. Silica's overlays — drawers, dialogs, sheets — sit
// at 40, so chrome that outranks them opens underneath the bar that opened it:
// at z-50 this header hid two of the four links in its own menu (issue 161).
export function SiteHeader() {
  return (
    <header className="bg-base-100 border-base-300 sticky top-0 z-30 border-b">
      <Navbar className="mx-auto max-w-7xl px-6">
        <NavbarStart>
          <Link href="/" aria-label="Piggles home">
            {/* The lockup is 124px of a 360px bar, spent saying a name the tab
                is already showing. The mark carries it at phone width and gives
                the row back the space the ☰ needs (issue 160). */}
            <Logo className="h-10 w-auto max-sm:hidden" />
            <Mark className="text-primary h-10 w-10 sm:hidden" />
          </Link>
        </NavbarStart>

        <NavbarCenter className="hidden gap-8 lg:flex">
          {HEADER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-base font-semibold">
              {l.label}
            </Link>
          ))}
        </NavbarCenter>

        <NavbarEnd className="items-center gap-2">
          {/* Chrome, so it comes before the two actions — the last thing on the
              bar should be the thing the bar is for. Visible at every width: a
              person who reads in dark mode reads in dark mode on a phone. */}
          <ThemeToggle />

          {/* Real anchors carrying `buttonClasses`, never `<Button render={<a/>}>`:
              the render form hands jsx-a11y an empty <a> whose text lives in a
              sibling prop, and every other page here is a server component. */}
          {/* COLORLESS on purpose. `neutral` is Piggles' chrome FILL, dark in both
              themes, and ghost/outline paint the ink with it — 1.12:1 on this
              header (issue 003). No `color` leaves silica on base-content. */}
          <a
            className={`${buttonClasses({ variant: 'ghost' })} max-sm:hidden`}
            href={accountUrl('sign-in')}
          >
            Sign in
          </a>
          <a className={buttonClasses({ color: 'primary' })} href={accountUrl('signup', 'header')}>
            Get Piggles
          </a>

          <HeaderMenu />
        </NavbarEnd>
      </Navbar>
    </header>
  );
}
