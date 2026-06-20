// Farm Fresh — Product page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-439',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Product',
  children: [
    {
      id: 'ffb-392',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row flex-wrap gap-2 items-center p-6',
      name: 'Breadcrumb',
      children: [
        {
          id: 'ffb-387',
          type: 'Button',
          props: {
            label: 'Home',
            href: '/',
          },
          class: 'text-sm text-base-content/60 transition-colors hover:text-accent',
        },
        {
          id: 'ffb-388',
          type: 'Text',
          props: {
            variant: 'body',
            text: '/',
          },
          class: 'text-base-content/30',
        },
        {
          id: 'ffb-389',
          type: 'Button',
          props: {
            label: 'Menu',
            href: '/menu',
          },
          class: 'text-sm text-base-content/60 transition-colors hover:text-accent',
        },
        {
          id: 'ffb-390',
          type: 'Text',
          props: {
            variant: 'body',
            text: '/',
          },
          class: 'text-base-content/30',
        },
        {
          id: 'ffb-391',
          type: 'Text',
          props: {},
          class: 'text-sm text-base-content/60',
          binding: {
            path: 'product.title',
          },
        },
      ],
    },
    {
      id: 'ffb-411',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 items-start p-8 @3xl:p-16',
      name: 'Product detail',
      children: [
        {
          id: 'ffb-393',
          type: 'Image',
          props: {
            ratio: 'square',
            alt: 'Bowl',
          },
          class: 'w-full rounded-box shadow-lg',
          binding: {
            path: 'product.images',
          },
        },
        {
          id: 'ffb-410',
          type: 'Stack',
          props: {},
          class: 'mx-auto w-full max-w-site flex flex-col gap-6 items-start',
          children: [
            {
              id: 'ffb-397',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
              children: [
                {
                  id: 'ffb-394',
                  type: 'Badge',
                  props: {
                    label: 'Made to order',
                  },
                  class: 'st-badge st-c-primary st-v-soft st-badge--sz-sm',
                },
                {
                  id: 'ffb-395',
                  type: 'Heading',
                  props: {
                    level: 'h1',
                  },
                  class: 'text-4xl leading-tight @3xl:text-5xl',
                  binding: {
                    path: 'product.title',
                  },
                },
                {
                  id: 'ffb-396',
                  type: 'Prose',
                  props: {},
                  class: 'text-lg leading-relaxed text-base-content/70',
                  binding: {
                    path: 'product.description',
                  },
                },
              ],
            },
            {
              id: 'ffb-398',
              type: 'BuyBox',
              props: {},
              binding: {
                path: 'product',
              },
            },
            {
              id: 'ffb-399',
              type: 'Divider',
              props: {},
              class: 'w-full border-base-300',
            },
            {
              id: 'ffb-409',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
              children: [
                {
                  id: 'ffb-402',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-start',
                  children: [
                    {
                      id: 'ffb-400',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: '🌿',
                      },
                      class: 'text-xl leading-none',
                    },
                    {
                      id: 'ffb-401',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: 'Local, wholesome ingredients — nothing artificial, ever.',
                      },
                      class: 'text-sm leading-relaxed text-base-content/80',
                    },
                  ],
                },
                {
                  id: 'ffb-405',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-start',
                  children: [
                    {
                      id: 'ffb-403',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: '🥣',
                      },
                      class: 'text-xl leading-none',
                    },
                    {
                      id: 'ffb-404',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: 'Blended to order, never sitting in storage.',
                      },
                      class: 'text-sm leading-relaxed text-base-content/80',
                    },
                  ],
                },
                {
                  id: 'ffb-408',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-start',
                  children: [
                    {
                      id: 'ffb-406',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: '🚲',
                      },
                      class: 'text-xl leading-none',
                    },
                    {
                      id: 'ffb-407',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: 'Free local delivery on orders over $35.',
                      },
                      class: 'text-sm leading-relaxed text-base-content/80',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-424',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Why bowls',
      children: [
        {
          id: 'ffb-424__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
          props: {},
          children: [
            {
              id: 'ffb-415',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
              children: [
                {
                  id: 'ffb-412',
                  type: 'Text',
                  props: {
                    variant: 'body',
                    text: '🌾',
                  },
                  class:
                    'h-16 w-16 bg-base-200 text-3xl shrink-0 inline-flex items-center justify-center rounded-full leading-none',
                },
                {
                  id: 'ffb-413',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Locally Sourced',
                  },
                  class: 'text-center text-lg',
                },
                {
                  id: 'ffb-414',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: 'From farms within 60 miles',
                  },
                  class: 'text-center text-sm',
                },
              ],
            },
            {
              id: 'ffb-419',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
              children: [
                {
                  id: 'ffb-416',
                  type: 'Text',
                  props: {
                    variant: 'body',
                    text: '⚖️',
                  },
                  class:
                    'h-16 w-16 bg-base-200 text-3xl shrink-0 inline-flex items-center justify-center rounded-full leading-none',
                },
                {
                  id: 'ffb-417',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Balanced Macros',
                  },
                  class: 'text-center text-lg',
                },
                {
                  id: 'ffb-418',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: 'Portioned by nutritionists',
                  },
                  class: 'text-center text-sm',
                },
              ],
            },
            {
              id: 'ffb-423',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
              children: [
                {
                  id: 'ffb-420',
                  type: 'Text',
                  props: {
                    variant: 'body',
                    text: '♻️',
                  },
                  class:
                    'h-16 w-16 bg-base-200 text-3xl shrink-0 inline-flex items-center justify-center rounded-full leading-none',
                },
                {
                  id: 'ffb-421',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Eco Packaging',
                  },
                  class: 'text-center text-lg',
                },
                {
                  id: 'ffb-422',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '100% compostable bowls',
                  },
                  class: 'text-center text-sm',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-438',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 items-start p-8 @3xl:p-16',
      name: 'You might also like',
      children: [
        {
          id: 'ffb-425',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'You might also like',
          },
          class: 'text-primary text-3xl',
        },
        {
          id: 'ffb-426',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'More fresh favorites our regulars order on repeat.',
          },
          class: 'text-base-content/70',
        },
        {
          id: 'ffb-437',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6',
          children: [
            {
              id: 'ffb-436',
              type: 'Card',
              props: {},
              class:
                'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
              children: [
                {
                  id: 'ffb-429',
                  type: 'Button',
                  props: {},
                  class: 'block',
                  children: [
                    {
                      id: 'ffb-428',
                      type: 'Image',
                      props: {
                        ratio: 'square',
                        alt: 'Bowl',
                      },
                      class: 'w-full',
                      binding: {
                        path: 'item.images',
                      },
                    },
                  ],
                  binding: {
                    action: 'link',
                    href: '/products/{{item.handle}}',
                  },
                },
                {
                  id: 'ffb-435',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 flex-1',
                  children: [
                    {
                      id: 'ffb-431',
                      type: 'Button',
                      props: {},
                      class: 'block transition-colors hover:text-accent',
                      children: [
                        {
                          id: 'ffb-430',
                          type: 'Heading',
                          props: {
                            level: 'h3',
                            text: 'Bowl',
                          },
                          class: 'text-xl',
                          binding: {
                            path: 'item.title',
                          },
                        },
                      ],
                      binding: {
                        action: 'link',
                        href: '/products/{{item.handle}}',
                      },
                    },
                    {
                      id: 'ffb-432',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: 'A fresh, balanced bowl.',
                      },
                      class: 'text-sm leading-relaxed text-base-content/70',
                      binding: {
                        path: 'item.description',
                      },
                    },
                    {
                      id: 'ffb-434',
                      type: 'Stack',
                      props: {},
                      class:
                        'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-between items-center mt-auto w-full',
                      children: [
                        {
                          id: 'ffb-433',
                          type: 'PriceTag',
                          props: {},
                          class: 'text-accent font-extrabold text-lg',
                          binding: {
                            path: 'item.price',
                          },
                        },
                        {
                          id: 'ffb-427',
                          type: 'Button',
                          props: {
                            label: 'Add',
                          },
                          class: 'st-btn st-c-accent st-v-solid st-btn--sz-sm whitespace-nowrap',
                          binding: {
                            action: 'add-to-cart',
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
          binding: {
            source: {
              from: 'collection',
              id: 'fan-favorites',
              limit: 4,
            },
          },
        },
      ],
    },
  ],
};
