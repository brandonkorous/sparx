// Home — the app a person opens first and the last one to get a walk.
//
// It keys on `platform` rather than on 'home' (see GUIDE_KEY_BY_APP): the answer
// is stored in a key space both brands share, and Piggles' word for the app is
// Piggles' alone.
//
// Seven steps, and only ONE of them is a settings screen. Home's panel carries
// eighteen rows, twelve of which are things you set once and never open again —
// walking all of them would teach the least useful two thirds of the app first.
// So this covers the six front-door screens and hands the settings groups off to
// their own walks, the way every other big app here does.

import type { Guide } from '../types';

export const HOME_GUIDE: Guide = {
  id: 'platform',
  offer: 'First time in Home? Show me around',
  steps: [
    {
      id: 'home.start',
      app: 'home',
      anchor: 'nav-piggles.home',
      title: 'Start here every morning',
      body: 'Whatever needs you today — an order to send, an invoice nobody has paid, a booking tomorrow — is on this one screen. If you only ever open one thing in Piggles, make it this.',
    },
    {
      id: 'home.pulse',
      app: 'home',
      anchor: 'nav-platform.pulse',
      title: 'What has been happening',
      body: 'Every notable thing, newest first: a sale, a new customer, a payment landing. It is the running commentary you would otherwise have to go and look for in five different apps.',
    },
    {
      id: 'home.setup',
      app: 'home',
      anchor: 'nav-workbench.welcome',
      title: 'The bits that are not finished yet',
      body: 'A short list of what is still to do before your business is fully set up — a logo, a web address, a way to take payment. Anything you skipped when you signed up is waiting here rather than lost.',
    },
    {
      id: 'home.dashboards',
      app: 'home',
      anchor: 'nav-analytics.dashboards.list',
      title: 'Numbers, arranged the way you want them',
      body: 'Build a screen of the figures you actually check — takings, bookings, stock, whatever matters in your trade — and keep it. Most people make one and never touch it again, which is the point.',
    },
    {
      id: 'home.migrate',
      app: 'home',
      anchor: 'nav-platform.migrate',
      title: 'Coming from somewhere else?',
      body: 'If your products, customers or posts are sitting in another system, bring them across here instead of retyping them. It will tell you what it found before it changes anything.',
    },
    {
      id: 'home.feedback',
      app: 'home',
      anchor: 'nav-platform.feedback.list',
      title: 'What you told us',
      body: 'Anything you have sent us, and what came of it. A real person reads every one, and this is where the reply lands — so asking for something is not the same as shouting into a void.',
    },
    {
      // Rings the first row of the settings groups rather than teaching it. The
      // step is about the SHAPE of what is below — six screens in, twelve
      // settings under it — and that row's own words live in its group's walk.
      id: 'home.handoff',
      app: 'home',
      anchor: 'nav-platform.settings.general',
      title: 'And the rest of it is settings',
      body: 'Everything below here is set once and forgotten — your details, who can sign in, what you have connected. Each group has a short walk of its own if you want it.',
    },
  ],
};
