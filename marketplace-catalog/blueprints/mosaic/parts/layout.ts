// Mosaic — site layout (header · Outlet · footer) (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/mosaic/.

export default {
  id: 'msc-76',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Site layout',
  children: [
    {
      id: 'msc-8',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col sticky top-0 z-30 bg-base-100 border-b border-base-300',
      name: 'Header',
      children: [
        {
          id: 'msc-7',
          type: 'Section',
          props: {},
          class: 'w-full mx-auto w-full max-w-site flex flex-row justify-between items-center p-6',
          children: [
            {
              id: 'msc-3',
              type: 'el:div',
              props: {},
              class: 'flex items-center gap-3 @3xl:gap-6',
              children: [
                {
                  id: 'msc-1',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'msc-2',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Product',
                        href: '/',
                      },
                      {
                        label: 'Pricing',
                        href: '/pricing',
                      },
                      {
                        label: 'Enterprise',
                        href: '/enterprise',
                      },
                      {
                        label: 'Customers',
                        href: '/customers',
                      },
                      {
                        label: 'Request a demo',
                        href: '/request-demo',
                      },
                    ],
                  },
                },
              ],
            },
            {
              id: 'msc-6',
              type: 'el:div',
              props: {},
              class: 'flex items-center gap-2',
              children: [
                {
                  id: 'msc-4',
                  type: 'el:a',
                  props: {
                    href: '#',
                    text: 'Log in',
                  },
                  class:
                    'hidden px-2 text-sm font-medium text-base-content transition-colors hover:text-[#191918] @sm:inline-flex',
                },
                {
                  id: 'msc-5',
                  type: 'el:a',
                  props: {
                    href: '/request-demo',
                    text: 'Get Mosaic free',
                  },
                  class: 'st-btn st-c-primary st-v-solid st-btn--sz-sm',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'msc-9',
      type: 'Outlet',
      props: {},
      class: 'w-full',
    },
    {
      id: 'msc-75',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site flex flex-col gap-6 items-start p-8 @3xl:p-16 border-t border-base-300',
      name: 'Footer',
      children: [
        {
          id: 'msc-67',
          type: 'el:div',
          props: {},
          class: 'grid w-full grid-cols-2 gap-10 @3xl:grid-cols-5',
          children: [
            {
              id: 'msc-16',
              type: 'el:div',
              props: {},
              class: 'col-span-2 flex flex-col @3xl:col-span-1',
              children: [
                {
                  id: 'msc-10',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'msc-11',
                  type: 'el:p',
                  props: {
                    text: 'The AI workspace where your docs, projects, and knowledge come together.',
                  },
                  class: 'mt-4 max-w-xs text-sm leading-relaxed text-base-content/60',
                },
                {
                  id: 'msc-12',
                  type: 'SocialLinks',
                  props: {},
                  class: 'mt-5 flex gap-3 text-base-content/50',
                  binding: {
                    path: 'site.social',
                  },
                },
                {
                  id: 'msc-15',
                  type: 'el:button',
                  props: {
                    type: 'button',
                  },
                  class:
                    'mt-5 inline-flex w-fit items-center gap-1.5 rounded-lg border border-base-300 px-3 py-1.5 text-sm text-base-content',
                  children: [
                    {
                      id: 'msc-13',
                      type: 'Icon',
                      props: {
                        name: 'globe',
                      },
                      class: 'h-4 w-4',
                    },
                    {
                      id: 'msc-14',
                      type: 'el:span',
                      props: {
                        text: 'English (US)',
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: 'msc-29',
              type: 'el:div',
              props: {},
              class: 'flex flex-col',
              children: [
                {
                  id: 'msc-17',
                  type: 'el:h4',
                  props: {
                    text: 'Product',
                  },
                  class: 'text-sm font-semibold text-[#191918]',
                },
                {
                  id: 'msc-28',
                  type: 'el:ul',
                  props: {},
                  class: 'mt-4 flex flex-col gap-3 text-sm text-base-content/60',
                  children: [
                    {
                      id: 'msc-19',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-18',
                          type: 'el:a',
                          props: {
                            href: '/pricing',
                            text: 'Pricing',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-21',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-20',
                          type: 'el:a',
                          props: {
                            href: '/enterprise',
                            text: 'Enterprise',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-23',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-22',
                          type: 'el:a',
                          props: {
                            href: '/customers',
                            text: 'Customers',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-25',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-24',
                          type: 'el:a',
                          props: {
                            href: '/request-demo',
                            text: 'Request a demo',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-27',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-26',
                          type: 'el:a',
                          props: {
                            href: '#',
                            text: 'What’s new',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 'msc-42',
              type: 'el:div',
              props: {},
              class: 'flex flex-col',
              children: [
                {
                  id: 'msc-30',
                  type: 'el:h4',
                  props: {
                    text: 'Resources',
                  },
                  class: 'text-sm font-semibold text-[#191918]',
                },
                {
                  id: 'msc-41',
                  type: 'el:ul',
                  props: {},
                  class: 'mt-4 flex flex-col gap-3 text-sm text-base-content/60',
                  children: [
                    {
                      id: 'msc-32',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-31',
                          type: 'el:a',
                          props: {
                            href: '#',
                            text: 'Help center',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-34',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-33',
                          type: 'el:a',
                          props: {
                            href: '/customers',
                            text: 'Blog',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-36',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-35',
                          type: 'el:a',
                          props: {
                            href: '#',
                            text: 'Community',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-38',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-37',
                          type: 'el:a',
                          props: {
                            href: '#',
                            text: 'Templates',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-40',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-39',
                          type: 'el:a',
                          props: {
                            href: '#',
                            text: 'Partner program',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 'msc-55',
              type: 'el:div',
              props: {},
              class: 'flex flex-col',
              children: [
                {
                  id: 'msc-43',
                  type: 'el:h4',
                  props: {
                    text: 'Company',
                  },
                  class: 'text-sm font-semibold text-[#191918]',
                },
                {
                  id: 'msc-54',
                  type: 'el:ul',
                  props: {},
                  class: 'mt-4 flex flex-col gap-3 text-sm text-base-content/60',
                  children: [
                    {
                      id: 'msc-45',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-44',
                          type: 'el:a',
                          props: {
                            href: '#',
                            text: 'About us',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-47',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-46',
                          type: 'el:a',
                          props: {
                            href: '#',
                            text: 'Careers',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-49',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-48',
                          type: 'el:a',
                          props: {
                            href: '/enterprise',
                            text: 'Security',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-51',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-50',
                          type: 'el:a',
                          props: {
                            href: '#',
                            text: 'Status',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-53',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-52',
                          type: 'el:a',
                          props: {
                            href: '#',
                            text: 'Privacy',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 'msc-66',
              type: 'el:div',
              props: {},
              class: 'flex flex-col',
              children: [
                {
                  id: 'msc-56',
                  type: 'el:h4',
                  props: {
                    text: 'Mosaic for',
                  },
                  class: 'text-sm font-semibold text-[#191918]',
                },
                {
                  id: 'msc-65',
                  type: 'el:ul',
                  props: {},
                  class: 'mt-4 flex flex-col gap-3 text-sm text-base-content/60',
                  children: [
                    {
                      id: 'msc-58',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-57',
                          type: 'el:a',
                          props: {
                            href: '/enterprise',
                            text: 'Enterprise',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-60',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-59',
                          type: 'el:a',
                          props: {
                            href: '#',
                            text: 'Small business',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-62',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-61',
                          type: 'el:a',
                          props: {
                            href: '#',
                            text: 'Personal',
                          },
                          class: 'transition-colors hover:text-[#191918]',
                        },
                      ],
                    },
                    {
                      id: 'msc-64',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'msc-63',
                          type: 'el:a',
                          props: {
                            href: '#',
                            text: 'Education',
                          },
                          class: 'transition-colors hover:text-[#191918]',
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
          id: 'msc-74',
          type: 'el:div',
          props: {},
          class:
            'flex w-full flex-col gap-3 border-t border-base-300 pt-7 text-xs text-base-content/50 @3xl:flex-row @3xl:items-center @3xl:justify-between',
          children: [
            {
              id: 'msc-72',
              type: 'el:div',
              props: {},
              class: 'flex flex-wrap items-center gap-x-5 gap-y-2',
              children: [
                {
                  id: 'msc-68',
                  type: 'el:span',
                  props: {
                    text: '© 2026 Mosaic. All rights reserved.',
                  },
                },
                {
                  id: 'msc-69',
                  type: 'el:a',
                  props: {
                    href: '#',
                    text: 'Privacy',
                  },
                  class: 'transition-colors hover:text-[#191918]',
                },
                {
                  id: 'msc-70',
                  type: 'el:a',
                  props: {
                    href: '#',
                    text: 'Terms',
                  },
                  class: 'transition-colors hover:text-[#191918]',
                },
                {
                  id: 'msc-71',
                  type: 'el:a',
                  props: {
                    href: '#',
                    text: 'Cookie settings',
                  },
                  class: 'transition-colors hover:text-[#191918]',
                },
              ],
            },
            {
              id: 'msc-73',
              type: 'el:p',
              props: {
                text: 'Built for teams and the agents that work alongside them.',
              },
              class: 'max-w-md leading-relaxed',
            },
          ],
        },
      ],
    },
  ],
};
