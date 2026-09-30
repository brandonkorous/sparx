import type { AppMarketing } from './types';
import { INVOICES_CHAPTERS } from './chapters/invoices';

export const INVOICES: AppMarketing = {
  heading: 'Send the bill. Find out who has paid.',
  lede: 'Invoices produces the document, sends it, records the payment and tells you who is late, for a single job, a monthly account or a quote that turned into work.',
  alsoKnownAs: ['invoicing', 'billing', 'accounts receivable', 'quotes and estimates'],
  does: [
    {
      title: 'Documents that look like your business',
      body: 'Your logo, your terms, your wording. Quotes, estimates, invoices and receipts from one set of templates.',
    },
    {
      title: 'Quote first, invoice after',
      body: 'Turn an accepted quote into an invoice without retyping any of it, and keep the link between the two.',
    },
    {
      title: 'Take payment from the document',
      body: 'Send a link to pay whatever is still owed. Paid through Stripe, the payment records itself against the right invoice.',
    },
    {
      title: 'Chasing, without the awkward part',
      body: 'See what is overdue and by how long, and send a reminder that is firm and polite without you writing it each time.',
    },
    {
      title: 'Part payments and agreed terms',
      body: 'Record money as it arrives and see what is left. Customers on agreed terms get a due date counted from the day they receive the bill.',
    },
    {
      title: 'Signed where it needs to be',
      body: 'Send a document for signature and keep the signed copy attached to the record.',
    },
  ],
  chapters: INVOICES_CHAPTERS,
  worksWith: ['money', 'customers', 'sell'],
};
