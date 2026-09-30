import Link from 'next/link';
import { Icon, Section } from '@piggles/ui';
import { APP_BY_ID, appIcon } from '@piggles/config';
import type { TradeTool } from '@/content/trades/types';

// What this trade juggles today, crossed out, and the app that takes its place.
// The old tool is a real <s>: "no longer needed" is the meaning, for a screen reader too.

export function TradeReplaces({ plural, tools }: { plural: string; tools: TradeTool[] }) {
  return (
    <Section variant="panel" className="bg-base-100 shadow">
      <h2 className="max-w-[26ch] text-3xl font-extrabold sm:text-4xl">
        What most {plural.toLowerCase()} are juggling, and what takes its place
      </h2>
      <ul className="mt-10 grid gap-6 lg:grid-cols-2">
        {tools.map((t) => {
          const app = APP_BY_ID[t.instead];
          if (!app) return null;
          return (
            <li
              key={t.today}
              data-group={app.group}
              className="border-base-300 grid gap-3 border-t pt-6"
            >
              <s className="font-heading text-2xl leading-tight font-normal">{t.today}</s>
              <Link
                href={`/apps/${app.id}`}
                className="ink-module inline-flex items-center gap-2 text-lg font-bold"
              >
                <span className="bg-module text-module-content grid size-8 place-items-center rounded-md">
                  <Icon glyph={appIcon(app.id)} aria-hidden className="size-4" />
                </span>
                {app.label}
              </Link>
              <p className="text-base">{t.why}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
