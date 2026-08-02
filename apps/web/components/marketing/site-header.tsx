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
import { ModuleGlyph, ModulesMegaContent, MODULE_NAV } from './modules-menu';

export interface SiteHeaderProps {
  /** Destination for the "Sign in" CTA + drawer link. */
  signInHref?: string;
  /** Destination for the "Start free" CTA. */
  signUpHref?: string;
}

// Top-level links other than Modules (which is a megamenu). All are route links
// to their own marketing pages.
//
// "Who it's for" was labelled "Customers". On a platform with no public case
// studies that label promises logos and quotes and then does not deliver them,
// and it reads as a page ABOUT us rather than one about the visitor. The route
// is unchanged — /customers is a stable, linked URL — but the label now says
// what the page actually answers.
const LINKS = [
  { label: 'Platform', href: '/platform' },
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: "Who it's for", href: '/customers' },
  { label: 'Partners', href: '/partners' },
  { label: 'Tools', href: '/tools' },
  { label: 'Docs', href: '/docs' },
] as const;

const NAV_LINK_CLASS = 'hover:text-sm font-medium';
const DRAWER_LINK_CLASS = 'border-base-300 border-b py-3.5 text-lg font-medium';

/**
 * The marketing site header — built solely on silicaui: `Navbar` for the bar
 * shell, `NavigationMenu` for desktop links + the Modules megamenu, and
 * `Drawer`/`Collapsible` for the mobile menu (replacing the old hand-rolled
 * `mkt-mobile-drawer` + manual open-state booleans).
 *
 * Nav links are plain relative routes — this component IS the marketing site.
 * (It briefly lived in a @sparx/web-chrome package with a `marketingOrigin`
 * prefix prop, on the theory that the dashboard auth pages would render the
 * same header; they never did — they use the split-panel AuthScreen — so the
 * indirection is gone.) Only the auth CTAs cross origins, via props.
 */
export function SiteHeader({ signInHref = '/sign-in', signUpHref = '/sign-up' }: SiteHeaderProps) {
  const otherLinks = LINKS.filter((l) => l.label !== 'Platform');

  return (
    <Navbar className="border-base-300 bg-base-100 sticky top-0 z-50 border-b px-6 sm:px-8">
      <NavbarStart>
        <a href="/" aria-label="sparx home" className="inline-flex">
          <Wordmark size={36} />
        </a>
      </NavbarStart>

      {/* Centers the desktop nav between brand and CTAs — the daisyUI
          `navbar-center` zone. (Links once vanished here; the cause was
          Tailwind not scanning this file's old home in packages/web-chrome,
          not the zone's own CSS. Moot now that it lives inside the app.) */}
      <NavbarCenter className="hidden lg:flex">
        <NavigationMenu>
          <NavigationMenuItem>
            <NavigationMenuLink href="/platform" className={NAV_LINK_CLASS}>
              Platform
            </NavigationMenuLink>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuTrigger className={NAV_LINK_CLASS}>Modules</NavigationMenuTrigger>
            {/* Silica's `.navigation-menu-content` caps at 38rem and adds its
                own 1rem padding — both wrong for a full-width mega panel that
                owns its own padding and edge-to-edge footer bar. */}
            <NavigationMenuContent className="max-w-none p-0">
              <ModulesMegaContent />
            </NavigationMenuContent>
          </NavigationMenuItem>

          {otherLinks.map((l) => (
            <NavigationMenuItem key={l.label}>
              <NavigationMenuLink href={l.href} className={NAV_LINK_CLASS}>
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
        <Button render={<a href={signUpHref} aria-label="Start free" />} color="primary" size="sm">
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
              <a href="/platform" className={DRAWER_LINK_CLASS}>
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
                        href={m.href}
                        className="rounded-field hover:bg-base-200 flex items-start gap-3 px-3 py-2"
                      >
                        <span className="mt-0.5">
                          <ModuleGlyph module={m.module} />
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{m.label}</span>
                          {/* Same as the desktop mega menu: scanned, not read through. */}
                          <span className="text-soft text-xs">{m.desc}</span>
                        </span>
                      </a>
                    </DrawerClose>
                  ))}
                </div>
              </CollapsiblePanel>
            </Collapsible>

            {otherLinks.map((l) => (
              <DrawerClose key={l.label}>
                <a href={l.href} className={DRAWER_LINK_CLASS}>
                  {l.label}
                </a>
              </DrawerClose>
            ))}

            <DrawerClose>
              <a href={signInHref} className="py-3.5 text-lg font-medium">
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
