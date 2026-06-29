// Tempo — Home page · Best Sellers (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/tempo/.

export default {
  id: 'tmp-326',
  type: 'Section',
  props: {},
  class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
  name: 'Best Sellers',
  children: [
    {
      id: 'tmp-313',
      type: 'el:div',
      props: {},
      class: 'flex w-full items-end justify-between gap-4',
      children: [
        {
          id: 'tmp-309',
          type: 'el:h2',
          props: {
            text: 'Shop Best Sellers',
          },
          class:
            'font-heading text-xl font-black uppercase tracking-tightest @2xl:text-2xl text-base-content',
        },
        {
          id: 'tmp-312',
          type: 'el:a',
          props: {
            href: '/shop',
          },
          class:
            'group/al inline-flex w-fit items-center gap-2 border-b-2 border-current pb-1 font-heading text-xs font-bold uppercase tracking-wide  pb-0.5',
          children: [
            {
              id: 'tmp-310',
              type: 'el:span',
              props: {
                text: 'View All',
              },
            },
            {
              id: 'tmp-311',
              type: 'Icon',
              props: {
                name: 'arrow-right',
              },
              class: 'h-3.5 w-3.5 transition-transform group-hover/al:translate-x-1',
            },
          ],
        },
      ],
    },
    {
      id: 'tmp-325',
      type: 'Section',
      props: {},
      class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-4',
      children: [
        {
          id: 'tmp-324',
          type: 'el:article',
          props: {},
          class: 'group flex flex-col',
          children: [
            {
              id: 'tmp-318',
              type: 'el:div',
              props: {},
              class: 'relative overflow-hidden bg-base-200',
              children: [
                {
                  id: 'tmp-315',
                  type: 'el:button',
                  props: {
                    type: 'button',
                    ariaLabel: 'Add to wishlist',
                  },
                  class:
                    'absolute right-2 top-2 z-10 text-base-content/50 transition-colors hover:text-base-content',
                  children: [
                    {
                      id: 'tmp-314',
                      type: 'Icon',
                      props: {
                        name: 'heart',
                      },
                      class: 'h-5 w-5',
                    },
                  ],
                },
                {
                  id: 'tmp-317',
                  type: 'el:a',
                  props: {},
                  class: 'block',
                  children: [
                    {
                      id: 'tmp-316',
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
              id: 'tmp-323',
              type: 'el:div',
              props: {},
              class: 'flex flex-1 flex-col pt-2',
              children: [
                {
                  id: 'tmp-320',
                  type: 'el:a',
                  props: {},
                  class: 'block transition-colors hover:text-base-content/70',
                  children: [
                    {
                      id: 'tmp-319',
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
                  id: 'tmp-321',
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
                  id: 'tmp-322',
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
          limit: 8,
        },
      },
    },
  ],
};
