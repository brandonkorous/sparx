// Jewelry Boutique — a sparx first-party marketplace blueprint (docs/85). The payload is
// a declarative @sparx/blueprints manifest; the ingest validates it (safeParseBlueprint)
// and writes it to storage as the artifact the installer replays into a new site.
export default {
  key: 'jewelry-boutique',
  version: '1.0.0',
  name: 'Jewelry Boutique',
  summary:
    'Quiet luxury, made to keep. A ready-to-edit retail starter site with a matching theme, layout, home, and about page.',
  vertical: 'retail',
  requiresModules: ['builder', 'cms', 'commerce'],
  brand: {
    businessName: 'Noir Atelier',
    tagline: 'Quiet luxury, made to keep.',
    colors: {
      primary: '#0a0a0a',
      primaryForeground: '#f5f0e6',
      accent: '#b08d57',
    },
    fonts: {
      heading: 'Cormorant Garamond',
      body: 'Inter',
    },
  },
  theme: {
    name: 'Jewelry Boutique',
    basePresetKey: 'drift',
    presentation: {
      v: 2,
      containerWidth: '1200px',
    },
    brand: {
      colorPrimary: '#0a0a0a',
      colorPrimaryForeground: '#f5f0e6',
      colorAccent: '#b08d57',
      fontHeading: 'Cormorant Garamond',
      fontBody: 'Inter',
      tokens: {
        radiusBase: '0px',
      },
    },
    apply: true,
  },
  layout: {
    name: 'Jewelry Boutique layout',
    tree: {
      id: 'bp-308',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col',
      name: 'Site layout',
      children: [
        {
          id: 'bp-302',
          type: 'Section',
          props: {},
          class:
            'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center p-6',
          name: 'Header',
          children: [
            {
              id: 'bp-300',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-center',
              children: [
                {
                  id: 'bp-298',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'bp-299',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Noir Atelier',
                  },
                },
              ],
            },
            {
              id: 'bp-301',
              type: 'NavMenu',
              props: {
                orientation: 'row',
                links: [
                  {
                    label: 'Collection',
                    href: '/collection',
                  },
                  {
                    label: 'Bespoke',
                    href: '/bespoke',
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
          id: 'bp-303',
          type: 'Outlet',
          props: {},
          class: 'w-full',
        },
        {
          id: 'bp-307',
          type: 'Section',
          class: 'w-full bg-base-300',
          props: {},
          name: 'Footer',
          children: [
            {
              id: 'bp-307__c',
              type: 'Stack',
              class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
              props: {},
              children: [
                {
                  id: 'bp-304',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Collection',
                        href: '/collection',
                      },
                      {
                        label: 'Bespoke',
                        href: '/bespoke',
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
                  id: 'bp-305',
                  type: 'SocialLinks',
                  props: {},
                  binding: {
                    path: 'site.social',
                  },
                },
                {
                  id: 'bp-306',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '© Noir Atelier',
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
        id: 'bp-326',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Home',
        children: [
          {
            id: 'bp-312',
            type: 'Section',
            class: 'w-full flex items-center justify-center h-[75vh] text-white',
            props: {
              bgImage: 'https://picsum.photos/seed/jewelry-boutique-hero/2000/1100',
              bgOverlay: 'dark',
            },
            name: 'Hero',
            children: [
              {
                id: 'bp-312__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-309',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      text: 'Pieces made to be kept',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-310',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Fine jewelry in gold and stone, designed to last a lifetime.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-311',
                    type: 'Button',
                    props: {
                      label: 'Explore the collection',
                      style: 'primary',
                      href: '/collection',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-322',
            type: 'Section',
            props: {},
            class:
              'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
            name: 'Features',
            children: [
              {
                id: 'bp-315',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-313',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Ethically sourced',
                    },
                  },
                  {
                    id: 'bp-314',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Stones and metals we can trace and stand behind.',
                    },
                  },
                ],
              },
              {
                id: 'bp-318',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-316',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Made to last',
                    },
                  },
                  {
                    id: 'bp-317',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Crafted to be worn every day for decades.',
                    },
                  },
                ],
              },
              {
                id: 'bp-321',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-319',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Bespoke',
                    },
                  },
                  {
                    id: 'bp-320',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Commission a piece designed entirely around you.',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-325',
            type: 'Section',
            class: 'w-full bg-neutral text-neutral-content',
            props: {},
            name: 'CTA',
            children: [
              {
                id: 'bp-325__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-323',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Find your piece',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-324',
                    type: 'Button',
                    props: {
                      label: 'Explore the collection',
                      style: 'primary',
                      href: '/collection',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      seoTitle: 'Noir Atelier',
      seoDescription: 'Quiet luxury, made to keep.',
    },
    {
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      tree: {
        id: 'bp-330',
        type: 'Section',
        props: {},
        class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
        name: 'About',
        children: [
          {
            id: 'bp-327',
            type: 'Heading',
            props: {
              level: 'h1',
              text: 'About Noir Atelier',
            },
          },
          {
            id: 'bp-328',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Quiet luxury, made to keep. Fine jewelry in gold and stone, designed to last a lifetime.',
            },
          },
          {
            id: 'bp-329',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Edit this page in the builder to tell your story — who you are, what you stand for, and why customers choose you.',
            },
          },
        ],
      },
      seoTitle: 'About — Noir Atelier',
    },
  ],
};
