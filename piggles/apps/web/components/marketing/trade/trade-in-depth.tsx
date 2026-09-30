import Link from 'next/link';
import { faCheck } from '@fortawesome/pro-solid-svg-icons';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Icon, Section } from '@piggles/ui';
import { APP_BY_ID, appIcon } from '@piggles/config';
import type { TradeAppDetail } from '@/content/trades/types';

// Each app this trade leans on, told for this trade. Every block wears its app's
// hue, so the reader learns the colors they will see in the product.

function Detail({ detail, flip }: { detail: TradeAppDetail; flip: boolean }) {
  const app = APP_BY_ID[detail.app];
  if (!app) return null;
  return (
    <article data-group={app.group} className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-16">
      <div className={flip ? 'lg:order-2' : ''}>
        <p className="ink-module inline-flex items-center gap-2 text-lg font-bold">
          <span className="bg-module text-module-content grid size-9 place-items-center rounded-lg">
            <Icon glyph={appIcon(app.id)} aria-hidden className="size-4" />
          </span>
          {app.label}
        </p>
        <h3 className="mt-4 text-2xl font-extrabold sm:text-3xl">{detail.heading}</h3>
        <p className="mt-4 text-lg">{detail.body}</p>
        <Link href={`/apps/${app.id}`} className={`${buttonClasses({ color: 'module' })} mt-6`}>
          Everything {app.label} does
        </Link>
      </div>
      <ul className="bg-base-100 border-base-300 rounded-section grid gap-4 border p-6 sm:p-8">
        {detail.points.map((p) => (
          <li key={p} className="flex gap-3">
            <span className="bg-module text-module-content mt-1 grid size-5 shrink-0 place-items-center rounded-full">
              <Icon glyph={faCheck} aria-hidden className="size-2.5" />
            </span>
            <span className="text-base">{p}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function TradeInDepth({ plural, details }: { plural: string; details: TradeAppDetail[] }) {
  return (
    <Section>
      <h2 className="max-w-[28ch] text-3xl font-extrabold sm:text-4xl">
        The apps {plural.toLowerCase()} use most, up close
      </h2>
      <div className="mt-14 grid gap-20">
        {details.map((d, i) => (
          <Detail key={d.app} detail={d} flip={i % 2 === 1} />
        ))}
      </div>
    </Section>
  );
}
