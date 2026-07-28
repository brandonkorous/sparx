// The sparx section library — the palette groups the studio merges into Insert.
//
// WHY THIS EXISTS. The engine ships 18 composed blocks: a navbar, a hero, two feature
// layouts, logos, stats, two testimonial shapes, pricing, an FAQ, prose, a team grid,
// contact, a CTA, a footer, tabs, an accordion and a dropdown. That is a good spine
// for a software marketing page and a thin one for everything else this platform
// actually serves. A builder with no gallery could not be used by a photographer; with
// no opening hours, not by a shop; with no menu, not by a restaurant; with no price
// list, not by a garage. The catalog is where breadth lives, and it was the narrowest
// part of the product.
//
// WHY IT IS DATA-AS-CODE AND STAMPED. Each entry is a `make()` returning a FRESH,
// id-free tree that the palette STAMPS into the page (docs/98 §5 + CLAUDE.md): the
// author then owns every node of it. That is the correct trade for a section — it is
// tenant content, and freezing at insert is what lets them rewrite the copy, delete
// half of it and restyle the rest without the platform arguing. A HOST CORE is the
// opposite trade and is reserved for the regions the platform must keep improving
// forever (`host-nodes.ts` states the sorting rule).
//
// THE HOUSE RULES ARE STRUCTURAL, not a review checklist. Every section is built from
// `_shell.ts`, which has no slot above a heading (no eyebrows), no faded ink for
// readable text, a 16px body floor, container queries rather than viewport variants,
// and no gradient or shadow as a visual device. `sections.test.ts` walks every tree in
// this file and fails on a class outside the declared vocabulary — the failure that is
// otherwise silent, because a stamped tree lives in a database no scanner ever reads.

import type { CatalogGroup } from '../types';

import * as compare from './compare';
import * as content from './content';
import * as convert from './convert';
import * as gallery from './gallery';
import * as layout from './layout';
import * as offer from './offer';
import * as people from './people';
import * as place from './place';
import * as process from './process';

