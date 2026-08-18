import type { ProductTypeDefinition } from '../schema';

// General (docs/143 §5) — the flexible fallback: a free list of labeled detail
// sections for any product that doesn't fit a specific type.
export const generalType: ProductTypeDefinition = {
  key: 'general',
  name: 'General',
  pluralName: 'General',
  description: 'A flexible fallback — a free list of labeled detail sections for any product.',
  icon: 'tag',
  attributeSchema: {
    fields: [
      {
        key: 'details',
        type: 'repeater',
        label: 'Details',
        itemLabel: 'Detail',
        max: 20,
        fields: [
          { key: 'label', type: 'text', label: 'Label', required: true, max: 60 },
          { key: 'body', type: 'long_text', label: 'Body', required: true, max: 1000 },
        ],
      },
    ],
  },
};
