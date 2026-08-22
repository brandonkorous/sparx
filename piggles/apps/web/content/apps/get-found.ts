import type { AppMarketing } from './types';

// Get Found is two jobs under one name — being findable in search, and being
// present on the networks your customers already scroll. Both are real, and the
// second one was almost invisible here: eight networks, seven screens and a
// two-way inbox, described in three bullets on a page about search. Somebody
// looking for social media software read this page and concluded Piggles does
// not do it, which is the most expensive kind of wrong copy — accurate, and
// still false in the impression it leaves.
//
// Hence two chapters, and hence the networks are NAMED. See `connects` in
// ./types.ts for the accuracy rule they are held to.

export const GET_FOUND: AppMarketing = {
  heading: 'Turn up when somebody searches for what you do.',
  lede: 'Get Found is the unglamorous half of being visible: the titles, descriptions, addresses and posts that decide whether a person looking for exactly your thing ever sees you. It tells you what is wrong in plain words, mostly fixes it for you, and posts to every network you are on without you opening eight apps.',
  alsoKnownAs: ['SEO', 'search engine optimisation', 'social media management', 'meta tags'],
  does: [
    {
      title: 'Plain-English checks',
      body: 'What is missing, why it matters and what to type instead — not a score out of a hundred and a list of acronyms.',
    },
    {
      title: 'Control how you look when shared',
      body: 'The title, the description and the picture that appear when your page is posted or messaged. Set once, right, per page.',
    },
    {
      title: 'Tell search engines you exist',
      body: 'Sitemaps, structured data and redirects handled for you, and kept correct when you rename or move a page.',
    },
    {
      title: 'Post to social without doing it eight times',
      body: 'Write once, choose where it goes, schedule it for when your customers are actually awake. Eight networks, one box.',
    },
    {
      title: 'See what a post actually did',
      body: 'Reach, engagement and clicks for every post you sent — because "did that work" is the only reason to have posted it.',
    },
    {
      title: 'Answer in one place',
      body: 'Comments and messages from Facebook, Instagram, LinkedIn and Google arrive in one inbox, alongside everything else that customer has said to you.',
    },
  ],
  chapters: [
    {
      heading: 'Being found by somebody who does not know your name yet.',
      body: 'Anyone who already knows your business can find it. The traffic worth having is the person who searched for what you do and had never heard of you — and whether they see you comes down to a few dozen small, dull, easily-wrong details on every page. Get Found checks them, says what is wrong in words rather than jargon, and fixes most of it without asking.',
      does: [
        {
          title: 'Told what to fix, not scored',
          body: 'A page with a missing description gets a sentence explaining what a description is for and a box to write one in. A number out of a hundred tells you nothing you can act on.',
        },
        {
          title: 'The picture people see before the page',
          body: 'When your link is pasted into a message, a post or a group chat, something is shown. Set what that is — per page — instead of letting each network guess from whatever was nearest the top.',
        },
        {
          title: 'The plumbing, kept right on its own',
          body: 'Sitemaps, structured data and redirects are generated from the site you actually published. Rename a page and the old address keeps working rather than becoming a dead link somebody else already shared.',
        },
        {
          title: 'What people searched to reach you',
          body: 'Connect your Google Search Console account and the real search terms, positions and click-throughs land beside the pages they belong to.',
        },
        {
          title: 'How each page is doing',
          body: 'Which pages people arrive on, which they leave from, and which are quietly getting no visitors at all despite being the ones you worked hardest on.',
        },
      ],
      connects: ['Google Search Console'],
    },
    {
      // The chapter this whole file was restructured for.
      heading: 'Write it once. It goes everywhere you are.',
      body: 'Posting the same thing to eight places by hand is the job everybody quietly stops doing after about three weeks. You write one post here, pick where it goes, and Piggles reshapes it for each one — the caption trimmed to that network’s limit, the image cropped to the shape it wants, the whole thing checked before it goes rather than failing quietly at two in the morning. Then it tells you what each post actually did, and brings the replies back.',
      does: [
        {
          title: 'One box, every network you are on',
          body: 'Write the post, attach the picture, tick the accounts. Per-network wording is there if you want it and unnecessary if you do not.',
        },
        {
          title: 'It will not let you post something that gets rejected',
          body: 'Each network’s real limits — caption length, how many images, what kind of video — are checked as you type and again before it publishes. "24 characters over" while you can still fix it, not a failure notice afterwards.',
        },
        {
          title: 'The picture, in the right shape',
          body: 'One image, cropped per network to the proportions each one actually wants, so a post does not arrive with the top of somebody’s head missing.',
        },
        {
          title: 'Standing times, not a reminder to yourself',
          body: 'Set the slots you want to post in — Tuesdays at nine, Fridays at four — and fill them ahead. They stay at nine when the clocks change, because your customers’ morning did not move.',
        },
        {
          title: 'When to post, from your own numbers',
          body: 'Best times worked out from the posts your audience actually engaged with, not an industry average. When there is not enough history to be sure, it says so instead of guessing.',
        },
        {
          title: 'Never post to an empty slot',
          body: 'Keep a pool of posts worth running again. A slot with nothing planned draws from it rather than going silent.',
        },
        {
          title: 'The hashtags you keep retyping',
          body: 'Save the blocks you use, drop one into the post or its first comment in a click. No more a typo in your own branded tag.',
        },
        {
          title: 'A month planned in a spreadsheet',
          body: 'Import the whole plan at once. Every problem is reported per row — line 14, and what is wrong with it — before a single post is created.',
        },
        {
          title: 'Nothing goes out unchecked, if you want it that way',
          body: 'Posts written by a member of staff or raised by an automation can wait for sign-off. Approve, send back, or edit and send.',
        },
        {
          title: 'Did it work',
          body: 'Reach, engagement and clicks per post per network, so the next month is planned from what happened rather than from what felt good.',
        },
        {
          // Deliberately names the four rather than saying "the platforms you
          // connected". All eight publish and report numbers; only these four
          // hand back comments and accept a reply, and a reader who connected
          // TikTok expecting an inbox would have been misled by the vaguer
          // sentence that was here.
          title: 'The replies come back to you',
          body: 'Comments and messages from Facebook, Instagram, LinkedIn and your Google Business listing arrive in one inbox, and you answer from there. Each one sits beside that customer’s orders and emails, so you are not replying to a stranger.',
        },
      ],
      // Publishing + numbers on all eight. X is deliberately absent: its posting
      // API is paid-tier and there is no adapter, so listing it would be exactly
      // the logo-wall lie ./types.ts forbids.
      connects: [
        'Facebook Page',
        'Instagram',
        'LinkedIn',
        'Google Business Profile',
        'TikTok',
        'Pinterest',
        'YouTube',
        'Threads',
      ],
    },
  ],
  worksWith: ['site', 'content', 'customers'],
};
