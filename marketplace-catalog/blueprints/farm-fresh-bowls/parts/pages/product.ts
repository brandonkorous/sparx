// Farm Fresh Bowls — Product page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/gen-farm-fresh-bowls.ts.

export default {
  id: 'ffb-318',
  type: 'Section',
  props: {},
  class:
    'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 items-start p-8 @3xl:p-16',
  name: 'Product',
  children: [
    {
      id: 'ffb-313',
      type: 'Image',
      props: {
        ratio: 'square',
        alt: 'Bowl',
      },
      binding: {
        path: 'product.images',
      },
    },
    {
      id: 'ffb-317',
      type: 'Stack',
      props: {},
      class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start',
      children: [
        {
          id: 'ffb-314',
          type: 'Heading',
          props: {
            level: 'h1',
          },
          binding: {
            path: 'product.title',
          },
        },
        {
          id: 'ffb-315',
          type: 'Prose',
          props: {},
          binding: {
            path: 'product.description',
          },
        },
        {
          id: 'ffb-316',
          type: 'BuyBox',
          props: {},
          binding: {
            path: 'product',
          },
        },
      ],
    },
  ],
};
