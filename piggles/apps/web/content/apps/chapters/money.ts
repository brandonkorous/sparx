import type { AppChapter } from '../types';

// Money fronts fifteen screens across three questions (money coming in, money
// going out, did we make money) plus the handover to an accountant. The chapters
// follow those questions rather than the screens.
//
// VERIFIED 2026-09-30 against piggles/apps/workbench/surfaces/finance, the
// finance catalog in lib/surfaces/catalog/finance.ts, api-rest /v1/finance/*,
// @wizeworks/finance (expenses, recurring, accounting/export) and the labor
// deriver in @wizeworks/staff.
//
// DELIBERATELY ABSENT, because none of it is true for a Piggles customer today:
//   • QuickBooks Online and Xero. Both adapters exist, but connecting needs an
//     OAuth app registered with each vendor and no deploy target sets
//     SPARX_QBO_CLIENT_ID / SPARX_XERO_CLIENT_ID, so the product itself reports
//     them as not ready. Even where they are, the adapters post stock journals
//     only (from an api route no Piggles screen calls), never bills or expenses.
//   • Tax totals to file from. Tax rates live in Sell, and no screen here adds
//     up tax for a period.
//   • Card processing fees. The profit screen says itself that they are not
//     captured, so no claim here takes them off.
//   • Real bank deposits. Without the first-party gateway (hidden in Piggles),
//     a deposit is card takings grouped by the day they should land, so the copy
//     says "should" and never "reconciled".
//   • Margin by product or by category. The screens measure by job and takings
//     by channel, and say nothing about margin per product.

