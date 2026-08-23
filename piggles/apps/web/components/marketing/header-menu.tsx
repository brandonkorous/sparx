'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl } from '@piggles/config';
import { HEADER_LINKS } from './header-links';

// The way around the site on a phone.
//
// Controlled rather than closed with <DrawerClose>, which assumes a real
// <button> child: a nav item has to stay a link to be middle-clickable,
// copyable and crawlable, and onClick is all that control was doing anyway.

export function HeaderMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {/* DrawerTrigger clones a single element CHILD and has no `render` prop.
          Passing one typechecks as an unknown attribute and silently does
          nothing. Colorless on purpose — see the note on Sign in. */}
      <DrawerTrigger>
        <Button variant="ghost" shape="square" className="lg:hidden">
          <span aria-hidden>☰</span>
          <span className="sr-only">Menu</span>
        </Button>
      </DrawerTrigger>

      <DrawerContent side="right">
        <DrawerTitle>Piggles</DrawerTitle>
        <nav className="mt-6 flex flex-col gap-1">
          {HEADER_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block py-3 text-lg font-semibold"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-base-300 mt-6 border-t pt-6">
          <a
            className={buttonClasses({ variant: 'outline', block: true })}
            href={accountUrl('sign-in')}
          >
            Sign in
          </a>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
