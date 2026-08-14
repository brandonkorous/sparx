import type { ReactNode } from 'react';
import { Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Display, Section, Spark } from './primitives';
import { LedgerLine, M, type Flow } from './inventory-ledger';
import { Faq, type FaqItem } from './faq';
import { PhotoBand } from './photo-band';
import {
  InventoryFalseFix,
  InventoryIntegrity,
  InventoryProvenance,
  InventoryTurn,
} from './inventory-sections';
import {
  InventoryAssistant,
  InventoryBuying,
  InventoryFloor,
  InventorySetup,
} from './inventory-floor';
import { InventoryEvidence, InventoryParity } from './inventory-evidence';
import { signupHref } from './cta';

/**
 * The /inventory marketing page.
 *
 * THE PAGE TELLS ONE STORY, in the six beats the voice doc specifies
 * (docs/brain/design/voice.md; /crm and /finance are the worked examples). Read
 * the headlines in order — if they shuffle without loss it is a feature
 * inventory rather than a story, and this page was the single easiest one on the
 * site to get wrong: Inventory is twelve shipped phases, 337 endpoints and
 * twenty-five workbench surfaces, and a feature inventory about inventory is a
 * joke that writes itself.
 *
 *   1. PROMISE ......... hero — the number is right, and here is it proving it
 *   2. RECOGNITION ..... you don't distrust the number exactly; you just walk to
 *                        the shelf before you promise anything. Then the survey:
 *                        it is 85% of the market, not carelessness
 *   3. FALSE FIX ....... so you buy a stock system, and it is confidently wrong
 *                        by Tuesday — with nothing to say about which of the two
 *                        numbers is lying
 *   4. THE TURN ........ on hand is not a number we keep, it is a sum we can
 *                        always do again — because nothing overwrites a total
 *                                                                    ← LAYER 5
 *   5. CONSEQUENCES .... it shows its working → it checks itself overnight → it
 *                        walks the floor with you → it tells you what to buy →
 *                        you can just ask it. Each one is only possible because
 *                        of the one before it, so the order is load-bearing
 *   6. RESOLUTION ...... off the spreadsheet by the end of the afternoon, and
 *                        everyone can use it — closing the beat-2 recognition
 *                        (85% are on a spreadsheet) rather than beat 3
 *
 * Then the two grounded sections (docs/146 §12.6): the capability bar the
 * category converged on with the four rows where our answer is no, then the
 * price, the questions, and the ask.
 *
 * Amber is a signal everywhere except beat 4, which paints it — one identity
 * band per page (DESIGN.md §2.5). Layers present: 1 (the FAQ's bare section), 2,
 * 3, 4 (the pricing band) and 5 (the turn).
 *
 * THE HARD CONSTRAINT ON EVERY WORD is docs/146's two governing rules: a guess
 * must never be indistinguishable from a fact, and absence must never be
 * presented as a measurement. A page that breaks either of those while selling a
 * product whose entire pitch is "you can check this number" is arguing against
 * itself. So the reorder table shows dashes where nothing was computed, the
 * thirty-minute setup figure is stated as the target it is measured against
 * rather than an average nobody measured, the survey figures carry a citation
 * and a date, and the four things this module does not do have their own group
 * on the page rather than an absence someone discovers later.
 */
