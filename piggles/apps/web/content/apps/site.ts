import type { AppMarketing } from './types';

export const SITE: AppMarketing = {
  heading: 'A website you can change yourself, on a Tuesday, without phoning anybody.',
  lede: 'My Site is the website customers actually land on — built by dragging real sections into place, published in one click, and editable by you at four in the afternoon when the opening hours change.',
  alsoKnownAs: ['website builder', 'CMS', 'landing page builder', 'ecommerce storefront'],
  does: [
    {
      title: 'Build it from real pieces',
      body: 'A library of finished sections — headers, galleries, price lists, contact forms, product grids — that you arrange and fill in. Not a blank page and not a template you cannot escape.',
    },
    {
      title: 'See the change as you make it',
      body: 'The preview is the actual page, not an approximation of it. What you see is what visitors get.',
    },
    {
      title: 'Your own address',
      body: 'Start on a free Piggles address, point your own domain at it whenever you are ready, and the certificate is issued and renewed without you knowing it happened.',
    },
    {
      title: 'Looks right on a phone',
      body: 'Every section is built to reflow rather than shrink, so the site is usable on the device most of your customers will actually use.',
    },
    {
      title: 'Change your mind safely',
      body: 'Every publish is a version. Compare, roll back, and keep working on a draft while the live site carries on being live.',
    },
    {
      title: 'More than one site',
      body: 'Two businesses, or a separate site for the wholesale side, each with its own look, its own domain and its own content.',
    },
  ],
  chapters: [
    {
      // Pages are the obvious half. The other half — the look, the header, the
      // reusable pieces, the emails and the replies — had no bullet at all,
      // which made a fairly deep builder read as a page editor.
      heading: 'The parts of a website that are not a page.',
      body: 'A site is not just its pages. It is the colors and type that make it look like you, the header and footer that every page sits inside, the pieces you want repeated without maintaining five copies, and the forms people fill in. Each of those is its own thing here rather than a setting buried in whichever page you happened to be editing.',
      does: [
        {
          title: 'Your look, set once',
          body: 'Colors, type and spacing defined in one place and worn by every page. Change your colors and the whole site changes, rather than you editing forty sections.',
        },
        {
          title: 'Header and footer as their own thing',
          body: 'The menu, the logo bar and the footer that every page renders inside. Edit it once; it is right everywhere.',
        },
        {
          title: 'The bits you keep repeating',
          body: 'Save a section as a reusable piece — an opening-hours panel, a call-to-action, a staff card — and update it in one place afterwards.',
        },
        {
          title: 'Start from a finished site',
          body: 'Ready-made sites for common trades, complete with real pages and real sections, so day one is editing rather than staring at a blank canvas.',
        },
        {
          title: 'Emails designed the same way',
          body: 'The same editor builds your email designs, so what lands in an inbox looks like the site it came from.',
        },
        {
          title: 'What people sent you',
          body: 'Every form submission kept and readable, rather than an email you might have deleted — and the pages report which are actually getting visitors.',
        },
      ],
    },
  ],
  worksWith: ['content', 'get_found', 'sell'],
  photo: {
    src: '/photos/florist.jpg',
    alt: 'A hand-lettered "fresh cut flowers" sign at a florist',
  },
};
