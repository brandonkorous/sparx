'use client';

import { useState } from 'react';
import {
  Button,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from '@sparx/ui';
import { Wordmark } from './primitives';
import { ModulesMegaContent, MODULE_NAV } from './modules-menu';

// Top-level links other than Modules (which is a megamenu). Same-page anchors
// (#pricing, #customers) resolve on the home page and on /platform, which both
// expose those section ids; route links go to their own pages.
const LINKS = [
  { label: 'Platform', href: '/platform' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Customers', href: '#customers' },
] as const;

export function Nav() {
  const [open, setOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);

  return (
    <>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '20px',
          paddingBottom: '20px',
          paddingLeft: 'var(--gutter-page)',
          paddingRight: 'var(--gutter-page)',
          borderBottom: '1px solid var(--color-border-default)',
          backgroundColor: 'var(--color-bg-page)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'saturate(150%) blur(8px)',
          gap: '16px',
        }}
      >
        <Wordmark />

        {/* Desktop: Radix NavigationMenu — Modules opens a megamenu panel. */}
        <NavigationMenu viewport={false} className="mkt-hide-on-tablet" style={{ display: 'flex' }}>
          <NavigationMenuList style={{ gap: '36px' }}>
            <NavigationMenuItem>
              <NavigationMenuLink href="/platform" className="mkt-navlink">
                Platform
              </NavigationMenuLink>
            </NavigationMenuItem>

            <NavigationMenuItem style={{ position: 'relative' }}>
              <NavigationMenuTrigger className="mkt-navlink-trigger">Modules</NavigationMenuTrigger>
              <NavigationMenuContent
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 16px)',
                  left: 0,
                  width: 'max-content',
                  zIndex: 60,
                }}
              >
                <ModulesMegaContent />
              </NavigationMenuContent>
            </NavigationMenuItem>

            {LINKS.filter((l) => l.label !== 'Platform').map((link) => (
              <NavigationMenuItem key={link.label}>
                <NavigationMenuLink href={link.href} className="mkt-navlink">
                  {link.label}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="mkt-hide-on-mobile" style={{ display: 'inline-flex' }}>
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </span>
          <Button variant="solid" size="sm" style={{ backgroundColor: '#0A0A0A' }}>
            Start free
          </Button>
          <button
            type="button"
            className="mkt-tablet-down-only-flex"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-page)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="mkt-mobile-drawer" style={{ display: 'flex' }}>
          <a href="/platform" onClick={() => setOpen(false)} style={drawerLinkStyle}>
            Platform
          </a>

          {/* Modules: expandable section listing every module. */}
          <button
            type="button"
            aria-expanded={modulesOpen}
            onClick={() => setModulesOpen((v) => !v)}
            style={{
              ...drawerLinkStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--color-border-default)',
              width: '100%',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Modules
            <Caret open={modulesOpen} />
          </button>
          {modulesOpen ? (
            <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '6px' }}>
              {MODULE_NAV.map((m) => (
                <a
                  key={m.module}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 400,
                    fontSize: '15px',
                    color: 'var(--color-text-secondary)',
                    textDecoration: 'none',
                    padding: '10px 0 10px 16px',
                  }}
                >
                  {m.label}
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      color: 'var(--color-text-tertiary)',
                      marginLeft: '8px',
                    }}
                  >
                    {m.desc}
                  </span>
                </a>
              ))}
            </div>
          ) : null}

          {LINKS.filter((l) => l.label !== 'Platform').map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              style={drawerLinkStyle}
            >
              {link.label}
            </a>
          ))}

          <a
            href="/signin"
            onClick={() => setOpen(false)}
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '18px',
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              padding: '14px 0',
            }}
          >
            Sign in
          </a>
        </div>
      ) : null}
    </>
  );
}

const drawerLinkStyle = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: '18px',
  color: 'var(--color-text-primary)',
  textDecoration: 'none',
  padding: '14px 0',
  borderBottom: '1px solid var(--color-border-default)',
} as const;

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
    >
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
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
