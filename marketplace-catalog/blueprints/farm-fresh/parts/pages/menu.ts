// Farm Fresh — Menu page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-198',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Menu',
  children: [
    {
      id: 'ffb-183',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Menu intro',
      children: [
        {
          id: 'ffb-183__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'ffb-181',
              type: 'Heading',
              props: {
                level: 'h1',
                size: 'display',
                text: 'The menu',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-182',
              type: 'Text',
              props: {
                variant: 'body',
                text: 'Blended-to-order açaí bowls, cold-pressed smoothies, and hearty grain bowls — built fresh from local ingredients. Order for pickup or free local delivery.',
              },
              class: 'text-center max-w-xl',
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-197',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
      name: 'Menu items',
      children: [
        {
          id: 'ffb-184',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'On the menu',
          },
          class: 'text-primary text-3xl',
        },
        {
          id: 'ffb-185',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Everything we make, blended to order from local ingredients.',
          },
          class: 'text-base-content/70',
        },
        {
          id: 'ffb-196',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
          children: [
            {
              id: 'ffb-195',
              type: 'Card',
              props: {},
              class:
                'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
              children: [
                {
                  id: 'ffb-188',
                  type: 'Button',
                  props: {},
                  class: 'block',
                  children: [
                    {
                      id: 'ffb-187',
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
                  id: 'ffb-194',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 flex-1',
                  children: [
                    {
                      id: 'ffb-190',
                      type: 'Button',
                      props: {},
                      class: 'block transition-colors hover:text-accent',
                      children: [
                        {
                          id: 'ffb-189',
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
                      id: 'ffb-191',
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
                      id: 'ffb-193',
                      type: 'Stack',
                      props: {},
                      class:
                        'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-between items-center mt-auto w-full',
                      children: [
                        {
                          id: 'ffb-192',
                          type: 'PriceTag',
                          props: {},
                          class: 'text-accent font-extrabold text-lg',
                          binding: {
                            path: 'item.price',
                          },
                        },
                        {
                          id: 'ffb-186',
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
            },
          },
        },
      ],
    },
  ],
};
