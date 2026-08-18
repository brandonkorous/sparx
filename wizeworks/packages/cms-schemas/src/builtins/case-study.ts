import type { ContentTypeDefinition } from '../types';

// Customer success story: challenge → solution → results, with a metrics
// repeater for the headline numbers.

export const caseStudyType: ContentTypeDefinition = {
  key: 'case_study',
  name: 'Case study',
  pluralName: 'Case studies',
  description: 'Customer success story with challenge, solution, results, and metrics.',
  urlPattern: '/case-studies/{slug}',
  icon: 'award',
  schema: {
    fields: [
      { key: 'title', type: 'text', label: 'Title', required: true, max: 255 },
      { key: 'client', type: 'text', label: 'Client', required: true, max: 160 },
      { key: 'industry', type: 'text', label: 'Industry', max: 80 },
      { key: 'summary', type: 'long_text', label: 'Summary', required: true, max: 600 },
      { key: 'heroImage', type: 'asset', label: 'Hero image', accept: ['image/*'] },
      { key: 'challenge', type: 'rich_text', label: 'Challenge', required: true },
      { key: 'solution', type: 'rich_text', label: 'Solution', required: true },
      { key: 'results', type: 'rich_text', label: 'Results', required: true },
      {
        key: 'metrics',
        type: 'repeater',
        label: 'Metrics',
        itemLabel: 'Metric',
        max: 6,
        helpText: 'Headline numbers, e.g. "Revenue" / "+40%".',
        fields: [
          { key: 'label', type: 'text', label: 'Label', required: true, max: 80 },
          { key: 'value', type: 'text', label: 'Value', required: true, max: 40 },
        ],
      },
    ],
  },
};
