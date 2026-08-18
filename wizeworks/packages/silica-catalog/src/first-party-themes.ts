// The FIRST-PARTY theme catalog — every theme sparx ships, as code.
//
// WHY THIS FILE EXISTS. A marketplace theme used to be a database row, put there
// by an ingest: a generator wrote bundles to `marketplace-catalog/themes/`, and a
// hand-run workflow read them into `marketplace_themes`. That made shipped,
// unchanging content behave like runtime data — so a cluster that had never had
// the ingest pointed at it served an EMPTY themes page while the same build
// served twenty of them elsewhere. That is exactly what happened on the move to
// Azure, where the ingest's only automation was hard-wired to GKE.
//
// First-party themes are code. They change when the repo changes, they ship in
// the image, and every environment gets them by existing. There is no data step
// to forget and no cluster that can be behind.
//
// WHAT IS STILL A DATABASE ROW. Themes published by a TENANT or a PARTNER — the
// contributor-upload surface `marketplace_themes` already models (`publisherId`,
// `publisherTenantId`, `status`, `visibility`). Those genuinely arrive at
// runtime, so they stay rows, and the catalog adapter serves the UNION: this
// list first, then whatever the database holds. Nothing here forecloses uploads;
// it just stops sparx's own themes from riding the same pipe.
//
// FIVE SHELVES, ONE LIST.
//
//   · `SPARX_THEMES` (themes.ts) — twenty looks named for the BUSINESS
//     (`clinic`, `workshop`, `kitchen`). Picking is recognition, not taste.
//   · `CONTENT_THEMES` (content-themes.ts) — ten bespoke publisher looks, one per
//     reference-driven content blueprint (`dispatch`, `broadsheet`, `amp`).
//   · `TEMPLATE_THEMES` (template-themes.ts) — ten bespoke commerce looks, one per
//     reference-driven store blueprint (`velodrome`, `maison`, `flux`).
//   · `PORTFOLIO_THEMES` (portfolio-themes.ts) — six bespoke personal-portfolio
//     looks, one per persona (`casework`, `silver`, `void`).
//   · silica's `THEME_PRESETS` — twenty named for the LOOK (`quartz`, `neon`).
//     Shipped by the design system, so they arrive with a silicaui bump.
//
// They stack rather than compete, and no slug collides. See themes.ts's header
// for why the sparx shelf is named the way it is.
//
// The `Meta` here is the MARKETPLACE face of a theme — the copy and the browse
// facets. It lived in `marketplace-catalog/_gen/gen-silica-themes.ts`, one file
// away from the palettes it describes; the generator now imports it from here so
// a theme's look and its listing are edited in one place.

import type { Theme } from '@wizeworks/silicaui-html';
import { THEME_PRESETS } from '@wizeworks/silicaui-html';

import { SPARX_THEMES } from './themes';
import { CONTENT_THEMES } from './content-themes';
import { TEMPLATE_THEMES } from './template-themes';
import { PORTFOLIO_THEMES } from './portfolio-themes';

/** A theme's marketplace face: the copy a shopper reads and the facets the
 *  browse rail is built from. `industry` / `mood` / `colorFamily` populate the
 *  rail directly — the rail takes whatever values exist, so a new value needs no
 *  registration, only consistency with its neighbours. */
export interface ThemeMeta {
  industry: string;
  /** The "Style" facet. */
  mood: string;
  /** The "Color" facet — honest to the theme's identity hue, not its page. */
  colorFamily: string;
  density: string;
  tagline: string;
  description: string;
  /** Which role the card accent (hex chip + wash) is pulled from. Default
   *  `primary`; overridden only when the light-mode primary is too pale to read
   *  as a chip (a dark-ground theme whose primary inverts to near-white). */
  accentRole?: 'primary' | 'secondary' | 'accent';
}

