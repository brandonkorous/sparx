import { Section } from '@piggles/ui';
import type { ComparePage } from '@/content/compare';

// The verdict, in two columns of equal weight. "Choose them if" is as long and
// as specific as "choose us if": a comparison that only ever ends one way is an
// advert, and the reader knows it.

export function ComparePick({ page }: { page: ComparePage }) {
  const columns = [
    { title: `Choose ${page.name} if`, lines: page.pickThem, border: 'border-base-300' },
    { title: 'Choose Piggles if', lines: page.pickUs, border: 'border-primary' },
  ];
  return (
    <Section variant="panel" className="bg-base-100 shadow">
      <h2 className="text-3xl font-extrabold sm:text-4xl">So which one?</h2>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {columns.map((col) => (
          <div key={col.title} className={`rounded-section border-2 p-6 sm:p-8 ${col.border}`}>
            <h3 className="text-2xl font-bold">{col.title}</h3>
            <ul className="mt-4 list-disc space-y-3 pl-5 text-lg">
              {col.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
