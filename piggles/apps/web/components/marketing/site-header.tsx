'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
  Navbar,
  NavbarCenter,
  NavbarEnd,
  NavbarStart,
} from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Logo } from '@piggles/brand/react';
import { accountUrl } from '@piggles/config';

// The site header. Solid, not laid over the hero.
//
// A transparent bar floating on the video is the reflex, and it is wrong here:
// the montage cuts between eight clips whose brightness is nothing alike, so a
// bar that reads over one of them is unreadable over the next. The header sits
// on `base-100` above the footage instead. It also means the wordmark keeps its
// own ink and the mark keeps its pink — a logo knocked out to white over video is
// a logo that stopped being the brand colour.

const LINKS = [
  { href: '/apps', label: 'Apps' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/trust', label: 'Trust' },
];

export function SiteHeader() {
  // The drawer is CONTROLLED rather than closed with <DrawerClose>.
  //
  // DrawerClose is a Base UI close control: it assumes it wraps a real
  // <button>, and wrapping a nav link in it logs "a component that acts as a
  // button was not rendered as a native <button>" on every open. Base UI's own
  // escape hatch is `nativeButton={false}`, but silica's DrawerClose takes only
  // `children` and does not forward it.
  //
  // Swapping the anchors for buttons would silence it and would be wrong: a nav
  // item has to be middle-clickable, copyable and crawlable, and none of those
  // survive becoming a <button>. So the links stay links and closing becomes an
  // onClick — which is all DrawerClose was doing anyway.
  const [open, setOpen] = useState(false);

  return (
    // Sticky, so the CTA survives a 7,000px page. Navigation on a landing page
    // is part of the conversion path, not a directory you visit once at the top —
    // and the alternative (a floating pill that appears on scroll) is a second
    // component that can disagree with this one about what the primary action is.
    // `bg-base-100` is opaque on purpose: a translucent bar over the module-tinted
    // bento gives the brand six different header colours on the way down.
    <header className="bg-base-100 border-base-300 sticky top-0 z-50 border-b">
      <Navbar className="mx-auto max-w-7xl px-6">
        <NavbarStart>
          <Link href="/" aria-label={`${'Piggles'} home`}>
            <Logo />
          </Link>
        </NavbarStart>

        <NavbarCenter className="hidden gap-8 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-base font-semibold">
              {l.label}
            </Link>
          ))}
        </NavbarCenter>

        <NavbarEnd className="items-center gap-2">
          {/* Real anchors carrying `buttonClasses`, NOT `<Button render={<a/>}>`.
              Both work here — this is a client component — but the render form
              hands jsx-a11y an empty `<a>` whose text lives in a sibling prop,
              so every one of these trips anchor-has-content. Styling the anchor
              directly is the same output with the content where a linter, and a
              screen reader, can actually see it. It is also the one pattern used
              on every other page, all of which are server components and cannot
              use `render` at all.

              Sign in is the dismiss half of the pair, so it is the one control
              on this bar that has earned `neutral` (root RULE #4). */}
          {/* `max-sm:hidden`, not `hidden sm:inline-flex`. The second form
              re-declares `display` on a `.btn`, which overrides whatever silica
              set and leaves the label sitting off-centre against the button
              beside it. Hiding by breakpoint upward never touches the class the
              component relies on. */}
          <a
            className={`${buttonClasses({ color: 'neutral', variant: 'ghost' })} max-sm:hidden`}
            href={accountUrl('sign-in')}
          >
            Sign in
          </a>
          <a className={buttonClasses({ color: 'primary' })} href={accountUrl('signup', 'header')}>
            Get Piggles
          </a>

          <Drawer open={open} onOpenChange={setOpen}>
            {/* DrawerTrigger takes a single element CHILD and clones it — it has
                no `render` prop, unlike Button. Passing one typechecks as an
                unknown attribute and silently does nothing. */}
            <DrawerTrigger>
              <Button color="neutral" variant="ghost" shape="square" className="lg:hidden">
                <span aria-hidden>☰</span>
                <span className="sr-only">Menu</span>
              </Button>
            </DrawerTrigger>
            <DrawerContent side="right">
              <DrawerTitle>Piggles</DrawerTitle>
              <nav className="mt-6 flex flex-col gap-1">
                {LINKS.map((l) => (
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
                  className={buttonClasses({ color: 'neutral', variant: 'outline', block: true })}
                  href={accountUrl('sign-in')}
                >
                  Sign in
                </a>
              </div>
            </DrawerContent>
          </Drawer>
        </NavbarEnd>
      </Navbar>
    </header>
  );
}
