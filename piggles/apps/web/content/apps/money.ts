import type { AppMarketing } from './types';

// NOTE what Money deliberately does not cover: what you pay WizeWorks. Platform
// billing lives on getpiggles.com and never in the operating console
// (piggles/CLAUDE.md, "The three surfaces"), so this page is about the money in
// the reader's business and never about ours.

export const MONEY: AppMarketing = {
  heading: 'What came in, what went out, what you kept.',
  lede: 'Money is the plain answer to how the business is doing. It reads what already happened — sales, refunds, costs, wages, payouts — and states the result without asking you to be an accountant to read it.',
  alsoKnownAs: ['financial reporting', 'bookkeeping', 'profit and loss', 'accounting'],
  does: [
    {
      title: 'Kept, not just taken',
      body: 'Revenue after refunds, discounts, fees and what the goods cost you — so the number on the screen is the one that matters.',
    },
    {
      title: 'What is actually profitable',
      body: 'Margin by product, by category and by channel. Sometimes the best seller is the worst earner, and this is where that shows up.',
    },
    {
      title: 'Where it went',
      body: 'Costs recorded against the thing that caused them, including freight and supplier charges, rather than a lump at the end of the month.',
    },
    {
      title: 'Money owed, both ways',
      body: 'What customers owe you and how old it is; what you owe suppliers and when it falls due.',
    },
    {
      title: 'Tax handled quietly',
      body: 'Rates by region, exemptions for the customers who have them, and a total you can file from.',
    },
    {
      title: 'Hand it to your accountant',
      body: 'Export in the formats real accounting software reads, or connect it directly, instead of retyping a year.',
    },
  ],
  chapters: [
    {
      heading: 'The half of the picture most software leaves out.',
      body: 'Almost every business system is good at what came in and vague about what went out, which is why the figure on the dashboard is always cheerful and the bank balance never agrees with it. Money records what you spent as deliberately as what you took — the bills, the standing costs, the people you pay — so the result is arithmetic rather than optimism.',
      does: [
        {
          title: 'What you spent, against what caused it',
          body: 'Costs recorded to a category and, where it matters, to the job they belong to — instead of a single line at the end of the month called "expenses".',
        },
        {
          title: 'Bills, before they are late',
          body: 'What you owe, to whom, and when it falls due. Ageing that tells you what is about to become a problem rather than what already is.',
        },
        {
          title: 'The costs that come round every month',
          body: 'Rent, insurance, subscriptions, the van. Recorded once as a repeating cost so they are in the picture without being retyped twelve times a year.',
        },
        {
          title: 'Who you pay',
          body: 'The other side of your customer list: the people and companies money goes to, with what they have had from you.',
        },
        {
          title: 'Categories that suit your trade',
          body: 'Your own headings, so the report reads like your business rather than like a generic chart of accounts.',
        },
      ],
    },
    {
      heading: 'Did that job make money, or just make noise?',
      body: 'Turnover is the number people quote and the least useful one. What matters is what was left after the parts, the hours and the fees — per job, per product, per channel — and that is a question most businesses cannot answer without an evening and a spreadsheet. Because the sales, the stock cost and the hours are all here already, it is a screen rather than an exercise.',
      does: [
        {
          title: 'Profit, with the costs actually taken off',
          body: 'What was sold, less refunds, discounts, payment fees and what the goods cost — stated as one figure you can act on.',
        },
        {
          title: 'By job',
          body: 'Parts, hours and charges against the work they were for, so the jobs quietly losing money are visible before you quote the next one like it.',
        },
        {
          title: 'Where the money comes from',
          body: 'Which channel, which site, which kind of customer. Useful mostly for finding the one that is a lot of effort for very little.',
        },
        {
          title: 'What is owed and how old it is',
          body: 'Outstanding customer money by age, so chasing starts with the one that has been sitting longest rather than the one you happened to think of.',
        },
        {
          title: 'Payments and payouts, reconciled',
          body: 'What was taken, what the provider actually deposited, and the fees in between — so the bank statement and the sales figure can be made to agree.',
        },
      ],
    },
    {
      heading: 'Your accountant does not want a screenshot.',
      body: 'At some point this has to leave Piggles and land wherever your books are kept. Connect one of the packages below and the journals, bills and expenses go across on their own; use anything else and you get a properly labelled spreadsheet rather than a print-out somebody has to retype. Both are real answers — which is the point, because the alternative is a year of retyping.',
      does: [
        {
          title: 'Connected, not exported',
          body: 'Sign in once and stock journals, bills and expenses go straight across, on their own, instead of being a monthly job somebody dreads.',
        },
        {
          title: 'A spreadsheet that is actually usable',
          body: 'Every column labelled, in the layout accounting software expects. It works with any package, and with an accountant who just wants the numbers.',
        },
        {
          title: 'Tax you can file from',
          body: 'Rates by region, exemptions held against the customers who have them, and totals for the period rather than a figure you assemble by hand.',
        },
      ],
      // Only the two with live adapters. The catalog carries several more marked
      // "coming soon" and none of them go here — see the accuracy rule on
      // `connects` in ./types.ts.
      connects: ['QuickBooks Online', 'Xero'],
    },
  ],
  worksWith: ['invoices', 'sell', 'stock'],
};
