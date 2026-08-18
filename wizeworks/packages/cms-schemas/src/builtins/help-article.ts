import type { ContentTypeDefinition } from '../types';

// A knowledge-base / help-center / documentation article. `category` groups the
// help index without the overhead of a full taxonomy for a small set.

export const helpArticleType: ContentTypeDefinition = {
  key: 'help_article',
  name: 'Help article',
  pluralName: 'Help center',
  description: 'A knowledge-base or documentation article.',
  urlPattern: '/help/{slug}',
  icon: 'life-buoy',
  schema: {
    fields: [
      { key: 'title', type: 'text', label: 'Title', required: true, max: 200 },
      {
        key: 'summary',
        type: 'long_text',
        label: 'Summary',
        max: 400,
        helpText: 'One-line answer shown in the help index and search results.',
      },
      { key: 'body', type: 'rich_text', label: 'Body', required: true },
      {
        key: 'category',
        type: 'text',
        label: 'Category',
        max: 80,
        helpText: 'Grouping label, e.g. "Billing" or "Getting started".',
      },
    ],
  },
};
