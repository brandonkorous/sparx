import type { ProductTypeDefinition } from '../schema';

// Auto Part (docs/143 §5) — vehicle parts for the Gillett / diesel vertical. No
// current site template uses it, but it ships so the diesel vertical has a real
// typed home for fitment + specs the moment it's needed.
export const autoPartType: ProductTypeDefinition = {
  key: 'auto_part',
  name: 'Auto Part',
  pluralName: 'Auto Parts',
  description: 'Vehicle parts — fitment, specifications, and warranty.',
  icon: '🔧',
  attributeSchema: {
    fields: [
      {
        key: 'fitment',
        type: 'long_text',
        label: 'Fitment',
        max: 2000,
        helpText: 'Which vehicles / engines this part fits.',
      },
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
      { key: 'warranty', type: 'long_text', label: 'Warranty', max: 1000 },
    ],
  },
};