export const SPARX_THEME_META: Record<string, ThemeMeta> = {
  // Shops & dining
  boutique: {
    industry: 'Apparel & Lifestyle',
    mood: 'Editorial',
    colorFamily: 'Mono',
    density: 'Spacious',
    tagline: 'Quiet, considered retail where the product is the color.',
    description:
      'Near-white and almost colorless, with a near-black primary and one soft blush accent. Built for the shop that hangs forty things, not four hundred — small fashion, jewelry, and considered goods.',
  },
  kitchen: {
    industry: 'Food & Beverage',
    mood: 'Vibrant',
    colorFamily: 'Red',
    density: 'Standard',
    tagline: 'Warm and appetizing for restaurants, cafés, and bakeries.',
    description:
      'A genuinely warm, buttery page with a tomato-red brand and olive support — tuned for appetite and momentum. For restaurants, cafés, bakeries, and anywhere the food should look as good on screen as on the plate.',
  },
  cellar: {
    industry: 'Food & Beverage',
    mood: 'Luxe',
    colorFamily: 'Wine',
    density: 'Spacious',
    tagline: 'Low-lit and grown-up for wine, beer, spirits, and bars.',
    description:
      'A dark page even in light mode — the low-lit room a wine bar or bottle shop already is. Deep burgundy and restrained gold for merchants who sell an evening, not just a bottle.',
  },
  petal: {
    industry: 'Weddings & Events',
    mood: 'Playful',
    colorFamily: 'Pink',
    density: 'Standard',
    tagline: 'Soft and celebratory for florists, weddings, and events.',
    description:
      'A gentle blush ground with a confident rose primary — warm without tipping into sugary. For florists, wedding planners, and event stylists whose work is already the prettiest thing on the page.',
  },
  lodge: {
    industry: 'Travel & Hospitality',
    mood: 'Earthy',
    colorFamily: 'Green',
    density: 'Standard',
    tagline: 'Grounded and welcoming for stays and hospitality.',
    description:
      'An earthy, outdoorsy palette of forest and clay that feels like arriving somewhere. For hotels, cabins, lodges, and short-stay rentals that trade on place and calm.',
  },
  // Trades & on-site work
  workshop: {
    industry: 'Trades & Construction',
    mood: 'Utilitarian',
    colorFamily: 'Amber',
    density: 'Standard',
    tagline: 'Sturdy and no-nonsense for fabrication and trade.',
    description:
      'A plain, hard-wearing look with a safety-amber accent and generous hit areas. For fabrication, joinery, general contracting, and anyone whose website should read like their work: solid and squared-up.',
  },
  garage: {
    industry: 'Automotive',
    mood: 'Bold',
    colorFamily: 'Orange',
    density: 'Standard',
    tagline: 'Bold and mechanical for vehicle service and parts.',
    description:
      'A dark, high-contrast shop floor with an ignition-orange primary. For vehicle service, repair, tuning, and parts sellers who want the site to look as capable as the bay.',
  },
  field: {
    industry: 'Agriculture & Outdoor',
    mood: 'Earthy',
    colorFamily: 'Green',
    density: 'Standard',
    tagline: 'Rugged and outdoorsy for land and outdoor work.',
    description:
      'A grounded green-and-soil palette built for daylight and mud. For farming, landscaping, tree work, and outdoor contracting — honest, weatherproof, and easy to read on a phone in the sun.',
  },
  harbor: {
    industry: 'Logistics & Freight',
    mood: 'Professional',
    colorFamily: 'Blue',
    density: 'Wide',
    tagline: 'Wide and dependable for freight and heavy work.',
    description:
      'A calm navy on a wide, data-friendly layout that holds schedules and specs without clutter. For freight, haulage, plant hire, and industrial suppliers who move serious things on time.',
  },
  hearth: {
    industry: 'Home Services',
    mood: 'Calm',
    colorFamily: 'Terracotta',
    density: 'Standard',
    tagline: 'Warm and homey for interiors and home services.',
    description:
      'A soft terracotta warmth that reads as lived-in rather than corporate. For home services, interiors, furnishings, and the trades people invite indoors.',
  },
  // Care & professional
  clinic: {
    industry: 'Health & Wellness',
    mood: 'Calm',
    colorFamily: 'Teal',
    density: 'Standard',
    tagline: 'Clean and reassuring for care and wellness.',
    description:
      'A cool, uncluttered teal-and-white that signals hygiene and calm. For medical, dental, physio, and wellness practices where a patient should feel looked after before they even call.',
  },
  salon: {
    industry: 'Wellness & Beauty',
    mood: 'Luxe',
    colorFamily: 'Mauve',
    density: 'Spacious',
    tagline: 'Polished and inviting for beauty and spa.',
    description:
      'A softly luxe mauve with generous whitespace that feels like a treatment room. For hair, beauty, nails, lashes, and spa businesses selling a little indulgence.',
  },
  ledger: {
    industry: 'Professional Services',
    mood: 'Professional',
    colorFamily: 'Navy',
    density: 'Wide',
    tagline: 'Precise and trustworthy for finance and law.',
    description:
      'A restrained navy on a wide, orderly layout that reads as competence and discretion. For accountants, lawyers, and financial advisers whose clients are buying judgment.',
  },
  summit: {
    industry: 'Professional Services',
    mood: 'Bold',
    colorFamily: 'Indigo',
    density: 'Wide',
    tagline: 'Confident and modern for consulting and B2B.',
    description:
      'A crisp indigo with a confident, contemporary rhythm. For consultancies, agencies, and B2B firms that want to look like the sharpest room in the deal.',
  },
  academy: {
    industry: 'Education',
    mood: 'Professional',
    colorFamily: 'Crimson',
    density: 'Standard',
    tagline: 'Collegiate and credible for teaching and training.',
    description:
      'A warm collegiate crimson that reads as established rather than childish. For schools, tutors, course creators, and training providers who need to look both trustworthy and serious.',
  },
  // Studios & publishing
  studio: {
    industry: 'Agency & Portfolio',
    mood: 'Minimal',
    colorFamily: 'Graphite',
    density: 'Spacious',
    tagline: 'Spare and gallery-like for creative studios.',
    description:
      'A near-silent graphite-on-white with acres of space, so the work is the only loud thing. For design, photography, and creative studios whose portfolio should carry the whole page.',
  },
  gallery: {
    industry: 'Arts & Culture',
    mood: 'Editorial',
    colorFamily: 'Stone',
    density: 'Spacious',
    // A dark-ground theme: the light-mode primary inverts to near-white, so the
    // card accent reads from the mid-stone secondary instead.
    accentRole: 'secondary',
    tagline: 'Museum-quiet for artists and makers.',
    description:
      'A warm stone neutral and a serif voice that treats every piece like it is hung, not posted. For artists, makers, and portfolio sites where the images earn the silence around them.',
  },
  press: {
    industry: 'Media & Publishing',
    mood: 'Editorial',
    colorFamily: 'Red',
    density: 'Wide',
    tagline: 'Column-driven and literary for publishing.',
    description:
      'A paper-white editorial look built around type and columns, with a single decisive red for mastheads and links. For publishers, newsletters, magazines, and blogs where the writing is the product.',
  },
  stage: {
    industry: 'Arts & Events',
    mood: 'Bold',
    colorFamily: 'Violet',
    density: 'Standard',
    tagline: 'Dramatic and low-lit for shows and events.',
    description:
      'A dark house with a spotlight-violet primary — the room going quiet before the lights come up. For music, theatre, comedy, and ticketed events that sell a night out.',
  },
  signal: {
    industry: 'Tech & Electronics',
    mood: 'Bold',
    colorFamily: 'Indigo',
    density: 'Standard',
    tagline: 'Sharp and product-forward for software and apps.',
    description:
      'A confident indigo with a clean, product-forward rhythm. For software, apps, devices, and subscriptions that want the site to feel as considered as the thing it sells.',
  },
};

