import type { AppMarketing } from './types';

export const CONTENT: AppMarketing = {
  heading: 'Write it once. Use it everywhere it belongs.',
  lede: 'Content holds the writing, pictures and reusable information behind your site — the guides, the notices, the staff profiles, the frequently asked questions — so the same thing does not get retyped in four places and go out of date in three of them.',
  alsoKnownAs: ['CMS', 'content management system', 'headless CMS', 'blog platform'],
  does: [
    {
      title: 'Anything you write, in one place',
      body: 'Articles, notices, recipes, case studies, team profiles, opening times. If you write it down, it lives here.',
    },
    {
      title: 'Decide what a thing is made of',
      body: 'Set up your own kinds of entry with your own fields, so a "class" has a date and a tutor and a capacity, rather than being a paragraph you have to remember the shape of.',
    },
    {
      title: 'Publish when you mean to',
      body: 'Save drafts, schedule for a date, and unpublish without deleting. Nothing goes live because you hit the wrong key.',
    },
    {
      title: 'A real history',
      body: 'Every version is kept. See what changed, and put back the paragraph you should not have removed.',
    },
    {
      title: 'One picture, used properly',
      body: 'A shared library for images and files, resized for wherever they appear, so the same photograph is not uploaded five times at five sizes.',
    },
    {
      title: 'It shows up on the site',
      body: 'Content flows into the pages you built in My Site. Change it here, and the page changes.',
    },
  ],
  chapters: [
    {
      heading: 'The housekeeping that keeps a site from rotting.',
      body: 'Sites decay in predictable ways: a page gets renamed and every link to it breaks, the terms and conditions say something that stopped being true two years ago, and the version in another language is a copy somebody made once. None of that is interesting and all of it costs you customers, so it is handled here rather than left to whoever remembers.',
      does: [
        {
          title: 'Old addresses keep working',
          body: 'Rename or move a page and the previous address redirects to the new one, so a link somebody shared last year still lands somewhere.',
        },
        {
          title: 'More than one language',
          body: 'Translations kept against the original rather than as a separate copy, so when the original changes it is obvious which translations are now behind.',
        },
        {
          title: 'The legal pages, as pages',
          body: 'Terms, privacy and returns kept with the rest of your content and versioned like it — not a PDF from 2021 nobody can edit.',
        },
        {
          title: 'Who wrote it',
          body: 'Authors as real records with a name and a picture, so an article can be by somebody rather than by the website.',
        },
        {
          title: 'Findable a year later',
          body: 'Tags and topics, so a shop with three hundred articles is still something a visitor can navigate.',
        },
      ],
    },
  ],
  worksWith: ['site', 'get_found', 'messages'],
};
