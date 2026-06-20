// Forge — site layout (header · Outlet · footer) (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/forge/.

export default {
  id: 'fg-59',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col bg-base-100 text-base-content',
  name: 'Site layout',
  children: [
    {
      id: 'fg-7',
      type: 'Section',
      props: {},
      class:
        'w-full flex flex-col sticky top-0 z-30 border-b border-white/10 bg-[#1A1611]/85 backdrop-blur',
      name: 'Header',
      children: [
        {
          id: 'fg-6',
          type: 'Section',
          props: {},
          class: 'w-full mx-auto w-full max-w-site flex flex-row justify-between items-center p-6',
          children: [
            {
              id: 'fg-3',
              type: 'el:div',
              props: {},
              class: 'flex items-center gap-4 @3xl:gap-9',
              children: [
                {
                  id: 'fg-1',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'fg-2',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Work',
                        href: '/work',
                      },
                      {
                        label: 'Services',
                        href: '/services',
                      },
                      {
                        label: 'About',
                        href: '/about',
                      },
                      {
                        label: 'Insights',
                        href: '/insights',
                      },
                      {
                        label: 'Careers',
                        href: '/careers',
                      },
                    ],
                  },
                  class: 'text-sm',
                },
              ],
            },
            {
              id: 'fg-5',
              type: 'el:div',
              props: {},
              class: 'flex items-center gap-2',
              children: [
                {
                  id: 'fg-4',
                  type: 'el:a',
                  props: {
                    href: '/contact',
                    text: 'Let’s talk',
                  },
                  class: 'st-btn st-c-neutral st-v-solid st-btn--sz-sm rounded-full',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'fg-8',
      type: 'Outlet',
      props: {},
      class: 'w-full',
    },
    {
      id: 'fg-58',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site flex flex-col gap-6 items-start p-8 @3xl:p-16 border-t border-white/10 bg-[#0B0A07]',
      name: 'Footer',
      children: [
        {
          id: 'fg-50',
          type: 'el:div',
          props: {},
          class: 'grid w-full grid-cols-2 gap-10 @3xl:grid-cols-[1.5fr_1fr_1fr_1fr]',
          children: [
            {
              id: 'fg-14',
              type: 'el:div',
              props: {},
              class: 'col-span-2 flex flex-col @3xl:col-span-1',
              children: [
                {
                  id: 'fg-9',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'fg-10',
                  type: 'el:p',
                  props: {
                    text: 'Transformative brands & digital experiences, engineered for growth.',
                  },
                  class: 'mt-5 max-w-xs text-sm leading-relaxed text-base-content/60',
                },
                {
                  id: 'fg-11',
                  type: 'el:p',
                  props: {
                    text: 'Let’s work together.',
                  },
                  class: 'mt-6 font-heading text-xl font-semibold text-[#ECE7DD]',
                },
                {
                  id: 'fg-12',
                  type: 'el:a',
                  props: {
                    href: 'mailto:hello@forge.studio',
                    text: 'hello@forge.studio',
                  },
                  class:
                    'mt-2 inline-block text-sm text-base-content underline-offset-4 transition-colors hover:text-[#ECE7DD] hover:underline',
                },
                {
                  id: 'fg-13',
                  type: 'SocialLinks',
                  props: {},
                  class: 'mt-6 flex gap-3 text-base-content/50',
                  binding: {
                    path: 'site.social',
                  },
                },
              ],
            },
            {
              id: 'fg-27',
              type: 'el:div',
              props: {},
              class: 'flex flex-col',
              children: [
                {
                  id: 'fg-15',
                  type: 'el:h4',
                  props: {
                    text: 'Studio',
                  },
                  class: 'font-heading text-sm font-semibold text-[#ECE7DD]',
                },
                {
                  id: 'fg-26',
                  type: 'el:ul',
                  props: {},
                  class: 'mt-5 flex flex-col gap-3 text-sm text-base-content/60',
                  children: [
                    {
                      id: 'fg-17',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-16',
                          type: 'el:a',
                          props: {
                            href: '/work',
                            text: 'Work',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
                        },
                      ],
                    },
                    {
                      id: 'fg-19',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-18',
                          type: 'el:a',
                          props: {
                            href: '/services',
                            text: 'Services',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
                        },
                      ],
                    },
                    {
                      id: 'fg-21',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-20',
                          type: 'el:a',
                          props: {
                            href: '/about',
                            text: 'About',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
                        },
                      ],
                    },
                    {
                      id: 'fg-23',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-22',
                          type: 'el:a',
                          props: {
                            href: '/insights',
                            text: 'Insights',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
                        },
                      ],
                    },
                    {
                      id: 'fg-25',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-24',
                          type: 'el:a',
                          props: {
                            href: '/careers',
                            text: 'Careers',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 'fg-38',
              type: 'el:div',
              props: {},
              class: 'flex flex-col',
              children: [
                {
                  id: 'fg-28',
                  type: 'el:h4',
                  props: {
                    text: 'Services',
                  },
                  class: 'font-heading text-sm font-semibold text-[#ECE7DD]',
                },
                {
                  id: 'fg-37',
                  type: 'el:ul',
                  props: {},
                  class: 'mt-5 flex flex-col gap-3 text-sm text-base-content/60',
                  children: [
                    {
                      id: 'fg-30',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-29',
                          type: 'el:a',
                          props: {
                            href: '/services',
                            text: 'Brand & Identity',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
                        },
                      ],
                    },
                    {
                      id: 'fg-32',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-31',
                          type: 'el:a',
                          props: {
                            href: '/services',
                            text: 'Web Design & Dev',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
                        },
                      ],
                    },
                    {
                      id: 'fg-34',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-33',
                          type: 'el:a',
                          props: {
                            href: '/services',
                            text: 'Growth Marketing',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
                        },
                      ],
                    },
                    {
                      id: 'fg-36',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-35',
                          type: 'el:a',
                          props: {
                            href: '/services',
                            text: 'Motion & 3D',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 'fg-49',
              type: 'el:div',
              props: {},
              class: 'flex flex-col',
              children: [
                {
                  id: 'fg-39',
                  type: 'el:h4',
                  props: {
                    text: 'Connect',
                  },
                  class: 'font-heading text-sm font-semibold text-[#ECE7DD]',
                },
                {
                  id: 'fg-48',
                  type: 'el:ul',
                  props: {},
                  class: 'mt-5 flex flex-col gap-3 text-sm text-base-content/60',
                  children: [
                    {
                      id: 'fg-41',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-40',
                          type: 'el:a',
                          props: {
                            href: 'https://instagram.com/forge.studio',
                            text: 'Instagram',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
                        },
                      ],
                    },
                    {
                      id: 'fg-43',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-42',
                          type: 'el:a',
                          props: {
                            href: 'https://dribbble.com/forgestudio',
                            text: 'Dribbble',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
                        },
                      ],
                    },
                    {
                      id: 'fg-45',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-44',
                          type: 'el:a',
                          props: {
                            href: 'https://linkedin.com/company/forgestudio',
                            text: 'LinkedIn',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
                        },
                      ],
                    },
                    {
                      id: 'fg-47',
                      type: 'el:li',
                      props: {},
                      children: [
                        {
                          id: 'fg-46',
                          type: 'el:a',
                          props: {
                            href: '/contact',
                            text: 'Start a project',
                          },
                          class: 'transition-colors hover:text-[#ECE7DD]',
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
          id: 'fg-57',
          type: 'el:div',
          props: {},
          class:
            'flex w-full flex-col gap-3 border-t border-white/10 pt-7 text-xs text-base-content/50 @3xl:flex-row @3xl:items-center @3xl:justify-between',
          children: [
            {
              id: 'fg-55',
              type: 'el:div',
              props: {},
              class: 'flex flex-wrap items-center gap-x-5 gap-y-2',
              children: [
                {
                  id: 'fg-51',
                  type: 'el:span',
                  props: {
                    text: '© 2026 Forge. All rights reserved.',
                  },
                },
                {
                  id: 'fg-52',
                  type: 'el:a',
                  props: {
                    href: '#',
                    text: 'Privacy',
                  },
                  class: 'transition-colors hover:text-[#ECE7DD]',
                },
                {
                  id: 'fg-53',
                  type: 'el:a',
                  props: {
                    href: '#',
                    text: 'Terms',
                  },
                  class: 'transition-colors hover:text-[#ECE7DD]',
                },
                {
                  id: 'fg-54',
                  type: 'el:a',
                  props: {
                    href: '#',
                    text: 'Cookies',
                  },
                  class: 'transition-colors hover:text-[#ECE7DD]',
                },
              ],
            },
            {
              id: 'fg-56',
              type: 'el:p',
              props: {
                text: 'Based in your city · Working with teams worldwide.',
              },
              class: 'max-w-md leading-relaxed',
            },
          ],
        },
      ],
    },
  ],
};
