// Photography Portfolio — a sparx first-party marketplace blueprint (docs/85). The payload is
// a declarative @sparx/blueprints manifest; the ingest validates it (safeParseBlueprint)
// and writes it to storage as the artifact the installer replays into a new site.
export default {
  key: 'photography-portfolio',
  version: '1.0.0',
  name: 'Photography Portfolio',
  summary:
    'Light, held still. A ready-to-edit content starter site with a matching theme, layout, home, and about page.',
  vertical: 'content',
  requiresModules: ['builder', 'cms'],
  brand: {
    businessName: 'Frame & Field',
    tagline: 'Light, held still.',
    colors: {
      primary: '#111111',
      primaryForeground: '#ffffff',
      accent: '#111111',
    },
    fonts: {
      heading: 'Archivo',
      body: 'Inter',
    },
  },
  theme: {
    name: 'Photography Portfolio',
    basePresetKey: 'drift',
    presentation: {
      v: 2,
      containerWidth: '1200px',
    },
    brand: {
      colorPrimary: '#111111',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#111111',
      fontHeading: 'Archivo',
      fontBody: 'Inter',
      tokens: {
        radiusBase: '0px',
      },
    },
    apply: true,
  },
  layout: {
    name: 'Photography Portfolio layout',
    tree: {
      id: 'bp-77',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col',
      name: 'Site layout',
      children: [
        {
          id: 'bp-71',
          type: 'Section',
          props: {},
          class:
            'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center p-6',
          name: 'Header',
          children: [
            {
              id: 'bp-69',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-center',
              children: [
                {
                  id: 'bp-67',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'bp-68',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Frame & Field',
                  },
                },
              ],
            },
            {
              id: 'bp-70',
              type: 'NavMenu',
              props: {
                orientation: 'row',
                links: [
                  {
                    label: 'Work',
                    href: '/work',
                  },
                  {
                    label: 'About',
                    href: '/about',
                  },
                  {
                    label: 'Prints',
                    href: '/prints',
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
          id: 'bp-72',
          type: 'Outlet',
          props: {},
          class: 'w-full',
        },
        {
          id: 'bp-76',
          type: 'Section',
          class: 'w-full bg-base-300',
          props: {},
          name: 'Footer',
          children: [
            {
              id: 'bp-76__c',
              type: 'Stack',
              class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
              props: {},
              children: [
                {
                  id: 'bp-73',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Work',
                        href: '/work',
                      },
                      {
                        label: 'About',
                        href: '/about',
                      },
                      {
                        label: 'Prints',
                        href: '/prints',
                      },
                      {
                        label: 'Contact',
                        href: '/contact',
                      },
                    ],
                  },
                },
                {
                  id: 'bp-74',
                  type: 'SocialLinks',
                  props: {},
                  binding: {
                    path: 'site.social',
                  },
                },
                {
                  id: 'bp-75',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '© Frame & Field',
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
        id: 'bp-95',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Home',
        children: [
          {
            id: 'bp-81',
            type: 'Section',
            class: 'w-full flex items-center justify-center h-[75vh] text-white',
            props: {
              bgImage: 'https://picsum.photos/seed/photography-portfolio-hero/2000/1100',
              bgOverlay: 'dark',
            },
            name: 'Hero',
            children: [
              {
                id: 'bp-81__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-78',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      text: 'Photography that lingers',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-79',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'A portfolio of work across portrait, landscape, and editorial.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-80',
                    type: 'Button',
                    props: {
                      label: 'Start a project',
                      style: 'primary',
                      href: '/work',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-91',
            type: 'Section',
            props: {},
            class:
              'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
            name: 'Features',
            children: [
              {
                id: 'bp-84',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-82',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Portraits',
                    },
                  },
                  {
                    id: 'bp-83',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Honest, unhurried frames of people as they are.',
                    },
                  },
                ],
              },
              {
                id: 'bp-87',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-85',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Editorial',
                    },
                  },
                  {
                    id: 'bp-86',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Stories told in a sequence of considered images.',
                    },
                  },
                ],
              },
              {
                id: 'bp-90',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-88',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Prints',
                    },
                  },
                  {
                    id: 'bp-89',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Archival prints of the work, made to last.',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-94',
            type: 'Section',
            class: 'w-full bg-neutral text-neutral-content',
            props: {},
            name: 'CTA',
            children: [
              {
                id: 'bp-94__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-92',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: "Let's make something",
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-93',
                    type: 'Button',
                    props: {
                      label: 'Start a project',
                      style: 'primary',
                      href: '/work',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      seoTitle: 'Frame & Field',
      seoDescription: 'Light, held still.',
    },
    {
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      tree: {
        id: 'bp-99',
        type: 'Section',
        props: {},
        class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
        name: 'About',
        children: [
          {
            id: 'bp-96',
            type: 'Heading',
            props: {
              level: 'h1',
              text: 'About Frame & Field',
            },
          },
          {
            id: 'bp-97',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Light, held still. A portfolio of work across portrait, landscape, and editorial.',
            },
          },
          {
            id: 'bp-98',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Edit this page in the builder to tell your story — who you are, what you stand for, and why customers choose you.',
            },
          },
        ],
      },
      seoTitle: 'About — Frame & Field',
    },
  ],
};