export const SECTION_CATALOG: CatalogGroup[] = [
  {
    key: 'sparx_layout',
    label: 'Page structure',
    items: [
      {
        key: 'page_header',
        label: 'Page top',
        icon: 'layout',
        hint: 'A title and a sentence — how every page except the home page actually starts.',
        make: layout.pageHeader,
      },
      {
        key: 'hero_simple',
        label: 'Opening (words only)',
        icon: 'layout',
        hint: 'A centred headline and two buttons. Faster than a picture and harder to get wrong.',
        make: layout.heroSimple,
      },
      {
        key: 'hero_picture_under',
        label: 'Opening with a wide picture',
        icon: 'image',
        hint: 'Headline first, then the photograph that proves it.',
        make: layout.heroPictureUnder,
      },
      {
        key: 'alternating_rows',
        label: 'Alternating picture rows',
        icon: 'layout',
        hint: 'Three rows that swap sides — what keeps a long page from becoming a column.',
        make: layout.alternatingRows,
      },
      {
        key: 'feature_list_sparx',
        label: 'What you get',
        icon: 'layout',
        hint: 'Four short features in two columns. No stock icons — they add nothing a reader can use.',
        make: layout.featureList,
      },
      {
        key: 'checklist_split',
        label: 'Text beside a ticked list',
        icon: 'layout',
        hint: 'The prose makes the argument, the list makes it checkable.',
        make: layout.checklistSplit,
      },
      {
        key: 'numbers_band',
        label: 'In numbers',
        icon: 'layout',
        hint: 'Three figures, each with a sentence. A number with no explanation is a claim.',
        make: layout.numbersBand,
      },
      {
        key: 'notice_banner',
        label: 'Notice',
        icon: 'article',
        hint: 'Holiday hours, a delivery delay, a phone line down — the block you need when you have no time to build one.',
        make: layout.noticeBanner,
      },
      {
        key: 'contact_strip',
        label: 'Contact strip',
        icon: 'layout',
        hint: 'Phone, email and hours in one row, for the top or bottom of a page.',
        make: layout.contactStrip,
      },
      {
        key: 'onward_links',
        label: 'Where to next',
        icon: 'grid',
        hint: 'Three onward links for the bottom of a page.',
        make: layout.onwardLinks,
      },
      {
        key: 'policy_body',
        label: 'Policy text',
        icon: 'article',
        hint: 'Numbered clauses at a readable width — for terms, privacy, or returns.',
        make: layout.policyBody,
      },
    ],
  },
  {
    key: 'sparx_gallery',
    label: 'Pictures',
    items: [
      {
        key: 'gallery_grid',
        label: 'Photo grid',
        icon: 'gallery',
        hint: 'A grid of photographs with a caption under each — your finished work, your space, your food.',
        make: gallery.galleryGrid,
      },
      {
        key: 'gallery_strip',
        label: 'Photo strip',
        icon: 'gallery',
        hint: 'A row of photographs a visitor swipes or scrolls through. No buttons to learn.',
        make: gallery.galleryStrip,
      },
      {
        key: 'gallery_showcase',
        label: 'Showcase (moves on its own)',
        icon: 'gallery',
        hint: 'Photographs that advance by themselves, with Previous and Next so a visitor can take over.',
        make: gallery.galleryShowcase,
      },
      {
        key: 'before_after',
        label: 'Before and after',
        icon: 'image',
        hint: 'Two photographs side by side, each labelled. The strongest thing a trade business can show.',
        make: gallery.beforeAfter,
      },
      {
        key: 'picture_split',
        label: 'Picture beside text',
        icon: 'image',
        hint: 'A photograph next to a paragraph and a button — the everyday "here is what we do" band.',
        make: gallery.pictureSplit,
      },
      {
        key: 'picture_band',
        label: 'Wide picture',
        icon: 'image',
        hint: 'One full-width photograph with a line underneath it.',
        make: gallery.pictureBand,
      },
      {
        key: 'logo_wall',
        label: 'Client logos',
        icon: 'grid',
        hint: 'A tidy wall of the people you work with.',
        make: gallery.logoWall,
      },
      {
        key: 'case_studies',
        label: 'Case studies',
        icon: 'article',
        hint: 'Three jobs: what each involved and how it turned out. A portfolio page on its own.',
        make: gallery.caseStudies,
      },
    ],
  },
  {
    key: 'sparx_compare',
    label: 'Helping people choose',
    items: [
      {
        key: 'comparison_table',
        label: 'Comparison table',
        icon: 'layout',
        hint: 'The same questions answered for each option, so a visitor can compare like with like.',
        make: compare.comparisonTable,
      },
      {
        key: 'two_up_compare',
        label: 'Two options',
        icon: 'layout',
        hint: 'Two ways to buy, side by side, each with its own price and button.',
        make: compare.twoUpCompare,
      },
      {
        key: 'trade_offs',
        label: 'What each is good at',
        icon: 'layout',
        hint: 'Best for, and less good for. Being straight is what sells to a wary buyer.',
        make: compare.tradeOffs,
      },
      {
        key: 'spec_list',
        label: 'Specification',
        icon: 'article',
        hint: 'The plain facts — material, size, lead time, guarantee — as a labelled list.',
        make: compare.specList,
      },
      {
        key: 'inclusion_list',
        label: "What's included",
        icon: 'article',
        hint: 'Everything in the price, ticked off. Reads as reassurance rather than as a table.',
        make: compare.inclusionList,
      },
    ],
  },
  {
    key: 'sparx_process',
    label: 'How it works',
    items: [
      {
        key: 'how_it_works',
        label: 'Steps',
        icon: 'layout',
        hint: 'Four steps from first contact to finished, so an enquiry stops feeling like a leap.',
        make: process.howItWorks,
      },
      {
        key: 'timeline',
        label: 'Timeline',
        icon: 'calendar',
        hint: 'Dated stages — your history, or how a project will run.',
        make: process.timeline,
      },
      {
        key: 'what_happens_next',
        label: 'What happens next',
        icon: 'layout',
        hint: 'What a visitor can expect after they get in touch. Belongs directly above a form.',
        make: process.whatHappensNext,
      },
      {
        key: 'faq_single_open',
        label: 'Questions people ask',
        icon: 'article',
        hint: 'Answers that open one at a time, so the page never turns into a wall of text.',
        make: process.faq,
      },
      {
        key: 'promises',
        label: 'What you can hold us to',
        icon: 'article',
        hint: 'Four checkable promises. Reads as a guarantee rather than as marketing.',
        make: process.promises,
      },
    ],
  },
  {
    key: 'sparx_people',
    label: 'People and proof',
    items: [
      {
        key: 'team_grid_sparx',
        label: 'The team',
        icon: 'avatar',
        hint: 'Faces, names, roles — and a line each, which is what makes it worth the space.',
        make: people.teamGrid,
      },
      {
        key: 'founder_note',
        label: 'A note from the owner',
        icon: 'avatar',
        hint: 'One person, at length. The most persuasive block on a small-business site.',
        make: people.founderNote,
      },
      {
        key: 'quote_band',
        label: 'One big quote',
        icon: 'article',
        hint: 'A single customer quote with a name and where it came from.',
        make: people.quoteBand,
      },
      {
        key: 'quote_grid',
        label: 'Three quotes',
        icon: 'article',
        hint: 'Three short quotes side by side. Short on purpose — three long ones is a wall.',
        make: people.quoteGrid,
      },
      {
        key: 'review_summary',
        label: 'Review score',
        icon: 'article',
        hint: 'Your rating, how many reviews it is from, and where they came from.',
        make: people.reviewSummary,
      },
      {
        key: 'open_roles',
        label: 'Jobs',
        icon: 'article',
        hint: 'Open roles, each linking to its own page.',
        make: people.openRoles,
      },
      {
        key: 'author_byline',
        label: 'Author',
        icon: 'avatar',
        hint: 'Who wrote this — a portrait, a name, and a line about them.',
        make: people.authorByline,
      },
      {
        key: 'trust_row',
        label: 'Trust facts',
        icon: 'layout',
        hint: 'Two checkable facts about your business, with a button under them.',
        make: people.trustRow,
      },
    ],
  },
  {
    key: 'sparx_place',
    label: 'Where and when',
    items: [
      {
        key: 'opening_hours',
        label: 'Opening hours',
        icon: 'calendar',
        hint: 'A real table of days and hours, so it reads correctly on a phone and out loud.',
        make: place.openingHours,
      },
      {
        key: 'find_us',
        label: 'Find us',
        icon: 'layout',
        hint: 'Address, phone number and directions — with the number pressable on a phone.',
        make: place.findUs,
      },
      {
        key: 'location_cards',
        label: 'Several branches',
        icon: 'grid',
        hint: 'Each place with its own address, hours and phone number.',
        make: place.locationCards,
      },
      {
        key: 'service_area',
        label: 'Where we cover',
        icon: 'grid',
        hint: 'The towns you travel to, as text a search engine can actually read.',
        make: place.serviceArea,
      },
      {
        key: 'price_list',
        label: 'Price list',
        icon: 'article',
        hint: 'Fixed prices, published. No "from", no "call for a price".',
        make: place.priceList,
      },
      {
        key: 'menu_sections',
        label: 'Menu',
        icon: 'article',
        hint: 'Dishes grouped into courses, priced. For a kitchen, a bar, or a treatment list.',
        make: place.menuSections,
      },
    ],
  },
  {
    key: 'sparx_convert',
    label: 'Getting in touch',
    items: [
      {
        key: 'enquiry_form',
        label: 'Enquiry form',
        icon: 'article',
        hint: 'Name, email, phone and room to explain. Submissions land in your Form submissions inbox.',
        make: convert.enquiryForm,
      },
      {
        key: 'callback_form',
        label: 'Ask for a callback',
        icon: 'article',
        hint: 'Two fields and a button. The lowest-effort ask on the shelf.',
        make: convert.callbackForm,
      },
      {
        key: 'quote_request',
        label: 'Quote request',
        icon: 'article',
        hint: 'The qualifying questions built in, with the reassurances beside them.',
        make: convert.quoteRequest,
      },
      {
        key: 'newsletter_signup',
        label: 'Email sign-up',
        icon: 'article',
        hint: 'One field, and it says what will actually arrive — which is what decides whether anyone types in it.',
        make: convert.newsletterSignup,
      },
      {
        key: 'booking_prompt',
        label: 'Book a time',
        icon: 'calendar',
        hint: 'Sends a visitor to your booking page, with a phone number for the ones who would rather call.',
        make: convert.bookingPrompt,
      },
      {
        key: 'reassurance_row',
        label: 'Three reassurances',
        icon: 'layout',
        hint: 'Short enough to get read. Belongs directly above a form.',
        make: convert.reassuranceRow,
      },
      {
        key: 'closing_cta',
        label: 'Closing band',
        icon: 'layout',
        hint: 'The last, plain ask at the bottom of a page. The one element allowed to shout.',
        make: convert.closingCta,
      },
    ],
  },
  {
    key: 'sparx_content',
    label: 'Writing',
    items: [
      {
        key: 'article_header',
        label: 'Article header',
        icon: 'article',
        hint: 'Title, standfirst, byline and a picture — the top of a piece of writing.',
        make: content.articleHeader,
      },
      {
        key: 'prose_section',
        label: 'Body text',
        icon: 'article',
        hint: 'Headings and paragraphs at a readable width.',
        make: content.prose,
      },
      {
        key: 'callout',
        label: 'Callout',
        icon: 'article',
        hint: 'The paragraph that matters more than the ones around it, marked so it says why.',
        make: content.callout,
      },
      {
        key: 'two_column_prose',
        label: 'Two columns of text',
        icon: 'layout',
        hint: 'Length without becoming a wall — for an "about us" that needs room.',
        make: content.twoColumnProse,
      },
      {
        key: 'glossary',
        label: 'Glossary',
        icon: 'article',
        hint: 'Trade words and what they mean, so a customer is never quietly lost.',
        make: content.glossary,
      },
      {
        key: 'update_list',
        label: 'What has changed',
        icon: 'calendar',
        hint: 'Dated updates, newest first.',
        make: content.updateList,
      },
      {
        key: 'downloads',
        label: 'Downloads',
        icon: 'article',
        hint: 'Files to take away — each saying what it is and how big it is.',
        make: content.downloads,
      },
      {
        key: 'resource_grid',
        label: 'Things worth reading',
        icon: 'grid',
        hint: 'Guides and articles, three across.',
        make: content.resourceGrid,
      },
    ],
  },
  {
    key: 'sparx_offer',
    label: 'Selling',
    items: [
      {
        key: 'category_tiles',
        label: 'Shop by category',
        icon: 'grid',
        hint: 'The "what are you looking for" chooser that belongs above a big catalog.',
        make: offer.categoryTiles,
      },
      {
        key: 'offer_hero',
        label: 'Featured offer',
        icon: 'image',
        hint: 'One product or package given the whole band — picture, price, buttons.',
        make: offer.offerHero,
      },
      {
        key: 'shop_reassurance',
        label: 'Delivery, returns, paying',
        icon: 'layout',
        hint: 'The three things a shopper checks before buying from someone new.',
        make: offer.shopReassurance,
      },
      {
        key: 'bundle_offer',
        label: 'Bundle',
        icon: 'layout',
        hint: 'Several things together at one price, with what they add up to separately.',
        make: offer.bundleOffer,
      },
      {
        key: 'availability_strip',
        label: 'Stock and lead time',
        icon: 'layout',
        hint: 'The honest answer to "when can I actually have it" — the question that most often loses a sale.',
        make: offer.availabilityStrip,
      },
      {
        key: 'gift_cards',
        label: 'Gift cards',
        icon: 'image',
        hint: 'A real revenue line almost nobody builds, because no block existed for it.',
        make: offer.giftCards,
      },
      {
        key: 'cost_examples',
        label: 'What people usually spend',
        icon: 'layout',
        hint: 'Three real jobs with what they cost. Answers the price question without ever quoting wrong.',
        make: offer.costExamples,
      },
      {
        key: 'stockists',
        label: 'Where else to buy',
        icon: 'article',
        hint: 'The shops that carry your work.',
        make: offer.stockists,
      },
    ],
  },
];
