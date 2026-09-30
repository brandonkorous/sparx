import Link from 'next/link';
import { faCheck } from '@fortawesome/pro-solid-svg-icons';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Icon, Section } from '@piggles/ui';
import { accountUrl } from '@piggles/config';
import { PRICE_LABEL, TRIAL_DAYS } from '@piggles/config/pricing';
import type { TradeCost as Cost } from '@/content/trades/types';

// The price, said for this trade: one number, what it covers, and what could add to it.

export function TradeCost({ slug, cost }: { slug: string; cost: Cost }) {
  return (
    <Section variant="panel" className="bg-base-100 shadow">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <h2 className="text-3xl font-extrabold sm:text-4xl">{cost.heading}</h2>
          <p className="font-heading text-primary mt-8 text-6xl font-black sm:text-7xl">
            {PRICE_LABEL}
            <span className="text-2xl font-bold"> a month</span>
          </p>
          <p className="mt-4 text-lg">{cost.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              className={buttonClasses({ color: 'primary', size: 'lg' })}
              href={accountUrl('signup', `for-${slug}-cost`)}
            >
              Try it free for {TRIAL_DAYS} days
            </a>
            <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/pricing">
              Work out what you pay now
            </Link>
          </div>
        </div>
        <ul className="grid content-start gap-4">
          {cost.points.map((p) => (
            <li key={p} className="flex gap-3">
              <span className="bg-success text-success-content mt-1 grid size-5 shrink-0 place-items-center rounded-full">
                <Icon glyph={faCheck} aria-hidden className="size-2.5" />
              </span>
              <span className="text-lg">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
