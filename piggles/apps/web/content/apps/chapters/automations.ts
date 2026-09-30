import type { AppChapter } from '../types';

// Automations fronts four screens (the list, the recipe library, activity and
// reports) plus each automation's own editor, run history and results. The
// chapters follow how somebody adopts it: turn on a ready-made one, build their
// own, make it smarter, trust it, then change it safely.
//
// VERIFIED 2026-09-30 against piggles/apps/workbench/surfaces/automations
// (automations-catalog.ts is the list of triggers and steps actually OFFERED),
// wizeworks/packages/automation (the engine re-reads the record at every step)
// and api-rest /v1/automations/*. DELIBERATELY ABSENT: every step the catalog
// marks `available: false` (create an invoice, apply a discount, adjust stock,
// create an order, draft a restock order, the wholesale quote steps), and any
// "try it on a real record first" claim, because no test-run exists.
// No `connects`: the "send to another system" step is a plain web address, not
// a named service.

export const AUTOMATIONS_CHAPTERS: AppChapter[] = [
  {
    heading: 'Start with the ones that already work.',
    body: 'You should not have to invent an automation to get something out of one. The recipe library arranges the ready-made ones by what they are for, such as getting paid or winning back a quiet customer, and each has a plain on and off switch. Which ones you see depends on the apps you use: a business with no online shop is not shown cart reminders.',
    does: [
      {
        title: 'Arranged by what you want',
        body: 'Welcome new customers, recover lost sales, keep customers coming back, reward loyalty, get paid on time, keep customers in the loop, stay on top of things, and grow your audience.',
      },
      {
        title: 'Getting paid, handled',
        body: 'A reminder before an invoice is due, notices at a week, two weeks and a month late, and a receipt when it is paid.',
      },
      {
        title: 'The sale that nearly got away',
        body: 'A reminder about a cart somebody left behind, a nudge to retry a payment that failed, and one before a quote runs out.',
      },
      {
        title: 'After the sale',
        body: 'Tell customers their order arrived, confirm a refund or a return, and ask the happy ones for a review.',
      },
      {
        title: 'Things you should hear about',
        body: 'An alert for a big order, stock running low, something selling out, or a chat nobody has answered.',
      },
      {
        title: 'An ordinary automation underneath',
        body: 'Open any of them to change the timing, the conditions or the steps. Nothing about a ready-made one is locked away from you.',
      },
    ],
  },
  {
    heading: 'Built from what already happens in your business.',
    body: 'Every automation starts from a moment: something that just happened, or a check that runs on a clock. The moments come from across the business (selling, customers, bookings, invoices, your team, your site and your campaigns), and each one carries the details you would expect to be able to test.',
    does: [
      {
        title: 'When something happens',
        body: 'An order is paid, a form on your site is filled in, somebody books or misses an appointment, a support request is running out of time, a team member’s license is about to expire.',
      },
      {
        title: 'Or on a clock',
        body: 'Every day, week or month, every so many minutes, or once at a set time, looking over your customers, invoices, quotes awaiting a decision, abandoned carts or chat conversations.',
      },
      {
        title: 'Only when it applies',
        body: 'Add conditions in plain words, such as is more than, is one of or is empty. "Order total is more than 500" works the way it reads.',
      },
      {
        title: 'The details you invented',
        body: 'If you keep a renewal date or a warranty expiry on your customers, an automation can start when that detail changes and act on it.',
      },
      {
        title: 'Only the steps you can use',
        body: 'Steps belonging to apps you have not added are left out of the list, so what you choose from is about your business.',
      },
    ],
  },
  {
    heading: 'Steps that wait, check, and choose.',
    body: 'Most useful jobs are not one action. They are "wait two days, see whether they paid, and only then send the reminder." Automations lays out steps one after another, with pauses and forks, and looks at the record again at every step, so nobody is chased for something they have already done.',
    does: [
      {
        title: 'Wait a while',
        body: 'Pause for an hour, a day or a week before the next step.',
      },
      {
        title: 'Go one way or the other',
        body: 'Ask a question about the record, then do one thing if the answer is yes and something else if it is no.',
      },
      {
        title: 'Fresh at every step',
        body: 'Details are looked up again at each step rather than remembered from the start, so a customer who paid yesterday is not treated as unpaid today.',
      },
      {
        title: 'Stop once it has worked',
        body: 'Say what you are aiming for, such as a booking or a payment. When it happens for someone, the remaining steps stop for them and they count as a success.',
      },
      {
        title: 'What a step can do',
        body: 'Label a customer, add a note, change a detail, create a task or a record, open a support request, share work evenly across the team, put someone on a list, write to them personally, start or stop an email sequence, email your staff, post a notice for your team, or draft a social post for you to approve.',
      },
      {
        title: 'Hand the details to other software',
        body: 'Send what happened to another tool you use, at a web address that tool gives you.',
      },
      {
        title: 'Words that fill themselves in',
        body: 'Write "Hi {{customer.firstName}}" and each customer’s own name goes in when it sends.',
      },
    ],
  },
  {
    heading: 'You can see what it did, and why.',
    body: 'An automation you cannot look inside is one you will quietly switch off. Every run is kept with each step it took, and a rule that keeps failing says so on the list instead of sitting there switched on and looking fine.',
    does: [
      {
        title: 'Every run, step by step',
        body: 'What started it, which steps ran, what each one changed, and where it stopped if it did.',
      },
      {
        title: 'Failing is not the same as on',
        body: 'A rule whose runs are failing is flagged on the list and on its own page, with the failures one click away.',
      },
      {
        title: 'Where people drop out',
        body: 'For a rule with an aim: how many started, how many got there, how long it took them, and the step where most people fell away.',
      },
      {
        title: 'Activity across all of them',
        body: 'How many runs there were and how many succeeded, for the period you pick. Open two side by side to compare one month with another.',
      },
    ],
  },
  {
    heading: 'Change it without breaking it.',
    body: 'Editing something that is already running is how a business ends up sending the wrong email to four hundred people. Changes to a live automation wait as a draft until you publish them, and every version you publish is kept.',
    does: [
      {
        title: 'Draft, then publish',
        body: 'Edit freely. The running version keeps going until you publish, and a draft you do not like can be thrown away.',
      },
      {
        title: 'Every version kept',
        body: 'See what changed and when, with a note on why, and go back to an earlier version if the new one is worse.',
      },
      {
        title: 'Pause without losing it',
        body: 'Switch one off and back on again, with its steps and history intact.',
      },
      {
        title: 'Copy one to start another',
        body: 'Duplicate an automation that works and change only the parts that differ.',
      },
    ],
  },
];