/** The marketplace face of the ten bespoke CONTENT-template themes (content-themes.ts).
 *
 *  Named for the LOOK, one per reference-driven publisher blueprint. The four
 *  neon-on-dark themes (amplitude, expanse, console, amp) are dark-ground in both
 *  modes, so their card accent reads from `secondary` rather than a light-mode
 *  primary that would sit too bright to read as a chip. */
export const CONTENT_THEME_META: Record<string, ThemeMeta> = {
  dispatch: {
    industry: 'Media & Publishing',
    mood: 'Editorial',
    colorFamily: 'Green',
    density: 'Standard',
    tagline: 'A cool-white newsroom carried by one saturated emerald.',
    description:
      'A pure, monochrome news feed where a single emerald marks every category tag, link, and subscribe button. Grotesk headlines over a neutral sans at real density — for tech blogs, news sites, and publications that run a lot of stories cleanly.',
  },
  broadsheet: {
    industry: 'Media & Publishing',
    mood: 'Editorial',
    colorFamily: 'Red',
    density: 'Spacious',
    tagline: 'Warm paper and serif-across type for long-form reading.',
    description:
      'A warm-paper reading theme set entirely in serif — a high-contrast display over a readable text serif — with one decisive editorial red on rubrics and the subscribe call. For magazines, essays, and literary longform where the writing is the product.',
  },
  runway: {
    industry: 'Fashion & Beauty',
    mood: 'Luxe',
    colorFamily: 'Mono',
    density: 'Spacious',
    tagline: 'Pure black-and-white editorial luxury, color from the photography.',
    description:
      'White page, near-black ink, and a high-contrast Didone display over a clean sans — with no chromatic accent at all, so every ounce of color comes from full-bleed imagery. For fashion, beauty, and glossy editorial where the pictures carry the page.',
  },
  amplitude: {
    industry: 'Media & Publishing',
    mood: 'Bold',
    colorFamily: 'Crimson',
    density: 'Standard',
    accentRole: 'secondary',
    tagline: 'A loud, near-black culture magazine with a voltage crimson masthead.',
    description:
      "The set's loudest dark magazine: near-black grounds, bright near-white type, and one electric crimson for the masthead, ranked lists, and the primary action. Heavy condensed headlines — for music, film, and culture coverage that wants to be looked at.",
  },
  expanse: {
    industry: 'Travel & Nature',
    mood: 'Editorial',
    colorFamily: 'Amber',
    density: 'Spacious',
    accentRole: 'secondary',
    tagline: 'A near-black photographic ground lit by one solar-amber line.',
    description:
      'A dark, cinematic canvas that makes full-bleed imagery pop, with a single solar amber used only as a thin rule, underline, or tag. Serif display over a neutral sans — for photo journalism, nature, and travel stories told mostly in pictures.',
  },
  podium: {
    industry: 'Education & Ideas',
    mood: 'Playful',
    colorFamily: 'Coral',
    density: 'Standard',
    tagline: 'A warm, optimistic ideas hub carried by one bright coral.',
    description:
      'A clean warm-white page with a single friendly coral on the play button, talk badges, and donate call. Geometric display over a humanist sans, softly rounded — for talks, conferences, courses, and idea platforms that want to feel welcoming.',
  },
  console: {
    industry: 'Gaming & Entertainment',
    mood: 'Bold',
    colorFamily: 'Violet',
    density: 'Standard',
    accentRole: 'secondary',
    tagline: 'A true-dark brand newsroom with a scarce electric-violet signal.',
    description:
      'A first-party newsroom on a near-black ground where big cover art carries the color, and one electric violet marks active nav, category chips, and the primary action. Technical grotesk over a neutral sans — for gaming, product, and brand blogs built on imagery.',
  },
  quad: {
    industry: 'Education & Institutions',
    mood: 'Professional',
    colorFamily: 'Navy',
    density: 'Wide',
    tagline: 'A two-color institutional chassis: deep navy with an academic crimson.',
    description:
      'An authoritative paper page with a deep navy primary and a distinct academic crimson accent, set serif-headline over a sans body. For universities, institutes, and institutional newsrooms that need to read as trustworthy and established.',
  },
  agency: {
    industry: 'Government & Nonprofit',
    mood: 'Professional',
    colorFamily: 'Blue',
    density: 'Wide',
    tagline: 'An accessibility-first civic palette in deep federal blue.',
    description:
      'A white, high-legibility public-service page with a deep federal-blue primary that clears AAA contrast, a single flag-red reserved for alerts, and an info-blue for notices. For government, civic, and public-institution sites where clarity is the whole brief.',
  },
  amp: {
    industry: 'Music & Entertainment',
    mood: 'Bold',
    colorFamily: 'Magenta',
    density: 'Standard',
    accentRole: 'secondary',
    tagline: 'A near-black concert stage in electric magenta and cyan.',
    description:
      'A dark stage ground carrying a magenta-and-cyan duotone — the two-light gel look — behind key art, tour dates, and release players. Expressive poster display over a neutral sans, softly lifted. For artists, labels, and music sites that perform on the page.',
  },
};

