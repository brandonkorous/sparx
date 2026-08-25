import type { Metadata } from 'next';
import { Section } from '@piggles/ui';
import Link from 'next/link';
import { Table } from '@wizeworks/silicaui-react';
import { PRODUCT } from '@piggles/config';
import { ConsentChange } from '@/components/consent-change';
import { PageHero } from '@/components/marketing/page-hero';
import { DocumentFigure } from '@/components/marketing/hero/document-figure';
import { ESSENTIAL, FACTS, PRODUCT_ANALYTICS, type CookieRow } from './cookie-list';

// /cookies — every cookie the three Piggles surfaces set, named.
// The rows themselves, and the record of what was read out of the repository
// to write them, are in ./cookie-list.ts.

export const metadata: Metadata = {
  title: 'Cookies',
  description:
    'Every cookie Piggles sets, on which of the three sites, what it is for and how long it lasts. No advertising cookies, nothing sold on, and nothing at all on the marketing site until you say yes.',
};

function Rows({ rows }: { rows: CookieRow[] }) {
  return (
    <Table zebra>
      <thead>
        <tr>
          <th>Cookie</th>
          <th>Where</th>
          <th>What it is for</th>
          <th>How long</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td className="font-semibold">{row.name}</td>
            <td>{row.where}</td>
            <td>{row.what}</td>
            <td className="whitespace-nowrap">{row.life}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default function CookiesPage() {
  return (
    <>
      <PageHero
        heading="Cookies, and the short list of them."
        lede="A cookie is a small note a website leaves in your browser so the next page knows something the last one did. Here is every one Piggles uses, which of our three sites uses it, and what it is for."
        figure={
          <DocumentFigure
            sections={`${ESSENTIAL.length + PRODUCT_ANALYTICS.length}, every one named`}
            covers="All three Piggles sites"
          />
        }
      />

      <Section>
        <h2 className="text-3xl font-extrabold sm:text-4xl">The ones that make it work</h2>
        <p className="mt-6 max-w-[70ch] text-lg">
          These are the plumbing. They keep you signed in, and they let the workspace open where you
          left it and in the shape of the screen you are on. None of them counts anything or leaves
          our sites, and there is no switch for them because switching them off makes Piggles worse
          for you and better for nobody.
        </p>
        <div className="mt-8">
          <Rows rows={ESSENTIAL} />
        </div>
      </Section>

      <Section className="bg-base-100 border-base-300 border-y">
        <h2 className="text-3xl font-extrabold sm:text-4xl">The ones you choose</h2>
        <p className="mt-6 max-w-[70ch] text-lg">
          Two things, asked separately in the two places they apply. On this site: where you came
          from, so we know which of the things we do actually brings anybody here. Inside the
          workspace at {PRODUCT.hosts.console}: which screens you use, so we find out that one is
          confusing before you have to tell us. Neither runs until you say yes, and neither is ever
          sold or passed on.
        </p>
        <div className="mt-8 max-w-[70ch]">
          {/* Your answer for THIS site, and the way to change it. The workspace
              one lives with your account, because it follows the person rather
              than the browser. */}
          <ConsentChange />
        </div>
        <div className="mt-8">
          <Rows rows={PRODUCT_ANALYTICS} />
        </div>
      </Section>

      <Section>
        {/* The count is written out and there are seven of them. It said
              "Four" while rendering seven — a number nobody would check and
              everybody would believe, on the page whose whole job is being
              checkable. If an entry is added or removed, this word changes. */}
        <h2 className="text-3xl font-extrabold sm:text-4xl">Seven things worth knowing</h2>
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:gap-10">
          {FACTS.map((f) => (
            <li key={f.title} className="border-base-content border-t-2 pt-5">
              <h3 className="text-xl font-bold">{f.title}</h3>
              <p className="mt-2 max-w-[60ch] text-base">{f.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-14 max-w-[70ch] text-lg">
          More on how your information is handled is on the{' '}
          <Link href="/privacy" className="font-semibold underline">
            privacy page
          </Link>
          , and how it is kept safe is on{' '}
          <Link href="/trust" className="font-semibold underline">
            trust
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
