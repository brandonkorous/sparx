import type { ProductTypeDefinition } from '../schema';

// Food & Beverage (docs/143 §5) — edible and drinkable goods. Covers
// warm-subscription template.
export const foodBeverageType: ProductTypeDefinition = {
  key: 'food_beverage',
  name: 'Food & Beverage',
  pluralName: 'Food & Beverage',
  description: 'Edible and drinkable goods — ingredients, allergens, storage, and nutrition.',
  icon: 'utensils-crossed',
  attributeSchema: {
    fields: [
      { key: 'ingredients', type: 'long_text', label: 'Ingredients', max: 3000 },
      {
        key: 'allergens',
        type: 'enum',
        label: 'Allergens',
        multiple: true,
        options: [
          { value: 'milk', label: 'Milk' },
          { value: 'eggs', label: 'Eggs' },
          { value: 'fish', label: 'Fish' },
          { value: 'shellfish', label: 'Shellfish' },
          { value: 'tree_nuts', label: 'Tree nuts' },
          { value: 'peanuts', label: 'Peanuts' },
          { value: 'wheat', label: 'Wheat' },
          { value: 'soybeans', label: 'Soybeans' },
          { value: 'sesame', label: 'Sesame' },
          { value: 'gluten', label: 'Gluten' },
        ],
      },
      { key: 'netWeight', type: 'text', label: 'Net weight', max: 40 },
      { key: 'storage', type: 'long_text', label: 'Storage', max: 1000 },
      {
        key: 'nutrition',
        type: 'repeater',
        label: 'Nutrition',
        itemLabel: 'Row',
        max: 40,
        fields: [
          { key: 'label', type: 'text', label: 'Nutrient', required: true, max: 60 },
          { key: 'value', type: 'text', label: 'Amount', required: true, max: 40 },
        ],
      },
    ],
  },
};
