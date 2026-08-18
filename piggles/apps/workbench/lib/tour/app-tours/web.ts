// The Web apps — My Site and Content.

import type { Guide } from '../types';

export const SITE_GUIDE: Guide = {
  id: 'builder',
  offer: 'First time in My Site? Show me around',
  steps: [
    {
      id: 'site.pages',
      app: 'site',
      anchor: 'nav-builder.page',
      title: 'Your pages live here',
      body: 'Every page on your website — the front page, About, anything you add. Open one and you edit it directly: drag things around, change the words, add a section.',
    },
    {
      id: 'site.theme',
      app: 'site',
      anchor: 'nav-builder.theme',
      title: 'The look, in one place',
      body: 'Colours, fonts and spacing for the whole site. Change them here and every page follows — you never have to restyle a page one at a time.',
    },
    {
      id: 'site.preview',
      app: 'site',
      anchor: 'nav-builder.preview',
      title: 'See it before anyone else does',
      body: 'Nothing you change is live until you say so. This shows you the site exactly as a visitor would get it, on a phone as well as a laptop.',
    },
    {
      id: 'site.publish',
      app: 'site',
      anchor: 'nav-builder.publish',
      title: 'And this is the moment it goes out',
      body: 'One button, and your changes are on the real site. If something looks wrong afterwards, the history screen puts it back the way it was.',
    },
  ],
};

export const CONTENT_GUIDE: Guide = {
  id: 'cms',
  offer: 'First time in Content? Show me around',
  steps: [
    {
      id: 'content.entries',
      app: 'content',
      anchor: 'nav-cms.content.list',
      title: 'Everything you write goes here',
      body: 'Blog posts, news, notices, case studies — whatever kinds of writing your site has. Write it once here and the site shows it wherever it belongs.',
    },
    {
      id: 'content.media',
      app: 'content',
      anchor: 'nav-cms.media.list',
      title: 'Your photos and files',
      body: 'Upload once, use anywhere. Anything you have put on a page or a product is already in here, so you are never hunting for the original.',
    },
    {
      id: 'content.types',
      app: 'content',
      anchor: 'nav-cms.types.list',
      title: 'When you need a kind of your own',
      body: 'Recipes, venues, staff bios, a fleet list — you decide what a "thing" is and what goes on it, and your site gets a page for each one. Most businesses never need this, and it is here the day you do.',
    },
  ],
};
