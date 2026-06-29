// Tempo — Shop page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/tempo/.

export default {
  id: 'tmp-411',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Shop',
  children: [
    {
      id: 'tmp-396',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Page hero',
      children: [
        {
          id: 'tmp-396__c',
          type: 'Stack',
          class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-8 @3xl:p-16',
          props: {},
          children: [
            {
              id: 'tmp-393',
              type: 'el:p',
              props: {
                text: 'New & Trending',
              },
              class:
                'font-heading text-xs font-bold uppercase tracking-[0.2em] text-base-content/50',
            },
            {
              id: 'tmp-394',
              type: 'el:h1',
              props: {
                text: 'Shop everything',
              },
              class:
                'font-heading max-w-3xl text-3xl font-black uppercase leading-[0.95] tracking-tightest text-base-content @2xl:text-5xl',
            },
            {
              id: 'tmp-395',
              type: 'el:p',
              props: {
                text: 'Performance and heritage, on and off the pitch — find your next pair, kit, or layer.',
              },
              class: 'max-w-2xl text-base leading-relaxed text-base-content/70',
            },
          ],
        },
      ],
    },
    {
      id: 'tmp-410',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
      name: 'All products',
      children: [
        {
          id: 'tmp-397',
          type: 'el:h2',
          props: {
            text: 'All products',
          },
          class:
            'font-heading text-xl font-black uppercase tracking-tightest @2xl:text-2xl text-base-content',
        },
        {
          id: 'tmp-409',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-4',
          children: [
            {
              id: 'tmp-408',
              type: 'el:article',
              props: {},
              class: 'group flex flex-col',
              children: [
                {
                  id: 'tmp-402',
                  type: 'el:div',
                  props: {},
                  class: 'relative overflow-hidden bg-base-200',
                  children: [
                    {
                      id: 'tmp-399',
                      type: 'el:button',
                      props: {
                        type: 'button',
                        ariaLabel: 'Add to wishlist',
                      },
                      class:
                        'absolute right-2 top-2 z-10 text-base-content/50 transition-colors hover:text-base-content',
                      children: [
                        {
                          id: 'tmp-398',
                          type: 'Icon',
                          props: {
                            name: 'heart',
                          },
                          class: 'h-5 w-5',
                        },
                      ],
                    },
                    {
                      id: 'tmp-401',
                      type: 'el:a',
                      props: {},
                      class: 'block',
                      children: [
                        {
                          id: 'tmp-400',
                          type: 'Image',
                          props: {
                            ratio: 'square',
                            alt: 'Product',
                          },
                          class: 'w-full transition-transform duration-500 group-hover:scale-105',
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
                  ],
                },
                {
                  id: 'tmp-407',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-1 flex-col pt-2',
                  children: [
                    {
                      id: 'tmp-404',
                      type: 'el:a',
                      props: {},
                      class: 'block transition-colors hover:text-base-content/70',
                      children: [
                        {
                          id: 'tmp-403',
                          type: 'Heading',
                          props: {
                            level: 'h3',
                            text: 'Product',
                          },
                          class:
                            'font-heading text-sm font-bold uppercase tracking-tight text-base-content',
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
                      id: 'tmp-405',
                      type: 'el:p',
                      props: {
                        text: 'A Tempo essential.',
                      },
                      class: 'mt-0.5 line-clamp-1 text-xs text-base-content/55',
                      binding: {
                        path: 'item.description',
                      },
                    },
                    {
                      id: 'tmp-406',
                      type: 'PriceTag',
                      props: {},
                      class: 'mt-1 text-sm font-bold text-base-content',
                      binding: {
                        path: 'item.price',
                      },
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
