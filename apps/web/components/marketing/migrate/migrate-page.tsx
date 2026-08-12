import Link from 'next/link';
import { Badge } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — this is a Server Component, and
// the client entry's copy is a client reference: calling it during prerender
// fails at `stringify` with "attempted to call buttonClasses() from the server".
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { ENTITY_LABEL, connectorOnlyEntities, vendorCapability } from '@sparx/migration';
import { Band } from '../band';
import { Display, Text } from '../primitives';
import { Faq } from '../faq';
import { SALES_HREF, signupHref } from '../cta';
import type { MigrateStory } from './stories';

/**
 * One page per platform somebody is leaving.
 *
 * ## The list of what moves is COMPUTED
 *
 * `vendorCapability(slug)` reads the same adapter registry the importer runs on, so
 * this page can only claim an entity that an adapter genuinely maps, and the file
 * names and menu paths it prints are the ones the workbench will ask for. That is not
 * tidiness — the route this replaces advertised four importers that did not exist,
 * because the claim and the capability had no connection to each other. This is the
 * connection, and it is a build-time one: change an adapter and the page changes.
 *
 * ## Band rhythm
 *
 * dark → page → surface → primary → page → neutral → page → dark, so no two adjacent
 * bands share a value and the argument has a shape you can feel while scrolling
 * (docs/141 §1). Each band carries one structural device and no two share one: the
 * hero is type, the pains are a numbered rail, what-moves is a chip field, the turn is
 * a single wide statement, the consequences are a checked list, the limits are a
 * plain-spoken table.
 *
 * ## The story, not the feature list
 *
 * Read the headlines down the page: the week you dread → here is why you opened this
 * tab → here is exactly what comes → the problem was the SHAPE of what you bought →
 * so this is what changes → and here is what does not come. Shuffle those and it
 * stops making sense, which is the test that it is an argument rather than an
 * inventory.
 */