export function InventoryPage() {
  return (
    <>
      <InventoryHero />
      {/* BEAT 2 — RECOGNITION. The reader is not sloppy; they have simply
          learned not to promise what the screen says. A photograph carries it
          because the moment being described is a person at a counter about to
          make a promise, which is exactly when the doubt shows up. */}
      <PhotoBand
        surface="surface"
        accent={M.ink}
        side="right"
        src="/scenes/counter-handover.jpg"
        alt="A shopkeeper handing a paper bag across the counter to a customer."
        headline="You don’t quite trust the number enough to promise it"
        lede="Somebody asks if you have four of something and you say “let me go and look” — because you have been caught before, and the walk to the back is cheaper than the phone call afterwards. Nothing about that is disorganised. It is what anyone sensible does with a number they cannot check, and it quietly costs you an hour a day and the occasional order."
      />
      <InventoryEvidence />
      {/* BEAT 3 — THE FALSE FIX. Concedes that the sync works, then attacks the
          second question. Conceding first is what makes beat 4 credible. */}
      <InventoryFalseFix />
      {/* BEAT 4 — THE TURN. Layer 5: the module's own hue, painted, at the one
          moment the page says the thing only sparx can say. */}
      <InventoryTurn />
      {/* BEAT 5 — CONSEQUENCES, escalating. Each follows from the turn and from
          its predecessor: you cannot direct a picker to a shelf unless the
          system knows what is on it, you cannot advise a purchase unless the
          demand history is trustworthy, and nothing should be reading any of it
          through an assistant until all of that is true. */}
      <InventoryProvenance />
      <InventoryIntegrity />
      <InventoryFloor />
      <InventoryBuying />
      <InventoryAssistant />
      {/* BEAT 6 — RESOLUTION. Closes the loop opened in beat 2: 85% are on a
          spreadsheet, so the answer is not a feature list, it is being off it by
          this afternoon with everyone able to use the thing. */}
      <InventorySetup />
      <InventoryParity />
      <InventoryPricing />
      <Faq
        items={INVENTORY_FAQ}
        id="faq"
        heading={
          <>
            Stock questions
            <Spark color={M.ink} />
          </>
        }
        lede="What it does, what it deliberately doesn’t, what it costs, and what happens to the spreadsheet you have been keeping — answered straight. Still deciding? Start the 14-day trial, or turn Commerce on and get this for nothing."
      />
      <InventoryCta />
    </>
  );
}

// ── HERO (BEAT 1 · PROMISE) ──────────────────────────────────────────────────
//
// The device is the promise stated as a picture: one item's quantity, taken
// apart into the things that produced it, arriving at the figure the rest of the
// business sees. It earns its place three ways — it makes the claim checkable in
// the first screenful (a reader can add the column up), it teaches the ledger
// idea before the page ever uses the word, and it is a shape no other stock
// product can draw, because storing a single editable figure per item destroys
// the information this card is made of.
//
// The arithmetic is real and every later section reconciles to it:
// 120 + 240 − 312 + 9 − 6 = 51 on hand, less 10 held = 41 free to sell.

const DERIVATION: { what: string; when?: string; qty: string; flow: Flow }[] = [
  { what: 'Counted on the shelf', when: '14 Feb', qty: '120', flow: 'count' },
  { what: 'Delivered', when: '3 deliveries', qty: '+240', flow: 'in' },
  { what: 'Sold', when: '188 orders', qty: '−312', flow: 'out' },
  { what: 'Came back', when: '4 returns', qty: '+9', flow: 'in' },
  { what: 'Broken on arrival', when: '4 Feb', qty: '−6', flow: 'out' },
];

function InventoryHero() {
  return (
    <Section padding="xl">
      <div className="grid grid-cols-1 items-center gap-[clamp(40px,6vw,72px)] lg:grid-cols-[1.05fr_1fr]">
        <div className="min-w-0">
          <Display as="h1" size={84} lineHeight={80}>
            The number is right.{' '}
            <span>
              Ask it why
              <Spark color={M.ink} />
            </span>
          </Display>
          <Text variant="lead" className="mt-7 max-w-[620px]">
            Every stock figure in sparx is worked out from what actually happened — every delivery,
            sale, count, breakage and transfer — rather than stored and overwritten. So any quantity
            on any screen comes apart in front of you, back to the day somebody last walked out and
            counted the shelf. And it is re-added every night, so you hear about a problem from us
            at breakfast instead of from a customer in six weeks.
          </Text>
          <div className="mt-[34px] flex flex-wrap items-center gap-3">
            <a
              href={signupHref('inventory-hero')}
              className={buttonClasses({ color: 'module-inventory', size: 'xl' })}
            >
              Start free →
            </a>
            <a href="#the-list" className={buttonClasses({ size: 'xl', variant: 'outline' })}>
              See the whole list
            </a>
          </div>
          <Text className="mt-[22px] font-mono">
            $29/mo · unlimited users · free with Commerce or B2B · 14 days free either way
          </Text>
        </div>

        <div className="w-full min-w-0">
          <Card>
            <CardBody className="gap-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Heading level={3} size={4}>
                  Guji Natural — 1kg
                </Heading>
                <Text as="span" className="font-mono">
                  Warehouse
                </Text>
              </div>

              <div className="flex flex-col">
                {DERIVATION.map((row) => (
                  <LedgerLine
                    key={row.what}
                    what={row.what}
                    when={row.when}
                    qty={row.qty}
                    flow={row.flow}
                  />
                ))}
                <LedgerLine what="On hand" qty="51" running="51" emphasis />
                <LedgerLine
                  what="Held for orders not yet shipped"
                  qty="−10"
                  flow="out"
                  when="6 orders"
                />
                <LedgerLine what="Free to sell" qty="41" running="41" emphasis />
              </div>

              <Text className="border-base-300 border-t pt-4 font-mono">
                1,290 entries · re-added at 04:31 today · agrees to the unit
              </Text>
            </CardBody>
          </Card>
        </div>
      </div>
    </Section>
  );
}

