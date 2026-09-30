import type { TradePage } from './types';
import { STUDIO_DETAIL } from './detail/studio';

export const STUDIO: TradePage = {
  slug: 'studio',
  pose: 'art-studio',
  group: 'people',
  name: 'A studio',
  plural: 'Studios',
  shape:
    'The work has to be seen before it can be sold, so writing about it is not marketing, it is the job. Being findable is what turns a portfolio into an income.',
  leans: ['content', 'get_found', 'site'],
  ...STUDIO_DETAIL,
  heading: 'Make the work easy to find, and easy to buy.',
  lede: 'Piggles keeps your portfolio, your writing and your posts in one place, puts them in front of people searching for what you make, and handles the sale or the commission when somebody is ready.',
  searchTerms: [
    'artist website builder',
    'portfolio website for artists',
    'sell art prints online',
    'photography studio software',
    'ceramics studio website',
    'social media scheduler for artists',
  ],
  problems: [
    {
      title: 'The portfolio site is two years out of date.',
      body: 'A friend built it, or it came from a template you cannot change without breaking. Your newest work lives only on Instagram, and the site people land on from a search shows the series you stopped making.',
    },
    {
      title: 'Posting everywhere became a second job, so you stopped.',
      body: 'The same photo resized four times, a caption trimmed for each network, then nothing for a month because the week filled up. The work did not get worse. It just stopped being seen.',
    },
    {
      title: 'People who know your name find you. Nobody else does.',
      body: 'Somebody searching for hand-thrown mugs, or a portrait photographer in your town, never sees you. Whether they do comes down to small, dull details on every page that nobody told you about.',
    },
    {
      title: 'A portfolio site, a shop plugin and a notes file of commissions.',
      body: 'That was the fix. One service for the gallery, another for selling prints, a scheduler for posts and a document listing who asked about a commission. Four bills, and still no single place that says what is for sale and who is waiting on you.',
    },
  ],
  turn: 'When the pictures, the words and the site live in one place, telling people about the work becomes something that happens while you do it, instead of a chore you get to on a Sunday.',
  week: [
    {
      when: 'Monday, 10am',
      body: 'Photograph the new series and add each piece in Content, as an entry with the fields you chose: medium, size, year, available or sold. The images go into one library and are resized for wherever they appear.',
      app: 'content',
    },
    {
      when: 'Monday, 2pm',
      body: 'Drag a gallery section onto a new page in My Site and the series fills it. The preview is the real page, so what you see is what a visitor gets. Publish in one click, and the previous version is kept if you change your mind.',
      app: 'site',
    },
    {
      when: 'Tuesday, 9am',
      body: 'Get Found flags that the new page has no description and explains in a sentence what to write. Then one post about the series goes to Instagram, Facebook and the rest, cropped to each network’s shape and scheduled for your standing Tuesday slot.',
      app: 'get_found',
    },
    {
      when: 'Wednesday, 3pm',
      body: 'Prints of the best piece go on sale in three sizes as options on one product, alongside the original. Sell the last original at an open studio and your site stops offering it, because both work from the same stock number.',
      app: 'sell',
    },
    {
      when: 'Thursday, 11am',
      body: 'A collector asks about a commission. It goes on your board with its value and a stage, on her record, with a task and a date for your follow-up, so it stops depending on you remembering.',
      app: 'customers',
    },
    {
      when: 'Friday, 4pm',
      body: 'She accepts the quote. It turns into an invoice without retyping, and you send her a link to pay the first part. Paid through Stripe, the payment records itself against the right invoice.',
      app: 'invoices',
    },
    {
      when: 'Sunday, 6pm',
      body: 'A short monthly note from your own address to everyone who has bought from you, with the new series and where it is showing. Messages shows who opened it and what they clicked.',
      app: 'messages',
    },
  ],
  firstHour: [
    'Start from a ready-made site and swap in your own images and words.',
    'Upload the twenty pieces you would most like a stranger to see first.',
    'Connect Instagram and the other networks you already post on.',
    'Stay on the free Piggles web address, or point your own domain at it. The security certificate is handled for you.',
    'Connect Google Search Console, so you can see what people actually searched to reach you.',
  ],
  questions: [
    {
      q: 'I only sell a few pieces a month. Is $99 a month worth it?',
      a: 'It is $99 a month, flat, and that covers every app: your website, your writing and images, posting to social networks, selling, invoices and email. If you are paying separately for a portfolio site, a shop and a post scheduler, add them up. You can try it for 14 days without a card and decide on your own numbers.',
    },
    {
      q: 'I already have a following on Instagram. Why do I need a website?',
      a: 'The website is the one place you own, where a search can find you and a sale can happen. Posts point back to it, and comments and messages from Facebook, Instagram, LinkedIn and your Google Business listing come back to one inbox, beside that person’s orders and emails.',
    },
    {
      q: 'Can I sell originals and prints in different sizes?',
      a: 'Yes. A product can have sizes and options, so one print is one listing with three sizes, and an original can sit beside it. Orders from your site and sales at an open studio arrive in the same list.',
    },
    {
      q: 'Will my images look right everywhere?',
      a: 'Images are kept in one library and resized for wherever they appear on your site. When you post, the same picture is cropped to the proportions each network wants, and you can control which picture shows when your page is shared in a message.',
    },
    {
      q: 'Can I change the site myself later?',
      a: 'Yes, and that is the point. You edit by dragging real sections into place, see the actual page as you work, and every publish is a version you can roll back to.',
    },
    {
      q: 'Can I get my records out again?',
      a: 'Your customers, products, orders, invoices, articles and form replies each download as a spreadsheet from the list they live on, and a key lets your own tools reach only what you allow. Your domain is one you register and own, so it goes wherever you point it.',
    },
  ],
};
