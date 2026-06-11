// Fitness Studio — a Sparx first-party marketplace blueprint (docs/85). The payload is
// a declarative @sparx/blueprints manifest; the ingest validates it (safeParseBlueprint)
// and writes it to storage as the artifact the installer replays into a new site.
export default {
  key: 'fitness-studio',
  version: '1.0.0',
  name: 'Fitness Studio',
  summary:
    'Train with intent. A ready-to-edit services starter site with a matching theme, layout, home, and about page.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'crm'],
  brand: {
    businessName: 'Pulse Athletic',
    tagline: 'Train with intent.',
    colors: {
      primary: '#e8590c',
      primaryForeground: '#ffffff',
      accent: '#c2255c',
    },
    fonts: {
      heading: 'Sora',
      body: 'Inter',
    },
  },
  theme: {
    name: 'Fitness Studio',
    basePresetKey: 'apex',
    presentation: {
      v: 2,
      containerWidth: '1200px',
    },
    brand: {
      colorPrimary: '#e8590c',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#c2255c',
      fontHeading: 'Sora',
      fontBody: 'Inter',
      tokens: {
        radiusBase: '12px',
      },
    },
    apply: true,
  },
  layout: {
    name: 'Fitness Studio layout',
    tree: {
      id: 'bp-44',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col',
      name: 'Site layout',
      children: [
        {
          id: 'bp-38',
          type: 'Section',
          props: {},
          class:
            'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center p-6',
          name: 'Header',
          children: [
            {
              id: 'bp-36',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-center',
              children: [
                {
                  id: 'bp-34',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'bp-35',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Pulse Athletic',
                  },
                },
              ],
            },
            {
              id: 'bp-37',
              type: 'NavMenu',
              props: {
                orientation: 'row',
                links: [
                  {
                    label: 'Classes',
                    href: '/classes',
                  },
                  {
                    label: 'Memberships',
                    href: '/memberships',
                  },
                  {
                    label: 'Coaches',
                    href: '/coaches',
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
          id: 'bp-39',
          type: 'Outlet',
          props: {},
          class: 'w-full',
        },
        {
          id: 'bp-43',
          type: 'Section',
          class: 'w-full bg-base-300',
          props: {},
          name: 'Footer',
          children: [
            {
              id: 'bp-43__c',
              type: 'Stack',
              class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
              props: {},
              children: [
                {
                  id: 'bp-40',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Classes',
                        href: '/classes',
                      },
                      {
                        label: 'Memberships',
                        href: '/memberships',
                      },
                      {
                        label: 'Coaches',
                        href: '/coaches',
                      },
                      {
                        label: 'Contact',
                        href: '/contact',
                      },
                    ],
                  },
                },
                {
                  id: 'bp-41',
                  type: 'SocialLinks',
                  props: {},
                  binding: {
                    path: 'site.social',
                  },
                },
                {
                  id: 'bp-42',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '© Pulse Athletic',
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
        id: 'bp-62',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Home',
        children: [
          {
            id: 'bp-48',
            type: 'Section',
            class: 'w-full flex items-center justify-center min-h-[75vh] text-white',
            props: {
              bgImage: 'https://picsum.photos/seed/fitness-studio-hero/2000/1100',
              bgOverlay: 'dark',
            },
            name: 'Hero',
            children: [
              {
                id: 'bp-48__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-45',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      text: 'Stronger every session',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-46',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Coached classes and open-gym training built around real progress.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-47',
                    type: 'Button',
                    props: {
                      label: 'Book a session',
                      style: 'primary',
                      href: '/classes',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-58',
            type: 'Section',
            props: {},
            class:
              'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
            name: 'Features',
            children: [
              {
                id: 'bp-51',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-49',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Expert coaching',
                    },
                  },
                  {
                    id: 'bp-50',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Certified coaches who scale every movement to you.',
                    },
                  },
                ],
              },
              {
                id: 'bp-54',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-52',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Flexible plans',
                    },
                  },
                  {
                    id: 'bp-53',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Drop in or commit — memberships that fit your week.',
                    },
                  },
                ],
              },
              {
                id: 'bp-57',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-55',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Community',
                    },
                  },
                  {
                    id: 'bp-56',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Train alongside people chasing the same goals.',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-61',
            type: 'Section',
            class: 'w-full bg-neutral text-neutral-content',
            props: {},
            name: 'CTA',
            children: [
              {
                id: 'bp-61__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-59',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Your first class is on us',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-60',
                    type: 'Button',
                    props: {
                      label: 'Book a session',
                      style: 'primary',
                      href: '/classes',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      seoTitle: 'Pulse Athletic',
      seoDescription: 'Train with intent.',
    },
    {
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      tree: {
        id: 'bp-66',
        type: 'Section',
        props: {},
        class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
        name: 'About',
        children: [
          {
            id: 'bp-63',
            type: 'Heading',
            props: {
              level: 'h1',
              text: 'About Pulse Athletic',
            },
          },
          {
            id: 'bp-64',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Train with intent. Coached classes and open-gym training built around real progress.',
            },
          },
          {
            id: 'bp-65',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Edit this page in the builder to tell your story — who you are, what you stand for, and why customers choose you.',
            },
          },
        ],
      },
      seoTitle: 'About — Pulse Athletic',
    },
  ],
};
