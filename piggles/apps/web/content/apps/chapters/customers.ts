import type { AppChapter } from '../types';

// Customers fronts the platform's customer module: 22 listed screens across
// people, winning work, support, setting up and reporting. The chapters follow
// what a person is trying to do with the record, not the nav.
//
// VERIFIED 2026-09-30 against piggles/apps/workbench/surfaces/crm (customer
// profile and its tabs, companies, segments and hand-picked lists, duplicates
// and the matching settings, deals, scoring, requests and response times,
// templates, saved paragraphs, mailboxes, phone systems, record types, reports,
// the report builder and dashboards) and the five-minute mailbox poll in
// api-rest lib/crm-mailbox-sync.ts + k8s/cronjobs/crm-mailbox-sync.yaml.
//
// NO `connects`, deliberately, although the mailbox screen offers Gmail,
// Outlook, Fastmail, Zoho and iCloud presets and the phone screen offers
// Twilio. Both store their credential under CRM_MAILBOX_TOKEN_KEY, which no
// committed manifest provisions, so whether a customer can finish connecting
// one today could not be confirmed from the repo. Name them once it is.
//
// Two named chapters rather than one array: the page opens with the profile and
// closes with the reports, and the three chapters in ../customers.ts sit between.

export const CUSTOMER_PROFILE_CHAPTER: AppChapter = {
  heading: 'Before you say hello, you already know the story.',
  body: 'The worst moment in a customer relationship is the one where they have to explain themselves again. Every customer here has one profile that opens on what matters: what they are worth to you, what is still open, and what happened last. Everything else is a tab away, and all of it is the real record rather than a copy somebody typed in.',
  does: [
    {
      title: 'What they are worth, at a glance',
      body: 'What they have ordered, what they have actually paid, what is still owed, their average order and when they last bought. Any credit they hold with you sits beside it.',
    },
    {
      title: 'Every kind of history, one record',
      body: 'Bookings, orders, invoices, work you are quoting for, tasks, notes and activity, each on its own tab. Bookings come first, because for a salon or a clinic that is the history you check before they sit down.',
    },
    {
      title: 'Write it down while it is fresh',
      body: 'Add a note, send an email or log a call from the top of their record in one press. Logging what just happened has to be quicker than not bothering.',
    },
    {
      title: 'Papers that belong to them',
      body: 'A signed contract, a scanned form, a spec sheet. PDFs and pictures kept on the person they are about.',
    },
    {
      title: 'The company, not just the person',
      body: 'A company record with the email addresses that are theirs and who on your team looks after them. Switch it on and a contact whose email matches is offered to that company. It asks, it never files them for you, and it never guesses from a personal email address.',
    },
    {
      title: 'A list sorted by what matters',
      body: 'Everybody, ordered by what they have spent or how recently they bought, with the filters you use every week saved as a view.',
    },
  ],
};

export const CUSTOMER_REPORTS_CHAPTER: AppChapter = {
  heading: 'The questions you actually have, answered on one screen.',
  body: 'Most businesses have the same handful of questions about their customers and no quick way to answer any of them: who is new, where they came from, which quotes are stuck, who on the team is winning work. The common ones are answered already. For the rest, you build the report yourself by choosing words in a sentence, and watch the answer change as you do.',
  does: [
    {
      title: 'The usual questions, already answered',
      body: 'Who is joining, where customers come from, how your open work is spread across its stages, who on the team wins it, and how big each of your groups is.',
    },
    {
      title: 'Every number opens its list',
      body: 'A count of overdue tasks is a number you want to click, so you can. Each figure opens the records it counted.',
    },
    {
      title: 'A report you build as a sentence',
      body: 'Count customers, broken down by how they found you, over the last 90 days. Each choice is the next word, and the answer on screen updates as you pick it.',
    },
    {
      title: 'Boards for different people',
      body: 'Several saved reports on one screen, as many boards as you need, and a choice of which one opens first. Fix a report once and every board showing it is fixed too.',
    },
    {
      title: 'Readable on a phone',
      body: 'A board stacks into one column on a small screen, rather than squeezing two columns into something nobody can read.',
    },
  ],
};
