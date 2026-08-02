import { Button, Text } from '@wizeworks/silicaui-react';
import {
  Container,
  Display,
  Dot,
  getModuleColor,
  Section,
  SectionHeader,
  Spark,
} from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The markup-heavy structural devices for the /email page, split out of
 * email-page.tsx so each file stays cohesive:
 *
 *  - EmailHero ........... tinted-band hero: split copy + a RENDERED BRANDED
 *    EMAIL PREVIEW (sender on the tenant's OWN domain, body from atomic
 *    components, an open/click/DKIM pulse) that crossfades through
 *    EXAMPLE_BUSINESSES — email reads as the same engine for ANY business.
 *  - EmailPipeline ...... the event-driven architecture as a 4-stage rail:
 *    a platform event → email.send → render → delivered from your domain.
 *  - EmailKinds ......... transactional vs marketing as a two-panel split,
 *    each with its real trigger flow — same engine, same reputation.
 *  - EmailDeliverability  the sender-health checklist (SPF·DKIM·DMARC Pass)
 *    beside the auto-configured DNS records panel — the real "Sending
 *    domains" surface.
 *
 * Grounded in docs/13 (Email PRD) + the real dashboard email surfaces (sender
 * health rows, domain states, broadcast vocabulary). Outbound is event-driven
 * (`email.send` → email-worker → @sparx/email React Email render → provider);
 * sends from the tenant's own domain after DKIM/SPF/DMARC verify. Email sky is
 * a deliverability signal, not flood fill.
 */

const E = getModuleColor('email');

// ── HERO ────────────────────────────────────────────────────────────────────
export function EmailHero() {
  const lede =
    'Transactional and marketing email, sent from your own domain and your reputation. Every message is triggered by a real platform event, rendered on-brand, and authenticated with SPF, DKIM, and DMARC the moment your domain verifies. No per-email markup — one flat price.';
  const chips = [
    'your own domain',
    'SPF · DKIM · DMARC',
    'transactional + marketing',
    'no per-email fees',
  ];
  return (
    <section className={`${E.bg} bg-soft px-page pb-section-lg pt-[clamp(56px,9vw,96px)]`}>
      <Container>
        <div className="flex flex-col items-center gap-[clamp(40px,6vw,72px)] lg:flex-row">
          <div className="min-w-0 flex-1">
            <Display as="h1" size={84} lineHeight={80}>
              Email on your own domain
              <Spark color={E.color} />
            </Display>
            <Text className="mt-7 max-w-[560px] text-[clamp(16px,1.6vw,20px)] leading-[1.55] font-normal">
              {lede}
            </Text>
            <div className="mt-[34px] flex flex-wrap items-center gap-3">
              <Button color="primary" size="lg">
                Activate Email →
              </Button>
              <a href="#pipeline">
                <Button size="lg" variant="outline">
                  See how a send flows
                </Button>
              </a>
            </div>
            <ul className="mt-6 flex list-none flex-wrap items-center gap-2.5 p-0">
              {chips.map((c) => (
                <li
                  key={c}
                  className="bg-base-100 border-base-300 inline-flex items-center gap-2 rounded-full border px-3 py-[7px]"
                >
                  <Dot color={E.color} size={6} />
                  <Text as="span" className="font-mono text-sm">
                    {c}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
          <div id="preview" className="w-full min-w-0 flex-1 scroll-mt-20">
            <Cycle
              items={EXAMPLE_BUSINESSES.map((b) => (
                <EmailPreviewCard key={b.domain} business={b} />
              ))}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** The hero's product-surface proof — a real branded email in the inbox: sent
 *  from the business's OWN domain, body composed from atomic components, with an
 *  open/click/DKIM pulse. Crossfades through EXAMPLE_BUSINESSES; every scene has
 *  the same shape so the card never reflows. */
function EmailPreviewCard({ business }: { business: ExampleBusiness }) {
  const { email, name } = business;
  const initials = name
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className="bg-base-100 border-base-300 overflow-hidden rounded-2xl border shadow-lg">
      {/* Window chrome — device mimicry, kept verbatim. */}
      <div className="bg-base-200 border-base-300 flex items-center gap-[7px] border-b px-[18px] py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="bg-base-300 h-2.5 w-2.5 rounded-full" />
        ))}
        <Text as="span" className="ml-2 font-mono text-sm">
          inbox · {name}
        </Text>
      </div>
      <div className="border-base-300 flex items-center gap-3 border-b px-[22px] py-[18px]">
        <span
          className={`${E.bg} bg-soft ${E.ink} border-module-email flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] text-sm font-medium`}
        >
          {initials}
        </span>
        <span className="min-w-0">
          <Text as="span" className="block text-sm font-medium">
            {email.transactional.subject}
          </Text>
          <Text as="span" className="font-mono text-sm">
            {email.sender} · to you · just now
          </Text>
        </span>
      </div>
      <div className="p-[22px]">
        <div className="border-base-200 flex items-center gap-2.5 border-b pb-4">
          <span
            className={`${E.bg} bg-soft border-module-email h-[26px] w-[26px] rounded-[7px] border`}
          />
          <Text as="span" className="text-sm font-medium">
            {name}
          </Text>
        </div>
        <Text className="mt-4 text-sm">{email.previewLine}</Text>
        <Text className="mt-2.5 text-sm">
          Tap below for the details — questions? Just reply to this email.
        </Text>
        <span
          className={`${E.bg} mt-4 inline-block rounded-lg px-[18px] py-2.5 text-sm font-medium`}
        >
          View the details
        </span>
      </div>
      <div className="border-base-300 grid grid-cols-3 border-t">
        {[
          [email.openRate, 'open rate'],
          [email.clickRate, 'click rate'],
          ['✓', 'DKIM signed'],
        ].map(([v, l], i) => (
          <div
            key={l}
            className={`px-[18px] py-3.5 ${i === 0 ? '' : 'border-base-200 border-l'}`.trimEnd()}
          >
            <div className={`text-lg font-medium tracking-[-0.01em] ${i === 2 ? E.ink : ''}`}>
              {v}
            </div>
            <Text className="mt-0.5 font-mono text-sm">{l}</Text>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PIPELINE (event-driven architecture) ────────────────────────────────────
export function EmailPipeline() {
  const stages = [
    {
      title: 'A platform event fires',
      body: 'An order is paid, a cart is abandoned, a quote is sent — or you hit send on a broadcast.',
    },
    {
      title: 'email.send is published',
      body: 'The event lands on a durable queue with retries — nothing is sent inline, nothing is lost.',
    },
    {
      title: 'Your template renders',
      body: 'A worker composes the message from atomic React Email components — HTML and plain text together.',
    },
    {
      title: 'Sent from your domain',
      body: 'Signed with your DKIM key and delivered to the inbox, with open, click, and bounce tracked back.',
    },
  ];
  return (
    <Section id="pipeline" surface="surface" padding="lg">
      <SectionHeader
        accent={E.color}
        headline="Every email is an event, not a blast"
        lede="Outbound mail is event-driven. A platform event publishes email.send; a worker renders your template and delivers it from your verified domain — the same path for an order receipt or a six-thousand-person broadcast."
      />
      <div className="mkt-pipeline bg-base-100 mt-13">
        {stages.map((s) => (
          <div key={s.title} className="mkt-pipe-cell px-6 py-7">
            <h3 className="m-0 font-sans text-lg font-medium tracking-[-0.01em]">{s.title}</h3>
            <Text className="mt-2 text-sm">{s.body}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}
