// Tempo — Product page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/tempo/.

export default {
  id: 'tmp-584',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Product',
  children: [
    {
      id: 'tmp-547',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row flex-wrap gap-2 items-center p-6',
      name: 'Breadcrumb',
      children: [
        {
          id: 'tmp-542',
          type: 'el:a',
          props: {
            href: '/',
            text: 'Home',
          },
          class: 'text-sm text-base-content/60 transition-colors hover:text-base-content',
        },
        {
          id: 'tmp-543',
          type: 'el:span',
          props: {
            text: '/',
          },
          class: 'text-base-content/30',
        },
        {
          id: 'tmp-544',
          type: 'el:a',
          props: {
            href: '/shop',
            text: 'Shop',
          },
          class: 'text-sm text-base-content/60 transition-colors hover:text-base-content',
        },
        {
          id: 'tmp-545',
          type: 'el:span',
          props: {
            text: '/',
          },
          class: 'text-base-content/30',
        },
        {
          id: 'tmp-546',
          type: 'el:span',
          props: {
            text: 'Product',
          },
          class: 'text-sm text-base-content/60',
          binding: {
            path: 'product.title',
          },
        },
      ],
    },
    {
      id: 'tmp-565',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-8 items-start p-8 @3xl:p-16',
      name: 'Product detail',
      children: [
        {
          id: 'tmp-548',
          type: 'Image',
          props: {
            ratio: 'square',
            alt: 'Product',
          },
          class: 'w-full bg-base-200',
          binding: {
            path: 'product.images',
          },
        },
        {
          id: 'tmp-564',
          type: 'el:div',
          props: {},
          class: 'flex flex-col gap-7',
          children: [
            {
              id: 'tmp-551',
              type: 'el:div',
              props: {},
              class: 'flex flex-col gap-3',
              children: [
                {
                  id: 'tmp-549',
                  type: 'Heading',
                  props: {
                    level: 'h1',
                  },
                  class:
                    'font-heading text-3xl font-black uppercase leading-tight tracking-tightest text-base-content @3xl:text-4xl',
                  binding: {
                    path: 'product.title',
                  },
                },
                {
                  id: 'tmp-550',
                  type: 'Prose',
                  props: {},
                  class: 'text-base leading-relaxed text-base-content/70',
                  binding: {
                    path: 'product.description',
                  },
                },
              ],
            },
            {
              id: 'tmp-552',
              type: 'BuyBox',
              props: {},
              binding: {
                path: 'product',
              },
            },
            {
              id: 'tmp-553',
              type: 'Divider',
              props: {},
              class: 'w-full border-base-300',
            },
            {
              id: 'tmp-563',
              type: 'el:div',
              props: {},
              class: 'flex flex-col gap-3',
              children: [
                {
                  id: 'tmp-556',
                  type: 'el:div',
                  props: {},
                  class: 'flex items-start gap-3',
                  children: [
                    {
                      id: 'tmp-554',
                      type: 'el:span',
                      props: {
                        text: '🚚',
                      },
                      class: 'text-xl leading-none',
                    },
                    {
                      id: 'tmp-555',
                      type: 'el:span',
                      props: {
                        text: 'Free shipping for Club members, always.',
                      },
                      class: 'text-sm leading-relaxed text-base-content/80',
                    },
                  ],
                },
                {
                  id: 'tmp-559',
                  type: 'el:div',
                  props: {},
                  class: 'flex items-start gap-3',
                  children: [
                    {
                      id: 'tmp-557',
                      type: 'el:span',
                      props: {
                        text: '↩️',
                      },
                      class: 'text-xl leading-none',
                    },
                    {
                      id: 'tmp-558',
                      type: 'el:span',
                      props: {
                        text: 'Free returns within 30 days — no questions asked.',
                      },
                      class: 'text-sm leading-relaxed text-base-content/80',
                    },
                  ],
                },
                {
                  id: 'tmp-562',
                  type: 'el:div',
                  props: {},
                  class: 'flex items-start gap-3',
                  children: [
                    {
                      id: 'tmp-560',
                      type: 'el:span',
                      props: {
                        text: '»',
                      },
                      class: 'text-xl leading-none',
                    },
                    {
                      id: 'tmp-561',
                      type: 'el:span',
                      props: {
                        text: 'Engineered to move, built to last.',
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
      id: 'tmp-583',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
      name: 'You might also like',
      children: [
        {
          id: 'tmp-570',
          type: 'el:div',
          props: {},
          class: 'flex w-full items-end justify-between gap-4',
          children: [
            {
              id: 'tmp-566',
              type: 'el:h2',
              props: {
                text: 'You Might Also Like',
              },
              class:
                'font-heading text-xl font-black uppercase tracking-tightest text-base-content @2xl:text-2xl',
            },
            {
              id: 'tmp-569',
              type: 'el:a',
              props: {
                href: '/shop',
              },
              class:
                'group/al inline-flex w-fit items-center gap-2 border-b-2 border-current pb-1 font-heading text-xs font-bold uppercase tracking-wide',
              children: [
                {
                  id: 'tmp-567',
                  type: 'el:span',
                  props: {
                    text: 'View All',
                  },
                },
                {
                  id: 'tmp-568',
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
          id: 'tmp-582',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-4',
          children: [
            {
              id: 'tmp-581',
              type: 'el:article',
              props: {},
              class: 'group flex flex-col',
              children: [
                {
                  id: 'tmp-575',
                  type: 'el:div',
                  props: {},
                  class: 'relative overflow-hidden bg-base-200',
                  children: [
                    {
                      id: 'tmp-572',
                      type: 'el:button',
                      props: {
                        type: 'button',
                        ariaLabel: 'Add to wishlist',
                      },
                      class:
                        'absolute right-2 top-2 z-10 text-base-content/50 transition-colors hover:text-base-content',
                      children: [
                        {
                          id: 'tmp-571',
                          type: 'Icon',
                          props: {
                            name: 'heart',
                          },
                          class: 'h-5 w-5',
                        },
                      ],
                    },
                    {
                      id: 'tmp-574',
                      type: 'el:a',
                      props: {},
                      class: 'block',
                      children: [
                        {
                          id: 'tmp-573',
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
                  id: 'tmp-580',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-1 flex-col pt-2',
                  children: [
                    {
                      id: 'tmp-577',
                      type: 'el:a',
                      props: {},
                      class: 'block transition-colors hover:text-base-content/70',
                      children: [
                        {
                          id: 'tmp-576',
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
                      id: 'tmp-578',
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
                      id: 'tmp-579',
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
              limit: 4,
            },
          },
        },
      ],
    },
  ],
};
