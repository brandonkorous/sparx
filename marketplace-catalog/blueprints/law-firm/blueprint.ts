// Law Firm — a Sparx first-party marketplace blueprint (docs/85). The payload is
// a declarative @sparx/blueprints manifest; the ingest validates it (safeParseBlueprint)
// and writes it to storage as the artifact the installer replays into a new site.
export default {
  key: 'law-firm',
  version: '1.0.0',
  name: 'Law Firm',
  summary:
    'Counsel you can build on. A ready-to-edit services starter site with a matching theme, layout, home, and about page.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'crm'],
  brand: {
    businessName: 'Meridian Legal',
    tagline: 'Counsel you can build on.',
    colors: {
      primary: '#1e3a8a',
      primaryForeground: '#ffffff',
      accent: '#0ea5e9',
    },
    fonts: {
      heading: 'Libre Baskerville',
      body: 'Inter',
    },
  },
  theme: {
    name: 'Law Firm',
    basePresetKey: 'apex',
    presentation: {
      v: 2,
      containerWidth: '1200px',
    },
    brand: {
      colorPrimary: '#1e3a8a',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#0ea5e9',
      fontHeading: 'Libre Baskerville',
      fontBody: 'Inter',
      tokens: {
        radiusBase: '4px',
      },
    },
    apply: true,
  },
  layout: {
    name: 'Law Firm layout',
    tree: {
      id: 'bp-176',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col',
      name: 'Site layout',
      children: [
        {
          id: 'bp-170',
          type: 'Section',
          props: {},
          class:
            'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center p-6',
          name: 'Header',
          children: [
            {
              id: 'bp-168',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-center',
              children: [
                {
                  id: 'bp-166',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'bp-167',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Meridian Legal',
                  },
                },
              ],
            },
            {
              id: 'bp-169',
              type: 'NavMenu',
              props: {
                orientation: 'row',
                links: [
                  {
                    label: 'Practice areas',
                    href: '/practice-areas',
                  },
                  {
                    label: 'Attorneys',
                    href: '/attorneys',
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
          id: 'bp-171',
          type: 'Outlet',
          props: {},
          class: 'w-full',
        },
        {
          id: 'bp-175',
          type: 'Section',
          class: 'w-full bg-base-300',
          props: {},
          name: 'Footer',
          children: [
            {
              id: 'bp-175__c',
              type: 'Stack',
              class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
              props: {},
              children: [
                {
                  id: 'bp-172',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Practice areas',
                        href: '/practice-areas',
                      },
                      {
                        label: 'Attorneys',
                        href: '/attorneys',
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
                  id: 'bp-173',
                  type: 'SocialLinks',
                  props: {},
                  binding: {
                    path: 'site.social',
                  },
                },
                {
                  id: 'bp-174',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '© Meridian Legal',
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
        id: 'bp-194',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Home',
        children: [
          {
            id: 'bp-180',
            type: 'Section',
            class: 'w-full flex items-center justify-center min-h-[75vh] text-white',
            props: {
              bgImage: 'https://picsum.photos/seed/law-firm-hero/2000/1100',
              bgOverlay: 'dark',
            },
            name: 'Hero',
            children: [
              {
                id: 'bp-180__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-177',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      text: 'Clear advice, steady representation',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-178',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'A practice built on plain answers, careful work, and long relationships.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-179',
                    type: 'Button',
                    props: {
                      label: 'Request a consultation',
                      style: 'primary',
                      href: '/practice areas',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-190',
            type: 'Section',
            props: {},
            class:
              'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
            name: 'Features',
            children: [
              {
                id: 'bp-183',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-181',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Plain answers',
                    },
                  },
                  {
                    id: 'bp-182',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'No jargon — we explain where you stand.',
                    },
                  },
                ],
              },
              {
                id: 'bp-186',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-184',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Senior attention',
                    },
                  },
                  {
                    id: 'bp-185',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Your matter is handled by experienced counsel.',
                    },
                  },
                ],
              },
              {
                id: 'bp-189',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-187',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Responsive',
                    },
                  },
                  {
                    id: 'bp-188',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'We return calls and meet deadlines, every time.',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-193',
            type: 'Section',
            class: 'w-full bg-neutral text-neutral-content',
            props: {},
            name: 'CTA',
            children: [
              {
                id: 'bp-193__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-191',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Tell us about your case',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-192',
                    type: 'Button',
                    props: {
                      label: 'Request a consultation',
                      style: 'primary',
                      href: '/practice areas',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      seoTitle: 'Meridian Legal',
      seoDescription: 'Counsel you can build on.',
    },
    {
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      tree: {
        id: 'bp-198',
        type: 'Section',
        props: {},
        class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
        name: 'About',
        children: [
          {
            id: 'bp-195',
            type: 'Heading',
            props: {
              level: 'h1',
              text: 'About Meridian Legal',
            },
          },
          {
            id: 'bp-196',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Counsel you can build on. A practice built on plain answers, careful work, and long relationships.',
            },
          },
          {
            id: 'bp-197',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Edit this page in the builder to tell your story — who you are, what you stand for, and why customers choose you.',
            },
          },
        ],
      },
      seoTitle: 'About — Meridian Legal',
    },
  ],
};
