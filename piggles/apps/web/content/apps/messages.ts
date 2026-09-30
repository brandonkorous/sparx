import type { AppMarketing } from './types';
import { MESSAGES_CHAPTERS } from './chapters/messages';

// Messages fronts two modules, email and live chat, and the six bullets were
// all email. "live chat" sat in `alsoKnownAs` with nothing on the page backing
// it up, which is the worst of both: the word is there for search, and a visitor
// who came looking for it found no evidence it exists.
//
// Bullets corrected 2026-09-30 (see chapters/messages.ts for what was checked):
// password resets are Piggles account email, not something a business sends its
// customers; saved groups have no booking fields, so "people who booked once"
// was not a group anybody could build; and a customer record shows the emails
// they opened and clicked, not "what they said back".

export const MESSAGES: AppMarketing = {
  heading: 'Talk to your customers without leaving what you were doing.',
  lede: 'Messages is email and live chat that already know who they are talking to. The order confirmation, the monthly note to everybody, the follow-up that goes out on its own, and the person typing on your website right now, all from one place, with what you know about each person beside it.',
  alsoKnownAs: ['email marketing', 'transactional email', 'newsletter', 'live chat', 'inbox'],
  does: [
    {
      title: 'Write from your own address',
      body: 'Verify a domain you own and send as hello@yourbusiness, not from a shared address with your name in brackets. Setup is guided and checked.',
    },
    {
      title: 'The automatic ones, handled',
      body: 'Order, shipping and booking confirmations, booking reminders, invoice reminders and receipts come ready-made as email designs you can reword to sound like you.',
    },
    {
      title: 'Write to everybody, or to the right ones',
      body: 'Send to a saved group: customers who have not ordered in three months, your biggest spenders, your wholesale accounts, or a list you picked by hand.',
    },
    {
      title: 'Did it arrive, and did they read it',
      body: 'Delivered, opened, clicked, bounced, unsubscribed and marked as spam, for every send, so the next one can be better.',
    },
    {
      title: 'Unsubscribes respected properly',
      body: 'Someone who opts out goes on one Do not email list, and marketing stops reaching them from broadcasts and sequences alike, without you keeping a list of exceptions.',
    },
    {
      title: 'Every conversation beside the person',
      body: 'The emails a customer opened and clicked show on their record, and a live chat shows their orders right beside it, so the next person to deal with them is not starting cold.',
    },
  ],
  chapters: MESSAGES_CHAPTERS,
  worksWith: ['customers', 'get_found', 'sell'],
};
