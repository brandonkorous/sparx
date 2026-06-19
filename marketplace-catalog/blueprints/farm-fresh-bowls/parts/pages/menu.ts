// Farm Fresh — Menu page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh-bowls/.

export default {
  id: 'ffb-253',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Menu',
  children: [
    {
      id: 'ffb-210',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Menu intro',
      children: [
        {
          id: 'ffb-210__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'ffb-208',
              type: 'Heading',
              props: {
                level: 'h1',
                size: 'display',
                text: 'The menu',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-209',
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
      id: 'ffb-224',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
      name: 'Açaí & Smoothie Bowls',
      children: [
        {
          id: 'ffb-211',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'Açaí & Smoothie Bowls',
          },
          class: 'text-primary text-3xl',
        },
        {
          id: 'ffb-212',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Blended to order and piled with fruit, granola, and seeds.',
          },
          class: 'text-base-content/70',
        },
        {
          id: 'ffb-223',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
          children: [
            {
              id: 'ffb-222',
              type: 'Card',
              props: {},
              class:
                'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
              children: [
                {
                  id: 'ffb-215',
                  type: 'Button',
                  props: {},
                  class: 'block',
                  children: [
                    {
                      id: 'ffb-214',
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
                  id: 'ffb-221',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 flex-1',
                  children: [
                    {
                      id: 'ffb-217',
                      type: 'Button',
                      props: {},
                      class: 'block transition-colors hover:text-accent',
                      children: [
                        {
                          id: 'ffb-216',
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
                      id: 'ffb-218',
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
                      id: 'ffb-220',
                      type: 'Stack',
                      props: {},
                      class:
                        'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-between items-center mt-auto w-full',
                      children: [
                        {
                          id: 'ffb-219',
                          type: 'PriceTag',
                          props: {},
                          class: 'text-accent font-extrabold text-lg',
                          binding: {
                            path: 'item.price',
                          },
                        },
                        {
                          id: 'ffb-213',
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
      id: 'ffb-238',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
      name: 'Cold-Pressed Smoothies',
      children: [
        {
          id: 'ffb-225',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'Cold-Pressed Smoothies',
          },
          class: 'text-primary text-3xl',
        },
        {
          id: 'ffb-226',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Fresh-pressed and never from concentrate.',
          },
          class: 'text-base-content/70',
        },
        {
          id: 'ffb-237',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6',
          children: [
            {
              id: 'ffb-236',
              type: 'Card',
              props: {},
              class:
                'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
              children: [
                {
                  id: 'ffb-229',
                  type: 'Button',
                  props: {},
                  class: 'block',
                  children: [
                    {
                      id: 'ffb-228',
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
                  id: 'ffb-235',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 flex-1',
                  children: [
                    {
                      id: 'ffb-231',
                      type: 'Button',
                      props: {},
                      class: 'block transition-colors hover:text-accent',
                      children: [
                        {
                          id: 'ffb-230',
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
                      id: 'ffb-232',
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
                      id: 'ffb-234',
                      type: 'Stack',
                      props: {},
                      class:
                        'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-between items-center mt-auto w-full',
                      children: [
                        {
                          id: 'ffb-233',
                          type: 'PriceTag',
                          props: {},
                          class: 'text-accent font-extrabold text-lg',
                          binding: {
                            path: 'item.price',
                          },
                        },
                        {
                          id: 'ffb-227',
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
      id: 'ffb-252',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
      name: 'Salads & Grain Bowls',
      children: [
        {
          id: 'ffb-239',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'Salads & Grain Bowls',
          },
          class: 'text-primary text-3xl',
        },
        {
          id: 'ffb-240',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Hearty, balanced, and made to fuel your day.',
          },
          class: 'text-base-content/70',
        },
        {
          id: 'ffb-251',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
          children: [
            {
              id: 'ffb-250',
              type: 'Card',
              props: {},
              class:
                'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
              children: [
                {
                  id: 'ffb-243',
                  type: 'Button',
                  props: {},
                  class: 'block',
                  children: [
                    {
                      id: 'ffb-242',
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
                  id: 'ffb-249',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 flex-1',
                  children: [
                    {
                      id: 'ffb-245',
                      type: 'Button',
                      props: {},
                      class: 'block transition-colors hover:text-accent',
                      children: [
                        {
                          id: 'ffb-244',
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
                      id: 'ffb-246',
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
                      id: 'ffb-248',
                      type: 'Stack',
                      props: {},
                      class:
                        'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-between items-center mt-auto w-full',
                      children: [
                        {
                          id: 'ffb-247',
                          type: 'PriceTag',
                          props: {},
                          class: 'text-accent font-extrabold text-lg',
                          binding: {
                            path: 'item.price',
                          },
                        },
                        {
                          id: 'ffb-241',
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
