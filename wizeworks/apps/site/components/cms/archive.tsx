// The archive block (`cms.archive`): everything the site has published, by month.
//
// A row of years, then each month of the chosen year with its pieces, newest first:
// the date, the section, the headline, linked. One year at a time, so a journal of two
// hundred pieces reads as a few dozen lines, not a wall. The year comes from the page's
// own address (`?year=2025`), so every year has a link a reader can keep.

import Link from 'next/link';

import { publicGet } from '@/lib/content';
import type { ResolvedSite } from '@/lib/site-context';

interface ArchivePiece {
  title: string;
  path: string;
  publishedAt: string;
  kindName: string;
  section: string | null;
}

interface ArchiveData {
  years: { year: number; count: number }[];
  year: number | null;
  months: { month: string; pieces: ArchivePiece[] }[];
}

type SearchParams = Record<string, string | string[] | undefined>;

function yearFrom(searchParams: SearchParams | undefined): number | undefined {
  const raw = searchParams?.year;
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(value) && value > 1900 && value < 3000 ? value : undefined;
}

async function readArchive(tenantSlug: string, year?: number): Promise<ArchiveData | null> {
  try {
    return await publicGet<ArchiveData>(
      '/v1/public/content/archive',
      { tenant: tenantSlug, ...(year ? { year } : {}) },
      { tag: `archive:${tenantSlug}` }
    );
  } catch {
    return null;
  }
}

export async function Archive({
  site,
  searchParams,
  basePath,
}: {
  site: ResolvedSite;
  searchParams?: SearchParams;
  basePath: string;
}) {
  const data = await readArchive(site.slug, yearFrom(searchParams));
  if (!data) {
    return (
      <p className="text-base-content text-lg">
        The archive could not be read just now. Try again in a moment.
      </p>
    );
  }
  if (data.years.length === 0) {
    return <p className="text-base-content text-lg">Nothing has been published yet.</p>;
  }

  const locale = site.commerce.defaultLocale;
  const timeZone = site.timezone ?? 'UTC';
  const monthName = (month: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${month}-01T12:00:00Z`)
    );
  const dayOf = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone }).format(
      new Date(iso)
    );

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <nav aria-label="Years" className="flex flex-wrap gap-2">
        {data.years.map(({ year, count }) => (
          <Link
            key={year}
            href={`${basePath}?year=${year}`}
            aria-current={year === data.year ? 'page' : undefined}
            className={year === data.year ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
          >
            {year} · {count} {count === 1 ? 'piece' : 'pieces'}
          </Link>
        ))}
      </nav>

      {data.months.length === 0 ? (
        <p className="text-base-content text-lg">Nothing was published in {data.year}.</p>
      ) : (
        data.months.map(({ month, pieces }) => (
          <section key={month} aria-labelledby={`archive-${month}`} className="flex flex-col gap-4">
            <h2
              id={`archive-${month}`}
              className="text-base-content text-2xl font-bold tracking-tight"
            >
              {monthName(month)}
            </h2>
            <ul className="divide-base-300 flex flex-col divide-y">
              {pieces.map((piece) => (
                <li key={piece.path} className="flex flex-col gap-1 py-3">
                  <span className="text-base-content text-sm font-semibold">
                    {dayOf(piece.publishedAt)}
                    {piece.section ? ` · ${piece.section}` : ''}
                  </span>
                  <Link
                    href={piece.path}
                    className="link link-hover text-base-content text-lg font-semibold"
                  >
                    {piece.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
