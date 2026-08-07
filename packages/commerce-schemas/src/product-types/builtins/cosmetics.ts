import type { ProductTypeDefinition } from '../schema';

// Beauty & Personal Care (docs/143 §5) — skincare, cosmetics, personal care.
// Covers beauty-counter, luxe-minimal templates.
export const cosmeticsType: ProductTypeDefinition = {
  key: 'cosmetics',
  name: 'Beauty & Personal Care',
  pluralName: 'Beauty & Personal Care',
  description: 'Skincare, cosmetics, and personal care — ingredients, usage, and skin type.',
  icon: 'sparkles',
  attributeSchema: {
    fields: [
      {
        key: 'keyIngredients',
        type: 'long_text',
        label: 'Key ingredients',
        max: 2000,
        helpText: 'The hero ingredients and what they do.',
      },
      { key: 'howToUse', type: 'long_text', label: 'How to use', max: 2000 },
      {
        key: 'skinType',
        type: 'enum',
        label: 'Skin type',
        multiple: true,
        options: [
          { value: 'all', label: 'All skin types' },
          { value: 'dry', label: 'Dry' },
          { value: 'oily', label: 'Oily' },
          { value: 'combination', label: 'Combination' },
          { value: 'sensitive', label: 'Sensitive' },
          { value: 'normal', label: 'Normal' },
        ],
      },
      { key: 'volume', type: 'text', label: 'Size', max: 40, helpText: 'e.g. "50 ml / 1.7 fl oz"' },
      {
        key: 'fullIngredients',
        type: 'long_text',
        label: 'Full ingredients (INCI)',
        max: 5000,
        helpText: 'The complete INCI list.',
      },
    ],
  },
};
