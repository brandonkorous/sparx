// Farm Fresh Bowls generator — menu showcase copy for the home page menu groups
// (Açaí & Smoothie Bowls / Cold-Pressed Smoothies / Salads & Grain Bowls). Pure data;
// the commerce catalog (commerce.ts) carries the same items as real products.

import { type MenuItem } from './_kit';

export const ACAI: MenuItem[] = [
  {
    name: 'Midnight Açaí',
    price: '$11.50',
    desc: 'Pure açaí blended with banana & almond milk, topped with granola, blueberries, coconut and raw honey.',
    tags: ['Vegan', 'Antioxidant'],
    seed: 'acai',
  },
  {
    name: 'Strawberry Fields',
    price: '$10.75',
    desc: 'Local strawberries & dragon fruit over a creamy banana base, finished with hemp hearts and mint.',
    tags: ['Gluten-Free', 'Local'],
    seed: 'strawberry',
  },
  {
    name: 'Green Machine',
    price: '$11.95',
    desc: 'Spinach, kale, kiwi and pineapple blended smooth, topped with kiwi, chia and house granola.',
    tags: ['Detox', 'Vegan'],
    seed: 'green',
  },
];

export const SMOOTHIES: MenuItem[] = [
  {
    name: 'Mango Sunrise',
    price: '$8.25',
    desc: 'Mango, orange, carrot & turmeric with a ginger kick.',
    tags: [],
    seed: 'mango',
  },
  {
    name: 'Blue Recovery',
    price: '$8.75',
    desc: 'Wild blueberry, banana, oat milk & plant protein.',
    tags: [],
    seed: 'blueberry',
  },
  {
    name: 'Citrus Glow',
    price: '$7.95',
    desc: 'Orange, pineapple, lemon & a hint of cayenne.',
    tags: [],
    seed: 'citrus',
  },
  {
    name: 'Coco Almond',
    price: '$8.50',
    desc: 'Coconut, almond butter, dates, banana & cinnamon.',
    tags: [],
    seed: 'coconut',
  },
];

export const SALADS: MenuItem[] = [
  {
    name: 'Harvest Kale',
    price: '$12.50',
    desc: 'Massaged kale, roasted squash, quinoa, pomegranate & tahini-lemon dressing.',
    tags: ['High-Protein', 'Seasonal'],
    seed: 'kale',
  },
  {
    name: 'Avocado Power',
    price: '$13.25',
    desc: 'Brown rice, avocado, edamame, cucumber, pickled carrot & sesame-ginger.',
    tags: ['Vegan', 'Filling'],
    seed: 'avocado',
  },
  {
    name: 'Southwest Grain',
    price: '$12.95',
    desc: 'Farro, black beans, roasted corn, peppers, cilantro & chipotle-lime crema.',
    tags: ['Hearty', 'Local'],
    seed: 'southwest',
  },
];
