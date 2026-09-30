import Link from 'next/link';
import { Table } from '@wizeworks/silicaui-react';
import { Section } from '@piggles/ui';
import {
  AREA_APP,
  AREA_LABELS,
  CHECKED_ON,
  PIGGLES_AREAS,
  type AreaId,
  type ComparePage,
} from '@/content/compare';
import { OfferBadge } from './offer-badge';
import { dayWords } from '../date-words';

// Every area, both answers, and one line on what each answer means. The Piggles
// cell links to the app page that explains it, so a claim on this table can be
// checked one click away.

export function CompareTable({ page }: { page: ComparePage }) {
  const ids = Object.keys(AREA_LABELS) as AreaId[];
  return (
    <Section id="side-by-side">
      <h2 className="max-w-[28ch] text-3xl font-extrabold sm:text-4xl">
        Piggles and {page.name}, one need at a time
      </h2>
      <p className="mt-4 max-w-[62ch] text-lg">
        What each one offers for the things a small business looks for, read from {page.name}’s own
        website on {dayWords(CHECKED_ON)}. Where we could not confirm a feature on their site, the
        table says so rather than guessing.
      </p>
      <div className="border-base-300 bg-base-100 rounded-section mt-10 overflow-x-auto border">
        <Table>
          <thead>
            <tr>
              <th>What you need</th>
              <th>Piggles</th>
              <th>{page.name}</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const app = AREA_APP[id];
              return (
                <tr key={id} className="align-top">
                  <th scope="row" className="text-base font-bold">
                    {app ? (
                      <Link href={`/apps/${app}`} className="underline underline-offset-4">
                        {AREA_LABELS[id]}
                      </Link>
                    ) : (
                      AREA_LABELS[id]
                    )}
                  </th>
                  <td className="min-w-56">
                    <OfferBadge offer={PIGGLES_AREAS[id].offer} />
                    <p className="mt-2 text-base">{PIGGLES_AREAS[id].note}</p>
                  </td>
                  <td className="min-w-56">
                    <OfferBadge offer={page.areas[id].offer} />
                    <p className="mt-2 text-base">{page.areas[id].note}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </Section>
  );
}