/** The marketplace face of the ten bespoke COMMERCE-template themes (template-themes.ts).
 *
 *  Named for the LOOK, one per reference-driven store blueprint. `flux` is dark-ground
 *  in both modes, so its card accent reads from `secondary`; the mono paper themes keep
 *  the default `primary` (their light-mode primary is a legible near-black chip). */
export const TEMPLATE_THEME_META: Record<string, ThemeMeta> = {
  velodrome: {
    industry: 'Sportswear & Fitness',
    mood: 'Bold',
    colorFamily: 'Mono',
    density: 'Standard',
    tagline: 'Monochrome endurance-kit chrome with one hi-vis chartreuse.',
    description:
      'A near-white page carried by a near-black primary that inverts to white in dark, plus a single race-visibility chartreuse held to the signals. Condensed grotesque headlines over a neutral sans — for athletic wear, gyms, and performance brands.',
  },
  atelier: {
    industry: 'Apparel & Streetwear',
    mood: 'Editorial',
    colorFamily: 'Mono',
    density: 'Standard',
    tagline: 'A paper-ground editorial grid where the product is the color.',
    description:
      'A warm paper mono theme carrying a high-contrast serif display, light-grey product tiles, and effectively no chrome accent — all color lives in the imagery. For considered apparel, streetwear, and lifestyle shops built on a tight grid.',
  },
  'sage-oat': {
    industry: 'Natural & Sustainable Goods',
    mood: 'Earthy',
    colorFamily: 'Sage',
    density: 'Standard',
    tagline: 'A tinted oat page with olive and sage for natural goods.',
    description:
      'A visibly warm oat ground — not white with a rumour of cream — with a near-black primary that flips to oat inside dark bands, plus olive and sage support. Soft serif over a geometric sans. For natural, sustainable, and wellness products sold on calm.',
  },
  romp: {
    industry: 'Apparel & Basics',
    mood: 'Playful',
    colorFamily: 'Amber',
    density: 'Standard',
    tagline: 'A warm-cream page energised by a bright marigold and giveback joy.',
    description:
      'A cheerful cream ground whose energy comes from color bands, with a bright marigold primary on the feel-good action, a deep navy for dark islands, and a sage accent. Heavy rounded display — for mission-driven brands, basics, and playful direct-to-consumer shops.',
  },
  roastery: {
    industry: 'Food & Subscription',
    mood: 'Earthy',
    colorFamily: 'Terracotta',
    density: 'Standard',
    tagline: 'A mid-warm cream page in deep terracotta and forest green.',
    description:
      'A warm cream page with an espresso dark island for footer and newsletter beats, a deep terracotta primary on prices and savings, and a disciplined forest-green for headings. High-contrast serif over a humanist sans — for coffee, food boxes, and subscription commerce.',
  },
  maison: {
    industry: 'Luxury Fashion',
    mood: 'Luxe',
    colorFamily: 'Mono',
    density: 'Spacious',
    tagline: 'Pure white and pure black, classical serif set across everything.',
    description:
      'Colder and starker than a gallery theme: a pure-white page, pure-black ink, warm stone tiles, and a classical serif used for body and headings alike. Restraint is the point — for couture, luxury fashion, and any brand that sells by holding back.',
  },
  flux: {
    industry: 'Tech & Electronics',
    mood: 'Bold',
    colorFamily: 'Blue',
    density: 'Standard',
    accentRole: 'secondary',
    tagline: 'A cinematic near-black showroom in deep electric blue.',
    description:
      'A genuinely dark page in both modes — a cinematic showroom where product renders pop against near-black — with a deep electric-blue primary on Buy and active nav, plus cyan and signal-blue for spec highlights. Technical grotesk, hairline structure. For hardware and premium tech.',
  },
  gloss: {
    industry: 'Beauty & Cosmetics',
    mood: 'Vibrant',
    colorFamily: 'Magenta',
    density: 'Standard',
    tagline: 'Blush grounds filled with a bold, white-inked hot magenta.',
    description:
      'Blush-tinted grounds that fill with a bold, saturated hot magenta on the header band, buttons, prices, and stars, plus a wine secondary and warm-nude accent. Rounded and lifted — for beauty counters, cosmetics, and color-forward retail.',
  },
  voltage: {
    industry: 'Fashion & Apparel',
    mood: 'Bold',
    colorFamily: 'Mono',
    density: 'Standard',
    tagline: 'Near-black chrome and white content with one loud sale-red.',
    description:
      'White and grey content alternating with near-black chrome, a near-black mono primary that inverts on the dark islands, and one loud sale-red on badges, prices, and urgency. Bold grotesque caps — for high-volume fashion catalogs and value retail.',
  },
  bare: {
    industry: 'Loungewear & Basics',
    mood: 'Minimal',
    colorFamily: 'Stone',
    density: 'Standard',
    tagline: 'A warm bone off-white with greige and near-black restraint.',
    description:
      'A warm bone page with a greige ramp and near-black ink and buttons, and deliberately no real accent — chroma comes from product imagery, never the theme. Heavy condensed all-caps display — for loungewear, intimates, and minimalist luxe basics.',
  },
};

