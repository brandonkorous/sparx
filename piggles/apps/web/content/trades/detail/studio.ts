import type { TradePage } from '../types';

// Studio depth: what it replaces, the three leaned-on apps, moving over, and cost.
// Imports bring writing, images and customers; the old site's design does not.

export const STUDIO_DETAIL: Pick<TradePage, 'replaces' | 'inDepth' | 'switching' | 'cost'> = {
  replaces: [
    {
      today: 'a portfolio site a friend built that you cannot change',
      instead: 'site',
      why: 'You rearrange My Site yourself the evening a new series is finished, and every publish is a version you can roll back to if you change your mind.',
    },
    {
      today: 'a separate shop add-on for selling prints',
      instead: 'sell',
      why: 'Prints and originals sit in the same catalog as the rest of your site, and orders from your own site and from an open studio day land in one list.',
    },
    {
      today: 'a separate app for scheduling posts',
      instead: 'get_found',
      why: 'Posts are written beside the work they are about, reshaped for each network, and comments from Instagram and Facebook come back to one inbox, beside that person’s orders and emails.',
    },
    {
      today: 'a notes file of commission inquiries',
      instead: 'customers',
      why: 'Each inquiry becomes a record with a value, a stage and a follow-up date, so a collector who asked in March is not forgotten by June.',
    },
    {
      today: 'a mailing list tool with its own bill',
      instead: 'messages',
      why: 'Your monthly note goes from your own address to buyers who already have a record here, and someone who unsubscribes is respected everywhere without a list of exceptions.',
    },
    {
      today: 'a folder of the same photograph saved at five sizes',
      instead: 'content',
      why: 'Each image is uploaded once to one library and resized for wherever it appears on your site.',
    },
  ],
  inDepth: [
    {
      app: 'content',
      heading: 'Describe each piece once, and it appears everywhere it belongs.',
      body: 'A studio website is mostly a catalog of work, and every piece has the same facts: what it is made of, how big it is, when it was made, whether it is still available. Content keeps those facts in one place, so two pages never disagree.',
      points: [
        'Set up your own kind of entry for a piece of work, with fields for medium, dimensions, year, series and whether it has sold.',
        'Mark a piece sold in one place, and every page that shows it changes with it.',
        'Write about a new series as a draft, schedule it for the opening night, and unpublish it later without deleting it.',
        'Every version is kept, so the artist statement you rewrote last spring can be put back from any earlier save.',
        'Tags and topics keep years of work easy to browse, so a visitor can see every piece in one series.',
        'Your commission terms and returns policy live as real pages you can edit, versioned like everything else.',
      ],
    },
    {
      app: 'get_found',
      heading: 'Get seen by people who have never heard your name.',
      body: 'Most new buyers reach a studio one of two ways: a search for exactly what you make, or a post in a feed. Get Found handles the dull details behind both, so the time you spend goes on the work.',
      points: [
        'Every page is checked, and what is missing is explained in plain words with a box to write the fix in.',
        'Set the picture and title that appear when somebody pastes your link into a message, so a shared page shows the piece and not a random crop.',
        'Connect Google Search Console and see the real searches, like “hand-thrown mugs”, that brought people to each page.',
        'Keep a pool of your best posts, so a week with nothing planned draws from it instead of going silent.',
        'Save the hashtag blocks you use for each series and drop one into a post or its first comment with a click.',
        'Reach, engagement and clicks per post and per network show which pieces people actually respond to.',
      ],
    },
    {
      app: 'site',
      heading: 'A portfolio you keep current yourself.',
      body: 'The site a stranger lands on decides whether they buy, commission or leave. My Site lets you change it the same evening a series is finished, without waiting on anybody.',
      points: [
        'Set your colors and type once and every page wears them, so the site looks like your work rather than like a template.',
        'Galleries, price lists, contact forms and product grids are finished sections you arrange and fill in.',
        'The menu and footer are edited once and are right on every page.',
        'Save a section you reuse, such as a commission inquiry panel, and update it in one place afterwards.',
        'Every form inquiry is kept and readable, so a commission request is never lost with a deleted email.',
        'Work on a draft of the new gallery while the live site carries on, then publish when it is ready.',
      ],
    },
  ],
  switching: [
    {
      title: 'Bring the old site’s writing and images.',
      body: 'If your current site came from one of the website builders or publishing platforms Move in lists, drop its export into “Move in from somewhere else” in your console. Pages, posts and images come across, and so can a list of old page addresses, so links people shared still land somewhere. You see what will happen before anything is saved.',
    },
    {
      title: 'Rebuild the look on real sections.',
      body: 'The design of your old site does not come across, only its words and pictures. Start from a ready-made site, arrange galleries and pages from finished sections, and publish when it looks like you.',
    },
    {
      title: 'Bring your buyers and your prints.',
      body: 'A customer list from a mailing list tool or a shop export comes across the same way, including whether each person agreed to hear from you. Prints can arrive as products with their sizes. Commission inquiries kept in a notes file are typed in by hand.',
    },
  ],
  cost: {
    heading: 'One price for the gallery, the shop and the posting.',
    body: '$99 a month, flat, with every app included. For a studio that means the website, the writing about the work, posting to your networks, selling prints, invoicing commissions and email, all on one bill. Try it free for 14 days without a card.',
    points: [
      'One website on your own address is included, with the security certificate handled, or stay on the free Piggles address as long as you like.',
      '10 GB of storage for images and files is included. If an archive of high-resolution photographs outgrows it, more room can be added in one tap with the price shown first.',
      'Unlimited products, so every print size and every original can be listed.',
      'Up to 5,000 marketing emails a month are included, and order confirmations do not count toward that.',
      'Your payment provider charges its own fees, under your own terms with them.',
      'Reaching a limit never takes anything down: your site stays up and only new uploads of that kind pause until you add room.',
    ],
  },
};
