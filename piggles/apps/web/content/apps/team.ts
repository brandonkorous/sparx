import type { AppMarketing } from './types';

// My Team fronts two things a business owner thinks of as one: who can get into
// the account (the team roster, roles, security and partner access, which live
// in the console's account settings) and the workforce itself (the `staff`
// module: people, timesheets, schedule, time off, tickets and licenses).
//
// Checked against piggles/apps/workbench/surfaces/team, surfaces/security,
// surfaces/partner, surfaces/staff and /v1/staff/*.
//
// DELIBERATELY ABSENT: access limited to one location or one site. The teammate
// pane narrows a person by APP, not by place, so the old "Per-location" bullet
// was replaced. Also absent: filing contracts and ID against a person. The API
// stores them but no console screen attaches one yet.

export const TEAM: AppMarketing = {
  heading: 'Let people help without handing over everything.',
  lede: 'My Team is who works with you and what each of them can see. A Saturday assistant needs the till and the bookings. They do not need your bank details, your margins or the button that deletes the website.',
  alsoKnownAs: ['user management', 'RBAC', 'permissions', 'staff accounts'],
  does: [
    {
      title: 'Their own account',
      body: 'Everyone signs in as themselves. No shared password, and no wondering who did that.',
    },
    {
      title: 'Access by the job they do',
      body: 'Ready-made roles for the common cases, adjustable per person when somebody does two jobs.',
    },
    {
      title: 'Money kept separate',
      body: 'Pay rates, wage costs and commission are for owners and admins only, and billing is the owner’s alone. The website and warehouse roles never see what anything cost.',
    },
    {
      title: 'A record of who did what',
      body: 'Significant changes are logged with a name and a time, not to catch anybody out, but so a mystery has an answer.',
    },
    {
      title: 'Only the apps they need',
      body: 'Tick the apps somebody works in and the rest disappear for them entirely. Not greyed out, simply not there.',
    },
    {
      title: 'Leaving is clean',
      body: 'Revoke access in one action. Their history stays; their way in does not.',
    },
  ],
  chapters: [
    {
      heading: 'Adding someone is one sentence: this email, that job.',
      body: 'Nobody reads a permissions matrix, so there is not one. You type an address, pick the job they will do, and they get an email with a link to join. They are on your team from that moment, marked as invited until they arrive, and everything about what they can reach sits on one page you can open beside another person’s to compare.',
      does: [
        {
          title: 'Eight jobs, each in a sentence',
          body: 'Admin, Editor, Website, Marketing, Support, Partners, Warehouse and View only. Every one says what that person can do and, just as plainly, what they cannot.',
        },
        {
          title: 'A safe place to start',
          body: 'New invitations default to Editor: enough to do the work they were hired for, without the team or the billing.',
        },
        {
          title: 'Invitations you can see',
          body: 'Invited, expired or joined, on the same list as everybody else. Send one again or cancel it in a click.',
        },
        {
          title: 'Two people, side by side',
          body: 'Open two teammates next to each other and the answer to “does Sam have the same reach as Priya?” is just visible.',
        },
        {
          title: 'What someone has been doing',
          body: 'Each person’s recent actions in the account, newest first. A role nobody uses is a role nobody needs.',
        },
        {
          title: 'Nobody locks the door from inside',
          body: 'The owner cannot be changed or removed, and nobody can demote or remove themselves, so somebody always holds the keys.',
        },
        {
          title: 'Your bookkeeper, on your terms',
          body: 'An outside accountant, consultant or agency gets their own sign-in with the reach you choose, and you withdraw it the day the job is done.',
        },
      ],
    },
    {
      heading: 'Signing in should be the safe part.',
      body: 'Every person signs in as themselves, which makes their sign-in theirs to protect. The security page is the same for everybody on the team: the password, a second step, the devices currently signed in, and a record of what has been done in the account.',
      does: [
        {
          title: 'A code from your phone',
          body: 'Two-step verification asks for a code from an authenticator app as well as your password, so a leaked password alone gets nobody in.',
        },
        {
          title: 'Backup codes for the bad day',
          body: 'Shown when you switch the second step on, to keep somewhere safe for the day your phone is not with you.',
        },
        {
          title: 'Every device, listed',
          body: 'See each device signed in to your account and sign out the one you do not recognize.',
        },
        {
          title: 'Changes on the record, looking is not',
          body: 'The activity list shows what people did, with who and when. Simply opening a page is not logged, because that would bury the things that matter.',
        },
      ],
    },
    {
      // The hours half of the app got no bullet at all while the page was six
      // long, which left the largest cost in most service businesses looking
      // like something Piggles does not track.
      heading: 'The hours behind the biggest number you pay out.',
      body: 'For most businesses that employ anybody, wages are the largest single cost, and in most software they are a figure somebody types in at the end of the month. My Team keeps what people actually worked, so the cost of a job is arithmetic rather than a guess. It is not payroll and will not become it: Piggles records the hours and the rates and hands them to whoever runs yours.',
      does: [
        {
          title: 'Hours attached to something',
          body: 'Timesheets per person, shift by shift, rather than a total at the bottom of a page.',
        },
        {
          title: 'Clock in, clock out',
          body: 'From the person’s own page, or typed in afterwards with a note for the day somebody forgot. Who is on the clock right now is always visible.',
        },
        {
          title: 'Approved on purpose',
          body: 'Hours count toward costs only once somebody approves them. Anyone still on the clock is skipped and named, so nobody banks a zero.',
        },
        {
          title: 'Who is on this week',
          body: 'A schedule you can publish, so people know their shifts without a photograph of a whiteboard going round a group chat.',
        },
        {
          title: 'Time off that actually blocks the diary',
          body: 'Requested, approved, and written straight through to availability, so once it is agreed, nobody can be booked in with a person who is away.',
        },
        {
          title: 'One list for the rota and the diary',
          body: 'Switch somebody on for appointments and they appear on your booking page as the same person, not a second record under Bookings.',
        },
        {
          title: 'Tickets and licenses before they lapse',
          body: 'A forklift ticket, a food-hygiene certificate, a trade license: kept with its expiry date and raised while there is still time to renew it.',
        },
        {
          title: 'Warned in time, by the right person',
          body: 'Each ticket has its own warning time, 30 days unless you change it, and an automation can email whoever ought to hear about it.',
        },
        {
          title: 'Wages in the profit figure',
          body: 'Once approved, hours and rates arrive in Money as wages, so the profit figure counts what your people cost instead of leaving them out.',
        },
      ],
    },
    {
      heading: 'A pay rise changes next month, not last year.',
      body: 'Most systems store one rate per person and quietly apply today’s figure to every hour ever worked, so a raise in June rewrites what March cost. Here each rate has a start date and the old one stops the day before, so every hour is costed at what that person earned on the day they worked it.',
      does: [
        {
          title: 'Paid the way they are paid',
          body: 'By the hour, by salary, on commission as a share of each sale, or not at all for a volunteer.',
        },
        {
          title: 'What they really cost you',
          body: 'Add the employer costs you pay on top of wages as a percentage, so the cost of a job includes them.',
        },
        {
          title: 'A missing rate is not a free hour',
          body: 'Somebody with approved hours and no rate shows as “no pay rate set”, and the period total says “so far” instead of pretending to be complete.',
        },
        {
          title: 'Commission worked out on the spot',
          body: 'Credit an order to the person who made the sale and their commission is calculated there and then. If it comes to nothing, the screen says why.',
        },
        {
          title: 'A file for whoever runs payroll',
          body: 'Download a period’s approved hours as a spreadsheet, carrying each person’s ID from your payroll system so nobody matches names by hand.',
        },
        {
          title: 'Pay stays private',
          body: 'Rates, costs and commission are visible to owners and admins. Everyone else sees the roster, and a sentence explaining why the pay is not there.',
        },
      ],
    },
  ],
  worksWith: ['bookings', 'money', 'connections'],
};
