import type { ProductTypeDefinition } from '../schema';

// Home & Objects (docs/143 §5) — furniture, homeware, objects. Covers
// editorial-grid template.
export const homeGoodsType: ProductTypeDefinition = {
  key: 'home_goods',
  name: 'Home & Objects',
  pluralName: 'Home & Objects',
  description: 'Furniture, homeware, and objects — materials, dimensions, and care.',
  icon: '💡',
  attributeSchema: {
    fields: [
      { key: 'materials', type: 'long_text', label: 'Materials', max: 2000 },
      {
        key: 'dimensions',
        type: 'text',
        label: 'Dimensions',
        max: 120,
        helpText: 'e.g. "W 40 × D 40 × H 75 cm"',
      },
      { key: 'care', type: 'long_text', label: 'Care', max: 1000 },
      { key: 'origin', type: 'text', label: 'Made in', max: 80 },
    ],
  },
};
