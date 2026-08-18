// "Show me around" — the shell guide. Words only; the runtime is use-guide.ts.
//
// ── WHAT THIS GUIDE IS FOR, WHICH IS NOT WHAT YOU'D EXPECT ──────────────────
//
// The obvious first-run problem is an empty product: nothing set up, nothing to
// look at, so a tour shows you what you could build. Piggles has the opposite
// problem. Every app is included in the one plan, so the rail is FULL on the
// first morning — thirteen tools, none of them bought, all of them working. That
// is generous and it is a lot to walk into.
//
// So this guide does not sell anything and does not list features. It answers
// the four questions somebody actually has while staring at a full rail: where
// am I, what are all these, where does my work go, and how do I find anything.
// Six steps, under a minute, and every one of them about the SHELL — the parts
// that are the same whichever app you open.
//
// ── THE VOICE ───────────────────────────────────────────────────────────────
//
// Plain, warm, and never cute. These are business owners, not users: they have a
// shop or a studio or a round, and they are here to run it. No "workspace", no
// "module", no "surface", no "pane" — screens, tools, your business. No step
// numbering in the words either; the chip already says where you are.

import type { Guide } from './types';

export const WELCOME_GUIDE: Guide = {
  id: 'welcome',
  offer: 'New here? Show me around',
  steps: [
    {
      id: 'hello',
      title: 'This is where you run everything',
      body: 'Your website, what you sell, who you sell it to, and what you get paid — all of it lives here. About a minute, and you can stop any time. Nothing on screen is locked while we do this.',
    },
    {
      id: 'business',
      anchor: 'business',
      title: 'This is your business',
      body: 'Its name sits up here so you always know whose books you are looking at. Run more than one? This is where you swap between them, and everything on screen follows.',
    },
    {
      id: 'app-rail',
      anchor: 'app-rail',
      title: 'Every one of these is yours',
      body: 'These are your apps, and you have all of them — nothing here costs extra and nothing is a trial. They are grouped and coloured by what they are for, so the orange ones are about selling and the green ones are about money.',
    },
    {
      id: 'app-panel',
      // Opens Home's panel first. Without it this step rings a panel that is
      // closed — a zero-width box against the left edge — and points confidently
      // at nothing, which is worse than not pointing at all.
      app: 'home',
      anchor: 'app-panel',
      title: 'Pick an app, get its screens',
      body: 'Clicking an app on the rail opens its list of screens here — this is Home’s. If you are ever hunting for something, this column is the map, and the search box will get you there faster still.',
    },
    {
      id: 'workspace',
      anchor: 'workspace',
      title: 'Your work opens in here',
      body: 'Screens open side by side so you can keep an eye on two things at once — an order next to the customer who placed it. Drag one out and it becomes its own window. Everything stays exactly as you left it, per business.',
    },
    {
      id: 'search',
      anchor: 'search',
      title: 'When you would rather just ask',
      body: 'Type a customer, an order, a product or the name of a screen. Ctrl-K opens it from anywhere — ⌘K on a Mac — and it is almost always quicker than clicking.',
    },
    {
      id: 'strip',
      title: 'That is the whole shape of it',
      body: 'Down here we tell you when things saved, what is still running, and anything worth knowing. Open an app and we will offer you a quick walk through that one too — same deal, and you can always say no.',
    },
  ],
};
