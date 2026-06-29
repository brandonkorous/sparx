// Farm Fresh — Product page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-368',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Product',
  children: [
    {
      id: 'ffb-321',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row flex-wrap gap-2 items-center p-6',
      name: 'Breadcrumb',
      children: [
        {
          id: 'ffb-316',
          type: 'Button',
          props: {
            label: 'Home',
            href: '/',
          },
          class: 'text-sm text-base-content/60 transition-colors hover:text-accent',
        },
        {
          id: 'ffb-317',
          type: 'Text',
          props: {
            variant: 'body',
            text: '/',
          },
          class: 'text-base-content/30',
        },
        {
          id: 'ffb-318',
          type: 'Button',
          props: {
            label: 'Menu',
            href: '/menu',
          },
          class: 'text-sm text-base-content/60 transition-colors hover:text-accent',
        },
        {
          id: 'ffb-319',
          type: 'Text',
          props: {
            variant: 'body',
            text: '/',
          },
          class: 'text-base-content/30',
        },
        {
          id: 'ffb-320',
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
      id: 'ffb-340',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-8 items-start p-8 @3xl:p-16',
      name: 'Product detail',
      children: [
        {
          id: 'ffb-322',
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
          id: 'ffb-339',
          type: 'Stack',
          props: {},
          class: 'mx-auto w-full max-w-site flex flex-col gap-6 items-start',
          children: [
            {
              id: 'ffb-326',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
              children: [
                {
                  id: 'ffb-323',
                  type: 'Badge',
                  props: {
                    label: 'Made to order',
                  },
                  class: 'st-badge st-c-primary st-v-soft st-badge--sz-sm',
                },
                {
                  id: 'ffb-324',
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
                  id: 'ffb-325',
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
              id: 'ffb-327',
              type: 'BuyBox',
              props: {},
              binding: {
                path: 'product',
              },
            },
            {
              id: 'ffb-328',
              type: 'Divider',
              props: {},
              class: 'w-full border-base-300',
            },
            {
              id: 'ffb-338',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
              children: [
                {
                  id: 'ffb-331',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-start',
                  children: [
                    {
                      id: 'ffb-329',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: '🌿',
                      },
                      class: 'text-xl leading-none',
                    },
                    {
                      id: 'ffb-330',
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
                  id: 'ffb-334',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-start',
                  children: [
                    {
                      id: 'ffb-332',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: '🥣',
                      },
                      class: 'text-xl leading-none',
                    },
                    {
                      id: 'ffb-333',
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
                  id: 'ffb-337',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-start',
                  children: [
                    {
                      id: 'ffb-335',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: '🚲',
                      },
                      class: 'text-xl leading-none',
                    },
                    {
                      id: 'ffb-336',
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
      id: 'ffb-353',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Why bowls',
      children: [
        {
          id: 'ffb-353__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
          props: {},
          children: [
            {
              id: 'ffb-344',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
              children: [
                {
                  id: 'ffb-341',
                  type: 'Text',
                  props: {
                    variant: 'body',
                    text: '🌾',
                  },
                  class:
                    'h-16 w-16 bg-base-200 text-3xl shrink-0 inline-flex items-center justify-center rounded-full leading-none',
                },
                {
                  id: 'ffb-342',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Locally Sourced',
                  },
                  class: 'text-center text-lg',
                },
                {
                  id: 'ffb-343',
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
              id: 'ffb-348',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
              children: [
                {
                  id: 'ffb-345',
                  type: 'Text',
                  props: {
                    variant: 'body',
                    text: '⚖️',
                  },
                  class:
                    'h-16 w-16 bg-base-200 text-3xl shrink-0 inline-flex items-center justify-center rounded-full leading-none',
                },
                {
                  id: 'ffb-346',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Balanced Macros',
                  },
                  class: 'text-center text-lg',
                },
                {
                  id: 'ffb-347',
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
              id: 'ffb-352',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
              children: [
                {
                  id: 'ffb-349',
                  type: 'Text',
                  props: {
                    variant: 'body',
                    text: '♻️',
                  },
                  class:
                    'h-16 w-16 bg-base-200 text-3xl shrink-0 inline-flex items-center justify-center rounded-full leading-none',
                },
                {
                  id: 'ffb-350',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Eco Packaging',
                  },
                  class: 'text-center text-lg',
                },
                {
                  id: 'ffb-351',
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
      id: 'ffb-367',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 items-start p-8 @3xl:p-16',
      name: 'You might also like',
      children: [
        {
          id: 'ffb-354',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'You might also like',
          },
          class: 'text-primary text-3xl',
        },
        {
          id: 'ffb-355',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'More fresh favorites our regulars order on repeat.',
          },
          class: 'text-base-content/70',
        },
        {
          id: 'ffb-366',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6',
          children: [
            {
              id: 'ffb-365',
              type: 'Card',
              props: {},
              class:
                'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
              children: [
                {
                  id: 'ffb-358',
                  type: 'Button',
                  props: {},
                  class: 'block',
                  children: [
                    {
                      id: 'ffb-357',
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
                  id: 'ffb-364',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 flex-1',
                  children: [
                    {
                      id: 'ffb-360',
                      type: 'Button',
                      props: {},
                      class: 'block transition-colors hover:text-accent',
                      children: [
                        {
                          id: 'ffb-359',
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
                      id: 'ffb-361',
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
                      id: 'ffb-363',
                      type: 'Stack',
                      props: {},
                      class:
                        'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-between items-center mt-auto w-full',
                      children: [
                        {
                          id: 'ffb-362',
                          type: 'PriceTag',
                          props: {},
                          class: 'text-accent font-extrabold text-lg',
                          binding: {
                            path: 'item.price',
                          },
                        },
                        {
                          id: 'ffb-356',
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
              from: 'all',
              limit: 4,
            },
          },
        },
      ],
    },
  ],
};
