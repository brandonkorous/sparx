// Farm Fresh — Home page · Menu (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh-bowls/.

export default {
  id: 'ffb-124',
  type: 'Section',
  props: {},
  class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 items-center p-8 @3xl:p-16',
  name: 'Menu',
  children: [
    {
      id: 'ffb-83',
      type: 'Stack',
      props: {},
      class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
      children: [
        {
          id: 'ffb-76',
          type: 'Text',
          props: {
            variant: 'body',
            text: '🥗 Our Menu',
          },
          class:
            'inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide bg-base-200 text-[#3E5C2A]',
        },
        {
          id: 'ffb-77',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'Made fresh, built for you',
          },
          class: 'text-center text-4xl @3xl:text-5xl',
        },
        {
          id: 'ffb-78',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Every bowl is blended to order with seasonal produce. Pick a signature combination, or build your own at the counter.',
          },
          class: 'text-center max-w-xl',
        },
        {
          id: 'ffb-82',
          type: 'Stack',
          props: {},
          class:
            'mx-auto w-full max-w-site flex flex-col @3xl:flex-row flex-wrap gap-2 justify-center text-center',
          children: [
            {
              id: 'ffb-79',
              type: 'Text',
              props: {
                variant: 'body',
                text: 'Açaí Bowls',
              },
              class:
                'rounded-full px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide bg-primary text-primary-content',
            },
            {
              id: 'ffb-80',
              type: 'Text',
              props: {
                variant: 'body',
                text: 'Smoothies',
              },
              class:
                'rounded-full px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-base-content/50',
            },
            {
              id: 'ffb-81',
              type: 'Text',
              props: {
                variant: 'body',
                text: 'Salads & Grains',
              },
              class:
                'rounded-full px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-base-content/50',
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-96',
      type: 'Stack',
      props: {},
      class: 'w-full flex flex-col gap-4 items-start',
      name: 'Açaí & Smoothie Bowls',
      children: [
        {
          id: 'ffb-84',
          type: 'Heading',
          props: {
            level: 'h3',
            text: 'Açaí & Smoothie Bowls',
          },
          class: 'text-primary text-2xl',
        },
        {
          id: 'ffb-95',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
          children: [
            {
              id: 'ffb-94',
              type: 'Card',
              props: {},
              class:
                'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
              children: [
                {
                  id: 'ffb-87',
                  type: 'Button',
                  props: {},
                  class: 'block',
                  children: [
                    {
                      id: 'ffb-86',
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
                  id: 'ffb-93',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 flex-1',
                  children: [
                    {
                      id: 'ffb-89',
                      type: 'Button',
                      props: {},
                      class: 'block transition-colors hover:text-accent',
                      children: [
                        {
                          id: 'ffb-88',
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
                      id: 'ffb-90',
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
                      id: 'ffb-92',
                      type: 'Stack',
                      props: {},
                      class:
                        'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-between items-center mt-auto w-full',
                      children: [
                        {
                          id: 'ffb-91',
                          type: 'PriceTag',
                          props: {},
                          class: 'text-accent font-extrabold text-lg',
                          binding: {
                            path: 'item.price',
                          },
                        },
                        {
                          id: 'ffb-85',
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
              from: 'category',
              id: 'acai-bowls',
              limit: 3,
            },
          },
        },
      ],
    },
    {
      id: 'ffb-109',
      type: 'Stack',
      props: {},
      class: 'w-full flex flex-col gap-4 items-start',
      name: 'Cold-Pressed Smoothies',
      children: [
        {
          id: 'ffb-97',
          type: 'Heading',
          props: {
            level: 'h3',
            text: 'Cold-Pressed Smoothies',
          },
          class: 'text-primary text-2xl',
        },
        {
          id: 'ffb-108',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6',
          children: [
            {
              id: 'ffb-107',
              type: 'Card',
              props: {},
              class:
                'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
              children: [
                {
                  id: 'ffb-100',
                  type: 'Button',
                  props: {},
                  class: 'block',
                  children: [
                    {
                      id: 'ffb-99',
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
                  id: 'ffb-106',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 flex-1',
                  children: [
                    {
                      id: 'ffb-102',
                      type: 'Button',
                      props: {},
                      class: 'block transition-colors hover:text-accent',
                      children: [
                        {
                          id: 'ffb-101',
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
                      id: 'ffb-103',
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
                      id: 'ffb-105',
                      type: 'Stack',
                      props: {},
                      class:
                        'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-between items-center mt-auto w-full',
                      children: [
                        {
                          id: 'ffb-104',
                          type: 'PriceTag',
                          props: {},
                          class: 'text-accent font-extrabold text-lg',
                          binding: {
                            path: 'item.price',
                          },
                        },
                        {
                          id: 'ffb-98',
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
              from: 'category',
              id: 'smoothies',
              limit: 4,
            },
          },
        },
      ],
    },
    {
      id: 'ffb-122',
      type: 'Stack',
      props: {},
      class: 'w-full flex flex-col gap-4 items-start',
      name: 'Salads & Grain Bowls',
      children: [
        {
          id: 'ffb-110',
          type: 'Heading',
          props: {
            level: 'h3',
            text: 'Salads & Grain Bowls',
          },
          class: 'text-primary text-2xl',
        },
        {
          id: 'ffb-121',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
          children: [
            {
              id: 'ffb-120',
              type: 'Card',
              props: {},
              class:
                'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
              children: [
                {
                  id: 'ffb-113',
                  type: 'Button',
                  props: {},
                  class: 'block',
                  children: [
                    {
                      id: 'ffb-112',
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
                  id: 'ffb-119',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 flex-1',
                  children: [
                    {
                      id: 'ffb-115',
                      type: 'Button',
                      props: {},
                      class: 'block transition-colors hover:text-accent',
                      children: [
                        {
                          id: 'ffb-114',
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
                      id: 'ffb-116',
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
                      id: 'ffb-118',
                      type: 'Stack',
                      props: {},
                      class:
                        'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-between items-center mt-auto w-full',
                      children: [
                        {
                          id: 'ffb-117',
                          type: 'PriceTag',
                          props: {},
                          class: 'text-accent font-extrabold text-lg',
                          binding: {
                            path: 'item.price',
                          },
                        },
                        {
                          id: 'ffb-111',
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
              from: 'category',
              id: 'salads-grains',
              limit: 3,
            },
          },
        },
      ],
    },
    {
      id: 'ffb-123',
      type: 'Button',
      props: {
        label: 'See the full menu',
        href: '/menu',
      },
      class: 'st-btn st-c-accent st-v-solid st-btn--sz-md',
    },
  ],
};
