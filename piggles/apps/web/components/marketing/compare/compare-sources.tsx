import Link from 'next/link';
import { Section } from '@piggles/ui';
import { CHECKED_ON, COMPARISONS, type ComparePage } from '@/content/compare';
import { dayWords } from '../date-words';

// Where every fact about them came from, and when it was read. A comparison
// that cannot show its working is an opinion. The links are nofollow: they are
// citations, not endorsements.

export function CompareSources({ page }: { page: ComparePage }) {
  const others = COMPARISONS.filter((c) => c.slug !== page.slug);
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-2xl font-extrabold sm:text-3xl">Where these facts come from</h2>
          <p className="mt-4 text-base">
            Everything this page says about {page.name} was read from {page.name}’s own website and
            help pages on {dayWords(CHECKED_ON)}. Products change; if something here is out of date,
            tell us and we will check it again.
          </p>
          <ul className="mt-5 space-y-2 text-base">
            {page.sources.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                  className="underline underline-offset-4"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-extrabold sm:text-3xl">Other comparisons</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {others.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/compare/${c.slug}`}
                  className="text-lg font-bold underline underline-offset-4"
                >
                  Piggles or {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/compare" className="text-lg font-bold underline underline-offset-4">
                All comparisons
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
