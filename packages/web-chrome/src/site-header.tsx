'use client';

import {
  Button,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
  Navbar,
  NavbarCenter,
  NavbarEnd,
  NavbarStart,
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
} from '@wizeworks/silicaui-react';
import { Wordmark } from '@sparx/ui';
import { ModulesMegaContent, MODULE_NAV } from './modules-menu';

export interface SiteHeaderProps {
  /** Origin prefix for marketing nav links (Platform, Pricing, module pages…).
   *  '' (default) keeps them relative — correct on the marketing site itself.
   *  The dashboard passes the marketing origin (e.g. 'https://sparx.works') so
   *  the same header links back out to the marketing site. */
  marketingOrigin?: string;
  /** Destination for the "Sign in" CTA + drawer link. */
  signInHref?: string;
  /** Destination for the "Start free" CTA. */
  signUpHref?: string;
}

// Top-level links other than Modules (which is a megamenu). All are route links
// to their own marketing pages.
const LINKS = [
  { label: 'Platform', href: '/platform' },
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Partners', href: '/partners' },
  { label: 'Tools', href: '/tools' },
  { label: 'Docs', href: '/docs' },
  { label: 'Customers', href: '/customers' },
] as const;

const NAV_LINK_CLASS = 'text-base-content/70 hover:text-base-content text-sm font-medium';
const DRAWER_LINK_CLASS = 'border-base-300 text-base-content border-b py-3.5 text-lg font-medium';

/**
 * The shared site header — rebuilt solely on silicaui: `Navbar` for the bar
 * shell, `NavigationMenu` for desktop links + the Modules megamenu, and
 * `Drawer`/`Collapsible` for the mobile menu (replacing the old hand-rolled
 * `mkt-mobile-drawer` + manual open-state booleans). Lives in @sparx/web-chrome
 * so the marketing site and the dashboard auth pages render one identical
 * header. Marketing routes are prefixed with `marketingOrigin`; the auth CTAs
 * point wherever the consumer says (relative on the dashboard, absolute on
 * the marketing site).
 */
export function SiteHeader({
  marketingOrigin = '',
  signInHref = '/sign-in',
  signUpHref = '/sign-up',
}: SiteHeaderProps) {
  const link = (href: string) => `${marketingOrigin}${href}`;
  const otherLinks = LINKS.filter((l) => l.label !== 'Platform');

  return (
    <Navbar className="border-base-300 bg-base-100 sticky top-0 z-50 border-b px-6 sm:px-8">
      <NavbarStart>
        <a href={link('/')} aria-label="sparx home" className="inline-flex">
          <Wordmark size={36} />
        </a>
      </NavbarStart>

      {/* Centers the desktop nav between brand and CTAs — the daisyUI
          `navbar-center` zone (verified against the real bug this session:
          links were vanishing because Tailwind wasn't scanning this
          package's source at all, not because of the zone's own CSS). */}
      <NavbarCenter className="hidden lg:flex">
        <NavigationMenu>
          <NavigationMenuItem>
            <NavigationMenuLink href={link('/platform')} className={NAV_LINK_CLASS}>
              Platform
            </NavigationMenuLink>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuTrigger className={NAV_LINK_CLASS}>Modules</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ModulesMegaContent linkBase={marketingOrigin} />
            </NavigationMenuContent>
          </NavigationMenuItem>

          {otherLinks.map((l) => (
            <NavigationMenuItem key={l.label}>
              <NavigationMenuLink href={link(l.href)} className={NAV_LINK_CLASS}>
                {l.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenu>
      </NavbarCenter>

      <NavbarEnd className="gap-2">
        {/* A responsive `hidden <bp>:<display>` toggle goes on a plain wrapper,
            never directly on a component (Button, DrawerTrigger's child, …)
            that already carries its own internal display/alignment classes —
            the two compete and render inconsistently. Recurring gotcha in
            this codebase; wrapping is the fix every time. */}
        <span className="hidden lg:inline-flex">
          <Button render={<a href={signInHref} aria-label="Sign in" />} variant="ghost" size="sm">
            Sign in
          </Button>
        </span>
        <Button render={<a href={signUpHref} aria-label="Start free" />} color="neutral" size="sm">
          Start free
        </Button>

        <Drawer>
          <span className="lg:hidden">
            <DrawerTrigger>
              <Button variant="ghost" shape="square" size="sm" aria-label="Open menu">
                <MenuIcon />
              </Button>
            </DrawerTrigger>
          </span>
          <DrawerContent side="right" className="flex w-full max-w-sm flex-col gap-1 p-6">
            <div className="flex items-center justify-between pb-4">
              <Wordmark size={36} />
              <DrawerClose>
                <Button variant="ghost" shape="circle" size="sm" aria-label="Close menu">
                  <CloseIcon />
                </Button>
              </DrawerClose>
            </div>

            <DrawerClose>
              <a href={link('/platform')} className={DRAWER_LINK_CLASS}>
                Platform
              </a>
            </DrawerClose>

            <Collapsible className="border-base-300 border-b">
              <CollapsibleTrigger className="py-3.5 text-lg font-medium">
                Modules
              </CollapsibleTrigger>
              <CollapsiblePanel>
                <div className="flex flex-col gap-0.5 pb-3">
                  {MODULE_NAV.map((m) => (
                    <DrawerClose key={m.module}>
                      <a
                        href={link(m.href)}
                        className="rounded-field hover:bg-base-200 flex flex-col gap-0.5 px-3 py-2"
                      >
                        <span className="text-base-content text-sm font-medium">{m.label}</span>
                        <span className="text-base-content/50 text-xs">{m.desc}</span>
                      </a>
                    </DrawerClose>
                  ))}
                </div>
              </CollapsiblePanel>
            </Collapsible>

            {otherLinks.map((l) => (
              <DrawerClose key={l.label}>
                <a href={link(l.href)} className={DRAWER_LINK_CLASS}>
                  {l.label}
                </a>
              </DrawerClose>
            ))}

            <DrawerClose>
              <a href={signInHref} className="text-base-content/70 py-3.5 text-lg font-medium">
                Sign in
              </a>
            </DrawerClose>
          </DrawerContent>
        </Drawer>
      </NavbarEnd>
    </Navbar>
  );
}

function MenuIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 7H21M3 12H21M3 17H21" stroke="currentColor" strokeWidth={1.6} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 5L19 19M5 19L19 5" stroke="currentColor" strokeWidth={1.6} />
    </svg>
  );
}
