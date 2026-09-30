import type { AppChapter } from '../types';

// The deeper parts of My Site, split out of ../site.ts to keep that file short.
//
// Checked against piggles/apps/workbench/lib/surfaces/catalog/builder.ts and the
// panes behind it: surfaces/studio (publish, history, preview, page settings,
// record templates, product listings), surfaces/builder (form settings, the
// submissions inbox, page results, blueprints, site identity) and the account
// settings for sites and domains.
//
// DELIBERATELY ABSENT: looks installed from other people's designs. The console
// has a shelf for them, but whether it has anything on it for a Piggles customer
// is not something this page can promise, so only the business's own looks and
// the ready-made ones are claimed.

export const SITE_CHAPTERS: AppChapter[] = [
  {
    heading: 'Publish when you are ready. Put it back if you were not.',
    body: 'Each part of your site has its own Publish button: a page, the header and footer, your look, an email. Fixing a typo in the footer does not push out the half-finished page you were also working on. When you do want everything live at once, one screen shows what is waiting, offers a check first, and keeps every version that ever went live.',
    does: [
      {
        title: 'Publish one thing',
        body: 'Finish the footer, publish the footer. Everything else you are working on stays a draft.',
      },
      {
        title: 'Or everything that is waiting',
        body: 'One screen lists what has changed since the site last went live, and puts it all out together.',
      },
      {
        title: 'A check before it goes out',
        body: 'It walks every page and lists what a visitor would trip over, worst first. It advises and never blocks: you know things about your site a rule does not.',
      },
      {
        title: 'The way back, for the whole site',
        body: 'Every version that went live is kept, and the site can be put back to an earlier one.',
      },
      {
        title: 'The way back, for one piece',
        body: 'Open the history beside a page, the header or an email and restore an earlier version of just that.',
      },
      {
        title: 'Two things open at once',
        body: 'A page beside the header it wears, or two pages side by side, each editable. Change your colors with a page open next to them and watch it repaint.',
      },
    ],
  },
  {
    heading: 'Two hundred products. One page to design.',
    body: 'Nobody wants to maintain a page per product. Design one page for every product, category, collection, post or service, and each record gets its own address wearing that design. Add a product next week and its page already exists.',
    does: [
      {
        title: 'One design, every record',
        body: 'A template page shows one record at a time. There is nothing to copy and nothing to keep in step.',
      },
      {
        title: 'A different look for one kind',
        body: 'Give one kind of product its own design, and everything else keeps the usual one. Change your mind and the way back is the same menu.',
      },
      {
        title: 'Product lists that choose themselves',
        body: 'Point a product list at everything, your featured items, your newest, or one group. On a product page it can show others from the same group.',
      },
      {
        title: 'How each page looks in search',
        body: 'Its own title and description for results pages, or a switch to keep it out of search altogether.',
      },
      {
        title: 'A bare page when you need one',
        body: 'Drop the header and footer from a single page, for a promotion or a thank-you page with no menu to wander off through.',
      },
    ],
  },
  {
    heading: 'Forms that end up somewhere useful.',
    body: 'A contact form that quietly emails whoever set up the website years ago is not a contact form. Every form on your site has its own settings: what it is called, who hears about it, what the sender sees next, and whether they become somebody in Customers.',
    does: [
      {
        title: 'Called what it is',
        body: 'Name each form, so the inbox says “Quote request” rather than “the form on the home page”.',
      },
      {
        title: 'The right people told',
        body: 'Choose which addresses hear about each form. Visitors can never change where a submission goes.',
      },
      {
        title: 'A proper thank-you',
        body: 'Set the message shown after sending, and an automatic reply email with your own subject and words.',
      },
      {
        title: 'Straight into Customers',
        body: 'Add the sender to Customers, and open a job on your board for them if the form is how work arrives.',
      },
      {
        title: 'An inbox for all of it',
        body: 'New, read, handled and spam, filterable by form, and downloadable as a spreadsheet.',
      },
    ],
  },
  {
    heading: 'Did the page you built do anything?',
    body: 'Page results puts four answers side by side for every page: how many people came, what they bought after landing there, how it grades for search, and how long it took to load for real visitors. A number nobody measured says so, instead of showing up as zero.',
    does: [
      {
        title: 'Who came',
        body: 'Visitors and views for each page, for the site you are working on and no other.',
      },
      {
        title: 'What it earned',
        body: 'Orders and money from people who landed on the page, and the share of visitors who bought.',
      },
      {
        title: 'Its search grade',
        body: 'How the page scores for search, with the one thing to fix first.',
      },
      {
        title: 'How fast it really is',
        body: 'Load time measured in your visitors’ own browsers, not in a lab on a fast connection.',
      },
      {
        title: 'Templates added up',
        body: 'A product design’s figures cover every product that uses it, with how many of them anybody actually visited.',
      },
      {
        title: 'No visitors, no rate',
        body: 'A page nobody visited shows no rate at all, rather than a 0% that reads like failure.',
      },
    ],
  },
  {
    heading: 'Two businesses. One sign-in. No mix-ups.',
    body: 'Plenty of owners run more than one thing: a salon and a product line, a shop and a wholesale arm. Each site here is its own business to the people who visit it, with its own name, its own address and its own figures, while you manage all of them from one place.',
    does: [
      {
        title: 'Its own name and face',
        body: 'Name, tagline, a light and a dark logo, the little icon in the browser tab, and the social links in the footer, set per site.',
      },
      {
        title: 'Its own address',
        body: 'Each site can have its own domain, connected and secured the same way as the first.',
      },
      {
        title: 'Its own emails',
        body: 'Keep an email design to one site, so the salon’s booking confirmation never arrives wearing the shop’s logo.',
      },
      {
        title: 'A look you can reuse',
        body: 'Looks belong to your business rather than one site, so a second site can wear the first one’s or have its own. Rename, copy or delete them.',
      },
      {
        title: 'Starting points that keep improving',
        body: 'When the ready-made site you started from gets a newer version, see what would change and take it. Anything you changed yourself stays yours.',
      },
    ],
  },
];
