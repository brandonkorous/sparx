import type { TradePage } from './types';
import { POTTER_DETAIL } from './detail/potter';

export const POTTER: TradePage = {
  slug: 'potter',
  pose: 'potter',
  group: 'run',
  name: 'A potter',
  plural: 'Potters',
  shape:
    'Everything is made once, photographed once and sold once. The website is the shop, and the hard part is that a piece has to come off it the moment it goes.',
  leans: ['site', 'sell', 'stock'],
  ...POTTER_DETAIL,
  heading: 'Every piece is one of a kind. Your shop should know that.',
  lede: 'Piggles runs your website, your craft fair sales and your shop-update announcements from one catalog, so when a mug sells at the fair, your site is already working from the same zero. It is $99 a month with every app included.',
  searchTerms: [
    'website for potters',
    'pottery shop website',
    'sell ceramics online',
    'ceramics artist website builder',
    'move my pottery shop from Etsy to my own website',
    'handmade shop software',
    'pottery business software',
  ],
  problems: [
    {
      title: 'The same bowl sold twice',
      body: 'It sold at the Saturday fair at eleven and on your site at twenty past, because nobody was free to take it down. Now you are writing an apology and a refund for a piece that took three weeks and two firings to make.',
    },
    {
      title: 'Shop update night is really data entry night',
      body: 'Every piece gets photographed, then typed in three times: once for the website, once for the fair price list, once for the spreadsheet you use to know what is left.',
    },
    {
      title: 'Commissions live somewhere in your inbox',
      body: 'Somebody wants a dinner set in the blue glaze. The price, the deposit and the promised date are spread across six emails, and you are no longer sure which version you agreed to.',
    },
    {
      title: 'Nobody hears the shop update happened',
      body: 'You post on Instagram, forget Facebook, and never get around to the email list. The pieces sit there while the people who would buy them are never told.',
    },
  ],
  turn: 'A piece is one record, and every place you sell it reads from that record.',
  week: [
    {
      when: 'Monday, 10am',
      body: 'The kiln is unloaded. Each piece goes in once, with its photos, a price and a count of one. Stock keeps a single number for what is available, and every place you sell is working from it.',
      app: 'stock',
    },
    {
      when: 'Tuesday, 8pm',
      body: 'You drop the new batch into a gallery section on your site. The preview is the actual page, so what you see is what visitors get, and when it is ready you publish it with one click.',
      app: 'site',
    },
    {
      when: 'Wednesday, 7pm',
      body: 'One post announcing Friday’s update goes to Instagram and Facebook, with the photo cropped to the shape each one wants, scheduled for Friday at 7pm.',
      app: 'get_found',
    },
    {
      when: 'Thursday, 6pm',
      body: 'An email goes to everybody who has bought from you before, from your own address, saying the update opens tomorrow at seven. The list keeps itself current, so last month’s new buyers are already on it.',
      app: 'messages',
    },
    {
      when: 'Friday, 7:04pm',
      body: 'The update opens and the orders arrive in one list. The speckled vase sells in four minutes, its count drops to zero, and your site stops offering it before anybody else can pay for it.',
      app: 'sell',
    },
    {
      when: 'Saturday, 11am',
      body: 'A commission request comes in for that dinner set. It goes on your board as a job with a value and a next step, so the follow-up exists as more than a good intention.',
      app: 'customers',
    },
    {
      when: 'Sunday, 4pm',
      body: 'You send the quote for the dinner set. When they accept it, it becomes an invoice without retyping a line, and you send a link to pay the deposit. Part payments are recorded, so the deposit and the balance are both on the record.',
      app: 'invoices',
    },
  ],
  firstHour: [
    'Pick a ready-made site and swap in your own photos, your story and your studio details. Publish on the free Piggles address, and point your own domain at it whenever you are ready.',
    'Add the pieces you have now, each with a count of one. If you keep a spreadsheet of them, bring it in and see a preview before anything is written.',
    'Connect the payment provider you already use, so money from every sale goes straight to your own account.',
    'Set shipping rates by weight or zone, so a heavy platter does not ship for the price of a mug.',
    'If you have an Etsy shop, download its listings file and drop it into Move in, so your pieces arrive with their photos and options instead of being typed in again.',
  ],
  questions: [
    {
      q: 'How much does Piggles cost for a pottery studio?',
      a: '$99 a month, flat, with all sixteen apps included: the website, selling, shipping rates, email, social posting and the rest. That covers one business, one location, one main website and three people with their own sign-in. Products and orders are unlimited. Try it free for 14 days, no card needed.',
    },
    {
      q: 'Do I need to know how to build a website?',
      a: 'No. You start from a finished site with real pages and arrange ready-made sections (headers, galleries, product grids, contact forms) and fill them in. The preview is the actual page, you publish with one click, and every publish is saved as a version you can roll back to.',
    },
    {
      q: 'Can I keep selling on Etsy?',
      a: 'Yes, you can keep your Etsy shop. Piggles does not connect to Etsy today, so Etsy orders and the stock you list there are handled on Etsy itself. Your own website, your fair sales and your invoices run from Piggles, from one stock number. If you want your Etsy listings on your own site too, drop Etsy’s listings file into Move in and they arrive as products with their photos.',
    },
    {
      q: 'What about shipping heavy, fragile pieces?',
      a: 'Shipping rates can be set by zone, weight or basket value, with different rules for the things that need them. A set of four plates and a single mug do not have to cost the same to send.',
    },
    {
      q: 'I also sell at craft fairs. Does that fit?',
      a: 'Yes. Sell covers over-the-counter sales as well as online ones, from the same catalog and into the same order list, so a piece sold at a fair on Saturday is not still showing as available on your site on Sunday.',
    },
    {
      q: 'What if I start selling wholesale to shops?',
      a: 'It is already there. Shops can have their own price list, order on account and pay on terms, all on the same catalog as your retail pieces. If you need more room as you grow (more people, more storage, more email going out) you add it in one tap and remove it the same way.',
    },
  ],
};
