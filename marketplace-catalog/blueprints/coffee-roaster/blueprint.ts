// Coffee Roaster — a Sparx first-party marketplace blueprint (docs/85). The payload is
// a declarative @sparx/blueprints manifest; the ingest validates it (safeParseBlueprint)
// and writes it to storage as the artifact the installer replays into a new site.
export default {
  key: 'coffee-roaster',
  version: '1.0.0',
  name: 'Coffee Roaster',
  summary:
    'Small-batch coffee, roasted to order. A ready-to-edit retail starter site with a matching theme, layout, home, and about page.',
  vertical: 'retail',
  requiresModules: ['builder', 'cms', 'commerce'],
  brand: {
    businessName: 'Ember Roasting Co.',
    tagline: 'Small-batch coffee, roasted to order.',
    colors: {
      primary: '#9a3412',
      primaryForeground: '#fff7ed',
      accent: '#ea580c',
    },
    fonts: {
      heading: 'Fraunces',
      body: 'Inter',
    },
  },
  theme: {
    name: 'Coffee Roaster',
    basePresetKey: 'market',
    presentation: {
      v: 2,
      containerWidth: '1200px',
    },
    brand: {
      colorPrimary: '#9a3412',
      colorPrimaryForeground: '#fff7ed',
      colorAccent: '#ea580c',
      fontHeading: 'Fraunces',
      fontBody: 'Inter',
      tokens: {
        radiusBase: '10px',
      },
    },
    apply: true,
  },
  layout: {
    name: 'Coffee Roaster layout',
    tree: {
      id: 'bp-11',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col',
      name: 'Site layout',
      children: [
        {
          id: 'bp-5',
          type: 'Section',
          props: {},
          class:
            'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center p-6',
          name: 'Header',
          children: [
            {
              id: 'bp-3',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-center',
              children: [
                {
                  id: 'bp-1',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'bp-2',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Ember Roasting Co.',
                  },
                },
              ],
            },
            {
              id: 'bp-4',
              type: 'NavMenu',
              props: {
                orientation: 'row',
                links: [
                  {
                    label: 'Shop',
                    href: '/shop',
                  },
                  {
                    label: 'Subscriptions',
                    href: '/subscriptions',
                  },
                  {
                    label: 'Our story',
                    href: '/our-story',
                  },
                  {
                    label: 'Contact',
                    href: '/contact',
                  },
                ],
              },
            },
          ],
        },
        {
          id: 'bp-6',
          type: 'Outlet',
          props: {},
          class: 'w-full',
        },
        {
          id: 'bp-10',
          type: 'Section',
          class: 'w-full bg-base-300',
          props: {},
          name: 'Footer',
          children: [
            {
              id: 'bp-10__c',
              type: 'Stack',
              class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
              props: {},
              children: [
                {
                  id: 'bp-7',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Shop',
                        href: '/shop',
                      },
                      {
                        label: 'Subscriptions',
                        href: '/subscriptions',
                      },
                      {
                        label: 'Our story',
                        href: '/our-story',
                      },
                      {
                        label: 'Contact',
                        href: '/contact',
                      },
                    ],
                  },
                },
                {
                  id: 'bp-8',
                  type: 'SocialLinks',
                  props: {},
                  binding: {
                    path: 'site.social',
                  },
                },
                {
                  id: 'bp-9',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '© Ember Roasting Co.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    makeActive: true,
  },
  pages: [
    {
      name: 'Home',
      kind: 'singleton',
      tree: {
        id: 'bp-29',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Home',
        children: [
          {
            id: 'bp-15',
            type: 'Section',
            class: 'w-full flex items-center justify-center h-[75vh] text-white',
            props: {
              bgImage: 'https://picsum.photos/seed/coffee-roaster-hero/2000/1100',
              bgOverlay: 'dark',
            },
            name: 'Hero',
            children: [
              {
                id: 'bp-15__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-12',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      text: 'Roasted the morning it ships',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-13',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Single-origin beans, roasted in small batches and sent straight to your door.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-14',
                    type: 'Button',
                    props: {
                      label: 'Shop the roasts',
                      style: 'primary',
                      href: '/shop',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-25',
            type: 'Section',
            props: {},
            class:
              'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
            name: 'Features',
            children: [
              {
                id: 'bp-18',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-16',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Single origin',
                    },
                  },
                  {
                    id: 'bp-17',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Traceable beans from farms we know by name.',
                    },
                  },
                ],
              },
              {
                id: 'bp-21',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-19',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Roasted to order',
                    },
                  },
                  {
                    id: 'bp-20',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'We roast the day we ship — never sooner.',
                    },
                  },
                ],
              },
              {
                id: 'bp-24',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-22',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Subscriptions',
                    },
                  },
                  {
                    id: 'bp-23',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Set your cadence and never run out again.',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-28',
            type: 'Section',
            class: 'w-full bg-neutral text-neutral-content',
            props: {},
            name: 'CTA',
            children: [
              {
                id: 'bp-28__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-26',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Start your morning right',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-27',
                    type: 'Button',
                    props: {
                      label: 'Shop the roasts',
                      style: 'primary',
                      href: '/shop',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      seoTitle: 'Ember Roasting Co.',
      seoDescription: 'Small-batch coffee, roasted to order.',
    },
    {
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      tree: {
        id: 'bp-33',
        type: 'Section',
        props: {},
        class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
        name: 'About',
        children: [
          {
            id: 'bp-30',
            type: 'Heading',
            props: {
              level: 'h1',
              text: 'About Ember Roasting Co.',
            },
          },
          {
            id: 'bp-31',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Small-batch coffee, roasted to order. Single-origin beans, roasted in small batches and sent straight to your door.',
            },
          },
          {
            id: 'bp-32',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Edit this page in the builder to tell your story — who you are, what you stand for, and why customers choose you.',
            },
          },
        ],
      },
      seoTitle: 'About — Ember Roasting Co.',
    },
  ],
};
