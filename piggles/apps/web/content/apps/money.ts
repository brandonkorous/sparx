import type { AppMarketing } from './types';
import { MONEY_CHAPTERS } from './chapters/money';

// NOTE what Money deliberately does not cover: what you pay WizeWorks. Platform
// billing lives on getpiggles.com and never in the operating console
// (piggles/CLAUDE.md, "The three surfaces"), so this page is about the money in
// the reader's business and never about ours.
//
// Four `does` bullets were corrected on 2026-09-30 (see chapters/money.ts for
// what was verified): margin by product and category is not measured anywhere,
// tax totals live in Sell rather than here, freight is Partners' business, and
// "connect it directly" named an accounting connection no Piggles customer can
// switch on today.

export const MONEY: AppMarketing = {
  heading: 'What came in, what went out, what you kept.',
  lede: 'Money is the plain answer to how the business is doing. It reads what already happened (sales, refunds, costs, wages) and states the result without asking you to be an accountant to read it.',
  alsoKnownAs: [
    'financial reporting',
    'bookkeeping',
    'profit and loss',
    'expense tracking',
    'job costing',
    'accounting',
  ],
  does: [
    {
      title: 'Kept, not just taken',
      body: 'What came in, less refunds, what the goods cost you, wages and running costs, so the number on the screen is the one you keep.',
    },
    {
      title: 'Which jobs made money',
      body: 'Every order and appointment with what it made after its goods, fees and costs. Worst first, because those are the ones you can still do something about.',
    },
    {
      title: 'Where it went',
      body: 'Every cost under a category you named, and split across the orders or appointments it was for, rather than a lump at the end of the month.',
    },
    {
      title: 'Money owed, both ways',
      body: 'What customers owe you and how late it is; what you owe and when it falls due. Both read the same way, so one habit covers both.',
    },
    {
      title: 'Costs that repeat, recorded once',
      body: 'Rent, insurance and subscriptions set up once, weekly through to yearly, and added to your spending on schedule without being retyped.',
    },
    {
      title: 'Hand it to your accountant',
      body: 'A spreadsheet of your spending with every column labeled and their account codes on each line, instead of retyping a year.',
    },
  ],
  chapters: MONEY_CHAPTERS,
  worksWith: ['invoices', 'sell', 'stock', 'team'],
};
