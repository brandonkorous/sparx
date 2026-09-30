import Link from 'next/link';
import { Section } from '@piggles/ui';
import type { ComparePage } from '@/content/compare';

// What moving over looks like, including what does NOT come across. The
// "stays behind" list is the promise-keeper: somebody told their blog will move
// and then finds it did not has already left.

export function CompareMoving({ page }: { page: ComparePage }) {
  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <h2 className="text-3xl font-extrabold sm:text-4xl">Moving from {page.name}</h2>
          <p className="mt-5 text-lg">{page.moving.body}</p>
          <Link
            href="/switching"
            className="mt-5 inline-block text-base font-bold underline underline-offset-4"
          >
            How moving to Piggles works
          </Link>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="text-xl font-bold">What comes across</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base">
              {page.moving.comesAcross.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-bold">What stays behind</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base">
              {page.moving.staysBehind.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}
