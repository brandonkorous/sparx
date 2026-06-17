// Tech Startup — a sparx first-party marketplace blueprint (docs/85). The payload is
// a declarative @sparx/blueprints manifest; the ingest validates it (safeParseBlueprint)
// and writes it to storage as the artifact the installer replays into a new site.
export default {
  key: 'tech-startup',
  version: '1.0.0',
  name: 'Tech Startup',
  summary:
    'Ship the future. A ready-to-edit content starter site with a matching theme, layout, home, and about page.',
  vertical: 'content',
  requiresModules: ['builder', 'cms'],
  brand: {
    businessName: 'Pulse Labs',
    tagline: 'Ship the future.',
    colors: {
      primary: '#6d28d9',
      primaryForeground: '#ffffff',
      accent: '#06b6d4',
    },
    fonts: {
      heading: 'Space Grotesk',
      body: 'Inter',
    },
  },
  theme: {
    name: 'Tech Startup',
    basePresetKey: 'apex',
    presentation: {
      v: 2,
      containerWidth: '1200px',
    },
    brand: {
      colorPrimary: '#6d28d9',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#06b6d4',
      fontHeading: 'Space Grotesk',
      fontBody: 'Inter',
      tokens: {
        radiusBase: '12px',
      },
    },
    apply: true,
  },
  layout: {
    name: 'Tech Startup layout',
    tree: {
      id: 'bp-275',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col',
      name: 'Site layout',
      children: [
        {
          id: 'bp-269',
          type: 'Section',
          props: {},
          class:
            'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center p-6',
          name: 'Header',
          children: [
            {
              id: 'bp-267',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-center',
              children: [
                {
                  id: 'bp-265',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'bp-266',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Pulse Labs',
                  },
                },
              ],
            },
            {
              id: 'bp-268',
              type: 'NavMenu',
              props: {
                orientation: 'row',
                links: [
                  {
                    label: 'Product',
                    href: '/product',
                  },
                  {
                    label: 'Pricing',
                    href: '/pricing',
                  },
                  {
                    label: 'Docs',
                    href: '/docs',
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
          id: 'bp-270',
          type: 'Outlet',
          props: {},
          class: 'w-full',
        },
        {
          id: 'bp-274',
          type: 'Section',
          class: 'w-full bg-base-300',
          props: {},
          name: 'Footer',
          children: [
            {
              id: 'bp-274__c',
              type: 'Stack',
              class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
              props: {},
              children: [
                {
                  id: 'bp-271',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Product',
                        href: '/product',
                      },
                      {
                        label: 'Pricing',
                        href: '/pricing',
                      },
                      {
                        label: 'Docs',
                        href: '/docs',
                      },
                      {
                        label: 'Contact',
                        href: '/contact',
                      },
                    ],
                  },
                },
                {
                  id: 'bp-272',
                  type: 'SocialLinks',
                  props: {},
                  binding: {
                    path: 'site.social',
                  },
                },
                {
                  id: 'bp-273',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '© Pulse Labs',
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
        id: 'bp-293',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Home',
        children: [
          {
            id: 'bp-279',
            type: 'Section',
            class: 'w-full flex items-center justify-center h-[75vh] text-white',
            props: {
              bgImage: 'https://picsum.photos/seed/tech-startup-hero/2000/1100',
              bgOverlay: 'dark',
            },
            name: 'Hero',
            children: [
              {
                id: 'bp-279__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-276',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      text: 'The platform for what’s next',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-277',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Everything your team needs to build, launch, and scale — in one place.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-278',
                    type: 'Button',
                    props: {
                      label: 'Get started free',
                      style: 'primary',
                      href: '/product',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-289',
            type: 'Section',
            props: {},
            class:
              'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
            name: 'Features',
            children: [
              {
                id: 'bp-282',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-280',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Fast by default',
                    },
                  },
                  {
                    id: 'bp-281',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'A stack tuned for speed from the first commit.',
                    },
                  },
                ],
              },
              {
                id: 'bp-285',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-283',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Built to scale',
                    },
                  },
                  {
                    id: 'bp-284',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Grows with you from prototype to production.',
                    },
                  },
                ],
              },
              {
                id: 'bp-288',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-286',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Loved by devs',
                    },
                  },
                  {
                    id: 'bp-287',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'An API and docs your team will actually enjoy.',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-292',
            type: 'Section',
            class: 'w-full bg-neutral text-neutral-content',
            props: {},
            name: 'CTA',
            children: [
              {
                id: 'bp-292__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-290',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Build with us',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-291',
                    type: 'Button',
                    props: {
                      label: 'Get started free',
                      style: 'primary',
                      href: '/product',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      seoTitle: 'Pulse Labs',
      seoDescription: 'Ship the future.',
    },
    {
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      tree: {
        id: 'bp-297',
        type: 'Section',
        props: {},
        class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
        name: 'About',
        children: [
          {
            id: 'bp-294',
            type: 'Heading',
            props: {
              level: 'h1',
              text: 'About Pulse Labs',
            },
          },
          {
            id: 'bp-295',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Ship the future. Everything your team needs to build, launch, and scale — in one place.',
            },
          },
          {
            id: 'bp-296',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Edit this page in the builder to tell your story — who you are, what you stand for, and why customers choose you.',
            },
          },
        ],
      },
      seoTitle: 'About — Pulse Labs',
    },
  ],
};
