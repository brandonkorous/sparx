// Travel Agency — a Sparx first-party marketplace blueprint (docs/85). The payload is
// a declarative @sparx/blueprints manifest; the ingest validates it (safeParseBlueprint)
// and writes it to storage as the artifact the installer replays into a new site.
export default {
  key: 'travel-agency',
  version: '1.0.0',
  name: 'Travel Agency',
  summary:
    'Go further, worry less. A ready-to-edit services starter site with a matching theme, layout, home, and about page.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'crm'],
  brand: {
    businessName: 'Coastline Travel',
    tagline: 'Go further, worry less.',
    colors: {
      primary: '#0e7490',
      primaryForeground: '#ffffff',
      accent: '#f4a259',
    },
    fonts: {
      heading: 'Poppins',
      body: 'Inter',
    },
  },
  theme: {
    name: 'Travel Agency',
    basePresetKey: 'drift',
    presentation: {
      v: 2,
      containerWidth: '1200px',
    },
    brand: {
      colorPrimary: '#0e7490',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#f4a259',
      fontHeading: 'Poppins',
      fontBody: 'Inter',
      tokens: {
        radiusBase: '14px',
      },
    },
    apply: true,
  },
  layout: {
    name: 'Travel Agency layout',
    tree: {
      id: 'bp-242',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col',
      name: 'Site layout',
      children: [
        {
          id: 'bp-236',
          type: 'Section',
          props: {},
          class:
            'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center p-6',
          name: 'Header',
          children: [
            {
              id: 'bp-234',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-center',
              children: [
                {
                  id: 'bp-232',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'bp-233',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Coastline Travel',
                  },
                },
              ],
            },
            {
              id: 'bp-235',
              type: 'NavMenu',
              props: {
                orientation: 'row',
                links: [
                  {
                    label: 'Destinations',
                    href: '/destinations',
                  },
                  {
                    label: 'Trips',
                    href: '/trips',
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
          id: 'bp-237',
          type: 'Outlet',
          props: {},
          class: 'w-full',
        },
        {
          id: 'bp-241',
          type: 'Section',
          class: 'w-full bg-base-300',
          props: {},
          name: 'Footer',
          children: [
            {
              id: 'bp-241__c',
              type: 'Stack',
              class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
              props: {},
              children: [
                {
                  id: 'bp-238',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Destinations',
                        href: '/destinations',
                      },
                      {
                        label: 'Trips',
                        href: '/trips',
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
                  id: 'bp-239',
                  type: 'SocialLinks',
                  props: {},
                  binding: {
                    path: 'site.social',
                  },
                },
                {
                  id: 'bp-240',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '© Coastline Travel',
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
        id: 'bp-260',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Home',
        children: [
          {
            id: 'bp-246',
            type: 'Section',
            class: 'w-full flex items-center justify-center h-[75vh] text-white',
            props: {
              bgImage: 'https://picsum.photos/seed/travel-agency-hero/2000/1100',
              bgOverlay: 'dark',
            },
            name: 'Hero',
            children: [
              {
                id: 'bp-246__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-243',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      text: 'Trips worth taking',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-244',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Tailored itineraries and the local know-how to make them effortless.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-245',
                    type: 'Button',
                    props: {
                      label: 'Start planning',
                      style: 'primary',
                      href: '/destinations',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-256',
            type: 'Section',
            props: {},
            class:
              'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
            name: 'Features',
            children: [
              {
                id: 'bp-249',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-247',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Tailored trips',
                    },
                  },
                  {
                    id: 'bp-248',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Itineraries shaped around how you like to travel.',
                    },
                  },
                ],
              },
              {
                id: 'bp-252',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-250',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Local experts',
                    },
                  },
                  {
                    id: 'bp-251',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'On-the-ground partners in every destination.',
                    },
                  },
                ],
              },
              {
                id: 'bp-255',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-253',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Always on call',
                    },
                  },
                  {
                    id: 'bp-254',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Support before, during, and after your trip.',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-259',
            type: 'Section',
            class: 'w-full bg-neutral text-neutral-content',
            props: {},
            name: 'CTA',
            children: [
              {
                id: 'bp-259__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-257',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Plan your next escape',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-258',
                    type: 'Button',
                    props: {
                      label: 'Start planning',
                      style: 'primary',
                      href: '/destinations',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      seoTitle: 'Coastline Travel',
      seoDescription: 'Go further, worry less.',
    },
    {
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      tree: {
        id: 'bp-264',
        type: 'Section',
        props: {},
        class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
        name: 'About',
        children: [
          {
            id: 'bp-261',
            type: 'Heading',
            props: {
              level: 'h1',
              text: 'About Coastline Travel',
            },
          },
          {
            id: 'bp-262',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Go further, worry less. Tailored itineraries and the local know-how to make them effortless.',
            },
          },
          {
            id: 'bp-263',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Edit this page in the builder to tell your story — who you are, what you stand for, and why customers choose you.',
            },
          },
        ],
      },
      seoTitle: 'About — Coastline Travel',
    },
  ],
};
