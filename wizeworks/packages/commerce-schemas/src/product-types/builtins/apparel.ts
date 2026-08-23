import type { ProductTypeDefinition } from '../schema';

// Apparel (docs/143 §5) — clothing and worn goods. Covers bold-athletic,
// catalog-dense, couture-serif, natural-clean, playful-mission templates.
export const apparelType: ProductTypeDefinition = {
  key: 'apparel',
  name: 'Apparel',
  pluralName: 'Apparel',
  description: 'Clothing and worn goods — fabric, fit, care, and material composition.',
  icon: '👕',
  attributeSchema: {
    fields: [
      {
        key: 'fabric',
        type: 'long_text',
        label: 'Fabric & construction',
        max: 2000,
        helpText:
          "What it's made of and how it's built. This is product-specific — write it per product.",
      },
      {
        key: 'fit',
        type: 'long_text',
        label: 'Fit',
        max: 1000,
        helpText: "How it's cut and how it wears (relaxed, true-to-size, compressive).",
      },
      {
        key: 'care',
        type: 'long_text',
        label: 'Care',
        max: 1000,
        helpText: 'Washing and care instructions.',
      },
      {
        key: 'materials',
        type: 'repeater',
        label: 'Materials',
        itemLabel: 'Material',
        max: 12,
        fields: [
          { key: 'name', type: 'text', label: 'Material', required: true, max: 60 },
          { key: 'percent', type: 'text', label: 'Percentage', max: 12, helpText: 'e.g. "82%"' },
        ],
      },
      { key: 'origin', type: 'text', label: 'Made in', max: 80 },
    ],
  },
};
