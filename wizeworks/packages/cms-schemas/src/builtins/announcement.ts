import type { ContentTypeDefinition } from '../types';

// A first-party company announcement / press release. Distinct from
// news_article (curated outside coverage) — this is your own news, with a full
// rich body rather than an outbound link.

export const announcementType: ContentTypeDefinition = {
  key: 'announcement',
  name: 'Announcement',
  pluralName: 'Announcements',
  description: 'A first-party company announcement or press release.',
  urlPattern: '/press/{slug}',
  icon: 'megaphone',
  schema: {
    fields: [
      { key: 'title', type: 'text', label: 'Title', required: true, max: 255 },
      {
        key: 'excerpt',
        type: 'long_text',
        label: 'Excerpt',
        required: true,
        max: 400,
        helpText: 'Shown on index pages, in feeds, and in search results.',
      },
      { key: 'body', type: 'rich_text', label: 'Body', required: true },
      { key: 'featuredImage', type: 'asset', label: 'Featured image', accept: ['image/*'] },
    ],
  },
};
