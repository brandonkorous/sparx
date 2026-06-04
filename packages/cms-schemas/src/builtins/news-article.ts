import type { ContentTypeDefinition } from '../types';

// News / press coverage. Distinct from blog_post in intent — curated news and
// press mentions, optionally linking out to an external source.

export const newsArticleType: ContentTypeDefinition = {
  key: 'news_article',
  name: 'News article',
  pluralName: 'News',
  description: 'News item or press mention, optionally linking to an external source.',
  urlPattern: '/news/{slug}',
  icon: 'newspaper',
  schema: {
    fields: [
      { key: 'title', type: 'text', label: 'Title', required: true, max: 255 },
      {
        key: 'excerpt',
        type: 'long_text',
        label: 'Excerpt',
        required: true,
        max: 500,
        helpText: 'Shown on index pages, in feeds, and in search results.',
      },
      { key: 'body', type: 'rich_text', label: 'Body' },
      { key: 'featuredImage', type: 'asset', label: 'Featured image', accept: ['image/*'] },
      {
        key: 'source',
        type: 'text',
        label: 'Source',
        max: 120,
        helpText: 'Publication or outlet, for curated coverage.',
      },
      {
        key: 'externalUrl',
        type: 'url',
        label: 'External URL',
        helpText: 'Link to the original article when this is outside coverage.',
      },
    ],
  },
};
