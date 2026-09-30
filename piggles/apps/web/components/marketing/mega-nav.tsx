'use client';

import Link from 'next/link';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
} from '@wizeworks/silicaui-react';
import type { PigglesGroup } from '@piggles/brand';
import { Icon } from '@piggles/ui';
import { APP_COUNT_WORD, appIcon, appsInGroup } from '@piggles/config';
import { TRADE_LINKS } from '@/content/trades/list';
import { GROUP_COPY } from './groups';
import { HEADER_LINKS } from './header-links';

// The desktop header menu. Apps and trades open as panels, so every app page
// and every trade page is one click from anywhere on the site.
//
// Silica sizes `.navigation-menu-link` for ONE-LINE bar links (fixed height) and
// caps the panel at 38rem. Rows here carry two lines and the apps panel has three
// columns, so panel rows take `h-auto` and each panel sets its own max width.

/** Groups stacked in columns, in rail order, paired so each column holds 5 to 6
 *  apps. A grid of rows left a gap under the one-app "Your day" group. */
const COLUMNS: readonly (readonly PigglesGroup[])[] = [
  ['home', 'web'],
  ['sell', 'people'],
  ['money', 'run'],
];

function AppGroup({ group }: { group: PigglesGroup }) {
  return (
    <div data-group={group}>
      <p className="ink-module text-base font-bold">{GROUP_COPY[group].title}</p>
      <ul className="mt-2 grid gap-1">
        {appsInGroup(group).map((app) => (
          <li key={app.id}>
            <NavigationMenuLink
              render={<Link href={`/apps/${app.id}`} />}
              className="rounded-field flex h-auto items-start gap-3 p-2"
            >
              <span className="bg-module text-module-content mt-0.5 grid size-8 shrink-0 place-items-center rounded-md">
                <Icon glyph={appIcon(app.id)} aria-hidden className="size-4" />
              </span>
              <span>
                <span className="block text-base font-semibold">{app.label}</span>
                <span className="block text-sm">{app.purpose}</span>
              </span>
            </NavigationMenuLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AppsPanel() {
  return (
    <div className="w-[min(58rem,calc(100vw-4rem))] p-2">
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-3">
        {COLUMNS.map((column) => (
          <div key={column[0]} className="flex flex-col gap-6">
            {column.map((group) => (
              <AppGroup key={group} group={group} />
            ))}
          </div>
        ))}
      </div>
      <div className="border-base-300 mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t pt-4">
        <NavigationMenuLink render={<Link href="/apps" />} className="text-base font-bold">
          See all {APP_COUNT_WORD} apps side by side
        </NavigationMenuLink>
        <NavigationMenuLink render={<Link href="/how-it-works" />} className="text-base font-bold">
          How they work together
        </NavigationMenuLink>
      </div>
    </div>
  );
}

function TradesPanel() {
  return (
    <div className="grid w-[min(42rem,calc(100vw-4rem))] gap-8 p-2 md:grid-cols-[14rem_1fr]">
      <div>
        <p className="text-lg font-bold">Built for the way you already work</p>
        <p className="mt-2 text-base">
          Eleven kinds of business, and what a normal week looks like for each one on Piggles.
        </p>
        <NavigationMenuLink
          render={<Link href="/who-its-for" />}
          className="mt-4 inline-flex h-auto text-base font-bold underline underline-offset-4"
        >
          Compare them all
        </NavigationMenuLink>
      </div>
      <ul className="grid grid-cols-2 gap-1">
        {TRADE_LINKS.map((t) => (
          <li key={t.slug}>
            <NavigationMenuLink
              render={<Link href={`/for/${t.slug}`} />}
              className="rounded-field flex h-auto p-2 text-base font-semibold"
            >
              {t.plural}
            </NavigationMenuLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MegaNav() {
  return (
    <NavigationMenu className="hidden lg:flex">
      <NavigationMenuItem>
        <NavigationMenuTrigger className="text-base font-semibold">Apps</NavigationMenuTrigger>
        {/* keepMounted: the links stay in the HTML, so crawlers see every app and trade. */}
        <NavigationMenuContent keepMounted className="max-w-[min(60rem,calc(100vw-2rem))]">
          <AppsPanel />
        </NavigationMenuContent>
      </NavigationMenuItem>
      <NavigationMenuItem>
        <NavigationMenuTrigger className="text-base font-semibold">
          Who it&apos;s for
        </NavigationMenuTrigger>
        {/* keepMounted: the links stay in the HTML, so crawlers see every app and trade. */}
        <NavigationMenuContent keepMounted className="max-w-[min(44rem,calc(100vw-2rem))]">
          <TradesPanel />
        </NavigationMenuContent>
      </NavigationMenuItem>
      {HEADER_LINKS.map((l) => (
        <NavigationMenuItem key={l.href}>
          <NavigationMenuLink render={<Link href={l.href} />} className="text-base font-semibold">
            {l.label}
          </NavigationMenuLink>
        </NavigationMenuItem>
      ))}
    </NavigationMenu>
  );
}