/** The marketplace face of the six bespoke PORTFOLIO-template themes (portfolio-themes.ts).
 *
 *  Named for the LOOK, one per personal-portfolio blueprint. `void` is terminal-dark in
 *  both modes, so its card accent reads from `secondary`; the mono paper themes (silver)
 *  keep the default `primary`. Note the theme token is `casework`, not `ledger` — `ledger`
 *  is a SPARX trade shelf, so the portfolio designer look took its own slug. */
export const PORTFOLIO_THEME_META: Record<string, ThemeMeta> = {
  casework: {
    industry: 'Agency & Portfolio',
    mood: 'Minimal',
    colorFamily: 'Blue',
    density: 'Standard',
    tagline: 'An almost achromatic case-study page with one electric blue.',
    description:
      'Judgment over decoration: a near-white, almost colorless page carried by a single electric signal-blue on the primary action, the outcome metric, and the active filter. Tight grotesk over a humanist sans — for product and UX designers whose case studies do the talking.',
  },
  silver: {
    industry: 'Photography & Portfolio',
    mood: 'Minimal',
    colorFamily: 'Mono',
    density: 'Spacious',
    tagline: 'A near-white gallery wall where the photographs are the color.',
    description:
      'The work is the design: a cool gallery-white ground, near-black ink and primary, and an elegant serif display over a clean sans — with no chromatic accent, so every ounce of color comes from the images. For photographers and image-first portfolios.',
  },
  void: {
    industry: 'Developer & Portfolio',
    mood: 'Utilitarian',
    colorFamily: 'Green',
    density: 'Standard',
    accentRole: 'secondary',
    tagline: 'A terminal-black page in acid green and cyan, monospace throughout.',
    description:
      'The medium is the message: a near-black void in both modes with a monospace body, one acid-green primary and an electric-cyan accent — the console prompt made into a site. Surfaces separate by base-shift and border, never a glow. For developers and technical portfolios.',
  },
  riso: {
    industry: 'Illustration & Art',
    mood: 'Playful',
    colorFamily: 'Coral',
    density: 'Standard',
    tagline: 'A warm riso-cream page in a loud coral-and-cobalt duotone.',
    description:
      'The palette is the brand: a warm riso-cream ground with an electric coral primary, a cobalt accent, and deep indigo ink. Expressive display over a rounded humanist sans — a loud, unmistakably one-maker look for illustrators, artists, and designers with a voice.',
  },
  manuscript: {
    industry: 'Writing & Publishing',
    mood: 'Editorial',
    colorFamily: 'Oxblood',
    density: 'Spacious',
    tagline: 'A warm-paper reading page in serif throughout with one oxblood.',
    description:
      'The words are the work: a warm-paper page set entirely in serif — a high-contrast display over a readable text serif — with a single oxblood on the byline, links, and primary action. Hairline rules, zero radius. For writers, journalists, and authors whose type is the hero.',
  },
  atlas: {
    industry: 'Studio & Portfolio',
    mood: 'Professional',
    colorFamily: 'Amber',
    density: 'Wide',
    tagline: 'A sober concrete-and-bone index in burnt amber and slate.',
    description:
      'A studio index built for range with precision: a bone-and-concrete chassis with a burnt-amber primary on the call, active category, and project year, and a cool slate accent for the facts column. Wide architectural grotesk — for design studios, architects, and multidisciplinary practices.',
  },
};

