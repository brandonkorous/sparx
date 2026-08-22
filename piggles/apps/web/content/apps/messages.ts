import type { AppMarketing } from './types';

// Messages fronts two modules — email and live chat — and the six bullets were
// all email. "live chat" sat in `alsoKnownAs` with nothing on the page backing
// it up, which is the worst of both: the word is there for search, and a visitor
// who came looking for it found no evidence it exists.

export const MESSAGES: AppMarketing = {
  heading: 'Talk to your customers without leaving what you were doing.',
  lede: 'Messages is email and conversation that already knows who it is talking to. Send the one-off reply, the order confirmation and the monthly note to everybody, answer the person typing on your website right now — all from the same place, with the whole history of that person beside it.',
  alsoKnownAs: ['email marketing', 'transactional email', 'newsletter', 'live chat', 'inbox'],
  does: [
    {
      title: 'Write from your own address',
      body: 'Verify your domain and send as you@yourbusiness — not as a platform with your name in brackets. Setup is guided and checked.',
    },
    {
      title: 'The automatic ones, handled',
      body: 'Order confirmations, booking reminders, invoice notices and password resets go out reliably, worded like you rather than like a receipt printer.',
    },
    {
      title: 'Write to everybody, or to the right ones',
      body: 'Send to a group that keeps itself current — recent customers, people who booked once, the wholesale list.',
    },
    {
      title: 'Did it arrive, and did they read it',
      body: 'Delivery, opens, clicks, bounces and unsubscribes, per send, so the next one can be better.',
    },
    {
      title: 'Unsubscribes respected properly',
      body: 'Someone who opts out stops receiving marketing everywhere, permanently, without you maintaining a list of exceptions.',
    },
    {
      title: 'Every conversation on the record',
      body: 'What you sent and what they said back is on their record, so the next person to deal with them is not starting cold.',
    },
  ],
  chapters: [
    {
      heading: 'Somebody is on your website right now with a question.',
      body: 'Most of them will not ring, and most of them will not fill in a form. They will look for a chat bubble, not find one, and go somewhere else. Live chat puts the conversation on the site, in the same place as everything else you know about them — and when nobody is there to answer, it takes the question rather than pretending the shop is open.',
      does: [
        {
          title: 'One queue, every conversation',
          body: 'Newest first, with who they are and the last thing they said. Open one and it docks beside the queue rather than replacing it.',
        },
        {
          title: 'It knows who they are',
          body: 'If they are a customer, their orders, bookings and past messages are right there. You are answering a person, not a session id.',
        },
        {
          title: 'The answers you give every day',
          body: 'Quick replies for the questions that come up constantly — opening hours, delivery times, whether you do that — inserted rather than retyped.',
        },
        {
          title: 'Per site, not all mixed together',
          body: 'If you run two businesses, the queue you open is the one you are working in. Widen it deliberately when you want everything.',
        },
        {
          title: 'Closed is honest',
          body: 'Outside your hours it takes the message instead of leaving somebody typing into a room with nobody in it.',
        },
        {
          title: 'How busy it actually is',
          body: 'Volume over time and what people are asking about — which is usually the fastest way to find the thing your website does not explain.',
        },
      ],
    },
    {
      heading: 'The follow-up that happens whether or not you remember.',
      body: 'A broadcast goes to everybody at once. A sequence is the more useful thing and the one almost nobody sets up: a few emails spaced over days or weeks, started by something that actually happened, and stopped the moment it is no longer appropriate. The welcome, the check-in a fortnight after a first order, the nudge to a quote that has gone quiet.',
      does: [
        {
          title: 'Started by something real',
          body: 'A first order, a booking, joining a group, a quote sent. Not a list somebody has to remember to add people to.',
        },
        {
          title: 'Spaced how you want it',
          body: 'Wait days or weeks between messages, so a follow-up lands when it is useful rather than an hour later.',
        },
        {
          title: 'Stops when it should',
          body: 'Somebody who replies, buys, or books is out of the sequence. Nothing is more damaging than chasing a person for something they already did.',
        },
        {
          title: 'See who is in one',
          body: 'Who is part-way through, at which step, and what they have had — so a sequence is inspectable rather than a thing running in the dark.',
        },
        {
          title: 'It arrives, because the setup was checked',
          body: 'Your sending domain is verified with the records that decide whether mail lands in an inbox or a spam folder, and the setup tells you which are still missing.',
        },
      ],
    },
  ],
  worksWith: ['customers', 'get_found', 'sell'],
};
