// Dental Practice — a Sparx first-party marketplace blueprint (docs/85). The payload is
// a declarative @sparx/blueprints manifest; the ingest validates it (safeParseBlueprint)
// and writes it to storage as the artifact the installer replays into a new site.
export default {
  key: 'dental-practice',
  version: '1.0.0',
  name: 'Dental Practice',
  summary:
    'Modern care, gentle hands. A ready-to-edit services starter site with a matching theme, layout, home, and about page.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'crm'],
  brand: {
    businessName: 'Brightwater Dental',
    tagline: 'Modern care, gentle hands.',
    colors: {
      primary: '#0e7490',
      primaryForeground: '#ffffff',
      accent: '#06b6d4',
    },
    fonts: {
      heading: 'Manrope',
      body: 'Inter',
    },
  },
  theme: {
    name: 'Dental Practice',
    basePresetKey: 'apex',
    presentation: {
      v: 2,
      containerWidth: '1200px',
    },
    brand: {
      colorPrimary: '#0e7490',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#06b6d4',
      fontHeading: 'Manrope',
      fontBody: 'Inter',
      tokens: {
        radiusBase: '12px',
      },
    },
    apply: true,
  },
  layout: {
    name: 'Dental Practice layout',
    tree: {
      id: 'bp-110',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col',
      name: 'Site layout',
      children: [
        {
          id: 'bp-104',
          type: 'Section',
          props: {},
          class:
            'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center p-6',
          name: 'Header',
          children: [
            {
              id: 'bp-102',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-center',
              children: [
                {
                  id: 'bp-100',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'bp-101',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Brightwater Dental',
                  },
                },
              ],
            },
            {
              id: 'bp-103',
              type: 'NavMenu',
              props: {
                orientation: 'row',
                links: [
                  {
                    label: 'Services',
                    href: '/services',
                  },
                  {
                    label: 'Team',
                    href: '/team',
                  },
                  {
                    label: 'New patients',
                    href: '/new-patients',
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
          id: 'bp-105',
          type: 'Outlet',
          props: {},
          class: 'w-full',
        },
        {
          id: 'bp-109',
          type: 'Section',
          class: 'w-full bg-base-300',
          props: {},
          name: 'Footer',
          children: [
            {
              id: 'bp-109__c',
              type: 'Stack',
              class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
              props: {},
              children: [
                {
                  id: 'bp-106',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Services',
                        href: '/services',
                      },
                      {
                        label: 'Team',
                        href: '/team',
                      },
                      {
                        label: 'New patients',
                        href: '/new-patients',
                      },
                      {
                        label: 'Contact',
                        href: '/contact',
                      },
                    ],
                  },
                },
                {
                  id: 'bp-107',
                  type: 'SocialLinks',
                  props: {},
                  binding: {
                    path: 'site.social',
                  },
                },
                {
                  id: 'bp-108',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '© Brightwater Dental',
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
        id: 'bp-128',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Home',
        children: [
          {
            id: 'bp-114',
            type: 'Section',
            class: 'w-full flex items-center justify-center min-h-[75vh] text-white',
            props: {
              bgImage: 'https://picsum.photos/seed/dental-practice-hero/2000/1100',
              bgOverlay: 'dark',
            },
            name: 'Hero',
            children: [
              {
                id: 'bp-114__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-111',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      text: 'A dental visit you won’t dread',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-112',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Comfortable, modern care for the whole family — with same-week appointments.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-113',
                    type: 'Button',
                    props: {
                      label: 'Request an appointment',
                      style: 'primary',
                      href: '/services',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-124',
            type: 'Section',
            props: {},
            class:
              'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
            name: 'Features',
            children: [
              {
                id: 'bp-117',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-115',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Gentle care',
                    },
                  },
                  {
                    id: 'bp-116',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Calm, judgement-free visits at your pace.',
                    },
                  },
                ],
              },
              {
                id: 'bp-120',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-118',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Modern tech',
                    },
                  },
                  {
                    id: 'bp-119',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Digital scans and same-day crowns.',
                    },
                  },
                ],
              },
              {
                id: 'bp-123',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-121',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Easy booking',
                    },
                  },
                  {
                    id: 'bp-122',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Request a time online and we’ll confirm fast.',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-127',
            type: 'Section',
            class: 'w-full bg-neutral text-neutral-content',
            props: {},
            name: 'CTA',
            children: [
              {
                id: 'bp-127__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-125',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'New patients welcome',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-126',
                    type: 'Button',
                    props: {
                      label: 'Request an appointment',
                      style: 'primary',
                      href: '/services',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      seoTitle: 'Brightwater Dental',
      seoDescription: 'Modern care, gentle hands.',
    },
    {
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      tree: {
        id: 'bp-132',
        type: 'Section',
        props: {},
        class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
        name: 'About',
        children: [
          {
            id: 'bp-129',
            type: 'Heading',
            props: {
              level: 'h1',
              text: 'About Brightwater Dental',
            },
          },
          {
            id: 'bp-130',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Modern care, gentle hands. Comfortable, modern care for the whole family — with same-week appointments.',
            },
          },
          {
            id: 'bp-131',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Edit this page in the builder to tell your story — who you are, what you stand for, and why customers choose you.',
            },
          },
        ],
      },
      seoTitle: 'About — Brightwater Dental',
    },
  ],
};
