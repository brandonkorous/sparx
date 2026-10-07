import Link from 'next/link';
import { PIGGLES_GROUPS } from '@piggles/brand';
import { APP_COUNT_WORD_CAP, appIcon, appsInGroup } from '@piggles/config';
import { Icon, Section } from '@piggles/ui';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { GROUP_COPY } from '@/components/marketing/groups';

// Every app, grouped the way a business works, short enough for a phone on the
// couch. Each name links to its own page for anyone who wants the detail.

function Group({ group }: { group: (typeof PIGGLES_GROUPS)[number] }) {
  return (
    <div data-group={group}>
      {/* `ink-module`, not `text-module`: the group hues are fills, too pale as type. */}
      <h3 className="ink-module text-2xl font-extrabold">{GROUP_COPY[group].title}</h3>
      <p className="mt-1 text-base">{GROUP_COPY[group].blurb}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {appsInGroup(group).map((app) => (
          <li key={app.id}>
            <Link
              href={`/apps/${app.id}`}
              className={buttonClasses({ color: 'module', size: 'md' })}
            >
              <Icon glyph={appIcon(app.id)} aria-hidden className="size-4" />
              {app.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WhatItDoes() {
  return (
    <Section id="what-it-does">
      <div className="max-w-[62ch]">
        <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          {APP_COUNT_WORD_CAP} apps. One login. They already know about each other.
        </h2>
        <p className="mt-6 text-lg">
          Add a customer once and your bookings, invoices and emails all know who they are. Sell
          something and your stock and your numbers move with it. Nothing to connect.
        </p>
      </div>
      <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {PIGGLES_GROUPS.map((group) => (
          <Group key={group} group={group} />
        ))}
      </div>
    </Section>
  );
}
