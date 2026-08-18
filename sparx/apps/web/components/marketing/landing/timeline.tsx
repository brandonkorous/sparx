import { Badge, Card, CardBody, CardTitle, Heading, Text } from '@wizeworks/silicaui-react';
import { Reveal } from '../reveal';
import { MODULE_BACKGROUND_COLOR, MODULE_CONTENT_COLOR } from '../modules-catalog';

/**
 * "One ordinary day" — a chronological walk through moments across several
 * modules. The dark band is `bg-neutral` (a real
 * theme token that's ALREADY a dark surface even in light mode, so — unlike
 * Hero/Whoever — no `data-theme="dark"` scoping is needed here, just
 * `text-neutral-content`). Each moment's numbered chip wears its module's
 * `bg-module-*` fill AND the paired `-content` ink, both as real utility
 * classes — it used to paint the fill with an inline `MODULE_HEX` style and
 * then hardcode `text-white` on top, which is the exact pairing the token
 * system exists to make unnecessary.
 */
const MOMENTS = [
  {
    time: '7:12 AM',
    title: 'An order lands before you open.',
    body: 'Inventory updates, payment clears, the customer record updates, and a pickup message is scheduled — automatically, with no integration to configure.',
    result: 'Order handled',
    module: 'commerce',
  },
  {
    time: '10:40 AM',
    title: 'A wholesale buyer asks for pricing.',
    body: 'sparx recognizes the company, applies their price list and net terms, and drafts a quote from the same product catalog you already sell from.',
    result: 'Quote ready',
    module: 'b2b',
  },
  {
    time: '1:15 PM',
    title: "This week's post becomes an email, in one click.",
    body: 'Write it once in the CMS. Send it as a newsletter to your subscribers without re-typing a word or opening a second tool.',
    result: 'Newsletter sent',
    module: 'cms',
  },
  {
    time: '4:50 PM',
    title: 'You ask your AI what changed today.',
    body: 'Because sparx exposes live business data through MCP, your assistant answers with real orders, customers and inventory — not a stale export.',
    result: 'Answer grounded',
    module: 'ai',
  },
  {
    time: '6:18 PM',
    title: 'You go home without doing software chores.',
    body: "Reports already agree. The customer list is current. Tomorrow's reminders are queued. The business closes; the system keeps working.",
    result: 'Evening reclaimed',
    module: 'builder',
  },
] as const;

export function LandingTimeline() {
  return (
    <section id="day" className="bg-neutral m-6 rounded-4xl px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <Reveal className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            {/* Starts a step below the other sections' `text-6xl`: this headline owns
                the page's longest unbreakable word ("extraordinary"), which at 60px
                is ~353px and overflowed a 294px phone column — inline text overflow
                doesn't grow the box, so it scrolled the page without any element
                visibly sticking out. */}
            <Heading
              level={2}
              size="display"
              className="text-neutral-content text-5xl leading-[0.95] tracking-tight sm:text-6xl md:text-7xl"
            >
              One ordinary day. One extraordinary advantage.
            </Heading>
            <Text variant="lead" className="text-neutral-content max-w-xl text-2xl">
              sparx is most valuable in the moments that used to steal your attention. Here&apos;s
              what it feels like when your whole business shares one brain.
            </Text>
          </Reveal>

          <div className="relative">
            <span
              aria-hidden
              className="bg-neutral-content/15 absolute top-1.5 bottom-1.5 left-[27px] w-px"
            />
            <div className="flex flex-col gap-5">
              {MOMENTS.map((m, i) => (
                <Reveal key={m.time} index={i}>
                  <Moment moment={m} index={i} />
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Moment({ moment: m, index }: { moment: (typeof MOMENTS)[number]; index: number }) {
  return (
    <article className="flex items-start gap-5">
      <span
        className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[15px] font-bold ${MODULE_BACKGROUND_COLOR[m.module]} ${MODULE_CONTENT_COLOR[m.module]}`}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <Card className="flex-1">
        <CardBody className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Text variant="caption">{m.time}</Text>
            <Badge color="success" variant="soft">
              {m.result}
            </Badge>
          </div>
          <CardTitle className="text-2xl">{m.title}</CardTitle>
          <Text className="max-w-xl text-lg">{m.body}</Text>
        </CardBody>
      </Card>
    </article>
  );
}
