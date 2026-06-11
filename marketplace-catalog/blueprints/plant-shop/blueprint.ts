// Plant Shop — a Sparx first-party marketplace blueprint (docs/85). The payload is
// a declarative @sparx/blueprints manifest; the ingest validates it (safeParseBlueprint)
// and writes it to storage as the artifact the installer replays into a new site.
export default {
  key: 'plant-shop',
  version: '1.0.0',
  name: 'Plant Shop',
  summary:
    'Greener, every day. A ready-to-edit retail starter site with a matching theme, layout, home, and about page.',
  vertical: 'retail',
  requiresModules: ['builder', 'cms', 'commerce'],
  brand: {
    businessName: 'Fern & Foliage',
    tagline: 'Greener, every day.',
    colors: {
      primary: '#4d7c5a',
      primaryForeground: '#ffffff',
      accent: '#a3b18a',
    },
    fonts: {
      heading: 'Fraunces',
      body: 'Nunito Sans',
    },
  },
  theme: {
    name: 'Plant Shop',
    basePresetKey: 'market',
    presentation: {
      v: 2,
      containerWidth: '1200px',
    },
    brand: {
      colorPrimary: '#4d7c5a',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#a3b18a',
      fontHeading: 'Fraunces',
      fontBody: 'Nunito Sans',
      tokens: {
        radiusBase: '14px',
      },
    },
    apply: true,
  },
  layout: {
    name: 'Plant Shop layout',
    tree: {
      id: 'bp-143',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col',
      name: 'Site layout',
      children: [
        {
          id: 'bp-137',
          type: 'Section',
          props: {},
          class:
            'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center p-6',
          name: 'Header',
          children: [
            {
              id: 'bp-135',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 items-center',
              children: [
                {
                  id: 'bp-133',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'bp-134',
                  type: 'Heading',
                  props: {
                    level: 'h3',
                    text: 'Fern & Foliage',
                  },
                },
              ],
            },
            {
              id: 'bp-136',
              type: 'NavMenu',
              props: {
                orientation: 'row',
                links: [
                  {
                    label: 'Shop',
                    href: '/shop',
                  },
                  {
                    label: 'Care',
                    href: '/care',
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
          id: 'bp-138',
          type: 'Outlet',
          props: {},
          class: 'w-full',
        },
        {
          id: 'bp-142',
          type: 'Section',
          class: 'w-full bg-base-300',
          props: {},
          name: 'Footer',
          children: [
            {
              id: 'bp-142__c',
              type: 'Stack',
              class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-6 @3xl:p-10',
              props: {},
              children: [
                {
                  id: 'bp-139',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Shop',
                        href: '/shop',
                      },
                      {
                        label: 'Care',
                        href: '/care',
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
                  id: 'bp-140',
                  type: 'SocialLinks',
                  props: {},
                  binding: {
                    path: 'site.social',
                  },
                },
                {
                  id: 'bp-141',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '© Fern & Foliage',
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
        id: 'bp-161',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Home',
        children: [
          {
            id: 'bp-147',
            type: 'Section',
            class: 'w-full flex items-center justify-center min-h-[75vh] text-white',
            props: {
              bgImage: 'https://picsum.photos/seed/plant-shop-hero/2000/1100',
              bgOverlay: 'dark',
            },
            name: 'Hero',
            children: [
              {
                id: 'bp-147__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-144',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      text: 'Plants that thrive with you',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-145',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Hand-picked houseplants, pots, and the know-how to keep them happy.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-146',
                    type: 'Button',
                    props: {
                      label: 'Shop plants',
                      style: 'primary',
                      href: '/shop',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-157',
            type: 'Section',
            props: {},
            class:
              'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
            name: 'Features',
            children: [
              {
                id: 'bp-150',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-148',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Healthy stock',
                    },
                  },
                  {
                    id: 'bp-149',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Every plant nursed in-store before it goes home.',
                    },
                  },
                ],
              },
              {
                id: 'bp-153',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-151',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Care guides',
                    },
                  },
                  {
                    id: 'bp-152',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Simple, plant-by-plant care for every space.',
                    },
                  },
                ],
              },
              {
                id: 'bp-156',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
                children: [
                  {
                    id: 'bp-154',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Local delivery',
                    },
                  },
                  {
                    id: 'bp-155',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Carefully boxed and delivered to your door.',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'bp-160',
            type: 'Section',
            class: 'w-full bg-neutral text-neutral-content',
            props: {},
            name: 'CTA',
            children: [
              {
                id: 'bp-160__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'bp-158',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Bring the outside in',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'bp-159',
                    type: 'Button',
                    props: {
                      label: 'Shop plants',
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
      seoTitle: 'Fern & Foliage',
      seoDescription: 'Greener, every day.',
    },
    {
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      tree: {
        id: 'bp-165',
        type: 'Section',
        props: {},
        class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
        name: 'About',
        children: [
          {
            id: 'bp-162',
            type: 'Heading',
            props: {
              level: 'h1',
              text: 'About Fern & Foliage',
            },
          },
          {
            id: 'bp-163',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Greener, every day. Hand-picked houseplants, pots, and the know-how to keep them happy.',
            },
          },
          {
            id: 'bp-164',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Edit this page in the builder to tell your story — who you are, what you stand for, and why customers choose you.',
            },
          },
        ],
      },
      seoTitle: 'About — Fern & Foliage',
    },
  ],
};
