import type { ProductTypeDefinition } from '../schema';

// Electronics (docs/143 §5) — devices and gear. Covers tech-cinematic template.
export const electronicsType: ProductTypeDefinition = {
  key: 'electronics',
  name: 'Electronics',
  pluralName: 'Electronics',
  description: 'Devices and gear — specifications, connectivity, box contents, and warranty.',
  icon: 'cpu',
  attributeSchema: {
    fields: [
      {
        key: 'specs',
        type: 'repeater',
        label: 'Specifications',
        itemLabel: 'Spec',
        max: 40,
        fields: [
          { key: 'label', type: 'text', label: 'Spec', required: true, max: 60 },
          { key: 'value', type: 'text', label: 'Value', required: true, max: 120 },
        ],
      },
      { key: 'connectivity', type: 'long_text', label: 'Connectivity', max: 1000 },
      { key: 'inTheBox', type: 'long_text', label: 'In the box', max: 1000 },
      { key: 'warranty', type: 'long_text', label: 'Warranty', max: 1000 },
    ],
  },
};