export const MONEY_CHAPTERS: AppChapter[] = [
  {
    heading: 'The half of the picture most software leaves out.',
    body: 'Almost every business system is good at what came in and vague about what went out, which is why the figure on the dashboard is always cheerful and the bank balance never agrees with it. Money records what you spent as deliberately as what you took (the bills, the standing costs, the people you pay) so the result is arithmetic rather than optimism.',
    does: [
      {
        title: 'What you spent, against what caused it',
        body: 'Costs recorded to a category and, where it matters, to the order or appointment they belong to, instead of a single line at the end of the month called "expenses".',
      },
      {
        title: 'Bills, before they are late',
        body: 'What you owe, to whom, and when it falls due, grouped by how late it is. A cost with no due date is listed as unpaid and never counted as late.',
      },
      {
        title: 'The costs that come round every month',
        body: 'Rent, insurance, subscriptions, the van. Set up once as a repeating cost, weekly through to yearly, and added on schedule. Changing the amount changes what comes next, never what already happened.',
      },
      {
        title: 'Wages without typing them twice',
        body: 'Once hours are approved in My Team, they arrive here as wages on their own, so the people you pay are in the picture without a second entry.',
      },
      {
        title: 'Who you pay',
        body: 'The other side of your customer list: the landlord, the contractor, the wholesaler, with what each has had from you. Archived rather than deleted, so last year’s records still say who was paid.',
      },
      {
        title: 'Categories that suit your trade',
        body: 'Your own headings, each marked as a cost of doing the work, wages, or the cost of being open. That choice decides which line of the profit figure it lands on, so the screen explains it before you pick.',
      },
    ],
  },
  {
    heading: 'Did that job make money, or just make noise?',
    body: 'Turnover is the number people quote and the least useful one. What matters is what was left after the goods, the fees and the costs of doing the work, and that is a question most businesses cannot answer without an evening and a spreadsheet. Because the sales, the cost of what you sold and the spending are all here already, it is a screen rather than an exercise.',
    does: [
      {
        title: 'Profit, with the costs actually taken off',
        body: 'What came in, less what the goods cost, the costs of the work, wages and running costs. One figure, in green when you kept money and in red when you lost it.',
      },
      {
        title: 'Against the period before',
        body: 'What came in and what you kept, each beside the same stretch of time just before it: this month against last month, this quarter against last quarter, this year against last year.',
      },
      {
        title: 'By job, worst first',
        body: 'Every order and appointment with what it made after its goods, its fees and the costs you charged to it. The losing ones sit at the top, before you quote the next one like it.',
      },
      {
        title: 'Where the money comes from',
        body: 'Takings split by where the sale happened, with what was sold, what was refunded and what is still unpaid side by side, so a place that sells a lot but is mostly unpaid shows up as exactly that.',
      },
      {
        title: 'What is owed and how old it is',
        body: 'Outstanding customer money by age, so chasing starts with the one that has been sitting longest rather than the one you happened to think of.',
      },
      {
        title: 'Every payment, including the ones that failed',
        body: 'Paid, failed, refunded and pending in one list, with the reason a card was declined and how much went back on a refund. Card takings are also grouped into the deposit they should arrive in, with the sales inside each one.',
      },
    ],
  },
  {
    heading: 'A number that tells you when it is guessing.',
    body: 'The most dangerous figure in a business is a confident one sitting on top of missing information. A profit screen that shows every job at 100% because nobody entered what the stock cost is worse than a blank one. Money checks what its numbers rest on and says so in plain words, right beside the number, so you know which figures to trust today and what to fill in to trust the rest.',
    does: [
      {
        title: 'Nothing is not zero',
        body: 'A period with no sales and no costs says there is nothing to measure yet, rather than telling you that you broke even.',
      },
      {
        title: 'Stock with no cost on it',
        body: 'If the things you sell have no cost recorded, the profit and job screens say the margins are not measured yet, instead of praising every job.',
      },
      {
        title: 'List price, marked as list price',
        body: 'An appointment records what the service is priced at, not what was actually collected. Those rows are labeled and counted separately, and orders show real money.',
      },
      {
        title: 'Costs left off a job',
        body: 'Spending not charged to any job is shown as its own figure, along with how much of it is parts, materials or subcontractors that probably belong to one.',
      },
      {
        title: 'What is left out, said out loud',
        body: 'Card processing fees are not included in these figures, and the screen says so beside the fees line rather than leaving you to find out.',
      },
      {
        title: 'Rebuilt when you ask',
        body: 'Figures are worked out overnight. Press Rebuild after a busy afternoon of changes and every number is recalculated from your orders and costs.',
      },
    ],
  },
  {
    heading: 'Recording a cost takes about as long as reading the receipt.',
    body: 'A spending record is only as good as the habit of keeping it, and the habit dies the first time it feels like paperwork. So the common case is three boxes at the top of the list: the amount, what it was for, and its category. Press Enter and you are ready for the next receipt. The full record, with dates, the job it belongs to and a photo of the paper, is one click away for the cost that needs it.',
    does: [
      {
        title: 'Three boxes, then the next one',
        body: 'Amount, what for, category. Saved on Enter, and the total at the top covers everything that matches your filter, not only the rows on screen.',
      },
      {
        title: 'The receipt, attached',
        body: 'Add a photo or a scan and it stays with the cost, so the paperwork is findable in April without a shoebox.',
      },
      {
        title: 'When it happened, and when it was paid',
        body: 'Two dates, kept apart. A January bill paid in March counts toward January’s profit and March’s cash, which is how your accountant will read it too.',
      },
      {
        title: 'Split across the work it was for',
        body: 'Share one parts bill across three jobs, or charge a cost to a customer or a product. What is left over is shown before you save, and stays as the cost of running the business.',
      },
      {
        title: 'Paid, in one click',
        body: 'Mark a bill paid straight from the list. A settled bill should not need opening, editing and saving on a Friday afternoon.',
      },
      {
        title: 'From your bank’s spreadsheet',
        body: 'Paste an export from your bank or your old system, match its columns, and see every row checked, with the total, before anything is saved. Import the same file twice and nothing is doubled.',
      },
    ],
  },
  {
    heading: 'Your accountant does not want a screenshot.',
    body: 'Piggles is not accounting software, and says so on the screen. Your books, your tax and your filings stay with your accountant. What Money does is hand them your spending in a file they can actually use, so the handover is a download rather than a year of retyping, and it keeps track of what has already gone to them.',
    does: [
      {
        title: 'A spreadsheet that is actually usable',
        body: 'Date, date paid, due date, who was paid, category, account, description, amount, tax, currency, how it was paid and reference. Every column labeled, one cost per row.',
      },
      {
        title: 'In their account codes',
        body: 'Type your accountant’s code against each of your categories once, and every file after that arrives ready to file. Leave one blank and it goes out under your own category name.',
      },
      {
        title: 'A closed month stays closed',
        body: 'Set the date your books are closed through, and nothing before it is ever sent again, however many times you export.',
      },
      {
        title: 'Sent, and marked as sent',
        body: 'Each cost is stamped when it goes out, so you can tell at a glance what your accountant already has and what they do not.',
      },
      {
        title: 'Before you email an empty file',
        body: 'Pick a period and you are told how many costs are in it, and a download with nothing in it says so plainly instead of reporting success.',
      },
    ],
  },
];