/** The marketplace face of silica's twenty shipped presets.
 *
 *  These are named for the LOOK, so their copy sells a look — the sparx shelf
 *  next to them sells a trade, and a shopper should be able to tell instantly
 *  which kind of choice they are making.
 *
 *  `industry` is deliberately broad here. A preset is not tuned to a business,
 *  and pretending otherwise would put `quartz` and `clinic` in the same rail
 *  bucket while only one of them was designed for it.
 *
 *  `colorFamily` is read off the palette, not the name: `carbon` is Mono because
 *  its primary has zero chroma, and `quartz` is Slate because its primary sits at
 *  .055 — pale enough that calling it Blue would misdescribe the card. Keep that
 *  discipline when adding one; the facet is a filter people trust. */
export const SILICA_THEME_META: Record<string, ThemeMeta> = {
  // Neutral grounds — the ones that carry any brand without arguing with it.
  quartz: {
    industry: 'General',
    mood: 'Minimal',
    colorFamily: 'Slate',
    density: 'Standard',
    tagline: 'A quiet slate-blue default that never competes with your content.',
    description:
      'The safest starting point in the set. A near-white page, a muted slate primary, and a single cyan accent kept for the one thing on a screen that should be clicked. Reach for it when the product photography or the writing is meant to carry the page.',
  },
  obsidian: {
    industry: 'General',
    mood: 'Professional',
    colorFamily: 'Graphite',
    density: 'Standard',
    tagline: 'Near-black controls on paper — serious without being cold.',
    description:
      'Almost no chroma in the primary, so buttons read as ink rather than as brand. Suits professional services, documentation, and anywhere a colorful interface would undercut the message.',
  },
  marble: {
    industry: 'General',
    mood: 'Editorial',
    colorFamily: 'Stone',
    density: 'Spacious',
    tagline: 'Generous spacing and stone-grey type for long-form reading.',
    description:
      'Built for words. Wide measure, a restrained stone primary, and a warm ochre accent that marks a link without shouting. A good fit for publications, essays, and documentation sites.',
  },
  carbon: {
    industry: 'General',
    mood: 'Utilitarian',
    colorFamily: 'Mono',
    density: 'Standard',
    tagline: 'Pure greyscale with one orange accent doing all the pointing.',
    description:
      'The primary has zero chroma — every scrap of color on the page is the accent, which makes calls to action impossible to miss. Suits tools, dashboards, and technical products where decoration is a distraction.',
  },
  frost: {
    industry: 'General',
    mood: 'Calm',
    colorFamily: 'Blue',
    density: 'Spacious',
    tagline: 'Cool, airy blue on the lightest page in the set.',
    description:
      'A pale, even palette with plenty of room around everything. Reads as calm and unhurried — health, wellbeing, and any product whose job is to lower someone’s blood pressure rather than raise it.',
  },

  // Blues and greens — the trust-and-growth end of the shelf.
  ocean: {
    industry: 'General',
    mood: 'Professional',
    colorFamily: 'Blue',
    density: 'Standard',
    tagline: 'Confident mid-blue with a teal accent — the classic trust palette.',
    description:
      'The most conventional choice here, and conventional for a reason: a clear blue primary reads as dependable at a glance. Good for software, finance, and services that need to look established on first sight.',
  },
  cobalt: {
    industry: 'General',
    mood: 'Bold',
    colorFamily: 'Navy',
    density: 'Standard',
    tagline: 'A deep, saturated blue that commits.',
    description:
      'Ocean with the volume up. High chroma in the primary makes filled buttons genuinely loud, so it suits products that want to feel decisive rather than safe.',
  },
  midnight: {
    industry: 'General',
    mood: 'Luxe',
    colorFamily: 'Indigo',
    density: 'Standard',
    tagline: 'Deep indigo with a warm gold accent.',
    description:
      'The indigo carries the chrome and the gold marks the moments that matter. A quietly premium pairing for membership products, events, and anything sold on anticipation.',
  },
  lagoon: {
    industry: 'General',
    mood: 'Calm',
    colorFamily: 'Teal',
    density: 'Standard',
    tagline: 'Teal and lime — fresh without tipping into novelty.',
    description:
      'A cool teal primary with a bright green accent that keeps it lively. Works for travel, leisure, and consumer products that want to feel modern and uncomplicated.',
  },
  jade: {
    industry: 'General',
    mood: 'Calm',
    colorFamily: 'Green',
    density: 'Standard',
    tagline: 'Muted green with a soft gold accent.',
    description:
      'A restrained, slightly herbal green — closer to sage than to emerald. Suits considered, slow-made things: skincare, tea, homeware, anything whose selling point is care.',
  },
  fern: {
    industry: 'General',
    mood: 'Vibrant',
    colorFamily: 'Green',
    density: 'Standard',
    tagline: 'A brighter, growing green with real saturation.',
    description:
      'Where jade is calm, fern is alive. High-chroma green through the chrome and a citrus accent on top — good for food, outdoors, sustainability, and anything sold on freshness.',
  },

  // Warm grounds — the appetite-and-craft end.
  sunset: {
    industry: 'General',
    mood: 'Vibrant',
    colorFamily: 'Orange',
    density: 'Standard',
    tagline: 'Warm orange into red, with a golden accent.',
    description:
      'The warmest palette in the set and the most appetising. Orange primary, red secondary and a gold accent give it real energy — food, events, and consumer brands that want to feel welcoming.',
  },
  amber: {
    industry: 'General',
    mood: 'Earthy',
    colorFamily: 'Amber',
    density: 'Standard',
    tagline: 'Honeyed amber on a faintly warm page.',
    description:
      'Softer and more grown-up than sunset — the page itself carries a little warmth, so the whole screen feels lit rather than white. Bakeries, bars, and makers who want warmth without brightness.',
  },
  copper: {
    industry: 'General',
    mood: 'Earthy',
    colorFamily: 'Terracotta',
    density: 'Standard',
    tagline: 'Burnished copper with a cool teal counterweight.',
    description:
      'A metallic warm primary balanced by a deliberately cool accent, which keeps it from reading as rustic. Suits workshops, hardware, and craft brands that also want to look precise.',
  },
  clay: {
    industry: 'General',
    mood: 'Earthy',
    colorFamily: 'Terracotta',
    density: 'Standard',
    tagline: 'Terracotta and olive — handmade, not homespun.',
    description:
      'Warm earth primary against a green secondary, the pairing you get from a pot and the plant in it. Ceramics, garden, food and anything sold as made by a person.',
  },
  dune: {
    industry: 'General',
    mood: 'Earthy',
    colorFamily: 'Stone',
    density: 'Wide',
    tagline: 'Sand-toned and low-contrast, with room to breathe.',
    description:
      'The most muted warm option: a tan page and a soft brown primary, set wide. Reads as understated and expensive — interiors, architecture, and slow fashion.',
  },

  // Pinks and purples — the expressive end.
  rose: {
    industry: 'General',
    mood: 'Editorial',
    colorFamily: 'Pink',
    density: 'Spacious',
    tagline: 'Dusty rose with a peach accent and plenty of air.',
    description:
      'Soft without being sweet — the pink is desaturated enough to hold a full page of text. Beauty, weddings, stationery, and editorial brands with a feminine register.',
  },
  plum: {
    industry: 'General',
    mood: 'Luxe',
    colorFamily: 'Wine',
    density: 'Standard',
    tagline: 'Deep plum lifted by a gold accent.',
    description:
      'Rich and slightly nocturnal. The gold accent does the lifting, so buttons and links glow against the depth — wine, fragrance, and anything sold as an indulgence.',
  },
  grape: {
    industry: 'General',
    mood: 'Bold',
    colorFamily: 'Violet',
    density: 'Standard',
    tagline: 'Saturated violet into magenta — confident and modern.',
    description:
      'High chroma across primary and secondary, so the interface itself is part of the brand. Suits software, creative studios, and products aimed at people who like a point of view.',
  },
  neon: {
    industry: 'General',
    mood: 'Playful',
    colorFamily: 'Violet',
    density: 'Standard',
    tagline: 'Electric magenta and lime. Not for the cautious.',
    description:
      'The loudest theme in the set by a distance — a heavily saturated primary with a lime accent that has no intention of blending in. Music, nightlife, gaming, and launches that want to be looked at.',
  },
};

