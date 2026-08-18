import type { ContentTypeDefinition } from '../types';

// Marketing / campaign landing page. The page-level successor to the widget
// `module` type (docs/51 §7): a routable shape with a hero and an inline
// `features` repeater — the old standalone `feature` content type is reborn
// here as nested fields, rendered by the feature-grid builder component.

export const landingPageType: ContentTypeDefinition = {
  key: 'landing_page',
  name: 'Landing page',
  pluralName: 'Landing pages',
  description: 'Campaign or product landing page with a hero, feature grid, and CTA.',
  urlPattern: '/{slug}',
  icon: 'rocket',
  schema: {
    fields: [
      { key: 'title', type: 'text', label: 'Title', required: true, max: 255 },
      {
        key: 'eyebrow',
        type: 'text',
        label: 'Eyebrow',
        max: 80,
        helpText: 'Short label above the headline.',
      },
      { key: 'headline', type: 'text', label: 'Headline', required: true, max: 200 },
      { key: 'subheadline', type: 'long_text', label: 'Subheadline', max: 400 },
      { key: 'heroImage', type: 'asset', label: 'Hero image', accept: ['image/*'] },
      { key: 'body', type: 'rich_text', label: 'Body' },
      {
        key: 'features',
        type: 'repeater',
        label: 'Features',
        itemLabel: 'Feature',
        max: 12,
        helpText: 'Feature cards rendered by the feature-grid component.',
        fields: [
          { key: 'title', type: 'text', label: 'Title', required: true, max: 120 },
          { key: 'body', type: 'long_text', label: 'Body', required: true, max: 600 },
          {
            key: 'icon',
            type: 'text',
            label: 'Icon',
            max: 40,
            helpText: 'Lucide icon name (optional).',
          },
        ],
      },
      { key: 'ctaLabel', type: 'text', label: 'CTA label', max: 60 },
      { key: 'ctaUrl', type: 'url', label: 'CTA URL' },
    ],
  },
};
