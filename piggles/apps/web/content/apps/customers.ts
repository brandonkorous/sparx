import type { AppMarketing } from './types';
import { CUSTOMER_PROFILE_CHAPTER, CUSTOMER_REPORTS_CHAPTER } from './chapters/customers';

// Corrected 2026-09-30: "One record per person" said orders, bookings,
// invoices, emails, calls and notes sit on one page in the order they happened.
// They sit on one RECORD, each kind on its own tab; only notes, email and calls
// share a timeline. And "Answer without starting cold" said a request shows the
// customer's orders and invoices beside it; the request screen shows none of
// them, so that bullet now says what it does do (reply from the request). What
// was verified, and what was left out, is noted in ./chapters/customers.ts.

export const CUSTOMERS: AppMarketing = {
  heading: 'Everything you know about someone, in one history.',
  lede: 'Customers is the memory of your business. Who they are, what they have bought, what they asked last time, what you promised, and what is still open, so anybody who picks up the phone can pick up the thread.',
  alsoKnownAs: [
    'CRM',
    'customer relationship management',
    'contact management',
    'helpdesk',
    'sales pipeline',
  ],
  does: [
    {
      title: 'One record per person, not four',
      body: 'Their bookings, orders, invoices, emails, calls and notes on one record, a tab each, so nobody has to go looking in four places.',
    },
    {
      title: 'The companies behind the people',
      body: 'Link contacts to the business they work for, so a firm with six people who order is one relationship rather than six.',
    },
    {
      title: 'Track work you are trying to win',
      body: 'Quotes and jobs on a board you can move along, with what each is worth and what happens next, instead of a spreadsheet nobody updates.',
    },
    {
      title: 'Questions and complaints, answered',
      body: 'Requests come in, get assigned to a person, and have a time they are expected to be answered by. Nothing quietly ages in an inbox.',
    },
    {
      title: 'Groups that keep themselves up to date',
      body: 'Everyone who bought a particular thing, or has not bought anything for six months. Defined once, always current, ready to write to.',
    },
    {
      title: 'One of them, not two',
      body: 'Find and merge duplicates properly: the history joins up instead of one copy being abandoned.',
    },
  ],
  chapters: [
    CUSTOMER_PROFILE_CHAPTER,
    {
      heading: 'Work you have not won yet is still work.',
      body: 'The jobs you are quoting for are the most valuable records in the business and usually the worst kept: a quote in a sent-items folder, a promise made on a phone call, and a follow-up that depended on somebody remembering. Here they are records with a value, a stage and a next action, on a board you move things along.',
      does: [
        {
          title: 'A board you actually move',
          body: 'Stages you define, for how your work really goes. Drag a job along; what it is worth and when it is expected move with it.',
        },
        {
          title: 'More than one way of working',
          body: 'A separate board for a different kind of job, because winning a wholesale account and quoting a driveway are not the same process.',
        },
        {
          title: 'The next thing, on somebody',
          body: 'Tasks attached to the person and the job, with a date, so a follow-up is a thing that exists rather than an intention.',
        },
        {
          title: 'Which ones are worth your morning',
          body: 'Scoring you set the rules for, for customers and for jobs, so the list is ordered by likelihood rather than by whoever emailed most recently. While you write the rules you see what they make of a real customer.',
        },
        {
          title: 'Won and lost, counted',
          body: 'What came in, what did not, and by whom, so a pattern is visible before it becomes a bad quarter.',
        },
      ],
    },
    {
      heading: 'When somebody has a problem, the clock is already running.',
      body: 'A complaint that ages in a shared inbox becomes a bad review. Requests here are records with an owner and a time they are expected to be answered by, so nothing depends on somebody noticing an unread email, and the reply you send from the request lands on that customer’s record as well.',
      does: [
        {
          title: 'Assigned to a person, not to everybody',
          body: 'A request with an owner gets answered. A request in a shared inbox belongs to nobody.',
        },
        {
          title: 'A time it should be answered by',
          body: 'Targets for the first reply and for sorting it out, set by how urgent it is and counted in your opening hours, so a message at five in the afternoon is not late by morning.',
        },
        {
          title: 'Replied to from the request itself',
          body: 'Email them or log a call without leaving it. Start a request from a customer’s record and it is already linked, and replying is what marks it answered.',
        },
        {
          title: 'The sentences you write constantly',
          body: 'Saved paragraphs and email templates for the answers you give weekly, so the tenth one is as good as the first.',
        },
        {
          title: 'Email on the record without copying it',
          body: 'Connect your mailbox and messages from people already in your customers land on their record every few minutes, without anybody pasting them in.',
        },
        {
          title: 'Calls from their record',
          body: 'Connect a phone account and press Call: your own phone rings first, then it dials them, and who was called, when and for how long is kept on the record.',
        },
      ],
    },
    {
      heading: 'Your customers, in the shape your trade actually has.',
      body: 'Every business has records that no generic system has a name for: a vehicle, a property, a machine under contract, a member. Rather than making you bend that into "contact" and "note", you define what a thing is, what it has on it, and how it relates to a person, and it appears in the navigation beside everything else.',
      does: [
        {
          title: 'Records you invent',
          body: 'Your own kinds of record with your own fields. They get a place in the navigation, so what you invented is findable rather than buried in a settings screen.',
        },
        {
          title: 'Related to the right people',
          body: 'How your records connect (this vehicle belongs to this person, this contract covers this site) rather than everything hanging off one flat contact.',
        },
        {
          title: 'Groups that keep themselves current',
          body: 'Defined by a rule rather than a list, so "bought in the last 90 days" is true today without anyone rebuilding it. You see how many match while you write the rule.',
        },
        {
          title: 'Or a list you pick by hand',
          body: 'For the group no rule describes. Add and remove people one at a time, and see who came off it and when.',
        },
        {
          title: 'Duplicates found and joined',
          body: 'The same person entered twice is found, and merging keeps both histories instead of abandoning one. You decide what counts as the same person, and nothing is merged without somebody looking unless you switch that on.',
        },
        {
          title: 'Let people book you from here',
          body: 'Send a link that shows your real availability and puts the appointment straight on the record.',
        },
      ],
    },
    CUSTOMER_REPORTS_CHAPTER,
  ],
  worksWith: ['messages', 'bookings', 'sell'],
  photo: {
    src: '/photos/coffee-shop.jpg',
    alt: 'Staff working behind the counter of a busy café',
  },
};
