'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { PIGGLES_GROUPS } from '@piggles/brand';
import { accountUrl, APP_COUNT_WORD, appsInGroup } from '@piggles/config';
import { TRADE_LINKS } from '@/content/trades/list';
import { GROUP_COPY } from './groups';
import { HEADER_LINKS } from './header-links';

// The way around the site on a phone: the same apps, trades and links as the
// desktop menu. Controlled, so a nav item can stay a real link and still close it.

function DrawerLink({ href, label, onPick }: { href: string; label: string; onPick: () => void }) {
  return (
    <Link href={href} className="block py-2 text-base font-semibold" onClick={onPick}>
      {label}
    </Link>
  );
}

export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {/* DrawerTrigger clones its child and has no `render` prop. Colorless on purpose. */}
      <DrawerTrigger>
        <Button variant="ghost" shape="square" className="lg:hidden">
          <span aria-hidden>☰</span>
          <span className="sr-only">Menu</span>
        </Button>
      </DrawerTrigger>

      <DrawerContent side="right">
        <DrawerTitle>Piggles</DrawerTitle>
        <nav className="mt-4">
          <Accordion>
            <AccordionItem value="apps">
              <AccordionTrigger className="text-lg font-semibold">Apps</AccordionTrigger>
              <AccordionPanel>
                {PIGGLES_GROUPS.map((group) => (
                  <div key={group} data-group={group} className="mb-3">
                    <p className="ink-module text-base font-bold">{GROUP_COPY[group].title}</p>
                    {appsInGroup(group).map((app) => (
                      <DrawerLink
                        key={app.id}
                        href={`/apps/${app.id}`}
                        label={app.label}
                        onPick={close}
                      />
                    ))}
                  </div>
                ))}
                <DrawerLink href="/apps" label={`All ${APP_COUNT_WORD} apps`} onPick={close} />
              </AccordionPanel>
            </AccordionItem>
            <AccordionItem value="trades">
              <AccordionTrigger className="text-lg font-semibold">
                Who it&apos;s for
              </AccordionTrigger>
              <AccordionPanel>
                {TRADE_LINKS.map((t) => (
                  <DrawerLink
                    key={t.slug}
                    href={`/for/${t.slug}`}
                    label={t.plural}
                    onPick={close}
                  />
                ))}
                <DrawerLink href="/who-its-for" label="Compare them all" onPick={close} />
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
          <div className="mt-2 flex flex-col">
            {HEADER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="block py-3 text-lg font-semibold"
                onClick={close}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="border-base-300 mt-6 border-t pt-6">
          <a
            className={buttonClasses({ variant: 'outline', block: true })}
            href={accountUrl('sign-in', 'header-menu-sign-in')}
          >
            Sign in
          </a>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