export function MigratePage({ story }: { story: MigrateStory }) {
  const capability = vendorCapability(story.slug);
  const entities = capability?.entities ?? [];
  const sources = capability?.sources ?? [];
  const connectorOnly = connectorOnlyEntities(story.slug).map((entity) =>
    ENTITY_LABEL[entity].many.toLowerCase()
  );
  const url = `https://sparx.works/migrate/${story.slug}`;

  // De-duplicated, because several vendors yield the same entity from two files (a
  // Square item library is both the catalogue and the stock).
  const files = sources.filter(
    (source, index) => sources.findIndex((other) => other.file === source.file) === index
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'sparx', item: 'https://sparx.works' },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Switching',
            item: 'https://sparx.works/migrate',
          },
          { '@type': 'ListItem', position: 3, name: `From ${story.name}`, item: url },
        ],
      },
      {
        '@type': 'HowTo',
        name: `Move from ${story.name} to sparx`,
        description: story.seoDescription,
        step: [
          {
            '@type': 'HowToStep',
            name: `Export from ${story.name}`,
            text: files
              .map((file) => `${file.label}: ${file.where} — you get ${file.file}.`)
              .join(' '),
          },
          {
            '@type': 'HowToStep',
            name: 'Drop the file in',
            text: 'sparx reads it in your browser, recognises which platform it came from, and tells you exactly what is in it. Nothing is uploaded at this point.',
          },
          {
            '@type': 'HowToStep',
            name: 'Look at what will happen',
            text: 'A practice run checks every row against what you already have and reports what would be created, updated or skipped — without saving anything.',
          },
          { '@type': 'HowToStep', name: 'Bring it in', text: story.effort },
        ],
      },
    ],
  };

  const faqItems = [
    {
      id: `${story.slug}-safe`,
      question: `Will this break my ${story.name} ${story.noun}?`,
      answer: `No. Everything happens on a copy — you export a file, and your ${story.name} account carries on exactly as it is. Plenty of people run both for a few weeks before switching their domain over.`,
    },
    {
      id: `${story.slug}-goes-wrong`,
      question: 'What if the import goes wrong?',
      answer:
        'It tells you first. Your file is read in your own browser and checked before a single byte is uploaded, and then a practice run resolves every row against your real data and reports what would happen without saving anything. You only press the real button once you have seen the numbers.',
    },
    {
      id: `${story.slug}-twice`,
      question: 'Can I bring it in twice?',
      answer:
        'Yes. Records are matched on their natural key — SKU for products, email for customers, order number for orders — so running the same file again updates rather than duplicates. Fix something in the spreadsheet and re-drop it.',
    },
    {
      id: `${story.slug}-done-for-you`,
      question: 'Do you do it for us?',
      answer:
        'For most businesses there is nothing to do — it is a file and a button. If your data is genuinely awkward, email migrate@sparx.works and we will do the move with you.',
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // Generated from the same data the page renders, so it cannot describe a
        // different product than the one above it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 1 · The promise */}
      <Band tone="dark" flush>
        <div className="mx-auto flex max-w-4xl flex-col items-start gap-6 py-20 @3xl:py-28">
          <Link href="/migrate" className="text-base underline underline-offset-4">
            ← Every platform we move you from
          </Link>
          <Display as="h1" size={64}>
            {story.headline}
          </Display>
          <Text size={20} className="max-w-2xl">
            {story.lede}
          </Text>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href={signupHref(`migrate-${story.slug}-hero`)}
              className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
            >
              Start moving &rarr;
            </a>
            {/* Colorless outline — a named color inside the dark island paints its
                raw accent onto the label. See vertical-hero.tsx. */}
            <Link href="/pricing" className={buttonClasses({ size: 'lg', variant: 'outline' })}>
              What it costs
            </Link>
          </div>
          <Text size={16}>{story.effort}</Text>
        </div>
      </Band>

      {/* 2 · Recognition — a numbered rail, because these escalate */}
      <Band>
        <div className="mx-auto flex max-w-4xl flex-col gap-10 py-20">
          <Display size={44}>{story.painTitle}</Display>
          <div className="flex flex-col gap-8">
            {story.pains.map((pain, index) => (
              <div key={pain.title} className="border-base-content/15 flex gap-6 border-l-2 pl-6">
                <span className="text-primary shrink-0 text-2xl font-semibold tabular-nums">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-2">
                  <Display size={26} as="h3">
                    {pain.title}
                  </Display>
                  <Text size={18}>{pain.body}</Text>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Band>

      {/* 3 · Exactly what comes across — computed, never written by hand */}
      <Band tone="surface">
        <div className="mx-auto flex max-w-4xl flex-col gap-8 py-20">
          <div className="flex flex-col gap-3">
            <Display size={44}>What comes across</Display>
            <Text size={18}>
              Everything in this list is something an importer we maintain actually reads out of
              your {story.name} export. It is generated from that importer, so it cannot promise you
              something we do not do.
            </Text>
          </div>

          <div className="flex flex-wrap gap-2">
            {entities.map((entity) => (
              <Badge key={entity} color="primary" variant="soft" size="lg">
                {ENTITY_LABEL[entity].many}
              </Badge>
            ))}
          </div>

          <div className="border-base-content/15 flex flex-col gap-0 rounded-2xl border">
            <div className="border-base-content/15 border-b p-5">
              <Display size={24} as="h3">
                The files you need from {story.name}
              </Display>
            </div>
            {files.map((file) => (
              <div
                key={file.id}
                className="border-base-content/10 grid gap-2 border-b p-5 last:border-b-0 @2xl:grid-cols-[1fr_1.6fr]"
              >
                <Text size={18} weight={600}>
                  {file.label}
                </Text>
                <div className="flex flex-col gap-1">
                  <Text size={16}>{file.where}</Text>
                  <Text size={16} mono>
                    {file.file}
                  </Text>
                </div>
              </div>
            ))}
          </div>

          {/* The live connection's claim is computed too, and specifically: it names
              the things their own exporter cannot produce at all. For Shopify that is
              collections, pages and the blog — the three a tenant discovers are
              missing about a week after they thought they had finished. */}
          {capability?.hasConnector === true ? (
            <Text size={18}>
              Or connect your {story.name} account with one read-only key and we fetch all of it
              directly — no exporting, no files.
              {connectorOnly.length === 0
                ? ''
                : ` It is also the only way ${connectorOnly.join(', ')} can come across, because ${story.name} has no export that produces them.`}
            </Text>
          ) : null}
        </div>
      </Band>

      {/* 4 · The turn — one wide statement, the only band that is all argument */}
      <Band tone="primary">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 py-24 text-center">
          <Display size={48}>{story.turnTitle}</Display>
          <Text size={20}>{story.turnBody}</Text>
        </div>
      </Band>

      {/* 5 · Consequences — what changes about the week */}
      <Band>
        <div className="mx-auto flex max-w-4xl flex-col gap-8 py-20">
          <Display size={40}>What that changes</Display>
          <ul className="flex flex-col gap-5">
            {story.consequences.map((line) => (
              <li key={line} className="flex gap-4">
                <span
                  className="bg-primary mt-2.5 size-2 shrink-0 rounded-full"
                  aria-hidden="true"
                />
                <Text size={18}>{line}</Text>
              </li>
            ))}
          </ul>
        </div>
      </Band>

      {/* 6 · Honesty — said before they find out */}
      <Band tone="neutral">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 py-20">
          <Display size={36}>What does not come across</Display>
          <Text size={18}>
            Every migration leaves something behind. Here is ours, so it is not a surprise halfway
            through.
          </Text>
          <ul className="flex flex-col gap-4">
            {story.limits.map((limit) => (
              <li key={limit} className="border-neutral-content/25 border-l-2 pl-5">
                <Text size={18}>{limit}</Text>
              </li>
            ))}
          </ul>
        </div>
      </Band>

      {/* 7 · The questions everyone asks before pressing anything */}
      <Faq id={`migrate-${story.slug}-faq`} heading="Before you start" items={faqItems} />

      {/* 8 · Resolution */}
      <Band tone="dark">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 py-24 text-center">
          <Display size={48}>Bring it over</Display>
          <Text size={20}>
            Export the file {story.name} already makes for you, drop it in, and look at what would
            happen before anything is saved. {story.effort}
          </Text>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={signupHref(`migrate-${story.slug}-final`)}
              className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
            >
              Get started &rarr;
            </a>
            <Link href={SALES_HREF} className={buttonClasses({ size: 'lg', variant: 'outline' })}>
              Ask us to do it
            </Link>
          </div>
        </div>
      </Band>
    </>
  );
}
