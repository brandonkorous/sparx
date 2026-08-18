import { Text } from '@wizeworks/silicaui-react';
import { Dot, getModuleColor, Section, SectionHeader } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * Three structural devices for the /dropship page, split out of dropship-page.tsx:
 *
 *  - DropshipRouting ..... the marquee: a 4-stage rail (order placed → split by
 *    supplier → submitted to each → tracking synced back) with connector arrows.
 *  - DropshipInventory ... live stock sync: a 3-up signal grid + a status strip.
 *  - DropshipTracking .... the routed-order lifecycle (submitted → shipped →
 *    delivered) on a branded shipping-email frame, rotating through verticals.
 *
 * Grounded in docs/14 §9–§10 (catalog sync, order routing) + the real dashboard
 * routed-order status. Dropship emerald is a signal, not fill. (The hero +
 * routed-order card live in dropship-hero.tsx; the supplier connect + margin
 * devices live in dropship-sections.tsx.)
 */

const M = getModuleColor('dropship');

// ── AUTOMATED ORDER ROUTING (the marquee rail) ──────────────────────────────
export function DropshipRouting() {
  const stages = [
    {
      title: 'An order comes in',
      body: 'A customer checks out as normal — through your store or the API. The order can mix dropship lines with stock you hold; sparx sorts that out next.',
    },
    {
      title: 'Split by supplier',
      body: 'The router groups the lines into a fulfillment group per supplier. Two suppliers on one order become two groups, each handled independently.',
    },
    {
      title: 'Routed to each supplier',
      body: 'Every group is submitted automatically through its supplier adapter — idempotent on the order id, so a retry never double-orders. A failure holds and alerts you, never drops.',
    },
    {
      title: 'Tracking flows back',
      body: 'Tracking arrives by webhook or poll, updates the fulfillment record, emails the customer, and logs a CRM activity. Combined tracking once every group ships.',
    },
  ];
  return (
    <Section id="routing" surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Orders route themselves"
        lede="This is the part you stop doing by hand. When an order lands, sparx splits it by supplier, submits each group, and pulls tracking back to the customer — automatically, whether one supplier fills it or three."
      />
      <div className="mkt-pipeline bg-base-100 mt-13">
        {stages.map((s, i) => (
          <div
            key={s.title}
            className="mkt-pipe-cell relative flex min-h-[188px] flex-col gap-3 px-6 pt-6 pb-7"
          >
            <h3 className="m-0 flex items-center gap-2.5 font-sans text-lg font-medium tracking-[-0.01em]">
              <Dot color={M.color} size={8} />
              {s.title}
            </h3>
            <Text className="m-0 text-sm">{s.body}</Text>
            {i < stages.length - 1 ? (
              <span
                className={`mkt-hide-on-tablet bg-base-100 border-base-300 ${M.ink} absolute top-[38px] -right-[11px] z-2 flex h-[22px] w-[22px] items-center justify-center rounded-full border`}
              >
                <ArrowRight size={13} />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── LIVE INVENTORY SYNC ─────────────────────────────────────────────────────
export function DropshipInventory() {
  const cells = [
    {
      title: 'Live stock, pulled on sync',
      body: 'API suppliers report stock on every scheduled sync. A product that sells out is flagged unavailable and you are notified in the dashboard and by email.',
    },
    {
      title: 'Per-combo availability',
      body: 'A supplier can mark one color or size temporarily unfulfillable while the product stays listed. That exact combo greys out on the product page, struck-through, not the whole product.',
    },
    {
      title: 'Made-to-order is unlimited',
      body: 'Print-on-demand suppliers have no finite stock, so there is nothing to count — those products never go out of stock for a sync reason.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline={<>Never sell what the supplier can&rsquo;t ship</>}
        lede={
          <>
            Stock you don&rsquo;t hold is stock you can&rsquo;t see &mdash; unless it syncs. sparx
            pulls live availability from each supplier, so a sold-out item comes off the shelf
            before a customer can order it, and a back-in-stock combo returns on its own.
          </>
        }
      />
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cells.map((c) => (
          <div
            key={c.title}
            className="bg-base-100 border-base-300 flex min-h-[186px] flex-col gap-3 rounded-xl border p-6"
          >
            <span className={`${M.bg} bg-soft flex h-8 w-8 items-center justify-center rounded-lg`}>
              <Dot color={M.color} size={9} />
            </span>
            <h3 className="m-0 font-sans text-lg font-medium tracking-[-0.01em]">{c.title}</h3>
            <Text className="m-0 text-sm">{c.body}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── TRACKING SYNC BACK TO THE CUSTOMER ──────────────────────────────────────
export function DropshipTracking() {
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="The customer hears from you, not the supplier"
        lede={
          <>
            When the supplier ships, sparx forwards the tracking to your customer in a branded email
            from your own domain, and moves the order through its status. They never see the
            supplier&rsquo;s name &mdash; to them, it&rsquo;s your store, start to finish.
          </>
        }
      />
      <div className="mkt-ds-split mt-13">
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <TrackingTimeline key={b.domain} business={b} />
          ))}
        />
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <ShippingEmail key={b.domain} business={b} />
          ))}
        />
      </div>
    </Section>
  );
}

/** Left: the routed-order status lifecycle, with the live one highlighted. */
function TrackingTimeline({ business }: { business: ExampleBusiness }) {
  const { dropship: d } = business;
  const steps = ['Submitted', 'Shipped', 'Delivered'];
  const activeIdx = Math.max(0, steps.indexOf(d.routed.status));
  return (
    <div
      className={`${M.bg} bg-soft border-base-300 flex h-full flex-col gap-[18px] rounded-[14px] border p-6`}
    >
      <div>
        <Text as="span" className="text-md font-medium">
          {d.routed.number}
        </Text>
        <Text as="span" className="mt-1 block font-mono text-sm">
          routed to {d.supplier} · {d.routed.carrier}
        </Text>
      </div>
      <div className="flex flex-col gap-3.5">
        {steps.map((s, i) => {
          const done = i <= activeIdx;
          return (
            <div key={s} className="flex items-center gap-3">
              <span
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
                  done ? M.bg : 'bg-base-200 border-base-300 border'
                }`}
              >
                {done ? <Check size={11} /> : null}
              </span>
              <Text
                as="span"
                className={`text-sm ${done ? '' : ''} ${
                  i === activeIdx ? 'font-medium' : 'font-normal'
                }`}
              >
                {s}
              </Text>
              {i === activeIdx ? (
                <Text as="span" className={`ml-auto font-mono text-sm ${M.ink}`}>
                  current
                </Text>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Right: the branded shipping email the customer receives, on the store domain. */
function ShippingEmail({ business }: { business: ExampleBusiness }) {
  const { dropship: d, customer, name, email } = business;
  return (
    <div className="bg-base-100 border-base-300 overflow-hidden rounded-[14px] border">
      {/* Inbox chrome — device mimicry, kept verbatim. */}
      <div className="border-base-300 bg-base-200 flex items-center gap-2.5 border-b px-5 py-3.5">
        <Dot color={M.color} size={8} />
        <Text as="span" className="font-mono text-sm">
          from {email.sender}
        </Text>
      </div>
      <div className="p-[22px]">
        <div className="text-md font-medium tracking-[-0.01em]">Your {name} order has shipped</div>
        <Text className="mt-3 text-sm">
          Hi {customer.name.split(' ')[0]} — {d.routed.number} is on its way via {d.routed.carrier}.
          Track it any time with the number below.
        </Text>
        <div className="bg-base-200 border-base-300 mt-4 flex items-center gap-3 rounded-[10px] border px-4 py-3.5">
          <TruckGlyph size={16} color={M.color} />
          <span className="min-w-0">
            <Text as="span" className="block text-sm font-medium">
              {d.routed.carrier}
            </Text>
            <Text as="span" className="font-mono text-sm">
              {d.routed.tracking}
            </Text>
          </span>
          <Text
            as="span"
            className={`${M.bg} bg-soft ${M.ink} ml-auto shrink-0 rounded-full px-3 py-1.5 text-sm font-medium`}
          >
            Track order
          </Text>
        </div>
        <div className="mt-4 flex items-center gap-2.5">
          <Dot color={M.color} size={6} />
          <Text as="span" className="font-mono text-sm">
            sent via sparx Email · {d.supplier} never named
          </Text>
        </div>
      </div>
    </div>
  );
}

function ArrowRight({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function Check({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TruckGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M1 3h15v13H1z" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}
