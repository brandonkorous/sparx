import type { AppChapter } from '../types';

// Messages fronts two platform modules, email and live chat, and the chapters
// follow what a person does with it: answer the website, let an assistant take
// the easy ones, write to a group, follow up over time, and make sure it lands.
//
// VERIFIED 2026-09-30 against piggles/apps/workbench/surfaces/chat (inbox,
// thread, settings, quick-replies, overview), api-rest lib/chat/ai-handler.ts
// (answers from the catalog and published pages with read-only lookups, never
// books or buys, hands over below its confidence bar), surfaces/email
// (broadcasts, sequences, sending addresses, Do not email, email settings) and
// sequence-words.ts. DELIBERATELY ABSENT: any booking-based group (the saved
// group rules have no booking fields), a sequence that stops on a reply or a
// booking (only "stop once they buy" exists), topic analysis of what people ask
// in chat (the report counts, it does not read), and a chat that takes a message
// while you are away (outside hours the visitor sees the away message instead of
// a reply box).

export const MESSAGES_CHAPTERS: AppChapter[] = [
  {
    heading: 'Somebody is on your website right now with a question.',
    body: 'Most of them will not ring, and most of them will not fill in a form. They will look for a chat box, not find one, and go somewhere else. Live chat puts one in the corner of every page, with your own greeting, and lands each conversation beside what you already know about that person. When you are not around, it says so plainly.',
    does: [
      {
        title: 'One queue, every conversation',
        body: 'Newest first, with who they are and the last thing they said. Open one and it sits beside the queue rather than replacing it, so the next person is still in view.',
      },
      {
        title: 'Only the ones that are yours',
        body: 'Show open, waiting, resolved or spam, or just the chats assigned to you. Hand a chat to a teammate, or take it yourself in one tap.',
      },
      {
        title: 'It knows who they are',
        body: 'If they have bought from you before, the chat shows how many orders they have placed, when they last ordered and their most recent orders, each one a tap away.',
      },
      {
        title: 'A name before a question',
        body: 'Choose whether visitors give their name and email before the chat starts, so you can still follow up if they leave before you reply.',
      },
      {
        title: 'The answers you give every day',
        body: 'Save the replies that come up constantly (opening hours, delivery times, whether you do that) and drop them in with a short word instead of typing them out again.',
      },
      {
        title: 'Done, or not a real customer',
        body: 'Mark a chat resolved once it is dealt with, reopen it if they come back, or move it to spam, which switches its reply box off.',
      },
      {
        title: 'Per site, not all mixed together',
        body: 'If you run two businesses, the queue you open is the one you are working in. Widen it to every site when you want everything.',
      },
      {
        title: 'Closed is honest',
        body: 'Set the days and hours you answer. Outside them, visitors see your away message instead of a reply box, and the screen warns you if your hours would leave the chat closed all week.',
      },
      {
        title: 'How busy it actually is',
        body: 'Conversations started and resolved over the last 30 days, how many are open now, how fast the first reply goes out, and who has been doing the answering.',
      },
    ],
  },
  {
    heading: 'An assistant that answers first, on your own AI account.',
    body: 'Plenty of chat questions already have an answer on your website: is it in stock, what does it cost, when are you open. Switch on the AI first responder and those get answered straight away, from your own products and published pages. It runs only on an AI account you connect and pay for yourself, and anything it is unsure about goes to a person.',
    does: [
      {
        title: 'Answers from what you actually sell',
        body: 'Before it replies it can look up your products, what is in stock, your prices and your business details, rather than guessing.',
      },
      {
        title: 'Hands over when it is not sure',
        body: 'When it is not confident, it tells the visitor your team will follow up and passes the chat to you, and your team is alerted.',
      },
      {
        title: 'Looks things up, never acts',
        body: 'It cannot place an order or book an appointment on anybody’s behalf. It answers, and the doing stays with the customer and with you.',
      },
      {
        title: 'Off until it can work',
        body: 'It stays off until a working key from Anthropic or OpenAI is connected, checked and stored encrypted. With no key, every chat simply goes to your team.',
      },
      {
        title: 'A personality you write',
        body: 'It follows the chat personality you switch on: how it should sound, what it should say, and what it should never say.',
      },
      {
        title: 'See what it handled',
        body: 'The chat report shows how many resolved conversations the assistant closed on its own and how many your team did.',
      },
    ],
    connects: ['Anthropic', 'OpenAI'],
  },
  {
    heading: 'One email, to the people who should get it.',
    body: 'The monthly note, the new season, the thing you only do twice a year. A broadcast is one email sent to a saved group of your customers, and everything about it is checked before it goes: who it reaches, what it looks like in their inbox, and whether anything is missing.',
    does: [
      {
        title: 'A group you define once',
        body: 'Send to a saved group, built from a rule such as customers who have not ordered in 90 days, or picked by hand. The screen says roughly how many it will reach, and anyone who unsubscribed is left out.',
      },
      {
        title: 'Greets each person by name',
        body: 'Put a greeting in the subject and everyone sees their own name, or “there” if you do not have it, so the line always reads properly.',
      },
      {
        title: 'Seen the way they will see it',
        body: 'Preview the finished email as one real person from the group will get it, from the address it will come from.',
      },
      {
        title: 'Now, or at a time you pick',
        body: 'Send the moment you press Send, or schedule it for a date and time in your own time zone.',
      },
      {
        title: 'Nothing half-finished goes out',
        body: 'Until it has a subject, a finished email, a group with people in it and your mailing address, the screen lists what is still missing instead of sending.',
      },
      {
        title: 'How it did',
        body: 'Delivered, opened, clicked, bounced, unsubscribed and marked as spam, with opens and clicks shown as a share of what actually arrived.',
      },
    ],
  },
  {
    heading: 'The follow-up that happens whether or not you remember.',
    body: 'A broadcast goes to everybody at once. A sequence is the more useful thing and the one almost nobody sets up: a few emails spaced over days or weeks, each person getting them on their own clock from the moment they are added. The welcome, the check-in two weeks after a first order, the nudge to a customer who has gone quiet.',
    does: [
      {
        title: 'Started by something real',
        body: 'An automation adds people when something happens, such as a paid order, a new booking or a form filled in on your site. You can also add someone by hand.',
      },
      {
        title: 'It tells you when nothing feeds it',
        body: 'A sequence switched on with nothing adding people to it is flagged, and one button builds the automation that would.',
      },
      {
        title: 'Spaced how you want it',
        body: 'Wait days, hours or minutes before each email, so a follow-up lands when it is useful. The first can go the moment someone is added.',
      },
      {
        title: 'Stops once they buy',
        body: 'Switch on one setting and anyone who places an order partway through gets none of the remaining emails. An automation can take someone out too.',
      },
      {
        title: 'Once, or every time',
        body: 'Choose whether a person only ever goes through it once or can go through it again later. Either way, nobody is in it twice at the same time.',
      },
      {
        title: 'The right kind of email',
        body: 'Mark each email as marketing or as something they are expecting, like a receipt. Marketing emails skip anyone on your Do not email list.',
      },
      {
        title: 'See who is in one',
        body: 'Who is partway through, who finished, who left early and who was taken out, rather than a thing running in the dark.',
      },
      {
        title: 'One business, or all of them',
        body: 'Set a sequence to one of your sites and it only ever emails that site’s customers.',
      },
    ],
  },
  {
    heading: 'Mail that arrives, and arrives from you.',
    body: 'Email from a shared address with your name on it looks like what it is. Messages lets you send from an address at your own domain, walks you through proving you own it, and shows you, word for word, what your customers will see in their inbox before any of it goes out.',
    does: [
      {
        title: 'Your own sending address',
        body: 'Add a domain you own, often a second one such as mail.yourbusiness.com so your website is left alone, and get a short list of records to add wherever you bought it.',
      },
      {
        title: 'Checked, not assumed',
        body: 'Press Check now and the address shows as verified, still checking, or records not found. Only a verified address can be chosen to send through.',
      },
      {
        title: 'Replies go where you want',
        body: 'Set the name shown in the inbox, the address it comes from, and a separate address for replies, then see the exact sender line your customers will get.',
      },
      {
        title: 'The address the law asks for',
        body: 'Every email to a list carries your mailing address and an unsubscribe link at the foot. If your site already shows an address, one tap copies it across.',
      },
      {
        title: 'Who you must not email, and why',
        body: 'Everyone who unsubscribed, marked you as spam or has an address that stopped working is listed with the reason, and you can add someone yourself.',
      },
    ],
  },
];
