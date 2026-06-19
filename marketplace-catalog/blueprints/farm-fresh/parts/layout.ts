// Farm Fresh — site layout (announcement · header · footer) (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-32',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Site layout',
  children: [
    {
      id: 'ffb-2',
      type: 'Section',
      class: 'w-full bg-neutral text-neutral-content',
      props: {},
      name: 'Announcement',
      children: [
        {
          id: 'ffb-2__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-center items-center p-3 text-center',
          props: {},
          children: [
            {
              id: 'ffb-1',
              type: 'Text',
              props: {
                variant: 'meta',
                text: '🌱  Free local delivery on orders over $35 · Fresh-pressed daily, never frozen',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-7',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col sticky top-0 z-30 bg-base-100 border-b border-base-300',
      name: 'Header',
      children: [
        {
          id: 'ffb-6',
          type: 'Section',
          props: {},
          class: 'w-full mx-auto w-full max-w-site flex flex-row justify-between items-center p-6',
          children: [
            {
              id: 'ffb-3',
              type: 'Wordmark',
              props: {},
              binding: {
                path: 'site.identity',
              },
            },
            {
              id: 'ffb-4',
              type: 'NavMenu',
              props: {
                orientation: 'row',
                links: [
                  {
                    label: 'Home',
                    href: '/',
                  },
                  {
                    label: 'Menu',
                    href: '/menu',
                  },
                  {
                    label: 'Our Story',
                    href: '/story',
                  },
                  {
                    label: 'Locations',
                    href: '/locations',
                  },
                  {
                    label: 'Catering',
                    href: '/catering',
                  },
                  {
                    label: 'Contact',
                    href: '/contact',
                  },
                ],
              },
            },
            {
              id: 'ffb-5',
              type: 'Button',
              props: {
                label: 'Order Online',
                href: '/menu',
              },
              class: 'st-btn st-c-accent st-v-solid st-btn--sz-md',
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-8',
      type: 'Outlet',
      props: {},
      class: 'w-full',
    },
    {
      id: 'ffb-31',
      type: 'Section',
      class: 'w-full bg-neutral text-neutral-content',
      props: {},
      name: 'Footer',
      children: [
        {
          id: 'ffb-31__c',
          type: 'Stack',
          class: 'mx-auto w-full max-w-site flex flex-col gap-6 items-start p-8 @3xl:p-16',
          props: {},
          children: [
            {
              id: 'ffb-28',
              type: 'Section',
              props: {},
              class: 'grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6',
              children: [
                {
                  id: 'ffb-12',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
                  children: [
                    {
                      id: 'ffb-9',
                      type: 'Wordmark',
                      props: {},
                      binding: {
                        path: 'site.identity',
                      },
                    },
                    {
                      id: 'ffb-10',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: 'Balanced, nutritious bowls made with local ingredients — here to deliver health, one bowl at a time.',
                      },
                    },
                    {
                      id: 'ffb-11',
                      type: 'Button',
                      props: {
                        label: 'Read the Journal →',
                        href: '/journal',
                      },
                      class:
                        'text-sm font-semibold text-[#7FA85B] transition-colors hover:text-white',
                    },
                  ],
                },
                {
                  id: 'ffb-17',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
                  children: [
                    {
                      id: 'ffb-13',
                      type: 'Heading',
                      props: {
                        level: 'h3',
                        text: 'Contact',
                      },
                      class: 'text-xs font-bold uppercase tracking-widest text-[#7FA85B]',
                    },
                    {
                      id: 'ffb-14',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: 'hello@farmfreshbowls.example',
                      },
                    },
                    {
                      id: 'ffb-15',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: '(951) 555-0142',
                      },
                    },
                    {
                      id: 'ffb-16',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: '214 Orchard Lane, Riverside, CA 92501',
                      },
                    },
                  ],
                },
                {
                  id: 'ffb-22',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
                  children: [
                    {
                      id: 'ffb-18',
                      type: 'Heading',
                      props: {
                        level: 'h3',
                        text: 'Hours',
                      },
                      class: 'text-xs font-bold uppercase tracking-widest text-[#7FA85B]',
                    },
                    {
                      id: 'ffb-19',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: 'Mon–Fri · 7am – 7pm',
                      },
                    },
                    {
                      id: 'ffb-20',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: 'Saturday · 8am – 5pm',
                      },
                    },
                    {
                      id: 'ffb-21',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: 'Sunday · 8am – 5pm',
                      },
                    },
                  ],
                },
                {
                  id: 'ffb-27',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
                  children: [
                    {
                      id: 'ffb-23',
                      type: 'Heading',
                      props: {
                        level: 'h3',
                        text: 'Stay in the loop',
                      },
                      class: 'text-xs font-bold uppercase tracking-widest text-[#7FA85B]',
                    },
                    {
                      id: 'ffb-24',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: 'Seasonal menus, new flavors, the occasional treat.',
                      },
                    },
                    {
                      id: 'ffb-25',
                      type: 'Signup',
                      props: {
                        cta: 'Join',
                      },
                    },
                    {
                      id: 'ffb-26',
                      type: 'SocialLinks',
                      props: {},
                      binding: {
                        path: 'site.social',
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: 'ffb-30',
              type: 'Section',
              props: {},
              class: 'w-full flex flex-col items-center text-center',
              children: [
                {
                  id: 'ffb-29',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '© 2026 Farm Fresh. All rights reserved.',
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
