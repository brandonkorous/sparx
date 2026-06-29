// Professional-services sample pack — a brand & digital consultancy ("studio").
// Data-as-code: productized services (no inventory — services aren't stocked), a
// consultation scheduling spine (discovery → strategy → quarterly review) matched
// to named consultants, mostly-B2B buyer personas that drive generated quotes +
// deals, client testimonials + Q&A, a launch-package bundle, and thought-leadership
// articles. Loading it tells the whole cross-module story for a service business —
// a bookable consult, a scoped engagement, a signed retainer, a published case.
//
// Pairs with the `professional` industry STARTER (Wave 3), which installs the config
// (tax/scheduling/markup); this pack brings the catalog + activity.

import { doc, h2, ol, p, ul } from '../engine/prose';
import type { SampleDataPack } from '../types';

export const professionalPack: SampleDataPack = {
  industry: 'professional',
  label: 'Professional services',
  summary:
    'A brand & digital consultancy: productized engagements (audits, sprints, retainers), a consultation booking flow matched to named consultants, B2B clients with quotes + deals, client testimonials, and thought-leadership articles.',

  categories: [
    { key: 'strategy', name: 'Strategy', handle: 'strategy' },
    { key: 'design', name: 'Design', handle: 'design' },
    { key: 'marketing', name: 'Marketing', handle: 'marketing' },
    { key: 'web', name: 'Web', handle: 'web' },
  ],

  collections: [
    {
      key: 'featured-engagements',
      name: 'Featured Engagements',
      handle: 'featured-engagements',
      featured: true,
    },
    { key: 'most-requested', name: 'Most Requested', handle: 'most-requested' },
  ],

  personas: [
    {
      key: 'nadia',
      name: 'Nadia Fereira',
      email: 'nadia.fereira@brightledger',
      kind: 'b2b',
      company: 'BrightLedger',
      phone: '+1-415-555-0148',
      line1: '210 Townsend St, Suite 400',
      city: 'San Francisco',
      region: 'CA',
      postalCode: '94107',
    },
    {
      key: 'darnell',
      name: 'Darnell Pierce',
      email: 'darnell.pierce@harborhouse',
      kind: 'b2b',
      company: 'Harbor House Hospitality',
      phone: '+1-503-555-0192',
      line1: '88 NW 12th Ave',
      city: 'Portland',
      region: 'OR',
      postalCode: '97209',
    },
    {
      key: 'imani',
      name: 'Imani Osei',
      email: 'imani.osei@risetogether',
      kind: 'b2b',
      company: 'Rise Together Foundation',
      phone: '+1-312-555-0137',
      line1: '540 W Madison St',
      city: 'Chicago',
      region: 'IL',
      postalCode: '60661',
    },
    {
      key: 'theo',
      name: 'Theo Vance',
      email: 'theo.vance@northpeak',
      kind: 'b2b',
      company: 'NorthPeak Outfitters',
      phone: '+1-720-555-0164',
      line1: '1455 Blake St',
      city: 'Denver',
      region: 'CO',
      postalCode: '80202',
    },
    {
      key: 'sofia',
      name: 'Sofia Marchetti',
      email: 'sofia.marchetti',
      phone: '+1-617-555-0119',
      line1: '74 Beacon St',
      city: 'Boston',
      region: 'MA',
      postalCode: '02108',
    },
    {
      key: 'cole',
      name: 'Cole Bennett',
      email: 'cole.bennett',
      phone: '+1-206-555-0176',
      line1: '309 Pine St',
      city: 'Seattle',
      region: 'WA',
      postalCode: '98101',
    },
  ],

  products: [
    {
      key: 'brand-audit',
      title: 'Brand Audit',
      handle: 'brand-audit',
      description:
        "<p>A two-week diagnostic that tells you the truth about how your brand actually shows up — to customers, to search engines, and against the competitors you keep losing deals to. We pull apart your messaging, visual identity, website, and core funnels, then hand you a prioritized fix list you can act on with or without us.</p><h3>What's included</h3><ul><li>Stakeholder kickoff and a review of your goals, audience, and competitive set</li><li>Messaging teardown — positioning, value proposition, and tone across every public touchpoint</li><li>Visual identity review — logo usage, type, color, and consistency across channels</li><li>Website and conversion-path walkthrough with annotated screenshots</li><li>A scored audit deck plus a ranked, effort-vs-impact action plan</li></ul><h3>Timeline</h3><p>Two weeks from kickoff to readout. Fixed scope, fixed price — no surprise change orders.</p>",
      productType: 'Strategy',
      vendor: 'Studio North',
      tags: ['brand', 'audit', 'strategy', 'positioning'],
      fulfillmentType: 'service',
      seoTitle: 'Brand Audit — a 2-week diagnostic with a prioritized fix list',
      seoDescription:
        'A fixed-scope brand audit covering messaging, identity, website, and funnels — with a ranked, effort-vs-impact action plan you can act on.',
      categoryKeys: ['strategy'],
      collectionKeys: ['featured-engagements', 'most-requested'],
      variants: [
        {
          key: 'brand-audit',
          sku: 'brand-audit',
          title: null,
          priceCents: 350000,
          costCents: 140000,
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Finally a clear picture',
          body: 'We thought we needed a rebrand. The audit showed we mostly had a consistency problem and a muddy value prop. Saved us a five-figure detour.',
          authorPersona: 'nadia',
          response:
            'Love that it pointed you somewhere cheaper than a full rebrand, Nadia — that is the whole point.',
          helpfulCount: 7,
          daysAgo: 24,
        },
        {
          rating: 5,
          title: 'The action plan alone was worth it',
          body: 'Ranked by effort vs impact, so we knew exactly what to do Monday morning. No fluff deck that sits in a drawer.',
          authorPersona: 'imani',
          helpfulCount: 4,
          daysAgo: 13,
        },
        {
          rating: 4,
          title: 'Thorough, intense kickoff',
          body: 'The kickoff workshop is a lot to pack into one session, but the readout more than made up for it. Bring your whole leadership team.',
          displayName: 'FounderMode',
          helpfulCount: 2,
          daysAgo: 6,
        },
      ],
      questions: [
        {
          body: 'Do we need to commit to a project afterward, or is the audit standalone?',
          authorPersona: 'sofia',
          answer:
            'Completely standalone. The fix list is yours to run in-house if you prefer — plenty of clients do exactly that.',
          daysAgo: 15,
        },
      ],
    },
    {
      key: 'seo-sprint',
      title: 'SEO Sprint (4 weeks)',
      handle: 'seo-sprint-4-weeks',
      description:
        "<p>Four focused weeks to fix what is quietly costing you organic traffic. We start with a technical crawl, prioritize the issues actually moving rankings, and ship the fixes — not a 60-page report you have to interpret and implement yourself.</p><h3>What's included</h3><ul><li>Full technical crawl: indexation, site speed, Core Web Vitals, structured data, and crawl-budget waste</li><li>Keyword and intent mapping against your top revenue pages</li><li>On-page optimization for up to fifteen priority URLs</li><li>An internal-linking and content-gap plan</li><li>Weekly check-ins and a final scorecard with tracked-keyword movement</li></ul><h3>Deliverables</h3><p>Implemented on-page fixes, a prioritized backlog for everything out of scope, and a baseline dashboard so you can see the line move after we leave.</p>",
      productType: 'Marketing',
      vendor: 'Studio North',
      tags: ['seo', 'sprint', 'marketing', 'organic'],
      fulfillmentType: 'service',
      seoTitle: 'SEO Sprint — 4 weeks of fixes shipped, not a report handed off',
      seoDescription:
        'A four-week SEO sprint: technical crawl, keyword mapping, on-page fixes for fifteen priority pages, and a tracked baseline dashboard.',
      categoryKeys: ['marketing'],
      collectionKeys: ['most-requested'],
      variants: [
        {
          key: 'seo-sprint',
          sku: 'seo-sprint',
          title: null,
          priceCents: 480000,
          costCents: 200000,
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'They actually shipped the fixes',
          body: 'Every other agency handed us a PDF and an invoice. These folks fixed our indexation mess and our Core Web Vitals in four weeks flat.',
          authorPersona: 'theo',
          response:
            'Shipping over reporting — thanks for the shout, Theo. Glad the CWV scores moved.',
          helpfulCount: 9,
          daysAgo: 20,
        },
        {
          rating: 4,
          title: 'Great for a focused push',
          body: 'Four weeks is the right size for a sprint. We have more to do, but the backlog they left was clearly ranked.',
          displayName: 'GrowthLeadJ',
          helpfulCount: 3,
          daysAgo: 9,
        },
      ],
      questions: [
        {
          body: 'Will you also write the new content, or just tell us what to write?',
          authorPersona: 'darnell',
          answer:
            'The sprint covers on-page optimization of existing pages and a content-gap plan. New long-form writing is the Content Retainer — happy to roll into that after.',
          daysAgo: 11,
        },
      ],
    },
    {
      key: 'website-package',
      title: 'Website Package',
      handle: 'website-package',
      description:
        "<p>A complete marketing website, designed and built end to end. Up to eight pages, responsive, fast, and handed over on a content system your team can actually update without calling us. Built for the businesses that have outgrown a template but do not need a hundred-page platform.</p><h3>What's included</h3><ul><li>Discovery, sitemap, and a content outline workshop</li><li>Custom design for every page type, reviewed in two rounds</li><li>Build and integration on the platform, including forms and analytics</li><li>Up to eight pages of structured content migration</li><li>Pre-launch QA, accessibility pass, and a launch-day runbook</li><li>A thirty-day post-launch support window</li></ul><h3>Timeline</h3><p>Six to eight weeks depending on content readiness. We will tell you up front which of those two it is.</p>",
      productType: 'Web',
      vendor: 'Studio North',
      tags: ['website', 'web design', 'build', 'launch'],
      fulfillmentType: 'service',
      seoTitle: 'Website Package — a full marketing site, designed and built',
      seoDescription:
        'An end-to-end website package: discovery, custom design, build, content migration, QA, and a 30-day support window. Up to eight pages.',
      categoryKeys: ['web', 'design'],
      collectionKeys: ['featured-engagements'],
      variants: [
        {
          key: 'website-package',
          sku: 'website-package',
          title: null,
          priceCents: 1450000,
          costCents: 620000,
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Best agency experience we have had',
          body: 'Two design rounds was exactly right — enough to get it dialed without endless revisions. The handover docs meant we could edit it ourselves day one.',
          authorPersona: 'darnell',
          response: 'A site your team can run without us is the goal. Thanks, Darnell!',
          helpfulCount: 11,
          daysAgo: 28,
        },
        {
          rating: 5,
          title: 'Fast and accessible',
          body: 'They actually ran an accessibility pass, which most shops skip. Lighthouse scores were green across the board at launch.',
          authorPersona: 'theo',
          helpfulCount: 6,
          daysAgo: 17,
        },
        {
          rating: 4,
          title: 'Worth getting content ready first',
          body: 'They were upfront that our timeline rode on our content. We were slow, so it ran eight weeks not six — on us, not them.',
          displayName: 'OpsDirectorK',
          helpfulCount: 2,
          daysAgo: 7,
        },
      ],
      questions: [
        {
          body: 'What happens after the thirty-day support window closes?',
          authorPersona: 'nadia',
          answer:
            'Most clients roll into a Content Retainer for ongoing changes, but you are never locked in — the site is fully yours, on a platform you control.',
          daysAgo: 19,
        },
      ],
    },
    {
      key: 'content-retainer',
      title: 'Content Retainer (monthly)',
      handle: 'content-retainer-monthly',
      description:
        "<p>A steady stream of on-brand content without the cost of an in-house team. Each month we plan, write, and ship a set quota of long-form and short-form work tied to your goals — then report on what actually moved.</p><h3>What's included each month</h3><ul><li>A content calendar planned against your campaigns and keyword targets</li><li>Two long-form articles, fully edited and SEO-optimized</li><li>Four short-form pieces (social, email, or landing-page copy)</li><li>One round of revisions per piece</li><li>A monthly performance recap with recommendations</li></ul><h3>Terms</h3><p>Month-to-month after an initial three-month commitment. Unused quota does not roll over — we plan the calendar so it rarely comes up.</p>",
      productType: 'Marketing',
      vendor: 'Studio North',
      tags: ['content', 'retainer', 'marketing', 'writing'],
      fulfillmentType: 'service',
      seoTitle: 'Content Retainer — monthly long-form + short-form, planned and shipped',
      seoDescription:
        'A monthly content retainer: a planned calendar, two long-form articles, four short-form pieces, and a performance recap — on-brand, every month.',
      categoryKeys: ['marketing'],
      collectionKeys: ['most-requested'],
      variants: [
        {
          key: 'content-retainer',
          sku: 'content-retainer',
          title: null,
          priceCents: 650000,
          costCents: 280000,
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Like having a content team for a fraction',
          body: 'We get our two articles and the social pieces on the same cadence every month. The calendar means we are never scrambling.',
          authorPersona: 'imani',
          response: 'Predictable cadence is the whole pitch — thank you, Imani.',
          helpfulCount: 5,
          daysAgo: 21,
        },
        {
          rating: 4,
          title: 'Solid, wish for more volume',
          body: 'The writing is genuinely good and on-brand. We sometimes want more than two long-form a month, but that is a tier conversation.',
          displayName: 'MarketingMaya',
          helpfulCount: 3,
          daysAgo: 10,
        },
      ],
      questions: [
        {
          body: 'Do you write in our voice or yours?',
          authorPersona: 'sofia',
          answer:
            'Yours. We build a voice guide in month one from your existing material and a short interview, then every piece runs against it.',
          daysAgo: 14,
        },
      ],
    },
    {
      key: 'logo-identity',
      title: 'Logo & Identity',
      handle: 'logo-and-identity',
      description:
        "<p>A complete visual identity, not just a logo file. We design the mark, the type system, the color palette, and the rules for using them — then package it so any designer, printer, or developer can stay on brand without guessing.</p><h3>What's included</h3><ul><li>A discovery workshop on your story, audience, and market</li><li>Three distinct logo directions, narrowed to one with two refinement rounds</li><li>A type and color system with accessibility-checked combinations</li><li>Primary, secondary, and responsive logo lockups plus favicon and app-icon sizes</li><li>A brand guidelines document and a packaged asset library (SVG, PNG, and source files)</li></ul><h3>Timeline</h3><p>Three to four weeks. You own every file outright when we are done.</p>",
      productType: 'Design',
      vendor: 'Studio North',
      tags: ['logo', 'identity', 'design', 'branding'],
      fulfillmentType: 'service',
      seoTitle: 'Logo & Identity — a full visual system, not just a logo',
      seoDescription:
        'A complete identity package: logo, type system, color, lockups, guidelines, and a packaged asset library you own outright.',
      categoryKeys: ['design'],
      collectionKeys: ['featured-engagements'],
      variants: [
        {
          key: 'logo-identity',
          sku: 'logo-identity',
          title: null,
          priceCents: 750000,
          costCents: 320000,
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'A system, not a JPEG',
          body: 'We have hired logo people before and gotten one file. This was the full kit — guidelines, every size, source files. Our printer and our dev both said thank you.',
          authorPersona: 'theo',
          helpfulCount: 8,
          daysAgo: 22,
        },
        {
          rating: 5,
          title: 'Three real directions',
          body: 'The three concepts were genuinely different, not the same idea in three colors. Made the choice feel like a strategy decision.',
          displayName: 'CreativeLeadR',
          helpfulCount: 4,
          daysAgo: 12,
        },
      ],
      questions: [
        {
          body: 'Do we get the editable source files or just exports?',
          authorPersona: 'darnell',
          answer:
            'Both. The packaged library includes source files and you own them outright — no licensing strings, ever.',
          daysAgo: 16,
        },
      ],
    },
    {
      key: 'conversion-teardown',
      title: 'Conversion Teardown',
      handle: 'conversion-teardown',
      description:
        "<p>A focused, one-week review of a single funnel — a landing page, a checkout, a signup flow — that finds the leaks costing you conversions and tells you exactly how to plug them. The fastest way to get a second set of expert eyes before you spend on more traffic.</p><h3>What's included</h3><ul><li>A heuristic review against conversion best practices, frame by frame</li><li>Analytics and funnel-drop analysis where data is available</li><li>A prioritized list of friction points with annotated screenshots</li><li>Specific, testable recommendations — copy, layout, and trust signals</li><li>A thirty-minute walkthrough call to talk through the findings</li></ul><h3>Timeline</h3><p>Five business days. Ideal as a standalone tune-up or a precursor to a larger engagement.</p>",
      productType: 'Strategy',
      vendor: 'Studio North',
      tags: ['conversion', 'cro', 'strategy', 'funnel'],
      fulfillmentType: 'service',
      seoTitle: 'Conversion Teardown — a 1-week funnel review with testable fixes',
      seoDescription:
        'A focused one-week conversion teardown of a single funnel: friction points, analytics drop-off, and specific testable recommendations.',
      categoryKeys: ['strategy', 'marketing'],
      collectionKeys: ['most-requested'],
      variants: [
        {
          key: 'conversion-teardown',
          sku: 'conversion-teardown',
          title: null,
          priceCents: 180000,
          costCents: 70000,
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Paid for itself in a week',
          body: 'They spotted a trust-signal gap above the fold we had stared past for a year. One change, signups up double digits.',
          authorPersona: 'nadia',
          response: 'A teardown that pays for itself is exactly the bar — thanks, Nadia.',
          helpfulCount: 10,
          daysAgo: 18,
        },
        {
          rating: 4,
          title: 'Sharp, fast',
          body: 'One week, one funnel, clear recommendations. Would have liked a couple more on the mobile flow but the desktop notes were spot on.',
          displayName: 'PMatScale',
          status: 'pending',
          helpfulCount: 2,
          daysAgo: 4,
        },
      ],
      questions: [
        {
          body: 'Can you tear down more than one funnel at once?',
          displayName: 'GrowthCurious',
          answer:
            'Each teardown is scoped to a single funnel so the review stays deep. For multiple, we book them back to back or fold them into a larger engagement.',
          daysAgo: 8,
        },
      ],
    },
    {
      key: 'fractional-cmo',
      title: 'Fractional Marketing Lead (monthly)',
      handle: 'fractional-marketing-lead-monthly',
      description:
        "<p>Senior marketing leadership without the senior-leadership salary. A dedicated lead embeds with your team part-time to own strategy, set priorities, manage vendors, and keep the whole effort pointed at revenue — for companies that need a steady hand but not a full-time hire yet.</p><h3>What's included each month</h3><ul><li>A standing weekly leadership session and async availability between</li><li>Quarterly strategy and a rolling 90-day roadmap</li><li>Hands-on management of your existing marketing team and outside vendors</li><li>Budget planning and channel-mix recommendations</li><li>A monthly metrics review tied to pipeline and revenue</li></ul><h3>Terms</h3><p>Month-to-month after a three-month minimum. Scales up or down as your needs change — most clients graduate to a full-time hire, and we help you find them.</p>",
      productType: 'Strategy',
      vendor: 'Studio North',
      tags: ['fractional', 'leadership', 'strategy', 'retainer'],
      fulfillmentType: 'service',
      seoTitle: 'Fractional Marketing Lead — senior leadership, part-time',
      seoDescription:
        'A monthly fractional marketing lead: weekly leadership sessions, a 90-day roadmap, team and vendor management, and a revenue-tied metrics review.',
      categoryKeys: ['strategy'],
      collectionKeys: [],
      variants: [
        {
          key: 'fractional-cmo',
          sku: 'fractional-cmo',
          title: null,
          priceCents: 850000,
          costCents: 380000,
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'The steady hand we needed',
          body: 'We were a founder doing marketing badly. Having a real lead set priorities and manage our freelancers changed the whole trajectory.',
          authorPersona: 'imani',
          helpfulCount: 6,
          daysAgo: 26,
        },
      ],
      questions: [
        {
          body: 'How many hours a week is "part-time" in practice?',
          displayName: 'SeedStageCEO',
          answer:
            'Plan on a standing weekly session plus async availability — roughly a day a week of focused attention, scaled to the engagement.',
          daysAgo: 9,
        },
      ],
    },
  ],

  bundles: [
    {
      wrapperProductKey: 'website-package',
      pricing: { mode: 'percent', percentOff: 10 },
      inventoryMode: 'bundle',
      components: [
        { productKey: 'brand-audit', quantity: 1, required: true },
        { productKey: 'logo-identity', quantity: 1, required: true },
        { productKey: 'website-package', quantity: 1, required: true },
      ],
    },
  ],

  scheduling: {
    resources: [
      {
        key: 'consultant-rena',
        name: 'Rena Calder (Strategy)',
        kind: 'staff',
        skills: ['strategy', 'general'],
        windows: [
          { day: 1, startMin: 540, endMin: 1020 },
          { day: 2, startMin: 540, endMin: 1020 },
          { day: 3, startMin: 540, endMin: 1020 },
          { day: 4, startMin: 540, endMin: 1020 },
          { day: 5, startMin: 540, endMin: 960 },
        ],
      },
      {
        key: 'consultant-malik',
        name: 'Malik Reyes (Design)',
        kind: 'staff',
        skills: ['design', 'general'],
        windows: [
          { day: 1, startMin: 540, endMin: 1020 },
          { day: 2, startMin: 540, endMin: 1020 },
          { day: 3, startMin: 540, endMin: 1020 },
          { day: 4, startMin: 540, endMin: 1020 },
        ],
      },
      {
        key: 'consultant-priya',
        name: 'Priya Anand (Analytics)',
        kind: 'staff',
        skills: ['analytics', 'general'],
        windows: [
          { day: 2, startMin: 540, endMin: 1020 },
          { day: 3, startMin: 540, endMin: 1020 },
          { day: 4, startMin: 540, endMin: 1020 },
          { day: 5, startMin: 540, endMin: 960 },
        ],
      },
    ],
    services: [
      {
        key: 'discovery-call',
        name: 'Discovery Call',
        description:
          'A free 30-minute call to talk through your goals and figure out whether we are a fit. No prep, no pitch deck — just a conversation.',
        durationMinutes: 30,
        priceCents: 0,
        bookingType: 'appointment',
        slotIntervalMin: 30,
        requiresApproval: true,
        resourceRoles: [{ role: 'consultant', kind: 'staff', skill: 'strategy' }],
      },
      {
        key: 'strategy-session',
        name: 'Strategy Session',
        description:
          'A focused 90-minute working session on a specific challenge — positioning, a launch, a funnel — with a senior strategist. You leave with a written recap and next steps.',
        durationMinutes: 90,
        priceCents: 45000,
        bookingType: 'appointment',
        bufferAfterMin: 15,
        slotIntervalMin: 30,
        resourceRoles: [{ role: 'consultant', kind: 'staff', skill: 'strategy' }],
      },
      {
        key: 'design-review',
        name: 'Design Review',
        description:
          'A 60-minute critique of your current design work — site, identity, or campaign assets — with a senior designer. Practical, candid, and prioritized.',
        durationMinutes: 60,
        priceCents: 30000,
        bookingType: 'appointment',
        bufferAfterMin: 15,
        slotIntervalMin: 30,
        resourceRoles: [{ role: 'consultant', kind: 'staff', skill: 'design' }],
      },
      {
        key: 'quarterly-review',
        name: 'Quarterly Review',
        description:
          'A 2-hour deep dive for retainer and fractional clients: what moved last quarter, what the data says, and where we point the next ninety days.',
        durationMinutes: 120,
        priceCents: 60000,
        bookingType: 'appointment',
        bufferAfterMin: 30,
        slotIntervalMin: 60,
        resourceRoles: [{ role: 'consultant', kind: 'staff', skill: 'analytics' }],
      },
    ],
  },

  articles: [
    {
      slug: 'how-to-scope-a-website-project',
      title: "How to scope a website project (so it doesn't balloon)",
      excerpt:
        'Most website projects run over because the scope was never really pinned down. Here is how to define it before anyone touches a design tool.',
      daysAgo: 6,
      body: doc(
        p(
          'Almost every website project that runs over budget and over schedule shares one root cause: the scope was fuzzy when the contract was signed. "A new website" is not a scope. "Eight pages, three templates, migrated content, and a launch by the end of Q2" is a scope. The difference is whether you and your agency are arguing about change orders in week six.'
        ),
        h2('Start with pages and templates, not features'),
        p(
          'Count the unique page templates, not the pages. A site can have forty pages and four templates — and it is the templates that drive design and build cost. Write down every template you need (home, service, article, contact) and roughly how many pages sit on each. That single list does more to control cost than any feature wishlist.'
        ),
        h2('Decide who writes the content'),
        p(
          'Content is the silent killer of website timelines. If you are writing it, your project is gated on your slowest writer, not the agency. Be honest about whether your team can produce the words on schedule, and if not, scope the writing in from the start. The fastest projects are the ones where content was ready before design began.'
        ),
        h2('Name what is explicitly out'),
        ol(
          'List the things you are NOT doing this round — the blog redesign, the customer portal, the integrations — in writing.',
          'Agree on what triggers a change order, and what is a free in-scope revision.',
          'Set the number of design revision rounds up front; "until we are happy" is not a number.'
        ),
        p(
          'A scope is as much about what you exclude as what you include. Write the exclusions down and you turn week-six surprises into week-one decisions.'
        )
      ),
    },
    {
      slug: 'what-a-brand-audit-actually-covers',
      title: 'What a brand audit actually covers',
      excerpt:
        'A brand audit is not a logo critique. Here is what a real one examines, and how to tell a diagnostic from a sales pitch.',
      daysAgo: 14,
      body: doc(
        p(
          'When people hear "brand audit" they often picture someone squinting at their logo and suggesting a new font. A real audit is a diagnostic of how your brand performs across every place a customer meets it — and the logo is one of the smaller pieces.'
        ),
        h2('The four layers we examine'),
        ul(
          'Messaging — is your positioning clear, differentiated, and consistent from your homepage to your sales deck to your job listings?',
          'Visual identity — do your logo, type, and color hold together across channels, or has every team improvised its own version?',
          'Experience — does your website and core funnel actually guide someone to the action you want?',
          'Perception — how do customers and search engines describe you, and does it match what you intend?'
        ),
        h2('A diagnostic, not a pitch'),
        p(
          'The tell of a good audit is that it sometimes concludes you do not need the expensive thing. We have run audits that recommended a messaging tune-up instead of the full rebrand the client came in asking for. An audit that always ends with "you need our biggest package" is a sales call wearing a lab coat.'
        ),
        h2('What you walk away with'),
        p(
          'A scored picture of where you stand and a ranked action plan — ordered by effort versus impact, so you know what to fix Monday morning whether or not you hire anyone to do it. The deliverable should be usable on its own. If it only makes sense as a setup for the next invoice, it was not really an audit.'
        )
      ),
    },
    {
      slug: 'retainer-vs-project',
      title: 'Choosing retainer vs project: which fits your business?',
      excerpt:
        'Both have their place. The right call depends less on budget than on whether the work ever really ends.',
      daysAgo: 22,
      body: doc(
        p(
          'One of the first questions we ask a new client is whether their need is a project or a retainer. Get it wrong and you either pay for ongoing capacity you do not use, or you keep re-scoping the same engagement every few weeks. The deciding factor is rarely budget — it is the shape of the work.'
        ),
        h2('A project has a finish line'),
        p(
          'Projects suit work with a clear definition of done: a website, an identity, a one-time audit. The scope is fixed, the price is fixed, and when it ships, the engagement is over. If you can describe the finished thing in a sentence and know when it exists, you want a project.'
        ),
        h2('A retainer suits work that never ends'),
        p(
          'Content, SEO, paid media, and marketing leadership are not projects — they are ongoing capacities. The work resets every month. A retainer buys you a predictable cadence and a team that already knows your business, instead of re-onboarding a freelancer every time something comes up.'
        ),
        h2('A simple test'),
        ul(
          'Can you name the finished deliverable and know when it is done? Project.',
          'Does the work reset every month with no natural end? Retainer.',
          'Is it a big one-time build followed by steady upkeep? Project first, then a retainer to maintain it.'
        ),
        p(
          'The two are not rivals. The most common path we see is a project to build the thing, then a right-sized retainer to keep it growing.'
        )
      ),
    },
  ],
};
