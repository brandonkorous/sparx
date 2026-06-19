// Farm Fresh — Menu page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh-bowls/.

export default {
  id: 'ffb-315',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Menu',
  children: [
    {
      id: 'ffb-278',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Menu intro',
      children: [
        {
          id: 'ffb-278__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'ffb-276',
              type: 'Heading',
              props: {
                level: 'h1',
                size: 'display',
                text: 'The menu',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-277',
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
      id: 'ffb-290',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
      name: 'Açaí & Smoothie Bowls',
      children: [
        {
          id: 'ffb-288',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'Açaí & Smoothie Bowls',
          },
          class: 'text-primary text-3xl',
        },
        {
          id: 'ffb-289',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Blended to order and piled with fruit, granola, and seeds.',
          },
          class: 'text-base-content/70',
        },
        {
          id: 'ffb-287',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
          children: [
            {
              id: 'ffb-286',
              type: 'Card',
              props: {},
              class:
                'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
              children: [
                {
                  id: 'ffb-280',
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
                {
                  id: 'ffb-285',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 flex-1',
                  children: [
                    {
                      id: 'ffb-281',
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
                    {
                      id: 'ffb-282',
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
                      id: 'ffb-284',
                      type: 'Stack',
                      props: {},
                      class:
                        'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-between items-center mt-auto w-full',
                      children: [
                        {
                          id: 'ffb-283',
                          type: 'PriceTag',
                          props: {},
                          class: 'text-accent font-extrabold text-lg',
                          binding: {
                            path: 'item.price',
                          },
                        },
                        {
                          id: 'ffb-279',
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
            },
          },
        },
      ],
    },
    {
      id: 'ffb-302',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
      name: 'Cold-Pressed Smoothies',
      children: [
        {
          id: 'ffb-300',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'Cold-Pressed Smoothies',
          },
          class: 'text-primary text-3xl',
        },
        {
          id: 'ffb-301',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Fresh-pressed and never from concentrate.',
          },
          class: 'text-base-content/70',
        },
        {
          id: 'ffb-299',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6',
          children: [
            {
              id: 'ffb-298',
              type: 'Card',
              props: {},
              class:
                'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
              children: [
                {
                  id: 'ffb-292',
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
                {
                  id: 'ffb-297',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 flex-1',
                  children: [
                    {
                      id: 'ffb-293',
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
                    {
                      id: 'ffb-294',
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
                      id: 'ffb-296',
                      type: 'Stack',
                      props: {},
                      class:
                        'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-between items-center mt-auto w-full',
                      children: [
                        {
                          id: 'ffb-295',
                          type: 'PriceTag',
                          props: {},
                          class: 'text-accent font-extrabold text-lg',
                          binding: {
                            path: 'item.price',
                          },
                        },
                        {
                          id: 'ffb-291',
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
            },
          },
        },
      ],
    },
    {
      id: 'ffb-314',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
      name: 'Salads & Grain Bowls',
      children: [
        {
          id: 'ffb-312',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'Salads & Grain Bowls',
          },
          class: 'text-primary text-3xl',
        },
        {
          id: 'ffb-313',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Hearty, balanced, and made to fuel your day.',
          },
          class: 'text-base-content/70',
        },
        {
          id: 'ffb-311',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
          children: [
            {
              id: 'ffb-310',
              type: 'Card',
              props: {},
              class:
                'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
              children: [
                {
                  id: 'ffb-304',
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
                {
                  id: 'ffb-309',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 flex-1',
                  children: [
                    {
                      id: 'ffb-305',
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
                    {
                      id: 'ffb-306',
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
                      id: 'ffb-308',
                      type: 'Stack',
                      props: {},
                      class:
                        'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-between items-center mt-auto w-full',
                      children: [
                        {
                          id: 'ffb-307',
                          type: 'PriceTag',
                          props: {},
                          class: 'text-accent font-extrabold text-lg',
                          binding: {
                            path: 'item.price',
                          },
                        },
                        {
                          id: 'ffb-303',
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
            },
          },
        },
      ],
    },
  ],
};