// ── PRICING STRIP (LAYER 4) ──────────────────────────────────────────────────
//
// A PAINTED band — the ask, in the brand's own colour. EMBER IS A DISPLAY
// GROUND, NOT A READING GROUND: measured, `primary` runs 4.13:1, which clears
// WCAG's large-text bar (3.0) and fails the body bar (4.5). So nothing here is
// smaller than `text-2xl` (24px) unless it is a solid control painting its own
// foreground. Same constraint and same reasoning as /crm's and /finance's bands.
//
// The unlimited-users clause is here rather than only in beat 6 because it is
// half of the §5 claim ("without buying a seat for every person in the
// warehouse") and it is a PRICE argument, so the price band is where a reader
// who skipped straight to the cost will meet it.
function InventoryPricing() {
  return (
    <Section surface="primary" padding="lg">
      <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-[clamp(56px,7vw,80px)] leading-none font-medium tracking-[-0.03em]">
              $29
            </span>
            <span className="text-2xl">/mo — everyone included</span>
          </div>
          <p className="max-w-[680px] text-2xl leading-[1.4]">
            Flat, whatever size your warehouse is, with every picker, receiver and counter on it at
            no extra charge. Free entirely if you sell through sparx with Commerce or B2B — the
            stock behind what you sell is not a second product. Fourteen days free regardless, and
            we don’t ask for a card.
          </p>
        </div>
        <a
          href={signupHref('inventory-pricing')}
          className={buttonClasses({ color: 'neutral', size: 'xl' })}
        >
          Switch Inventory on →
        </a>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ─────────────────────────────────────────────────────────
function InventoryCta() {
  const stats: { n: ReactNode; l: string }[] = [
    {
      n: <>1{<Spark color={M.ink} />}</>,
      l: 'way stock is allowed to move · which is why there is only ever one place it can have gone',
    },
    { n: '0', l: 'people who can edit the history · not you, not us, not an integration' },
    { n: '04:31', l: 'when every number in the building gets added up again, every night' },
    { n: '∞', l: 'users at the same price — the warehouse does not cost you per head' },
  ];
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-9">
        <Display size={88} lineHeight={84}>
          Stop walking to the shelf to check
          <Spark color={M.ink} />
        </Display>
        <Text variant="lead" className="m-0 max-w-[680px]">
          Fourteen days free, no card, no contract at the end of it. Bring the spreadsheet you
          already keep and you can be counting real stock this afternoon — and if you ever leave,
          every movement, report and figure downloads in full from a button, without asking anyone.
        </Text>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={signupHref('inventory-final')}
            className={buttonClasses({ color: 'module-inventory', size: 'xl' })}
          >
            Start free →
          </a>
          <a href="#getting-started" className={buttonClasses({ size: 'xl', variant: 'outline' })}>
            What setting up looks like
          </a>
        </div>
      </div>
      <div className="mt-16 grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.l} className={i === 0 ? undefined : 'border-base-300 border-l pl-8'}>
            <div className="font-sans text-[clamp(36px,5vw,54px)] leading-none font-medium tracking-[-0.03em]">
              {s.n}
            </div>
            <Text className="mt-3 text-sm">{s.l}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// Page-specific FAQ — real evaluation questions, answered straight and grounded
// in docs/146. Feeds the FAQPage JSON-LD via <Faq>, so accuracy is load-bearing:
// an assistant quotes these verbatim, which makes the standalone answer, the
// accounting boundary and the spreadsheet-migration answer the three that must
// not drift.
const INVENTORY_FAQ: FaqItem[] = [
  {
    id: 'inventory-standalone',
    question: 'Can I use this if I don’t sell anything online?',
    answer:
      'Yes, and it is a first-class case rather than a technicality. A workshop, a hire company, a lab, a charity warehouse, a distributor who takes every order by phone — anyone who has stock in more than one place can run locations, shelves, scanning, counts, purchase orders, suppliers, costing and every report, with no storefront, no website and no orders anywhere in sparx. That is what the $29 standalone price is for. Add Commerce or B2B later and the charge simply stops.',
  },
  {
    id: 'inventory-spreadsheet',
    question: 'What happens to the spreadsheet I have been keeping?',
    answer:
      'You upload it as it is. sparx reads your column headings and matches them to its own — it knows that “Qty”, “QTY on hand” and “stock” are the same idea — and asks about anything it is unsure of instead of guessing. Then it shows you exactly what it is about to do before it does anything: how many items it will create, how many it will update, and every row it could not read with the reason why. Nothing is written until you agree, and the setup finishes with a real opening count so day one is a verified number rather than an imported one. It is built against a thirty-minute target and measured against it.',
  },
  {
    id: 'inventory-price',
    question: 'How much is it, and do I pay per user?',
    answer:
      'A flat $29 a month, and no — nobody is priced per seat. Every person who touches stock gets an account, and there is a role built for exactly them: it can receive deliveries, enter counts, move stock and look items up, and it cannot see a single cost price. Charging per head would mean the accuracy of your stock depended on how few people you could afford to let near it. If you sell through sparx with Commerce or B2B, Inventory is included at no extra cost.',
  },
  {
    id: 'inventory-accuracy',
    question: 'What actually stops the number going wrong?',
    answer:
      'Two different things, deliberately. First, nothing overwrites a total: every delivery, sale, count, breakage and transfer is recorded as its own line and the quantity is worked out from them, so a wrong number always has a findable cause rather than being a mystery someone has to recount their way out of. Second, every night sparx re-adds the entire history for every item in every location and compares the answer to the figure it has been showing you. If those two ever disagree it names the items and what the difference is worth, and it does not quietly write the “correct” value over the top — because that would destroy the only evidence of whatever caused it.',
  },
  {
    id: 'inventory-accounting',
    question: 'Does it work with my accounting software?',
    answer:
      'It produces the journals for stock and cost of sale, and a reconciliation that lists each ordinary timing difference — goods received but not yet invoiced, invoiced but not received, stock in the building you do not own, stock in transit — instead of netting them into one unexplained figure. Today the way that reaches your accounting package is an export in the layout it expects, which any of them import. Direct connections to QuickBooks Online and Xero are built but not switched on for this installation yet, and the screen says exactly that rather than offering a button that fails. What sparx will never do is keep your books: there is no general ledger and no chart of accounts here, and that stays your accountant’s job.',
  },
  {
    id: 'inventory-ai',
    question: 'Can I point my own AI assistant at my stock?',
    answer:
      'Yes, and it is your assistant and your model — sparx never runs an AI on your behalf or on a credential of ours. Connect the client you already use and it can read your stock the way a person would: what should I reorder, why did this number drop, which supplier is slipping, what expires next month. It deliberately cannot spend your money. Approving a purchase order, agreeing a price with a supplier, sending stock back, or writing off a batch are all left out of what an assistant can reach, because every one of them points money at somebody else or breaks a promise to them.',
  },
];
