// Bakery — a Sparx first-party marketplace blueprint (docs/85). The payload is
// a declarative @sparx/blueprints manifest; the ingest validates it (safeParseBlueprint)
// and writes it to storage as the artifact the installer replays into a new site.
export default {
  key: 'bakery',
  version: '1.0.0',
  name: 'Bakery',
  summary:
    'Baked fresh, daily. A ready-to-edit retail starter site with a matching theme, layout, home, and about page.',
  vertical: 'retail',
  requiresModules: ['builder', 'cms', 'commerce'],
  brand: {
    businessName: 'Bloom Bakehouse',
    tagline: 'Baked fresh, daily.',
    colors: {
      primary: '#db2777',
      primaryForeground: '#ffffff',
      accent: '#8b5cf6',
    },
    fonts: {
      heading: 'Quicksand',
      body: 'Nunito',
    },
  },
  theme: {
    name: 'Bakery',
    basePresetKey: 'market',
    presentation: {
      v: 2,
      containerWidth: '1200px',
    },
    brand: {
      colorPrimary: '#db2777',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#8b5cf6',
      fontHeading: 'Quicksand',
      fontBody: 'Nunito',
      tokens: {
        radiusBase: '18px',
      },
    },
    apply: true,
  },
  layout: {
    name: 'Bakery layout',
    tree: {
      id: 'bp-209',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col',
      name: 'Site layout',
      children: [
        {
          id: 'bp-203',
          type: 'Section',
          props: {},
          class:
            'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center p-6',
          name: 'Header',
          children: [
            {
              id: 'bp-201',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-center',
              children: [
                {
                  id: 'bp-199',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'bp-200',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Bloom Bakehouse',
                  },
                },
              ],
            },
            {
              id: 'bp-202',
              type: 'NavMenu',
              props: {
                orientation: 'row',
                links: [
                  {
                    label: 'Menu',
                    href: '/menu',
                  },
                  {
                    label: 'Cakes',
                    href: '/cakes',
                  },
                  {
                    label: 'About',
                    href: '/about',
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
          id: 'bp-204',
          type: 'Outlet',
          props: {},
          class: 'w-full',
        },
        {
          id: 'bp-208',
          type: 'Section',
          class: 'w-full bg-base-300',
          props: {},
          name: 'Footer',
          children: [
            {
              id: 'bp-208__c',
              type: 'Stack',
              class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
              props: {},
              children: [
                {
                  id: 'bp-205',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Menu',
                        href: '/menu',
                      },
                      {
                        label: 'Cakes',
                        href: '/cakes',
                      },
                      {
                        label: 'About',
                        href: '/about',
                      },
                      {
                        label: 'Contact',
                        href: '/contact',
                      },
                    ],
                  },
                },
                {
                  id: 'bp-206',
                  type: 'SocialLinks',
                  props: {},
                  binding: {
                    path: 'site.social',
                  },
                },
                {
                  id: 'bp-207',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '© Bloom Bakehouse',
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
        id: 'bp-227',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Home',
        children: [
          {
            id: 'bp-213',
            type: 'Section',
            class: 'w-full flex items-center justify-center h-[75vh] text-white',
            props: {
              bgImage: 'https://picsum.photos/seed/bakery-hero/2000/1100',
              bgOverlay: 'dark',
            },
            name: 'Hero',
            children: [
              {
                id: 'bp-213__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-210',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      text: 'Warm from the oven',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-211',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Breads, pastries, and celebration cakes baked fresh every morning.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-212',
                    type: 'Button',
                    props: {
                      label: 'See the menu',
                      style: 'primary',
                      href: '/menu',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-223',
            type: 'Section',
            props: {},
            class:
              'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
            name: 'Features',
            children: [
              {
                id: 'bp-216',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-214',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Daily bakes',
                    },
                  },
                  {
                    id: 'bp-215',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Out of the oven and onto the shelf each morning.',
                    },
                  },
                ],
              },
              {
                id: 'bp-219',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-217',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Custom cakes',
                    },
                  },
                  {
                    id: 'bp-218',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Celebration cakes made to your brief.',
                    },
                  },
                ],
              },
              {
                id: 'bp-222',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-220',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Pre-order',
                    },
                  },
                  {
                    id: 'bp-221',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Reserve your favourites before they sell out.',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-226',
            type: 'Section',
            class: 'w-full bg-neutral text-neutral-content',
            props: {},
            name: 'CTA',
            children: [
              {
                id: 'bp-226__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-224',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Order for pickup',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-225',
                    type: 'Button',
                    props: {
                      label: 'See the menu',
                      style: 'primary',
                      href: '/menu',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      seoTitle: 'Bloom Bakehouse',
      seoDescription: 'Baked fresh, daily.',
    },
    {
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      tree: {
        id: 'bp-231',
        type: 'Section',
        props: {},
        class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
        name: 'About',
        children: [
          {
            id: 'bp-228',
            type: 'Heading',
            props: {
              level: 'h1',
              text: 'About Bloom Bakehouse',
            },
          },
          {
            id: 'bp-229',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Baked fresh, daily. Breads, pastries, and celebration cakes baked fresh every morning.',
            },
          },
          {
            id: 'bp-230',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Edit this page in the builder to tell your story — who you are, what you stand for, and why customers choose you.',
            },
          },
        ],
      },
      seoTitle: 'About — Bloom Bakehouse',
    },
  ],
};
