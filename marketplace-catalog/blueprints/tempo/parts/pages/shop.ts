// Tempo — Shop page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/tempo/.

export default {
  id: 'tmp-469',
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
                text: 'Performance and heritage, on and off the pitch — find your next pair, kit, or layer across every category.',
              },
              class: 'max-w-2xl text-base leading-relaxed text-base-content/70',
            },
          ],
        },
      ],
    },
    {
      id: 'tmp-414',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
      name: 'Originals',
      children: [
        {
          id: 'tmp-401',
          type: 'el:div',
          props: {},
          class: 'flex w-full items-end justify-between gap-4',
          children: [
            {
              id: 'tmp-397',
              type: 'el:h2',
              props: {
                text: 'Originals',
              },
              class:
                'font-heading text-xl font-black uppercase tracking-tightest @2xl:text-2xl text-base-content',
            },
            {
              id: 'tmp-400',
              type: 'el:a',
              props: {
                href: '/shop',
              },
              class:
                'group/al inline-flex w-fit items-center gap-2 border-b-2 border-current pb-1 font-heading text-xs font-bold uppercase tracking-wide  pb-0.5',
              children: [
                {
                  id: 'tmp-398',
                  type: 'el:span',
                  props: {
                    text: 'View All',
                  },
                },
                {
                  id: 'tmp-399',
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
          id: 'tmp-413',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-4',
          children: [
            {
              id: 'tmp-412',
              type: 'el:article',
              props: {},
              class: 'group flex flex-col',
              children: [
                {
                  id: 'tmp-406',
                  type: 'el:div',
                  props: {},
                  class: 'relative overflow-hidden bg-base-200',
                  children: [
                    {
                      id: 'tmp-403',
                      type: 'el:button',
                      props: {
                        type: 'button',
                        ariaLabel: 'Add to wishlist',
                      },
                      class:
                        'absolute right-2 top-2 z-10 text-base-content/50 transition-colors hover:text-base-content',
                      children: [
                        {
                          id: 'tmp-402',
                          type: 'Icon',
                          props: {
                            name: 'heart',
                          },
                          class: 'h-5 w-5',
                        },
                      ],
                    },
                    {
                      id: 'tmp-405',
                      type: 'el:a',
                      props: {},
                      class: 'block',
                      children: [
                        {
                          id: 'tmp-404',
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
                  id: 'tmp-411',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-1 flex-col pt-2',
                  children: [
                    {
                      id: 'tmp-408',
                      type: 'el:a',
                      props: {},
                      class: 'block transition-colors hover:text-base-content/70',
                      children: [
                        {
                          id: 'tmp-407',
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
                      id: 'tmp-409',
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
                      id: 'tmp-410',
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
              from: 'category',
              id: 'originals',
            },
          },
        },
      ],
    },
    {
      id: 'tmp-432',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
      name: 'Running',
      children: [
        {
          id: 'tmp-419',
          type: 'el:div',
          props: {},
          class: 'flex w-full items-end justify-between gap-4',
          children: [
            {
              id: 'tmp-415',
              type: 'el:h2',
              props: {
                text: 'Running',
              },
              class:
                'font-heading text-xl font-black uppercase tracking-tightest @2xl:text-2xl text-base-content',
            },
            {
              id: 'tmp-418',
              type: 'el:a',
              props: {
                href: '/shop',
              },
              class:
                'group/al inline-flex w-fit items-center gap-2 border-b-2 border-current pb-1 font-heading text-xs font-bold uppercase tracking-wide  pb-0.5',
              children: [
                {
                  id: 'tmp-416',
                  type: 'el:span',
                  props: {
                    text: 'View All',
                  },
                },
                {
                  id: 'tmp-417',
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
          id: 'tmp-431',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-4',
          children: [
            {
              id: 'tmp-430',
              type: 'el:article',
              props: {},
              class: 'group flex flex-col',
              children: [
                {
                  id: 'tmp-424',
                  type: 'el:div',
                  props: {},
                  class: 'relative overflow-hidden bg-base-200',
                  children: [
                    {
                      id: 'tmp-421',
                      type: 'el:button',
                      props: {
                        type: 'button',
                        ariaLabel: 'Add to wishlist',
                      },
                      class:
                        'absolute right-2 top-2 z-10 text-base-content/50 transition-colors hover:text-base-content',
                      children: [
                        {
                          id: 'tmp-420',
                          type: 'Icon',
                          props: {
                            name: 'heart',
                          },
                          class: 'h-5 w-5',
                        },
                      ],
                    },
                    {
                      id: 'tmp-423',
                      type: 'el:a',
                      props: {},
                      class: 'block',
                      children: [
                        {
                          id: 'tmp-422',
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
                  id: 'tmp-429',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-1 flex-col pt-2',
                  children: [
                    {
                      id: 'tmp-426',
                      type: 'el:a',
                      props: {},
                      class: 'block transition-colors hover:text-base-content/70',
                      children: [
                        {
                          id: 'tmp-425',
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
                      id: 'tmp-427',
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
                      id: 'tmp-428',
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
              from: 'category',
              id: 'running',
            },
          },
        },
      ],
    },
    {
      id: 'tmp-450',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
      name: 'Soccer',
      children: [
        {
          id: 'tmp-437',
          type: 'el:div',
          props: {},
          class: 'flex w-full items-end justify-between gap-4',
          children: [
            {
              id: 'tmp-433',
              type: 'el:h2',
              props: {
                text: 'Soccer',
              },
              class:
                'font-heading text-xl font-black uppercase tracking-tightest @2xl:text-2xl text-base-content',
            },
            {
              id: 'tmp-436',
              type: 'el:a',
              props: {
                href: '/shop',
              },
              class:
                'group/al inline-flex w-fit items-center gap-2 border-b-2 border-current pb-1 font-heading text-xs font-bold uppercase tracking-wide  pb-0.5',
              children: [
                {
                  id: 'tmp-434',
                  type: 'el:span',
                  props: {
                    text: 'View All',
                  },
                },
                {
                  id: 'tmp-435',
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
          id: 'tmp-449',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-4',
          children: [
            {
              id: 'tmp-448',
              type: 'el:article',
              props: {},
              class: 'group flex flex-col',
              children: [
                {
                  id: 'tmp-442',
                  type: 'el:div',
                  props: {},
                  class: 'relative overflow-hidden bg-base-200',
                  children: [
                    {
                      id: 'tmp-439',
                      type: 'el:button',
                      props: {
                        type: 'button',
                        ariaLabel: 'Add to wishlist',
                      },
                      class:
                        'absolute right-2 top-2 z-10 text-base-content/50 transition-colors hover:text-base-content',
                      children: [
                        {
                          id: 'tmp-438',
                          type: 'Icon',
                          props: {
                            name: 'heart',
                          },
                          class: 'h-5 w-5',
                        },
                      ],
                    },
                    {
                      id: 'tmp-441',
                      type: 'el:a',
                      props: {},
                      class: 'block',
                      children: [
                        {
                          id: 'tmp-440',
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
                  id: 'tmp-447',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-1 flex-col pt-2',
                  children: [
                    {
                      id: 'tmp-444',
                      type: 'el:a',
                      props: {},
                      class: 'block transition-colors hover:text-base-content/70',
                      children: [
                        {
                          id: 'tmp-443',
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
                      id: 'tmp-445',
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
                      id: 'tmp-446',
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
              from: 'category',
              id: 'soccer',
            },
          },
        },
      ],
    },
    {
      id: 'tmp-468',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
      name: 'Lifestyle',
      children: [
        {
          id: 'tmp-455',
          type: 'el:div',
          props: {},
          class: 'flex w-full items-end justify-between gap-4',
          children: [
            {
              id: 'tmp-451',
              type: 'el:h2',
              props: {
                text: 'Lifestyle',
              },
              class:
                'font-heading text-xl font-black uppercase tracking-tightest @2xl:text-2xl text-base-content',
            },
            {
              id: 'tmp-454',
              type: 'el:a',
              props: {
                href: '/shop',
              },
              class:
                'group/al inline-flex w-fit items-center gap-2 border-b-2 border-current pb-1 font-heading text-xs font-bold uppercase tracking-wide  pb-0.5',
              children: [
                {
                  id: 'tmp-452',
                  type: 'el:span',
                  props: {
                    text: 'View All',
                  },
                },
                {
                  id: 'tmp-453',
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
          id: 'tmp-467',
          type: 'Section',
          props: {},
          class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-4',
          children: [
            {
              id: 'tmp-466',
              type: 'el:article',
              props: {},
              class: 'group flex flex-col',
              children: [
                {
                  id: 'tmp-460',
                  type: 'el:div',
                  props: {},
                  class: 'relative overflow-hidden bg-base-200',
                  children: [
                    {
                      id: 'tmp-457',
                      type: 'el:button',
                      props: {
                        type: 'button',
                        ariaLabel: 'Add to wishlist',
                      },
                      class:
                        'absolute right-2 top-2 z-10 text-base-content/50 transition-colors hover:text-base-content',
                      children: [
                        {
                          id: 'tmp-456',
                          type: 'Icon',
                          props: {
                            name: 'heart',
                          },
                          class: 'h-5 w-5',
                        },
                      ],
                    },
                    {
                      id: 'tmp-459',
                      type: 'el:a',
                      props: {},
                      class: 'block',
                      children: [
                        {
                          id: 'tmp-458',
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
                  id: 'tmp-465',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-1 flex-col pt-2',
                  children: [
                    {
                      id: 'tmp-462',
                      type: 'el:a',
                      props: {},
                      class: 'block transition-colors hover:text-base-content/70',
                      children: [
                        {
                          id: 'tmp-461',
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
                      id: 'tmp-463',
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
                      id: 'tmp-464',
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
              from: 'category',
              id: 'lifestyle',
            },
          },
        },
      ],
    },
  ],
};