/** One first-party theme, ready to become a marketplace listing. `theme` is the
 *  ship-ready silica `Theme` a site adopts — the same object the Builder applies,
 *  so what a shopper previews is literally what they get. */
export interface FirstPartyTheme {
  slug: string;
  /** `sparx` — the business-named shelf. `content` / `template` / `portfolio` — the
   *  three bespoke reference-driven shelves. `silica` — the design system's presets. */
  shelf: 'sparx' | 'content' | 'template' | 'portfolio' | 'silica';
  theme: Theme;
  meta: ThemeMeta;
}

/** Every theme sparx ships, sparx's own shelf first.
 *
 *  Order is the default browse order, and it is a decision: the business-named
 *  shelf leads because "what do I do" is an easier question for the person
 *  choosing than "what look do I want". Sorting by name or newest overrides it.
 *
 *  A silica preset with no entry in `SILICA_THEME_META` is SKIPPED rather than
 *  listed with placeholder copy — a silicaui bump that adds a preset should show
 *  up as a missing theme (which `first-party-themes.test.ts` fails on), not as a
 *  card with an empty tagline in front of customers. */
export const FIRST_PARTY_THEMES: FirstPartyTheme[] = [
  ...SPARX_THEMES.flatMap<FirstPartyTheme>((theme) => {
    const meta = SPARX_THEME_META[theme.name];
    return meta ? [{ slug: theme.name, shelf: 'sparx', theme, meta }] : [];
  }),
  ...CONTENT_THEMES.flatMap<FirstPartyTheme>((theme) => {
    const meta = CONTENT_THEME_META[theme.name];
    return meta ? [{ slug: theme.name, shelf: 'content', theme, meta }] : [];
  }),
  ...TEMPLATE_THEMES.flatMap<FirstPartyTheme>((theme) => {
    const meta = TEMPLATE_THEME_META[theme.name];
    return meta ? [{ slug: theme.name, shelf: 'template', theme, meta }] : [];
  }),
  ...PORTFOLIO_THEMES.flatMap<FirstPartyTheme>((theme) => {
    const meta = PORTFOLIO_THEME_META[theme.name];
    return meta ? [{ slug: theme.name, shelf: 'portfolio', theme, meta }] : [];
  }),
  ...THEME_PRESETS.flatMap<FirstPartyTheme>((theme) => {
    const meta = SILICA_THEME_META[theme.name];
    return meta ? [{ slug: theme.name, shelf: 'silica', theme, meta }] : [];
  }),
];

/** Lookup by slug, for the catalog's detail route. */
const BY_SLUG = new Map(FIRST_PARTY_THEMES.map((t) => [t.slug, t]));

export function firstPartyTheme(slug: string): FirstPartyTheme | undefined {
  return BY_SLUG.get(slug);
}

/** True when a slug belongs to sparx, and so must not be shadowed by a database
 *  row. The catalog serves first-party themes ahead of uploads; without this a
 *  tenant could publish `clinic` and take over the listing everyone else sees. */
export function isFirstPartyThemeSlug(slug: string): boolean {
  return BY_SLUG.has(slug);
}
