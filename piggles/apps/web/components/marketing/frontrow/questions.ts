import { APP_COUNT_WORD } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';

// The questions somebody asks a minute after seeing a shirt on TV. Every answer
// must be true of the product today: no claim here that the account app cannot keep.

export const FRONTROW_QUESTIONS = [
  {
    q: 'What is Piggles, exactly?',
    a: `Software for running a small business, in one place: your website, selling, bookings, invoices, customers, email, stock and your numbers. It is ${APP_COUNT_WORD} apps that share one set of customers, products and orders, so you type things once instead of three times.`,
  },
  {
    q: 'Who is it for?',
    a: 'Anybody with a business to run: a salon, a bakery, a repair shop, a maker selling online, a consultant sending invoices. You do not need to be technical. If you can use email, you can use Piggles.',
  },
  {
    q: 'Do I need a card to try it?',
    a: 'No. The trial is fourteen days with no card. If you decide not to carry on, nothing is charged.',
  },
  {
    q: 'What does it cost after the trial?',
    a: `${PRICE_LABEL} a month, with every app included. There are no tiers and no app that costs extra. The price only changes if your business needs more room, like more people on the team.`,
  },
  {
    q: 'Can I bring what I already have?',
    a: 'Yes. Your customers, products and orders come across from the software you use now, or from a spreadsheet, and nothing changes on the old one. When you are ready, point your web address at Piggles.',
  },
];
