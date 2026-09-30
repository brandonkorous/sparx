import Link from 'next/link';
import { Section } from '@piggles/ui';
import { PRICE_LABEL } from '@piggles/config/pricing';
import type { ComparePage } from '@/content/compare';

// How each bill is SHAPED, never what the other one costs. Their prices are
// theirs to publish and they change without telling us; a stale competitor
// price on this page would be the one sentence a reader can prove wrong.

const OURS = [
  `One plan, ${PRICE_LABEL} a month, with every app included.`,
  'Three team members, one location, one website and 10,000 customer records included.',
  'More room costs a fixed amount: another location, another person, more storage.',
  'No fee on your sales. Your payment company charges its own card fee.',
  'Fourteen days free, with no card needed to start.',
];

export function CompareBill({ page }: { page: ComparePage }) {
  return (
    <Section variant="panel" className="bg-base-100 shadow">
      <h2 className="max-w-[26ch] text-3xl font-extrabold sm:text-4xl">
        How each bill is put together
      </h2>
      <p className="mt-4 max-w-[62ch] text-lg">
        No {page.name} prices here: they are theirs to publish and they change. This is the shape of
        each bill, which decides what happens to it as your business grows.
      </p>
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <h3 className="text-2xl font-bold">Piggles</h3>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-base">
            {OURS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <Link
            href="/pricing"
            className="mt-5 inline-block text-base font-bold underline underline-offset-4"
          >
            Everything on the Piggles price
          </Link>
        </div>
        <div>
          <h3 className="text-2xl font-bold">{page.name}</h3>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-base">
            {page.billShape.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
