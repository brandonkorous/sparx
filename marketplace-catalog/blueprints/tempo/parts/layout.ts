// Tempo — site layout (utility · header · footer) (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/tempo/.

export default {
  id: 'tmp-139',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Site layout',
  children: [
    {
      id: 'tmp-13',
      type: 'Section',
      class: 'w-full bg-base-200 hidden border-b border-base-300 md:block',
      props: {},
      name: 'Utility bar',
      children: [
        {
          id: 'tmp-13__c',
          type: 'Stack',
          class: 'mx-auto w-full max-w-site flex flex-col',
          props: {},
          children: [
            {
              id: 'tmp-12',
              type: 'el:div',
              props: {},
              class:
                'flex items-center justify-end gap-5 py-1.5 text-[11px] font-medium text-base-content/60',
              children: [
                {
                  id: 'tmp-1',
                  type: 'el:a',
                  props: {
                    href: '/help',
                    text: 'Store finder',
                  },
                  class: 'transition-colors hover:text-base-content hover:underline',
                },
                {
                  id: 'tmp-2',
                  type: 'el:span',
                  props: {
                    text: '|',
                  },
                  class: 'text-base-300',
                },
                {
                  id: 'tmp-3',
                  type: 'el:a',
                  props: {
                    href: '/help',
                    text: 'Help',
                  },
                  class: 'transition-colors hover:text-base-content hover:underline',
                },
                {
                  id: 'tmp-4',
                  type: 'el:span',
                  props: {
                    text: '|',
                  },
                  class: 'text-base-300',
                },
                {
                  id: 'tmp-5',
                  type: 'el:a',
                  props: {
                    href: '/help',
                    text: 'Orders & returns',
                  },
                  class: 'transition-colors hover:text-base-content hover:underline',
                },
                {
                  id: 'tmp-6',
                  type: 'el:span',
                  props: {
                    text: '|',
                  },
                  class: 'text-base-300',
                },
                {
                  id: 'tmp-7',
                  type: 'el:a',
                  props: {
                    href: '/shop',
                    text: 'Gift cards',
                  },
                  class: 'transition-colors hover:text-base-content hover:underline',
                },
                {
                  id: 'tmp-8',
                  type: 'el:span',
                  props: {
                    text: '|',
                  },
                  class: 'text-base-300',
                },
                {
                  id: 'tmp-9',
                  type: 'el:a',
                  props: {
                    href: '/club',
                    text: 'Join the Club',
                  },
                  class: 'font-semibold text-base-content hover:underline',
                },
                {
                  id: 'tmp-10',
                  type: 'el:span',
                  props: {
                    text: '|',
                  },
                  class: 'text-base-300',
                },
                {
                  id: 'tmp-11',
                  type: 'el:a',
                  props: {
                    href: '/club',
                    text: 'Sign in',
                  },
                  class: 'font-semibold text-base-content hover:underline',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'tmp-51',
      type: 'Section',
      props: {
        behavior: {
          type: 'menu',
        },
      },
      class: 'w-full flex flex-col sticky top-0 z-30 bg-base-100',
      name: 'Masthead',
      children: [
        {
          id: 'tmp-37',
          type: 'Section',
          props: {},
          class: 'w-full mx-auto w-full max-w-site flex flex-row justify-between items-center p-6',
          children: [
            {
              id: 'tmp-22',
              type: 'el:div',
              props: {},
              class: 'flex items-center gap-4 @4xl:gap-7',
              children: [
                {
                  id: 'tmp-14',
                  type: 'Wordmark',
                  props: {},
                  class: 'shrink-0',
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'tmp-21',
                  type: 'el:nav',
                  props: {},
                  class: 'hidden items-center gap-6 lg:flex',
                  name: 'Primary nav',
                  children: [
                    {
                      id: 'tmp-15',
                      type: 'el:a',
                      props: {
                        href: '/shop',
                        text: 'New & Trending',
                      },
                      class:
                        'border-b-2 border-transparent pb-0.5 font-heading text-[13px] font-bold uppercase tracking-wide transition-colors text-base-content hover:border-base-content',
                    },
                    {
                      id: 'tmp-16',
                      type: 'el:a',
                      props: {
                        href: '/shop',
                        text: 'Men',
                      },
                      class:
                        'border-b-2 border-transparent pb-0.5 font-heading text-[13px] font-bold uppercase tracking-wide transition-colors text-base-content hover:border-base-content',
                    },
                    {
                      id: 'tmp-17',
                      type: 'el:a',
                      props: {
                        href: '/shop',
                        text: 'Women',
                      },
                      class:
                        'border-b-2 border-transparent pb-0.5 font-heading text-[13px] font-bold uppercase tracking-wide transition-colors text-base-content hover:border-base-content',
                    },
                    {
                      id: 'tmp-18',
                      type: 'el:a',
                      props: {
                        href: '/shop',
                        text: 'Kids',
                      },
                      class:
                        'border-b-2 border-transparent pb-0.5 font-heading text-[13px] font-bold uppercase tracking-wide transition-colors text-base-content hover:border-base-content',
                    },
                    {
                      id: 'tmp-19',
                      type: 'el:a',
                      props: {
                        href: '/club',
                        text: 'Club',
                      },
                      class:
                        'border-b-2 border-transparent pb-0.5 font-heading text-[13px] font-bold uppercase tracking-wide transition-colors text-base-content hover:border-base-content',
                    },
                    {
                      id: 'tmp-20',
                      type: 'el:a',
                      props: {
                        href: '/shop',
                        text: 'Sale',
                      },
                      class:
                        'border-b-2 border-transparent pb-0.5 font-heading text-[13px] font-bold uppercase tracking-wide transition-colors text-accent hover:border-accent',
                    },
                  ],
                },
              ],
            },
            {
              id: 'tmp-36',
              type: 'el:div',
              props: {},
              class: 'flex items-center gap-3 @sm:gap-4',
              children: [
                {
                  id: 'tmp-25',
                  type: 'el:label',
                  props: {},
                  class:
                    'hidden items-center gap-2 bg-base-200 px-3 py-2 text-sm text-base-content/60 md:flex',
                  children: [
                    {
                      id: 'tmp-23',
                      type: 'Icon',
                      props: {
                        name: 'search',
                      },
                      class: 'h-4 w-4',
                    },
                    {
                      id: 'tmp-24',
                      type: 'el:input',
                      props: {
                        type: 'search',
                        placeholder: 'Search',
                        name: 'q',
                      },
                      class: 'w-28 bg-transparent text-base-content outline-none',
                    },
                  ],
                },
                {
                  id: 'tmp-27',
                  type: 'el:a',
                  props: {
                    href: '/shop',
                    ariaLabel: 'Account',
                  },
                  class: 'relative text-base-content transition-opacity hover:opacity-70',
                  children: [
                    {
                      id: 'tmp-26',
                      type: 'Icon',
                      props: {
                        name: 'user',
                      },
                      class: 'h-6 w-6',
                    },
                  ],
                },
                {
                  id: 'tmp-30',
                  type: 'el:a',
                  props: {
                    href: '/shop',
                    ariaLabel: 'Wishlist',
                  },
                  class: 'relative text-base-content transition-opacity hover:opacity-70',
                  children: [
                    {
                      id: 'tmp-28',
                      type: 'Icon',
                      props: {
                        name: 'heart',
                      },
                      class: 'h-6 w-6',
                    },
                    {
                      id: 'tmp-29',
                      type: 'el:span',
                      props: {
                        text: '2',
                      },
                      class:
                        'absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center bg-neutral text-[10px] font-bold text-neutral-content',
                    },
                  ],
                },
                {
                  id: 'tmp-33',
                  type: 'el:a',
                  props: {
                    href: '/shop',
                    ariaLabel: 'Bag',
                  },
                  class: 'relative text-base-content transition-opacity hover:opacity-70',
                  children: [
                    {
                      id: 'tmp-31',
                      type: 'Icon',
                      props: {
                        name: 'shopping-bag',
                      },
                      class: 'h-6 w-6',
                    },
                    {
                      id: 'tmp-32',
                      type: 'el:span',
                      props: {
                        text: '3',
                      },
                      class:
                        'absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center bg-neutral text-[10px] font-bold text-neutral-content',
                    },
                  ],
                },
                {
                  id: 'tmp-35',
                  type: 'el:button',
                  props: {
                    type: 'button',
                    ariaLabel: 'Open menu',
                    sxRole: 'trigger',
                  },
                  class: 'text-base-content transition-opacity hover:opacity-70 lg:hidden',
                  children: [
                    {
                      id: 'tmp-34',
                      type: 'Icon',
                      props: {
                        name: 'menu',
                      },
                      class: 'h-7 w-7',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'tmp-41',
          type: 'Section',
          props: {},
          class:
            'w-full mx-auto w-full max-w-site flex flex-col items-center text-center border-y border-base-content',
          name: 'Promo',
          children: [
            {
              id: 'tmp-40',
              type: 'el:p',
              props: {},
              class: 'py-2 text-center text-[12px] font-medium tracking-wide text-base-content',
              children: [
                {
                  id: 'tmp-38',
                  type: 'el:span',
                  props: {
                    text: 'Season Kickoff: up to 40% off select styles. ',
                  },
                },
                {
                  id: 'tmp-39',
                  type: 'el:a',
                  props: {
                    href: '/shop',
                    text: 'Shop the event',
                  },
                  class: 'font-bold underline underline-offset-2',
                },
              ],
            },
          ],
        },
        {
          id: 'tmp-50',
          type: 'el:div',
          props: {
            hidden: true,
            sxRole: 'panel',
          },
          class: 'hidden border-b border-base-300 bg-base-100 lg:hidden',
          name: 'Mobile menu',
          children: [
            {
              id: 'tmp-49',
              type: 'el:nav',
              props: {},
              class: 'flex flex-col',
              children: [
                {
                  id: 'tmp-42',
                  type: 'el:a',
                  props: {
                    href: '/shop',
                    text: 'New & Trending',
                  },
                  class:
                    'border-b border-base-300 px-5 py-3 font-heading text-base font-bold uppercase tracking-tight transition-colors hover:bg-base-200 text-base-content',
                },
                {
                  id: 'tmp-43',
                  type: 'el:a',
                  props: {
                    href: '/shop',
                    text: 'Men',
                  },
                  class:
                    'border-b border-base-300 px-5 py-3 font-heading text-base font-bold uppercase tracking-tight transition-colors hover:bg-base-200 text-base-content',
                },
                {
                  id: 'tmp-44',
                  type: 'el:a',
                  props: {
                    href: '/shop',
                    text: 'Women',
                  },
                  class:
                    'border-b border-base-300 px-5 py-3 font-heading text-base font-bold uppercase tracking-tight transition-colors hover:bg-base-200 text-base-content',
                },
                {
                  id: 'tmp-45',
                  type: 'el:a',
                  props: {
                    href: '/shop',
                    text: 'Kids',
                  },
                  class:
                    'border-b border-base-300 px-5 py-3 font-heading text-base font-bold uppercase tracking-tight transition-colors hover:bg-base-200 text-base-content',
                },
                {
                  id: 'tmp-46',
                  type: 'el:a',
                  props: {
                    href: '/club',
                    text: 'Club',
                  },
                  class:
                    'border-b border-base-300 px-5 py-3 font-heading text-base font-bold uppercase tracking-tight transition-colors hover:bg-base-200 text-base-content',
                },
                {
                  id: 'tmp-47',
                  type: 'el:a',
                  props: {
                    href: '/shop',
                    text: 'Sale',
                  },
                  class:
                    'border-b border-base-300 px-5 py-3 font-heading text-base font-bold uppercase tracking-tight transition-colors hover:bg-base-200 text-accent',
                },
                {
                  id: 'tmp-48',
                  type: 'el:a',
                  props: {
                    href: '/club',
                    text: 'Sign in',
                  },
                  class:
                    'border-b border-base-300 px-5 py-3 font-heading text-base font-bold uppercase tracking-tight transition-colors hover:bg-base-200 text-base-content',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'tmp-52',
      type: 'Outlet',
      props: {},
      class: 'w-full',
    },
    {
      id: 'tmp-138',
      type: 'Section',
      class: 'w-full bg-neutral text-neutral-content',
      props: {},
      name: 'Footer',
      children: [
        {
          id: 'tmp-138__c',
          type: 'Stack',
          class: 'mx-auto w-full max-w-site flex flex-col gap-6 items-start p-8 @3xl:p-16',
          props: {},
          children: [
            {
              id: 'tmp-118',
              type: 'el:div',
              props: {},
              class: 'grid w-full grid-cols-2 gap-8 @sm:grid-cols-3 @4xl:grid-cols-5',
              children: [
                {
                  id: 'tmp-65',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-col',
                  children: [
                    {
                      id: 'tmp-53',
                      type: 'el:h4',
                      props: {
                        text: 'Products',
                      },
                      class:
                        'font-heading text-xs font-bold uppercase tracking-widest text-base-100/90',
                    },
                    {
                      id: 'tmp-64',
                      type: 'el:ul',
                      props: {},
                      class: 'mt-4 flex flex-col gap-2.5 text-sm text-base-100/70',
                      children: [
                        {
                          id: 'tmp-55',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-54',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Shoes',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-57',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-56',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Clothing',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-59',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-58',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Accessories',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-61',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-60',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'New Arrivals',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-63',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-62',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Best Sellers',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'tmp-78',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-col',
                  children: [
                    {
                      id: 'tmp-66',
                      type: 'el:h4',
                      props: {
                        text: 'Sports',
                      },
                      class:
                        'font-heading text-xs font-bold uppercase tracking-widest text-base-100/90',
                    },
                    {
                      id: 'tmp-77',
                      type: 'el:ul',
                      props: {},
                      class: 'mt-4 flex flex-col gap-2.5 text-sm text-base-100/70',
                      children: [
                        {
                          id: 'tmp-68',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-67',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Soccer',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-70',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-69',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Running',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-72',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-71',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Training',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-74',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-73',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Outdoor',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-76',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-75',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Lifestyle',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'tmp-91',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-col',
                  children: [
                    {
                      id: 'tmp-79',
                      type: 'el:h4',
                      props: {
                        text: 'Collections',
                      },
                      class:
                        'font-heading text-xs font-bold uppercase tracking-widest text-base-100/90',
                    },
                    {
                      id: 'tmp-90',
                      type: 'el:ul',
                      props: {},
                      class: 'mt-4 flex flex-col gap-2.5 text-sm text-base-100/70',
                      children: [
                        {
                          id: 'tmp-81',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-80',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Originals',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-83',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-82',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Glide',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-85',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-84',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Vega',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-87',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-86',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Strike',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-89',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-88',
                              type: 'el:a',
                              props: {
                                href: '/shop',
                                text: 'Field',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'tmp-104',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-col',
                  children: [
                    {
                      id: 'tmp-92',
                      type: 'el:h4',
                      props: {
                        text: 'Support',
                      },
                      class:
                        'font-heading text-xs font-bold uppercase tracking-widest text-base-100/90',
                    },
                    {
                      id: 'tmp-103',
                      type: 'el:ul',
                      props: {},
                      class: 'mt-4 flex flex-col gap-2.5 text-sm text-base-100/70',
                      children: [
                        {
                          id: 'tmp-94',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-93',
                              type: 'el:a',
                              props: {
                                href: '/help',
                                text: 'Help',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-96',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-95',
                              type: 'el:a',
                              props: {
                                href: '/help',
                                text: 'Returns & Exchanges',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-98',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-97',
                              type: 'el:a',
                              props: {
                                href: '/help',
                                text: 'Shipping',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-100',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-99',
                              type: 'el:a',
                              props: {
                                href: '/help',
                                text: 'Order Tracker',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-102',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-101',
                              type: 'el:a',
                              props: {
                                href: '/help',
                                text: 'Size Charts',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'tmp-117',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-col',
                  children: [
                    {
                      id: 'tmp-105',
                      type: 'el:h4',
                      props: {
                        text: 'Company',
                      },
                      class:
                        'font-heading text-xs font-bold uppercase tracking-widest text-base-100/90',
                    },
                    {
                      id: 'tmp-116',
                      type: 'el:ul',
                      props: {},
                      class: 'mt-4 flex flex-col gap-2.5 text-sm text-base-100/70',
                      children: [
                        {
                          id: 'tmp-107',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-106',
                              type: 'el:a',
                              props: {
                                href: '/story',
                                text: 'Our Story',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-109',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-108',
                              type: 'el:a',
                              props: {
                                href: '/club',
                                text: 'The Club',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-111',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-110',
                              type: 'el:a',
                              props: {
                                href: '/news',
                                text: 'News',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-113',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-112',
                              type: 'el:a',
                              props: {
                                href: '/help',
                                text: 'Careers',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
                            },
                          ],
                        },
                        {
                          id: 'tmp-115',
                          type: 'el:li',
                          props: {},
                          children: [
                            {
                              id: 'tmp-114',
                              type: 'el:a',
                              props: {
                                href: '/story',
                                text: 'Sustainability',
                              },
                              class: 'transition-colors hover:text-base-100 hover:underline',
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
              id: 'tmp-124',
              type: 'el:div',
              props: {},
              class:
                'flex flex-col gap-8 border-t border-base-100/10 pt-10 @4xl:flex-row @4xl:items-end @4xl:justify-between',
              children: [
                {
                  id: 'tmp-122',
                  type: 'el:div',
                  props: {},
                  class: 'max-w-md',
                  children: [
                    {
                      id: 'tmp-119',
                      type: 'el:h3',
                      props: {
                        text: 'Join our newsletter',
                      },
                      class:
                        'font-heading text-lg font-black uppercase tracking-tightest text-base-100',
                    },
                    {
                      id: 'tmp-120',
                      type: 'el:p',
                      props: {
                        text: 'The latest drops, offers and member rewards — straight to your inbox.',
                      },
                      class: 'mt-1 text-sm text-base-100/60',
                    },
                    {
                      id: 'tmp-121',
                      type: 'Signup',
                      props: {
                        cta: 'Subscribe',
                      },
                      class: 'mt-4',
                    },
                  ],
                },
                {
                  id: 'tmp-123',
                  type: 'SocialLinks',
                  props: {},
                  class: 'flex items-center gap-3 text-base-100/80',
                  binding: {
                    path: 'site.social',
                  },
                },
              ],
            },
            {
              id: 'tmp-130',
              type: 'el:div',
              props: {},
              class:
                'flex flex-col gap-6 border-t border-base-100/10 pt-8 @3xl:flex-row @3xl:items-center @3xl:justify-between',
              children: [
                {
                  id: 'tmp-125',
                  type: 'Wordmark',
                  props: {},
                  class: 'text-base-100',
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'tmp-129',
                  type: 'el:button',
                  props: {
                    type: 'button',
                  },
                  class:
                    'inline-flex w-fit items-center gap-2 border border-base-100/30 px-4 py-2.5 text-sm text-base-100/80 transition-colors hover:bg-base-100/10',
                  children: [
                    {
                      id: 'tmp-126',
                      type: 'Icon',
                      props: {
                        name: 'globe',
                      },
                      class: 'h-4 w-4',
                    },
                    {
                      id: 'tmp-127',
                      type: 'el:span',
                      props: {
                        text: 'United States',
                      },
                      class: 'font-medium',
                    },
                    {
                      id: 'tmp-128',
                      type: 'Icon',
                      props: {
                        name: 'chevron-down',
                      },
                      class: 'h-4 w-4',
                    },
                  ],
                },
              ],
            },
            {
              id: 'tmp-137',
              type: 'el:div',
              props: {},
              class:
                'flex flex-col gap-4 border-t border-base-100/10 pt-6 text-xs text-base-100/45 @3xl:flex-row @3xl:items-center @3xl:justify-between',
              children: [
                {
                  id: 'tmp-135',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-wrap gap-x-5 gap-y-2',
                  children: [
                    {
                      id: 'tmp-131',
                      type: 'el:a',
                      props: {
                        href: '/help',
                        text: 'Privacy Policy',
                      },
                      class: 'transition-colors hover:text-base-100/80 hover:underline',
                    },
                    {
                      id: 'tmp-132',
                      type: 'el:a',
                      props: {
                        href: '/help',
                        text: 'Terms & Conditions',
                      },
                      class: 'transition-colors hover:text-base-100/80 hover:underline',
                    },
                    {
                      id: 'tmp-133',
                      type: 'el:a',
                      props: {
                        href: '/help',
                        text: 'Cookie Settings',
                      },
                      class: 'transition-colors hover:text-base-100/80 hover:underline',
                    },
                    {
                      id: 'tmp-134',
                      type: 'el:a',
                      props: {
                        href: '/help',
                        text: 'Accessibility',
                      },
                      class: 'transition-colors hover:text-base-100/80 hover:underline',
                    },
                  ],
                },
                {
                  id: 'tmp-136',
                  type: 'el:p',
                  props: {
                    text: '© 2026 Tempo. All rights reserved.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
