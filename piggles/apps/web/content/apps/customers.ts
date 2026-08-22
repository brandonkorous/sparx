import type { AppMarketing } from './types';

export const CUSTOMERS: AppMarketing = {
  heading: 'Everything you know about someone, in one history.',
  lede: 'Customers is the memory of your business. Who they are, what they have bought, what they asked last time, what you promised, and what is still open — so anybody who picks up the phone can pick up the thread.',
  alsoKnownAs: ['CRM', 'customer relationship management', 'contact management', 'helpdesk'],
  does: [
    {
      title: 'One record per person, not four',
      body: 'Their orders, bookings, invoices, emails, calls and notes on one page, in the order they happened.',
    },
    {
      title: 'The companies behind the people',
      body: 'Link contacts to the business they work for, so a firm with six people who order is one relationship rather than six.',
    },
    {
      title: 'Track work you are trying to win',
      body: 'Quotes and jobs on a board you can move along, with what it is worth and what happens next — instead of a spreadsheet nobody updates.',
    },
    {
      title: 'Questions and complaints, answered',
      body: 'Requests come in, get assigned to a person, and have a time they are expected to be answered by. Nothing quietly ages in an inbox.',
    },
    {
      title: 'Groups that keep themselves up to date',
      body: 'Everyone who bought a particular thing, or has not been in for six months. Defined once, always current, ready to write to.',
    },
    {
      title: 'One of them, not two',
      body: 'Find and merge duplicates properly — the history joins up instead of one copy being abandoned.',
    },
  ],
  chapters: [
    {
      heading: 'Work you have not won yet is still work.',
      body: 'The jobs you are quoting for are the most valuable records in the business and usually the worst kept — a quote in a sent-items folder, a promise made on a phone call, and a follow-up that depended on somebody remembering. Here they are records with a value, a stage and a next action, on a board you move things along.',
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
          body: 'Tasks attached to the person and the job, with a date — so a follow-up is a thing that exists rather than an intention.',
        },
        {
          title: 'Which ones are worth your morning',
          body: 'Scoring you set the rules for, so the list is ordered by likelihood rather than by whoever emailed most recently. It shows its working: you can see why a record scored what it did.',
        },
        {
          title: 'Won and lost, counted',
          body: 'What came in, what did not, and by whom — so a pattern is visible before it becomes a bad quarter.',
        },
      ],
    },
    {
      heading: 'When somebody has a problem, the clock is already running.',
      body: 'A complaint that ages in a shared inbox becomes a bad review. Requests here are records with an owner and a time they are expected to be answered by, so nothing depends on somebody noticing an unread email — and the whole history of that customer sits beside the request while you answer it.',
      does: [
        {
          title: 'Assigned to a person, not to everybody',
          body: 'A request with an owner gets answered. A request in a shared inbox belongs to nobody.',
        },
        {
          title: 'A time it should be answered by',
          body: 'Response targets you set, measured, and visible before they are missed rather than reported after.',
        },
        {
          title: 'Answer without starting cold',
          body: 'Their orders, invoices and previous conversations are on the same screen, so the reply knows what happened last time.',
        },
        {
          title: 'The sentences you write constantly',
          body: 'Saved paragraphs and email templates for the answers you give weekly, so the tenth one is as good as the first.',
        },
        {
          title: 'Calls and email on the record',
          body: 'Connect your mailbox and your phone system and the conversation lands on the customer automatically — not because somebody typed a note afterwards.',
        },
      ],
    },
    {
      heading: 'Your customers, in the shape your trade actually has.',
      body: 'Every business has records that no generic system has a name for — a vehicle, a property, a machine under contract, a member. Rather than making you bend that into "contact" and "note", you define what a thing is, what it has on it, and how it relates to a person, and it appears in the navigation beside everything else.',
      does: [
        {
          title: 'Records you invent',
          body: 'Your own kinds of record with your own fields. They get a place in the navigation, so what you invented is findable rather than buried in a settings screen.',
        },
        {
          title: 'Related to the right people',
          body: 'How your records connect — this vehicle belongs to this person, this contract covers this site — rather than everything hanging off one flat contact.',
        },
        {
          title: 'Groups that keep themselves current',
          body: 'Defined by a rule rather than a list, so "bought in the last 90 days" is true today without anyone rebuilding it.',
        },
        {
          title: 'Duplicates found and joined',
          body: 'The same person entered twice is found, and merging keeps both histories instead of abandoning one.',
        },
        {
          title: 'Your own questions answered',
          body: 'Build a report over any of it and pin the ones you check often to a dashboard.',
        },
        {
          title: 'Let people book you from here',
          body: 'Send a link that shows your real availability and puts the appointment straight on the record.',
        },
      ],
    },
  ],
  worksWith: ['messages', 'bookings', 'sell'],
  photo: {
    src: '/photos/coffee-shop.jpg',
    alt: 'Staff working behind the counter of a busy café',
  },
};
