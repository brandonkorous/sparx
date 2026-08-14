import Link from 'next/link';
import { Badge } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — this is a Server Component, and
// the client entry's copy is a client reference: calling it during prerender
// fails at `stringify` with "attempted to call buttonClasses() from the server".
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { ENTITY_LABEL, catalogueByKind, connectorOnlyEntities } from '@sparx/migration';
import { Band } from '../band';
import { Display, Text } from '../primitives';
import { Faq } from '../faq';
import { EARLY_HREF, SALES_HREF, signupHref } from '../cta';
import { getStory } from './stories';

/**
 * `/migrate` — the hub.
 *
 * Deliberately NOT a wall of logos. The argument is "the week you are dreading is an
 * afternoon", and a grid of brands makes no argument at all — it just asserts breadth
 * and leaves the reader exactly as worried as they arrived.
 *
 * So the page shows the MECHANISM first (four steps, in the order they happen, with
 * the one that matters called out: nothing is uploaded until you have looked at it),
 * and only then the list of platforms — which is generated from the adapter registry
 * rather than typed here, so it cannot list a vendor whose importer does not exist.
 */
export function MigrateHub() {
  const groups = catalogueByKind().filter((group) => group.vendors.length > 0);
  const vendorCount = groups.reduce((sum, group) => sum + group.vendors.length, 0);

  const steps = [
    {
      title: 'Export from where you are now',
      body: 'Every platform on this page already makes the file — it is usually two clicks and it is already sitting in your downloads folder. We name the exact menu and the exact file on each page.',
    },
    {
      title: 'Drop it in',
      body: 'We read it in your own browser and tell you which platform it came from and what is in it. Nothing is uploaded at this point — not one byte — so a file with a problem is rejected in the second you drop it, not after a failed job.',
    },
    {
      title: 'Do a practice run',
      body: 'Every row is checked against the data you already have, and you are told what would be created, what would be updated and what would be skipped, and why. Nothing is saved.',
    },
    {
      title: 'Bring it in',
      body: 'Then it happens, with a running count and a list of anything that needed a person. Run the same file again later and it updates rather than duplicating.',
    },
  ];

  const faqItems = [
    {
      id: 'migrate-cost',
      question: 'Does this cost anything?',
      answer:
        'No. Moving your data in is part of the product, not a service we sell. If your data is genuinely awkward we will do the move with you, and that is not charged for either.',
    },
    {
      id: 'migrate-not-listed',
      question: 'What if my platform is not listed?',
      answer:
        'Drop the CSV in anyway. Anything we do not recognise goes to a mapping screen that guesses what your columns mean and asks you to confirm — so any spreadsheet with labelled columns works, including one your bookkeeper has kept since 2011.',
    },
    {
      id: 'migrate-run-both',
      question: 'Can I keep my old site running while I set this up?',
      answer:
        'Yes, and most people do. Nothing here touches your existing account — you export a file, and it carries on exactly as it was. You switch the domain over when you are ready.',
    },
    {
      id: 'migrate-rankings',
      question: 'Will I lose my search rankings?',
      answer:
        'Not if your platform gives us the old addresses. Every page and post that moves gets a redirect from its old URL to its new one automatically, and WordPress SEO titles and descriptions come across too.',
    },
  ];

  return (
    <>
      <Band tone="dark" flush>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <Display as="h1" size={64}>
            The week you are dreading is an afternoon
          </Display>
          <Text size={20} className="max-w-2xl">
            Your products, your customers, your stock, your orders and everything you have written —
            brought over from the export file your current platform already makes. No developer, no
            agency, no re-typing, and nothing saved until you have seen exactly what would happen.
          </Text>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href={signupHref('migrate-hero')}
              className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
            >
              Start moving &rarr;
            </a>
            {/* No color on the outline: inside a dark island a named color paints
                its raw accent onto the label and drops to ~1.7:1. Colorless, it
                inherits the surface ink. Same trap as vertical-hero.tsx. */}
            <a href="#platforms" className={buttonClasses({ size: 'lg', variant: 'outline' })}>
              See your platform
            </a>
          </div>
          <Text size={16}>{vendorCount} platforms, and any spreadsheet besides.</Text>
        </div>
      </Band>

      <Band>
        <div className="mx-auto flex max-w-4xl flex-col gap-10">
          <div className="flex flex-col gap-3">
            <Display size={44}>
              Switching is only frightening because of what you cannot see
            </Display>
            <Text size={18}>
              Nobody is scared of the file. They are scared of pressing a button and finding out
              afterwards that four hundred products came across with the wrong prices. So this is
              built the other way round: you find out first, and the button is last.
            </Text>
          </div>

          <ol className="flex flex-col gap-8">
            {steps.map((step, index) => (
              <li key={step.title} className="border-base-content/15 flex gap-6 border-l-2 pl-6">
                <span className="text-primary shrink-0 text-2xl font-semibold tabular-nums">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-2">
                  <Display size={26} as="h3">
                    {step.title}
                  </Display>
                  <Text size={18}>{step.body}</Text>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Band>

      <Band tone="primary">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 text-center">
          <Display size={48}>Most importers take the catalogue and leave the business</Display>
          <Text size={20}>
            Products are the easy half. What actually costs you a month is everything else — the
            stock counted per location, the order history, the blog you have written for nine years,
            the mailing list with its consent intact, the pipeline with your own stage names, and
            every old link still pointing at the right page. That is the half this does.
          </Text>
        </div>
      </Band>

      <Band tone="surface" id="platforms">
        <div className="mx-auto flex max-w-5xl flex-col gap-12">
          <div className="flex flex-col gap-3">
            <Display size={44}>Where are you moving from?</Display>
            <Text size={18}>
              Each page names the exact file, the exact menu it is under, what comes across, and
              what does not.
            </Text>
          </div>

          {groups.map((group) => (
            <section key={group.kind} className="flex flex-col gap-5">
              <Display size={28} as="h3">
                {group.label}
              </Display>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.vendors.map((vendor) => {
                  const story = getStory(vendor.slug);
                  // Entities the vendor has NO export for. Computed from the same
                  // registry as everything else, so this card cannot claim one the
                  // connector does not read — and cannot quietly omit one either,
                  // which is what it did: the WooCommerce card listed no order
                  // history at all, and Shopify's left off collections and the blog.
                  const liveOnly = connectorOnlyEntities(vendor.slug);
                  // Appended, because catalogue() derives its list from FILES — the
                  // live-only ones are absent from it by construction.
                  // No cap. The longest card is eight chips, and "+2 more" was
                  // hiding exactly the two that make this vendor interesting — a
                  // truncation that drops the differentiator is worse than a card
                  // one row taller.
                  const all = [...vendor.entities, ...liveOnly];
                  return (
                    <Link
                      key={vendor.slug}
                      href={`/migrate/${vendor.slug}`}
                      className="border-base-content/15 hover:border-primary flex flex-col gap-3 rounded-2xl border p-5 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Display size={24} as="h3">
                          {vendor.name}
                        </Display>
                        {vendor.hasConnector ? (
                          <Badge color="primary" variant="soft" size="sm">
                            Live connection
                          </Badge>
                        ) : null}
                      </div>
                      {story !== undefined ? <Text size={16}>{story.headline}</Text> : null}
                      <div className="flex flex-wrap gap-1.5">
                        {all.map((entity) => (
                          // Primary, not neutral, for anything that needs the live
                          // connection: it is the one distinction on this card that
                          // changes what the reader has to DO, and grey says nothing.
                          <Badge
                            key={entity}
                            color={liveOnly.includes(entity) ? 'primary' : 'neutral'}
                            variant={liveOnly.includes(entity) ? 'soft' : 'outline'}
                            size="sm"
                          >
                            {ENTITY_LABEL[entity].many}
                          </Badge>
                        ))}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="border-base-content/15 flex flex-col gap-3 rounded-2xl border border-dashed p-6">
            <Display size={24} as="h3">
              Somewhere else entirely
            </Display>
            <Text size={18}>
              Drop any CSV in and tell us what the columns mean — we guess first, so on a
              well-labelled file there is usually nothing left to correct. Your own stock
              spreadsheet works exactly as well as a competitor&rsquo;s export.
            </Text>
          </div>
        </div>
      </Band>

      <Faq id="migrate-faq" heading="The questions everybody asks" items={faqItems} />

      <Band tone="dark">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <Display size={48}>Find out in ten minutes, not in a month</Display>
          <Text size={20}>
            Export the file, drop it in, and read what would happen. If it is not right, nothing has
            been saved and you have lost ten minutes.
          </Text>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={signupHref('migrate-final')}
              className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
            >
              Get started &rarr;
            </a>
            <a href={SALES_HREF} className={buttonClasses({ size: 'lg', variant: 'outline' })}>
              Talk to us first
            </a>
            <a href={EARLY_HREF} className={buttonClasses({ size: 'lg', variant: 'ghost' })}>
              Not ready yet
            </a>
          </div>
        </div>
      </Band>
    </>
  );
}
