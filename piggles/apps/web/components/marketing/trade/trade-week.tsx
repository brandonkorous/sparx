import Link from 'next/link';
import { Icon, Section } from '@piggles/ui';
import { APP_BY_ID, appIcon } from '@piggles/config';
import type { TradeMoment } from '@/content/trades/types';

// A normal week, moment by moment. Each moment wears the hue of the app that
// handles it, so the reader sees how many apps a week touches without a list.

function Moment({ moment }: { moment: TradeMoment }) {
  const app = APP_BY_ID[moment.app];
  if (!app) return null;
  return (
    <li data-group={app.group} className="grid gap-4 sm:grid-cols-[11rem_1fr] sm:gap-8">
      <p className="text-lg font-bold">{moment.when}</p>
      <div>
        <p className="text-lg">{moment.body}</p>
        <Link
          href={`/apps/${app.id}`}
          className="ink-module mt-3 inline-flex items-center gap-2 text-base font-bold"
        >
          <span className="bg-module text-module-content grid size-7 place-items-center rounded-md">
            <Icon glyph={appIcon(app.id)} aria-hidden className="size-3.5" />
          </span>
          {app.label}
        </Link>
      </div>
    </li>
  );
}

export function TradeWeek({ plural, week }: { plural: string; week: TradeMoment[] }) {
  return (
    <Section className="bg-base-100 border-base-300 border-y">
      <h2 className="max-w-[28ch] text-3xl font-extrabold sm:text-4xl">
        A normal week for {plural.toLowerCase()}, on Piggles
      </h2>
      <ol className="border-base-300 mt-12 grid gap-10 border-l-2 pl-6 sm:pl-10">
        {week.map((m) => (
          <Moment key={m.when} moment={m} />
        ))}
      </ol>
    </Section>
  );
}
