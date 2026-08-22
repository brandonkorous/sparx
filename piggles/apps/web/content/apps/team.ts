import type { AppMarketing } from './types';

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
      body: 'Costs, margins, payouts and platform billing are their own permission. Plenty of people need the product list and none of that.',
    },
    {
      title: 'A record of who did what',
      body: 'Significant changes are logged with a name and a time — not to catch anybody out, but so a mystery has an answer.',
    },
    {
      title: 'Per-location, where it matters',
      body: 'Staff at one shop see that shop, if that is how you want it.',
    },
    {
      title: 'Leaving is clean',
      body: 'Revoke access in one action. Their history stays; their way in does not.',
    },
  ],
  chapters: [
    {
      // The hours half of the app got no bullet at all while the page was six
      // long, which left the largest cost in most service businesses looking
      // like something Piggles does not track.
      heading: 'The hours behind the biggest number you pay out.',
      body: 'For most businesses that employ anybody, wages are the largest single cost — and in most software they are a figure somebody types in at the end of the month. My Team keeps what people actually worked, so the cost of a job is arithmetic rather than a guess. It is not payroll and will not become it: Piggles records the hours and the rates and hands them to whoever runs yours.',
      does: [
        {
          title: 'Hours attached to something',
          body: 'Timesheets per person, against the shift or the job they were on, rather than a total at the bottom of a page.',
        },
        {
          title: 'Who is on this week',
          body: 'A schedule you can publish, so people know their shifts without a photograph of a whiteboard going round a group chat.',
        },
        {
          title: 'Time off that actually blocks the diary',
          body: 'Requested, approved, and written straight through to availability — so once it is agreed, nobody can be booked in with a person who is away.',
        },
        {
          title: 'Tickets and licences before they lapse',
          body: 'A forklift ticket, a food-hygiene certificate, a trade licence — kept with its expiry date and raised while there is still time to renew it.',
        },
        {
          title: 'It is what makes profit-by-job real',
          body: 'Hours and rates feed Money. Without them, profit on a job is revenue minus the parts, which is the number that makes unprofitable work look fine.',
        },
      ],
    },
  ],
  worksWith: ['bookings', 'money', 'connections'],
};
