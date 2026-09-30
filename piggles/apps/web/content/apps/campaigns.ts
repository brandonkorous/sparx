import type { AppMarketing } from './types';

// Campaigns fronts the `funnels` module. Every line below was checked against
// piggles/apps/workbench/surfaces/funnels, the /v1/funnels routes and
// @wizeworks/funnels (library.ts, install.ts, advance.ts, abandon.ts).
//
// RECORDING IS AUTOMATIC. The automation worker sees every event and moves
// people through each running campaign on its site (advance.ts): a step with a
// rule is recorded when an event fits it (a basket left, an order paid, a form
// sent, a booking missed, a quote submitted), and the finishing step is recorded
// when the success rule comes true, with the order total as its value. A daily
// pass puts in customers who have not bought for four months (captureFromScan).
//
// THE SEVEN READY-MADE CAMPAIGNS have no gallery in the Piggles console. They
// install as DRAFTS, per site, when a module they belong to is switched on while
// Campaigns is on (install.ts via the worker's `module.activated` handler), and
// appear in the ordinary list. So the copy says they arrive ready to switch on,
// never that you pick them from a gallery.
//
// Deliberately NOT claimed: a page builder ("landing pages" is absent from
// alsoKnownAs), sending anything itself (the follow-up is an automation), or a
// value you type for a success (the field exists but no console control sets it).

