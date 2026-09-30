import type { AppMarketing } from './types';

// Content fronts the `cms` module. Checked against
// piggles/apps/workbench/surfaces/cms and lib/surfaces/catalog/cms.ts.
//
// The translations bullet was rewritten: the Translations screen translates
// PRODUCT wording (name, description, search listing) and flags a language as
// unfinished when only the name is done. It does not track whether a translation
// fell behind a later edit to the original, which is what the old line claimed.

export const CONTENT: AppMarketing = {
  heading: 'Write it once. Use it everywhere it belongs.',
  lede: 'Content holds the writing, pictures and reusable information behind your site (the guides, the notices, the staff profiles, the frequently asked questions) so the same thing does not get retyped in four places and go out of date in three of them.',
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
      heading: 'An event has a date, a venue and a price. Its entry should too.',
      body: 'Most website editors hand you one big text box and trust you to remember the shape of everything you put in it. Here you decide once what a kind of entry is made of, and every entry of that kind asks for exactly those things. A menu, a list of properties, a course timetable, a staff directory: each becomes a kind of content with its own fields, laid out the same way every time.',
      does: [
        {
          title: 'Fifteen kinds of field',
          body: 'Short and long text, formatted text, numbers, dates and times, yes or no, a choice from your own list, web links, email addresses, pictures and files.',
        },
        {
          title: 'Entries that point at each other',
          body: 'Link an event to its venue or a recipe to the chef who wrote it, rather than copying the same details into every entry.',
        },
        {
          title: 'Things that come in sets',
          body: 'Groups and repeating groups for the courses on a menu, the stops on a tour or the questions on a help page.',
        },
        {
          title: 'The right kind of file',
          body: 'A file field can be told to take only pictures, only video or only PDFs, so a price list never ends up where the photo should be.',
        },
        {
          title: 'Required means required',
          body: 'Mark the fields every entry must have. Leave one empty and the editor names the box by its label before anything is saved.',
        },
        {
          title: 'Drag the fields into order',
          body: 'The order you set is the order the form asks in, so the person filling it in meets the important things first.',
        },
        {
          title: 'Built-in kinds to start from',
          body: 'Ready-made kinds of content sit beside the ones you define, so you can start writing before you design anything.',
        },
      ],
    },
    {
      heading: 'Nothing reaches a visitor by accident.',
      body: 'Writing and publishing are two separate decisions here. You save as often as you like, and nothing appears on the site until you publish it or set a time for it to go out. Every save is kept, so the paragraph you cut on Tuesday is still there on Friday when you want it back.',
      does: [
        {
          title: 'Four states, one list',
          body: 'Drafts, scheduled, published and archived, each a filter away, so what is waiting and what is live is never a guess.',
        },
        {
          title: 'Set it for Monday at nine',
          body: 'Choose a date and time and the entry publishes itself while you are doing something else.',
        },
        {
          title: 'Take it down, keep it',
          body: 'Unpublish and it leaves the site but stays here with its whole history, ready to go back up.',
        },
        {
          title: 'Bring an old version back',
          body: 'Open the history and restore any earlier save of the entry.',
        },
        {
          title: 'How it looks in a search result',
          body: 'Write the title and the two lines people see on a results page, or leave them empty and they are made from the title and a summary.',
        },
        {
          title: 'Its own web address',
          body: 'Choose the end of the address each entry lives at, so it reads like words rather than a number.',
        },
        {
          title: 'On the right site',
          body: 'Run more than one website and each entry can be kept to the sites it belongs on, and off the rest.',
        },
        {
          title: 'Asked before you lose work',
          body: 'One Save button. Close an entry with changes you have not saved and you are asked first.',
        },
      ],
    },
    {
      heading: 'One library for every picture, clip and document.',
      body: 'Files uploaded straight into pages end up scattered, duplicated and impossible to replace. The library keeps every picture, video, sound file and document in one place, and every page, post and field picks from the same shelf.',
      does: [
        {
          title: 'Sorted by what it is',
          body: 'Pictures, video, audio and documents, each a filter away, instead of one long scroll.',
        },
        {
          title: 'The part that matters survives the crop',
          body: 'A photo gets cut to square, tall, full-screen and wide shapes when it goes out. Point at the part to keep, the face or the cake, and every cut keeps it.',
        },
        {
          title: 'Words for people who cannot see it',
          body: 'Alt text on every picture: the sentence a screen reader says aloud in its place.',
        },
        {
          title: 'Captions kept with the picture',
          body: 'Write the caption once in the library, alongside the file it describes, instead of in a note somewhere else.',
        },
        {
          title: 'Picked, not re-uploaded',
          body: 'Every picture field in Content opens the same library, so the photo on the site and the photo in the article are one file.',
        },
      ],
    },
    {
      heading: 'The policies a business is expected to publish, handled.',
      body: 'Privacy, terms and cookies apply to almost everybody, and returns, shipping and refunds join them once you sell. The legal pages screen lists what a business like yours is normally expected to have, shows which are missing, and starts each one from wording you then make your own.',
      does: [
        {
          title: 'A checklist, not a guess',
          body: 'The pages you should have, then the optional ones, each marked missing, draft, needs review or published.',
        },
        {
          title: 'Started in one click',
          body: 'Create a page from starter wording, then edit it like any other entry. It stays marked for review until you say you have read it.',
        },
        {
          title: 'In the footer, where people look',
          body: 'Choose which legal pages link from the bottom of every page on your site.',
        },
      ],
    },
    {
      heading: 'The housekeeping that keeps a site from rotting.',
      body: 'Sites decay in predictable ways: a page gets renamed and every link to it breaks, the terms and conditions say something that stopped being true two years ago, and the version in another language is a copy somebody made once. None of that is interesting and all of it costs you customers, so it is handled here rather than left to whoever remembers.',
      does: [
        {
          title: 'Old addresses keep working',
          body: 'Rename or move a page and the previous address redirects to the new one, so a link somebody shared last year still lands somewhere.',
        },
        {
          title: 'A whole list of old links at once',
          body: 'Moving from another website? Paste every old address with its new home, check the preview, and import them together, each marked permanent or temporary.',
        },
        {
          title: 'More than one language',
          body: 'Your products’ names, descriptions and search listings in each language you sell in. Anything left empty falls back to your own words, and the list shows which languages are only half done.',
        },
        {
          title: 'The legal pages, as pages',
          body: 'Terms, privacy and returns kept with the rest of your content and versioned like it, not a PDF from 2021 nobody can edit.',
        },
        {
          title: 'Who wrote it',
          body: 'Authors as real records with a name and a picture, so an article can be by somebody rather than by the website.',
        },
        {
          title: 'Findable a year later',
          body: 'Tags and topics, so a shop with three hundred articles is still something a visitor can navigate.',
        },
        {
          title: 'Topics inside topics',
          body: 'Let a topic sit under another, and decide whether an entry takes one of them or several.',
        },
        {
          title: 'Tell your other tools',
          body: 'When something is published, edited, taken down or uploaded, Piggles can send a message to another system you use, with a list of what was sent and a switch to pause it.',
        },
      ],
    },
  ],
  worksWith: ['site', 'get_found', 'messages'],
};