export const CAMPAIGNS: AppMarketing = {
  heading: 'Find the exact step where people give up.',
  lede: 'Campaigns lays out a promotion as the steps somebody takes, from landing on your page to filling in your form and beyond, then shows how many people reached each step and where the rest stopped. So the next change you make fixes the step that is actually losing people.',
  alsoKnownAs: ['sales funnels', 'conversion funnel', 'funnel tracking', 'drop-off analysis'],
  does: [
    {
      title: 'Start from what you are trying to do',
      body: 'Finding new customers, selling something, filling your calendar, winning someone back. Pick one and it arrives with a sensible set of steps already in place.',
    },
    {
      title: 'The steps, in your own words',
      body: 'Name each step the way you would say it out loud, then add, remove or reorder them. Renaming a step keeps everything it has already counted.',
    },
    {
      title: 'Your form is the front door',
      body: 'Choose a form on your site and everyone who sends it joins the campaign by name. Even somebody who gives an email on page one of a longer form and wanders off still counts.',
    },
    {
      title: 'Visits counted, visitors left alone',
      body: 'A step can be a page on your site. Piggles counts how many people reached it without cookies or following anyone around, and nobody is named until they choose to tell you who they are.',
    },
    {
      title: 'Where people stop, and who finished',
      body: 'Each step shows how many got there and what share carried on, over the last week, month or three months. When somebody does the thing the campaign is for, like paying or booking, Piggles counts it as a success on its own, with what it brought in.',
    },
    {
      title: 'Notice when somebody goes quiet',
      body: 'Decide how long to wait, from four hours to two months. Once somebody has gone quiet that long, an automation can send the follow-up for you.',
    },
  ],
  chapters: [
    {
      heading: 'Seven campaigns, already written.',
      body: 'Adding Campaigns does not hand you a blank page. The campaigns worth running for the apps you already use arrive in your list as drafts, one set for each of your sites, with their steps and their success rule in place and ready to switch on. Only the ones that fit arrive: a business that does not sell online gets no basket campaign. Switch on another app later and its campaigns turn up then.',
      does: [
        {
          title: 'Basket recovery',
          body: 'Somebody filled a basket and left without paying. Counts who came back to check out, and who paid.',
        },
        {
          title: 'After the order',
          body: 'Follows a paid order through delivery and a review to the moment they order again. It waits a month before calling anybody gone, because a reorder takes time.',
        },
        {
          title: 'Welcome',
          body: 'Starts when somebody signs up for your emails, and counts as a success when they buy or book.',
        },
        {
          title: 'Lead nurture',
          body: 'For an inquiry that is interested but not ready. It waits two months before giving up, because slow is the point.',
        },
        {
          title: 'Win back',
          body: 'Customers who have bought before and not in four months are found by a daily check, and count as back when they pay.',
        },
        {
          title: 'Quote follow-up',
          body: 'From a quote request to the quote going out to its acceptance, with three weeks of patience, because trade customers wait for budget meetings.',
        },
        {
          title: 'Missed appointment',
          body: 'Somebody booked and did not turn up. Finished when they book again.',
        },
        {
          title: 'Yours from the moment it lands',
          body: 'Rename it, change its steps, give it a different success rule. Nothing Piggles adds later ever overwrites what you changed.',
        },
      ],
    },
    {
      heading: 'It fills itself in.',
      body: 'A campaign is only as good as the person keeping it up to date, and nobody has time for that. So nobody has to. Piggles watches what already happens in the business, a basket left behind, an order paid, a form sent, a booking missed, a quote submitted, and records each step the moment it happens.',
      does: [
        {
          title: 'In on something real',
          body: 'People join a campaign because of something they did, not because somebody remembered to add them.',
        },
        {
          title: 'Each step says what records it',
          body: 'In plain words under every step: “recorded on its own when they pay for an order”, or “only when you mark it”. No guessing which numbers are automatic.',
        },
        {
          title: 'Finished when it worked',
          body: 'The last step is recorded when your success rule comes true, and a paid order brings its total with it, so the report says what the campaign earned.',
        },
        {
          title: 'Going quiet counts as something',
          body: 'Nothing happens when a customer drifts away, so a daily check looks for the ones who have not bought in four months and puts them in.',
        },
        {
          title: 'A second chance is a second round',
          body: 'Somebody who finishes and then leaves another basket next month goes through again, rather than being counted once forever.',
        },
        {
          title: 'The same order cannot count twice',
          body: 'The order that put somebody into a campaign can never also be the one that finishes it.',
        },
        {
          title: 'Each site keeps its own',
          body: 'A campaign belongs to one of your sites. Somebody buying from your other business does not wander into it.',
        },
      ],
    },
    {
      heading: 'Did it work? Two numbers, then the shape.',
      body: 'The report leads with the two answers anybody opening it wants: what share of the people who started got all the way through, and what the campaign brought in. Under them, each step is a bar that narrows as people drop away, so the step losing the most people is the one you can see from across the room.',
      does: [
        {
          title: 'How many finished',
          body: 'The share of everyone who started that reached the end, for the last 7, 30 or 90 days.',
        },
        {
          title: 'What it brought in',
          body: 'The money from the orders that finished people, added up for the period.',
        },
        {
          title: 'The drop between each step',
          body: 'Between every pair of steps, the share who carried on, and beside each step, its share of everyone who started.',
        },
        {
          title: 'Nothing to compare is not zero',
          body: 'A step nobody has reached yet says there is nothing to compare, rather than printing a 0% that reads like a disaster.',
        },
        {
          title: 'Honest about a missing page',
          body: 'If a step counts visits to a page you have since deleted, it says it can no longer tell, instead of quietly showing nobody.',
        },
      ],
    },
    {
      heading: 'On when it means something, and not before.',
      body: 'A campaign counts nobody until you switch it on, and it cannot be switched on until it knows what success looks like. Those two rules are what keep the numbers honest: every figure on the report was counted on purpose, against a finish line somebody chose.',
      does: [
        {
          title: 'Draft until you say',
          body: 'New campaigns and ready-made ones both start as drafts and count nobody.',
        },
        {
          title: 'No finish line, no start',
          body: 'The Turn it on button stays unavailable until there is a success rule, and it tells you why.',
        },
        {
          title: 'Success in your terms',
          body: 'Build the rule from the same conditions your automations use: paid, booked, became a customer, or whatever your finish line is.',
        },
        {
          title: 'Pause without losing anything',
          body: 'Paused keeps everything it recorded and adds nothing. Archived retires it, results intact.',
        },
        {
          title: 'Every campaign on one list',
          body: 'Running, drafts, paused and archived, searchable, each row showing its state and the shape of its steps.',
        },
        {
          title: 'Changed by the right people',
          body: 'Owners, admins and editors can set campaigns up. Everyone else who can open them can read the results.',
        },
      ],
    },
    {
      heading: 'Somebody went quiet. Something happens.',
      body: 'Knowing where people stop is half the job. The other half is doing something about it at the right moment, and that belongs to Automations, which listens to your campaigns the same way it listens to orders and bookings.',
      does: [
        {
          title: 'When somebody joins',
          body: 'Add them to an email sequence, or let the team know in Piggles, the moment somebody enters a campaign.',
        },
        {
          title: 'When somebody finishes',
          body: 'Say thank you, or let whoever handles the next part know it is their turn.',
        },
        {
          title: 'When somebody goes quiet',
          body: 'Once they have been still for the waiting time you chose, send the follow-up that brings them back.',
        },
        {
          title: 'Told once, not every night',
          body: 'The daily check notices each person on the day they cross your waiting time, so a follow-up goes out once rather than on repeat.',
        },
        {
          title: 'A sensible wait to start with',
          body: 'Each kind of campaign comes with its own default, from four hours for a sale to a month for winning somebody back. Any campaign can have its own.',
        },
      ],
    },
  ],
  worksWith: ['site', 'automations', 'customers'],
};
