// Farm Fresh Bowls — Sparx first-party blueprint payload (docs/85). GENERATED, do not
// edit by hand: the source of truth is marketplace-catalog/_gen/gen-farm-fresh-bowls.ts
// (run it to regenerate). Self-contained data — no imports — so the ingest can
// dynamic-import it from marketplace-catalog/ and validate it with safeParseBlueprint.

export default {
  key: 'farm-fresh-bowls',
  version: '1.0.1',
  name: 'Farm Fresh Bowls',
  summary:
    'A warm, organic storefront for a fresh-food brand — açaí bowls, smoothies and salads with a full menu, a brand story, locations, catering, and a welcome email. A ready-to-edit retail starter.',
  vertical: 'retail',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],
  brand: {
    businessName: 'Farm Fresh Bowls',
    tagline: 'Here to deliver health.',
    colors: {
      primary: '#5C7A3D',
      primaryForeground: '#FBF8F1',
      accent: '#C8324B',
      secondary: '#F2A93B',
    },
    fonts: {
      heading: 'Quicksand',
      body: 'Nunito',
    },
  },
  theme: {
    name: 'Farm Fresh',
    basePresetKey: 'market',
    presentation: {
      v: 2,
      containerWidth: '1180px',
      light: {
        base100: '#FBF8F1',
        base200: '#E8EEDF',
        base300: '#F3ECDE',
        baseContent: '#54513F',
        neutral: '#2E3424',
        neutralContent: '#FBF8F1',
        border: '#E7E0D0',
      },
    },
    brand: {
      colorPrimary: '#5C7A3D',
      colorPrimaryForeground: '#FBF8F1',
      colorAccent: '#C8324B',
      colorSecondary: '#F2A93B',
      fontHeading: 'Quicksand',
      fontBody: 'Nunito',
      tokens: {
        shape: {
          radiusSelector: '9999px',
          radiusField: '9999px',
          radiusBox: '1.75rem',
        },
      },
    },
    apply: true,
  },
  assets: [
    {
      id: 'img-midnight-acai',
      url: 'https://loremflickr.com/1000/1000/acai,bowl?lock=72161',
      alt: 'Midnight Açaí',
    },
    {
      id: 'img-strawberry-fields',
      url: 'https://loremflickr.com/1000/1000/strawberry,smoothie?lock=56102',
      alt: 'Strawberry Fields',
    },
    {
      id: 'img-green-machine',
      url: 'https://loremflickr.com/1000/1000/green,smoothie?lock=28782',
      alt: 'Green Machine',
    },
    {
      id: 'img-mango-sunrise',
      url: 'https://loremflickr.com/1000/1000/mango,smoothie?lock=72173',
      alt: 'Mango Sunrise',
    },
    {
      id: 'img-blue-recovery',
      url: 'https://loremflickr.com/1000/1000/blueberry,smoothie?lock=84775',
      alt: 'Blue Recovery',
    },
    {
      id: 'img-citrus-glow',
      url: 'https://loremflickr.com/1000/1000/orange,juice?lock=23609',
      alt: 'Citrus Glow',
    },
    {
      id: 'img-coco-almond',
      url: 'https://loremflickr.com/1000/1000/coconut,bowl?lock=10976',
      alt: 'Coco Almond',
    },
    {
      id: 'img-harvest-kale',
      url: 'https://loremflickr.com/1000/1000/kale,salad?lock=68486',
      alt: 'Harvest Kale',
    },
    {
      id: 'img-avocado-power',
      url: 'https://loremflickr.com/1000/1000/avocado,salad?lock=19406',
      alt: 'Avocado Power',
    },
    {
      id: 'img-southwest-grain',
      url: 'https://loremflickr.com/1000/1000/grain,bowl?lock=65767',
      alt: 'Southwest Grain',
    },
  ],
  content: [
    {
      typeKey: 'blog_post',
      slug: 'sourcing-within-60-miles',
      status: 'draft',
      body: {
        title: 'Why we source within 60 miles',
        excerpt: 'Fresher produce, a smaller footprint, and farmers we know by name.',
        body: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'When we say local, we mean it — every bowl starts with produce picked from partner farms within 60 miles of our counters.',
                },
              ],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Sourcing close to home means we serve fruit and greens within a day of harvest, support growers in our own community, and keep our footprint small.',
                },
              ],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'It’s more work to build a menu around what’s ripe this week. We think you can taste the difference — and that’s the whole point.',
                },
              ],
            },
          ],
        },
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'eating-with-the-seasons',
      status: 'draft',
      body: {
        title: 'Eating with the seasons',
        excerpt: 'How our menu shifts with what the farms are picking.',
        body: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Our menu isn’t fixed — it follows the harvest. Spring leans green and bright; late summer brings stone fruit and berries; winter turns to roots, squash and citrus.',
                },
              ],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Cooking and blending with the seasons means peak flavor and peak nutrition, with less shipped from far away.',
                },
              ],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Check the counter for this week’s seasonal bowl — it’s where our team gets to play.',
                },
              ],
            },
          ],
        },
      },
    },
  ],
  commerce: {
    categories: [
      {
        handle: 'acai-bowls',
        name: 'Açaí & Smoothie Bowls',
        description: 'Blended-to-order bowls topped with fruit, granola and seeds.',
        featured: true,
        position: 0,
      },
      {
        handle: 'smoothies',
        name: 'Cold-Pressed Smoothies',
        description: 'Fresh-pressed smoothies, never from concentrate.',
        position: 1,
      },
      {
        handle: 'salads-grains',
        name: 'Salads & Grain Bowls',
        description: 'Hearty, balanced salads and grain bowls.',
        position: 2,
      },
    ],
    collections: [
      {
        handle: 'signature-bowls',
        name: 'Signature Bowls',
        description: 'Our most-loved açaí and smoothie bowls.',
        type: 'manual',
        featured: true,
        productHandles: ['midnight-acai', 'strawberry-fields', 'green-machine'],
      },
    ],
    products: [
      {
        handle: 'midnight-acai',
        title: 'Midnight Açaí',
        description:
          'Pure açaí blended with banana & almond milk, topped with granola, blueberries, coconut and a drizzle of raw honey.',
        status: 'draft',
        productType: 'Bowl',
        vendor: 'Farm Fresh Bowls',
        tags: ['vegan', 'antioxidant'],
        categoryHandles: ['acai-bowls'],
        collectionHandles: ['signature-bowls'],
        variants: [
          {
            sku: 'MIDNIGHTACAI',
            priceCents: 1150,
            isDefault: true,
          },
        ],
        images: [
          {
            assetId: 'img-midnight-acai',
            isPrimary: true,
          },
        ],
      },
      {
        handle: 'strawberry-fields',
        title: 'Strawberry Fields',
        description:
          'Local strawberries & dragon fruit over a creamy banana base, finished with hemp hearts, fresh berries and mint.',
        status: 'draft',
        productType: 'Bowl',
        vendor: 'Farm Fresh Bowls',
        tags: ['gluten-free', 'local'],
        categoryHandles: ['acai-bowls'],
        collectionHandles: ['signature-bowls'],
        variants: [
          {
            sku: 'STRAWBERRYFI',
            priceCents: 1075,
            isDefault: true,
          },
        ],
        images: [
          {
            assetId: 'img-strawberry-fields',
            isPrimary: true,
          },
        ],
      },
      {
        handle: 'green-machine',
        title: 'Green Machine',
        description:
          'Spinach, kale, kiwi and pineapple blended smooth, topped with kiwi, chia, toasted coconut and house granola.',
        status: 'draft',
        productType: 'Bowl',
        vendor: 'Farm Fresh Bowls',
        tags: ['detox', 'vegan'],
        categoryHandles: ['acai-bowls'],
        collectionHandles: ['signature-bowls'],
        variants: [
          {
            sku: 'GREENMACHINE',
            priceCents: 1195,
            isDefault: true,
          },
        ],
        images: [
          {
            assetId: 'img-green-machine',
            isPrimary: true,
          },
        ],
      },
      {
        handle: 'mango-sunrise',
        title: 'Mango Sunrise',
        description: 'Mango, orange, carrot & turmeric with a ginger kick.',
        status: 'draft',
        productType: 'Bowl',
        vendor: 'Farm Fresh Bowls',
        tags: ['vegan'],
        categoryHandles: ['smoothies'],
        variants: [
          {
            sku: 'MANGOSUNRISE',
            priceCents: 825,
            isDefault: true,
          },
        ],
        images: [
          {
            assetId: 'img-mango-sunrise',
            isPrimary: true,
          },
        ],
      },
      {
        handle: 'blue-recovery',
        title: 'Blue Recovery',
        description: 'Wild blueberry, banana, oat milk & plant protein.',
        status: 'draft',
        productType: 'Bowl',
        vendor: 'Farm Fresh Bowls',
        tags: ['protein'],
        categoryHandles: ['smoothies'],
        variants: [
          {
            sku: 'BLUERECOVERY',
            priceCents: 875,
            isDefault: true,
          },
        ],
        images: [
          {
            assetId: 'img-blue-recovery',
            isPrimary: true,
          },
        ],
      },
      {
        handle: 'citrus-glow',
        title: 'Citrus Glow',
        description: 'Orange, pineapple, lemon & a hint of cayenne.',
        status: 'draft',
        productType: 'Bowl',
        vendor: 'Farm Fresh Bowls',
        tags: ['immunity'],
        categoryHandles: ['smoothies'],
        variants: [
          {
            sku: 'CITRUSGLOW',
            priceCents: 795,
            isDefault: true,
          },
        ],
        images: [
          {
            assetId: 'img-citrus-glow',
            isPrimary: true,
          },
        ],
      },
      {
        handle: 'coco-almond',
        title: 'Coco Almond',
        description: 'Coconut, almond butter, dates, banana & cinnamon.',
        status: 'draft',
        productType: 'Bowl',
        vendor: 'Farm Fresh Bowls',
        tags: ['vegan'],
        categoryHandles: ['smoothies'],
        variants: [
          {
            sku: 'COCOALMOND',
            priceCents: 850,
            isDefault: true,
          },
        ],
        images: [
          {
            assetId: 'img-coco-almond',
            isPrimary: true,
          },
        ],
      },
      {
        handle: 'harvest-kale',
        title: 'Harvest Kale',
        description: 'Massaged kale, roasted squash, quinoa, pomegranate & tahini-lemon dressing.',
        status: 'draft',
        productType: 'Bowl',
        vendor: 'Farm Fresh Bowls',
        tags: ['high-protein', 'seasonal'],
        categoryHandles: ['salads-grains'],
        variants: [
          {
            sku: 'HARVESTKALE',
            priceCents: 1250,
            isDefault: true,
          },
        ],
        images: [
          {
            assetId: 'img-harvest-kale',
            isPrimary: true,
          },
        ],
      },
      {
        handle: 'avocado-power',
        title: 'Avocado Power',
        description: 'Brown rice, avocado, edamame, cucumber, pickled carrot & sesame-ginger.',
        status: 'draft',
        productType: 'Bowl',
        vendor: 'Farm Fresh Bowls',
        tags: ['vegan', 'filling'],
        categoryHandles: ['salads-grains'],
        variants: [
          {
            sku: 'AVOCADOPOWER',
            priceCents: 1325,
            isDefault: true,
          },
        ],
        images: [
          {
            assetId: 'img-avocado-power',
            isPrimary: true,
          },
        ],
      },
      {
        handle: 'southwest-grain',
        title: 'Southwest Grain',
        description: 'Farro, black beans, roasted corn, peppers, cilantro & chipotle-lime crema.',
        status: 'draft',
        productType: 'Bowl',
        vendor: 'Farm Fresh Bowls',
        tags: ['hearty', 'local'],
        categoryHandles: ['salads-grains'],
        variants: [
          {
            sku: 'SOUTHWESTGRA',
            priceCents: 1295,
            isDefault: true,
          },
        ],
        images: [
          {
            assetId: 'img-southwest-grain',
            isPrimary: true,
          },
        ],
      },
    ],
  },
  layout: {
    name: 'Farm Fresh layout',
    tree: {
      id: 'ffb-31',
      type: 'Section',
      props: {},
      class: 'w-full flex flex-col',
      name: 'Site layout',
      children: [
        {
          id: 'ffb-2',
          type: 'Section',
          class: 'w-full bg-neutral text-neutral-content',
          props: {},
          name: 'Announcement',
          children: [
            {
              id: 'ffb-2__c',
              type: 'Stack',
              class:
                'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-center items-center p-3 text-center',
              props: {},
              children: [
                {
                  id: 'ffb-1',
                  type: 'Text',
                  props: {
                    variant: 'meta',
                    text: '🌱  Free local delivery on orders over $35 · Fresh-pressed daily, never frozen',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'ffb-7',
          type: 'Section',
          props: {},
          class: 'w-full flex flex-col sticky top-0 z-30 bg-base-100 border-b border-base-300',
          name: 'Header',
          children: [
            {
              id: 'ffb-6',
              type: 'Section',
              props: {},
              class:
                'w-full mx-auto w-full max-w-site flex flex-row justify-between items-center p-6',
              children: [
                {
                  id: 'ffb-3',
                  type: 'Wordmark',
                  props: {},
                  binding: {
                    path: 'site.identity',
                  },
                },
                {
                  id: 'ffb-4',
                  type: 'NavMenu',
                  props: {
                    orientation: 'row',
                    links: [
                      {
                        label: 'Home',
                        href: '/',
                      },
                      {
                        label: 'Menu',
                        href: '/menu',
                      },
                      {
                        label: 'Our Story',
                        href: '/story',
                      },
                      {
                        label: 'Locations',
                        href: '/locations',
                      },
                      {
                        label: 'Catering',
                        href: '/catering',
                      },
                    ],
                  },
                },
                {
                  id: 'ffb-5',
                  type: 'Button',
                  props: {
                    label: 'Order Online',
                    href: '/menu',
                  },
                  class: 'st-btn st-c-accent st-v-solid st-btn--sz-md',
                },
              ],
            },
          ],
        },
        {
          id: 'ffb-8',
          type: 'Outlet',
          props: {},
          class: 'w-full',
        },
        {
          id: 'ffb-30',
          type: 'Section',
          class: 'w-full bg-neutral text-neutral-content',
          props: {},
          name: 'Footer',
          children: [
            {
              id: 'ffb-30__c',
              type: 'Stack',
              class: 'mx-auto w-full max-w-site flex flex-col gap-6 items-start p-8 @3xl:p-16',
              props: {},
              children: [
                {
                  id: 'ffb-27',
                  type: 'Section',
                  props: {},
                  class: 'grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6',
                  children: [
                    {
                      id: 'ffb-11',
                      type: 'Stack',
                      props: {},
                      class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
                      children: [
                        {
                          id: 'ffb-9',
                          type: 'Wordmark',
                          props: {},
                          binding: {
                            path: 'site.identity',
                          },
                        },
                        {
                          id: 'ffb-10',
                          type: 'Text',
                          props: {
                            variant: 'body',
                            text: 'Balanced, nutritious bowls made with local ingredients — here to deliver health, one bowl at a time.',
                          },
                        },
                      ],
                    },
                    {
                      id: 'ffb-16',
                      type: 'Stack',
                      props: {},
                      class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
                      children: [
                        {
                          id: 'ffb-12',
                          type: 'Heading',
                          props: {
                            level: 'h3',
                            text: 'Contact',
                          },
                          class: 'text-xs font-bold uppercase tracking-widest text-[#7FA85B]',
                        },
                        {
                          id: 'ffb-13',
                          type: 'Text',
                          props: {
                            variant: 'body',
                            text: 'hello@farmfreshbowls.example',
                          },
                        },
                        {
                          id: 'ffb-14',
                          type: 'Text',
                          props: {
                            variant: 'body',
                            text: '(951) 555-0142',
                          },
                        },
                        {
                          id: 'ffb-15',
                          type: 'Text',
                          props: {
                            variant: 'body',
                            text: '214 Orchard Lane, Riverside, CA 92501',
                          },
                        },
                      ],
                    },
                    {
                      id: 'ffb-21',
                      type: 'Stack',
                      props: {},
                      class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
                      children: [
                        {
                          id: 'ffb-17',
                          type: 'Heading',
                          props: {
                            level: 'h3',
                            text: 'Hours',
                          },
                          class: 'text-xs font-bold uppercase tracking-widest text-[#7FA85B]',
                        },
                        {
                          id: 'ffb-18',
                          type: 'Text',
                          props: {
                            variant: 'body',
                            text: 'Mon–Fri · 7am – 7pm',
                          },
                        },
                        {
                          id: 'ffb-19',
                          type: 'Text',
                          props: {
                            variant: 'body',
                            text: 'Saturday · 8am – 5pm',
                          },
                        },
                        {
                          id: 'ffb-20',
                          type: 'Text',
                          props: {
                            variant: 'body',
                            text: 'Sunday · 8am – 5pm',
                          },
                        },
                      ],
                    },
                    {
                      id: 'ffb-26',
                      type: 'Stack',
                      props: {},
                      class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
                      children: [
                        {
                          id: 'ffb-22',
                          type: 'Heading',
                          props: {
                            level: 'h3',
                            text: 'Stay in the loop',
                          },
                          class: 'text-xs font-bold uppercase tracking-widest text-[#7FA85B]',
                        },
                        {
                          id: 'ffb-23',
                          type: 'Text',
                          props: {
                            variant: 'body',
                            text: 'Seasonal menus, new flavors, the occasional treat.',
                          },
                        },
                        {
                          id: 'ffb-24',
                          type: 'Signup',
                          props: {
                            cta: 'Join',
                          },
                        },
                        {
                          id: 'ffb-25',
                          type: 'SocialLinks',
                          props: {},
                          binding: {
                            path: 'site.social',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'ffb-29',
                  type: 'Section',
                  props: {},
                  class: 'w-full flex flex-col items-center text-center',
                  children: [
                    {
                      id: 'ffb-28',
                      type: 'Text',
                      props: {
                        variant: 'meta',
                        text: '© 2026 Farm Fresh Bowls. All rights reserved.',
                      },
                    },
                  ],
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
        id: 'ffb-243',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Home',
        children: [
          {
            id: 'ffb-39',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site flex flex-col justify-center items-center p-8 @3xl:p-16 text-center',
            name: 'Hero',
            children: [
              {
                id: 'ffb-38',
                type: 'Section',
                props: {},
                class:
                  'rounded-box bg-accent text-accent-content min-h-[50vh] flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center w-full max-w-2xl rounded-box shadow-lg',
                children: [
                  {
                    id: 'ffb-32',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: '🍓',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-33',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      size: 'display',
                      text: 'Here to deliver health',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-34',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Balanced, nutritious bowls made with local ingredients — without any chemicals or preservatives.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-37',
                    type: 'Stack',
                    props: {},
                    class:
                      'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-center',
                    children: [
                      {
                        id: 'ffb-35',
                        type: 'Button',
                        props: {
                          label: 'Order Online',
                          href: '/menu',
                        },
                        class: 'st-btn st-c-secondary st-v-solid st-btn--sz-md',
                      },
                      {
                        id: 'ffb-36',
                        type: 'Button',
                        props: {
                          label: 'See the Menu',
                          href: '/menu',
                        },
                        class: 'st-btn st-c-surface st-v-glass st-btn--sz-md',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-41',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site flex flex-col justify-center items-center p-8 @3xl:p-16 text-center',
            name: 'Quote',
            children: [
              {
                id: 'ffb-40',
                type: 'Heading',
                props: {
                  level: 'h2',
                  text: '“Healthy bowls from healthy people, to make people healthy and happy.”',
                },
                class: 'text-center',
              },
            ],
          },
          {
            id: 'ffb-50',
            type: 'Section',
            class: 'w-full bg-base-200',
            props: {},
            name: 'We really do care',
            children: [
              {
                id: 'ffb-50__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 items-center p-8 @3xl:p-16',
                props: {},
                children: [
                  {
                    id: 'ffb-47',
                    type: 'Stack',
                    props: {},
                    class:
                      'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-start',
                    children: [
                      {
                        id: 'ffb-42',
                        type: 'Section',
                        props: {},
                        class: 'mx-auto w-full max-w-site h-[3px] w-16 rounded-full bg-accent',
                      },
                      {
                        id: 'ffb-43',
                        type: 'Heading',
                        props: {
                          level: 'h2',
                          text: 'We Really Do Care',
                        },
                        class: 'text-4xl @3xl:text-5xl font-bold leading-tight text-accent',
                      },
                      {
                        id: 'ffb-44',
                        type: 'Text',
                        props: {
                          variant: 'body',
                          text: 'We care about your health. To make the most of your life, it’s important to take good care of it — because feeling good is where everything starts.',
                        },
                      },
                      {
                        id: 'ffb-45',
                        type: 'Text',
                        props: {
                          variant: 'body',
                          text: 'So let us support you, and contribute to your healthy lifestyle with food that loves you back.',
                        },
                      },
                      {
                        id: 'ffb-46',
                        type: 'Button',
                        props: {
                          label: 'Explore the Bowls',
                          href: '/menu',
                        },
                        class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
                      },
                    ],
                  },
                  {
                    id: 'ffb-49',
                    type: 'Section',
                    props: {},
                    class:
                      'rounded-box bg-accent text-accent-content min-h-[50vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                    children: [
                      {
                        id: 'ffb-48',
                        type: 'Heading',
                        props: {
                          level: 'h1',
                          size: 'display',
                          text: '🍓',
                        },
                        class: 'text-center',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-58',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 items-center p-8 @3xl:p-16',
            name: 'We love for you to',
            children: [
              {
                id: 'ffb-57',
                type: 'Section',
                props: {},
                class:
                  'rounded-box bg-base-200 min-h-[50vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-56',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      size: 'display',
                      text: '🥣',
                    },
                    class: 'text-center',
                  },
                ],
              },
              {
                id: 'ffb-55',
                type: 'Stack',
                props: {},
                class: 'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-start',
                children: [
                  {
                    id: 'ffb-51',
                    type: 'Section',
                    props: {},
                    class: 'mx-auto w-full max-w-site h-[3px] w-16 rounded-full bg-primary',
                  },
                  {
                    id: 'ffb-52',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'We Love For You To',
                    },
                    class: 'text-4xl @3xl:text-5xl font-bold leading-tight text-primary',
                  },
                  {
                    id: 'ffb-53',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: '…experience the flavors of food the way it’s meant to taste — local, wholesome ingredients with nothing artificial.',
                    },
                  },
                  {
                    id: 'ffb-54',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'We balance the nutrients you need and serve the right portion size, every single time.',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-71',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6 p-8 @3xl:p-16',
            name: 'Values',
            children: [
              {
                id: 'ffb-61',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-59',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '🌾  Locally Sourced',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-60',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: 'From farms within 60 miles',
                    },
                    class: 'text-center',
                  },
                ],
              },
              {
                id: 'ffb-64',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-62',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '🚫  No Preservatives',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-63',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: 'Nothing artificial, ever',
                    },
                    class: 'text-center',
                  },
                ],
              },
              {
                id: 'ffb-67',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-65',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '⚖️  Balanced Macros',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-66',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: 'Portioned by nutritionists',
                    },
                    class: 'text-center',
                  },
                ],
              },
              {
                id: 'ffb-70',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-68',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '♻️  Eco Packaging',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-69',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: '100% compostable bowls',
                    },
                    class: 'text-center',
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-184',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site flex flex-col gap-6 items-center p-8 @3xl:p-16',
            name: 'Menu',
            children: [
              {
                id: 'ffb-75',
                type: 'Stack',
                props: {},
                class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
                children: [
                  {
                    id: 'ffb-72',
                    type: 'Badge',
                    props: {
                      label: '🥗 Our Menu',
                    },
                  },
                  {
                    id: 'ffb-73',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Made fresh, built for you',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-74',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Every bowl is blended to order with seasonal produce. Pick a signature combination, or build your own at the counter.',
                    },
                    class: 'text-center',
                  },
                ],
              },
              {
                id: 'ffb-111',
                type: 'Stack',
                props: {},
                class: 'w-full flex flex-col gap-4 items-start',
                name: 'Açaí & Smoothie Bowls',
                children: [
                  {
                    id: 'ffb-76',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Açaí & Smoothie Bowls',
                    },
                  },
                  {
                    id: 'ffb-110',
                    type: 'Section',
                    props: {},
                    class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
                    children: [
                      {
                        id: 'ffb-87',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-78',
                            type: 'Section',
                            props: {},
                            class:
                              'w-full bg-accent text-accent-content min-h-[25vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                            children: [
                              {
                                id: 'ffb-77',
                                type: 'Heading',
                                props: {
                                  level: 'h1',
                                  size: 'display',
                                  text: '🥣',
                                },
                                class: 'text-center',
                              },
                            ],
                          },
                          {
                            id: 'ffb-86',
                            type: 'Stack',
                            props: {},
                            class:
                              'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 @3xl:p-10',
                            children: [
                              {
                                id: 'ffb-81',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center',
                                children: [
                                  {
                                    id: 'ffb-79',
                                    type: 'Heading',
                                    props: {
                                      level: 'h3',
                                      text: 'Midnight Açaí',
                                    },
                                  },
                                  {
                                    id: 'ffb-80',
                                    type: 'Text',
                                    props: {
                                      variant: 'body',
                                      text: '$11.50',
                                    },
                                  },
                                ],
                              },
                              {
                                id: 'ffb-82',
                                type: 'Text',
                                props: {
                                  variant: 'body',
                                  text: 'Pure açaí blended with banana & almond milk, topped with granola, blueberries, coconut and raw honey.',
                                },
                              },
                              {
                                id: 'ffb-85',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row flex-wrap gap-2',
                                children: [
                                  {
                                    id: 'ffb-83',
                                    type: 'Badge',
                                    props: {
                                      label: 'Vegan',
                                    },
                                  },
                                  {
                                    id: 'ffb-84',
                                    type: 'Badge',
                                    props: {
                                      label: 'Antioxidant',
                                    },
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                      {
                        id: 'ffb-98',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-89',
                            type: 'Section',
                            props: {},
                            class:
                              'w-full bg-accent text-accent-content min-h-[25vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                            children: [
                              {
                                id: 'ffb-88',
                                type: 'Heading',
                                props: {
                                  level: 'h1',
                                  size: 'display',
                                  text: '🍓',
                                },
                                class: 'text-center',
                              },
                            ],
                          },
                          {
                            id: 'ffb-97',
                            type: 'Stack',
                            props: {},
                            class:
                              'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 @3xl:p-10',
                            children: [
                              {
                                id: 'ffb-92',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center',
                                children: [
                                  {
                                    id: 'ffb-90',
                                    type: 'Heading',
                                    props: {
                                      level: 'h3',
                                      text: 'Strawberry Fields',
                                    },
                                  },
                                  {
                                    id: 'ffb-91',
                                    type: 'Text',
                                    props: {
                                      variant: 'body',
                                      text: '$10.75',
                                    },
                                  },
                                ],
                              },
                              {
                                id: 'ffb-93',
                                type: 'Text',
                                props: {
                                  variant: 'body',
                                  text: 'Local strawberries & dragon fruit over a creamy banana base, finished with hemp hearts and mint.',
                                },
                              },
                              {
                                id: 'ffb-96',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row flex-wrap gap-2',
                                children: [
                                  {
                                    id: 'ffb-94',
                                    type: 'Badge',
                                    props: {
                                      label: 'Gluten-Free',
                                    },
                                  },
                                  {
                                    id: 'ffb-95',
                                    type: 'Badge',
                                    props: {
                                      label: 'Local',
                                    },
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                      {
                        id: 'ffb-109',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-100',
                            type: 'Section',
                            props: {},
                            class:
                              'w-full bg-primary text-primary-content min-h-[25vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                            children: [
                              {
                                id: 'ffb-99',
                                type: 'Heading',
                                props: {
                                  level: 'h1',
                                  size: 'display',
                                  text: '🥝',
                                },
                                class: 'text-center',
                              },
                            ],
                          },
                          {
                            id: 'ffb-108',
                            type: 'Stack',
                            props: {},
                            class:
                              'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 @3xl:p-10',
                            children: [
                              {
                                id: 'ffb-103',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center',
                                children: [
                                  {
                                    id: 'ffb-101',
                                    type: 'Heading',
                                    props: {
                                      level: 'h3',
                                      text: 'Green Machine',
                                    },
                                  },
                                  {
                                    id: 'ffb-102',
                                    type: 'Text',
                                    props: {
                                      variant: 'body',
                                      text: '$11.95',
                                    },
                                  },
                                ],
                              },
                              {
                                id: 'ffb-104',
                                type: 'Text',
                                props: {
                                  variant: 'body',
                                  text: 'Spinach, kale, kiwi and pineapple blended smooth, topped with kiwi, chia and house granola.',
                                },
                              },
                              {
                                id: 'ffb-107',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row flex-wrap gap-2',
                                children: [
                                  {
                                    id: 'ffb-105',
                                    type: 'Badge',
                                    props: {
                                      label: 'Detox',
                                    },
                                  },
                                  {
                                    id: 'ffb-106',
                                    type: 'Badge',
                                    props: {
                                      label: 'Vegan',
                                    },
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                id: 'ffb-146',
                type: 'Stack',
                props: {},
                class: 'w-full flex flex-col gap-4 items-start',
                name: 'Cold-Pressed Smoothies',
                children: [
                  {
                    id: 'ffb-112',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Cold-Pressed Smoothies',
                    },
                  },
                  {
                    id: 'ffb-145',
                    type: 'Section',
                    props: {},
                    class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6',
                    children: [
                      {
                        id: 'ffb-120',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-114',
                            type: 'Section',
                            props: {},
                            class:
                              'w-full bg-secondary text-secondary-content min-h-[25vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                            children: [
                              {
                                id: 'ffb-113',
                                type: 'Heading',
                                props: {
                                  level: 'h1',
                                  size: 'display',
                                  text: '🥭',
                                },
                                class: 'text-center',
                              },
                            ],
                          },
                          {
                            id: 'ffb-119',
                            type: 'Stack',
                            props: {},
                            class:
                              'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 @3xl:p-10',
                            children: [
                              {
                                id: 'ffb-117',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center',
                                children: [
                                  {
                                    id: 'ffb-115',
                                    type: 'Heading',
                                    props: {
                                      level: 'h3',
                                      text: 'Mango Sunrise',
                                    },
                                  },
                                  {
                                    id: 'ffb-116',
                                    type: 'Text',
                                    props: {
                                      variant: 'body',
                                      text: '$8.25',
                                    },
                                  },
                                ],
                              },
                              {
                                id: 'ffb-118',
                                type: 'Text',
                                props: {
                                  variant: 'body',
                                  text: 'Mango, orange, carrot & turmeric with a ginger kick.',
                                },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        id: 'ffb-128',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-122',
                            type: 'Section',
                            props: {},
                            class:
                              'w-full bg-base-200 min-h-[25vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                            children: [
                              {
                                id: 'ffb-121',
                                type: 'Heading',
                                props: {
                                  level: 'h1',
                                  size: 'display',
                                  text: '🫐',
                                },
                                class: 'text-center',
                              },
                            ],
                          },
                          {
                            id: 'ffb-127',
                            type: 'Stack',
                            props: {},
                            class:
                              'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 @3xl:p-10',
                            children: [
                              {
                                id: 'ffb-125',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center',
                                children: [
                                  {
                                    id: 'ffb-123',
                                    type: 'Heading',
                                    props: {
                                      level: 'h3',
                                      text: 'Blue Recovery',
                                    },
                                  },
                                  {
                                    id: 'ffb-124',
                                    type: 'Text',
                                    props: {
                                      variant: 'body',
                                      text: '$8.75',
                                    },
                                  },
                                ],
                              },
                              {
                                id: 'ffb-126',
                                type: 'Text',
                                props: {
                                  variant: 'body',
                                  text: 'Wild blueberry, banana, oat milk & plant protein.',
                                },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        id: 'ffb-136',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-130',
                            type: 'Section',
                            props: {},
                            class:
                              'w-full bg-secondary text-secondary-content min-h-[25vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                            children: [
                              {
                                id: 'ffb-129',
                                type: 'Heading',
                                props: {
                                  level: 'h1',
                                  size: 'display',
                                  text: '🍊',
                                },
                                class: 'text-center',
                              },
                            ],
                          },
                          {
                            id: 'ffb-135',
                            type: 'Stack',
                            props: {},
                            class:
                              'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 @3xl:p-10',
                            children: [
                              {
                                id: 'ffb-133',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center',
                                children: [
                                  {
                                    id: 'ffb-131',
                                    type: 'Heading',
                                    props: {
                                      level: 'h3',
                                      text: 'Citrus Glow',
                                    },
                                  },
                                  {
                                    id: 'ffb-132',
                                    type: 'Text',
                                    props: {
                                      variant: 'body',
                                      text: '$7.95',
                                    },
                                  },
                                ],
                              },
                              {
                                id: 'ffb-134',
                                type: 'Text',
                                props: {
                                  variant: 'body',
                                  text: 'Orange, pineapple, lemon & a hint of cayenne.',
                                },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        id: 'ffb-144',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-138',
                            type: 'Section',
                            props: {},
                            class:
                              'w-full bg-base-200 min-h-[25vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                            children: [
                              {
                                id: 'ffb-137',
                                type: 'Heading',
                                props: {
                                  level: 'h1',
                                  size: 'display',
                                  text: '🥥',
                                },
                                class: 'text-center',
                              },
                            ],
                          },
                          {
                            id: 'ffb-143',
                            type: 'Stack',
                            props: {},
                            class:
                              'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 @3xl:p-10',
                            children: [
                              {
                                id: 'ffb-141',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center',
                                children: [
                                  {
                                    id: 'ffb-139',
                                    type: 'Heading',
                                    props: {
                                      level: 'h3',
                                      text: 'Coco Almond',
                                    },
                                  },
                                  {
                                    id: 'ffb-140',
                                    type: 'Text',
                                    props: {
                                      variant: 'body',
                                      text: '$8.50',
                                    },
                                  },
                                ],
                              },
                              {
                                id: 'ffb-142',
                                type: 'Text',
                                props: {
                                  variant: 'body',
                                  text: 'Coconut, almond butter, dates, banana & cinnamon.',
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                id: 'ffb-182',
                type: 'Stack',
                props: {},
                class: 'w-full flex flex-col gap-4 items-start',
                name: 'Salads & Grain Bowls',
                children: [
                  {
                    id: 'ffb-147',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: 'Salads & Grain Bowls',
                    },
                  },
                  {
                    id: 'ffb-181',
                    type: 'Section',
                    props: {},
                    class: 'w-full grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
                    children: [
                      {
                        id: 'ffb-158',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-149',
                            type: 'Section',
                            props: {},
                            class:
                              'w-full bg-primary text-primary-content min-h-[25vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                            children: [
                              {
                                id: 'ffb-148',
                                type: 'Heading',
                                props: {
                                  level: 'h1',
                                  size: 'display',
                                  text: '🥗',
                                },
                                class: 'text-center',
                              },
                            ],
                          },
                          {
                            id: 'ffb-157',
                            type: 'Stack',
                            props: {},
                            class:
                              'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 @3xl:p-10',
                            children: [
                              {
                                id: 'ffb-152',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center',
                                children: [
                                  {
                                    id: 'ffb-150',
                                    type: 'Heading',
                                    props: {
                                      level: 'h3',
                                      text: 'Harvest Kale',
                                    },
                                  },
                                  {
                                    id: 'ffb-151',
                                    type: 'Text',
                                    props: {
                                      variant: 'body',
                                      text: '$12.50',
                                    },
                                  },
                                ],
                              },
                              {
                                id: 'ffb-153',
                                type: 'Text',
                                props: {
                                  variant: 'body',
                                  text: 'Massaged kale, roasted squash, quinoa, pomegranate & tahini-lemon dressing.',
                                },
                              },
                              {
                                id: 'ffb-156',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row flex-wrap gap-2',
                                children: [
                                  {
                                    id: 'ffb-154',
                                    type: 'Badge',
                                    props: {
                                      label: 'High-Protein',
                                    },
                                  },
                                  {
                                    id: 'ffb-155',
                                    type: 'Badge',
                                    props: {
                                      label: 'Seasonal',
                                    },
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                      {
                        id: 'ffb-169',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-160',
                            type: 'Section',
                            props: {},
                            class:
                              'w-full bg-primary text-primary-content min-h-[25vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                            children: [
                              {
                                id: 'ffb-159',
                                type: 'Heading',
                                props: {
                                  level: 'h1',
                                  size: 'display',
                                  text: '🥑',
                                },
                                class: 'text-center',
                              },
                            ],
                          },
                          {
                            id: 'ffb-168',
                            type: 'Stack',
                            props: {},
                            class:
                              'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 @3xl:p-10',
                            children: [
                              {
                                id: 'ffb-163',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center',
                                children: [
                                  {
                                    id: 'ffb-161',
                                    type: 'Heading',
                                    props: {
                                      level: 'h3',
                                      text: 'Avocado Power',
                                    },
                                  },
                                  {
                                    id: 'ffb-162',
                                    type: 'Text',
                                    props: {
                                      variant: 'body',
                                      text: '$13.25',
                                    },
                                  },
                                ],
                              },
                              {
                                id: 'ffb-164',
                                type: 'Text',
                                props: {
                                  variant: 'body',
                                  text: 'Brown rice, avocado, edamame, cucumber, pickled carrot & sesame-ginger.',
                                },
                              },
                              {
                                id: 'ffb-167',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row flex-wrap gap-2',
                                children: [
                                  {
                                    id: 'ffb-165',
                                    type: 'Badge',
                                    props: {
                                      label: 'Vegan',
                                    },
                                  },
                                  {
                                    id: 'ffb-166',
                                    type: 'Badge',
                                    props: {
                                      label: 'Filling',
                                    },
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                      {
                        id: 'ffb-180',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-171',
                            type: 'Section',
                            props: {},
                            class:
                              'w-full bg-secondary text-secondary-content min-h-[25vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                            children: [
                              {
                                id: 'ffb-170',
                                type: 'Heading',
                                props: {
                                  level: 'h1',
                                  size: 'display',
                                  text: '🌽',
                                },
                                class: 'text-center',
                              },
                            ],
                          },
                          {
                            id: 'ffb-179',
                            type: 'Stack',
                            props: {},
                            class:
                              'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-6 @3xl:p-10',
                            children: [
                              {
                                id: 'ffb-174',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row justify-between items-center',
                                children: [
                                  {
                                    id: 'ffb-172',
                                    type: 'Heading',
                                    props: {
                                      level: 'h3',
                                      text: 'Southwest Grain',
                                    },
                                  },
                                  {
                                    id: 'ffb-173',
                                    type: 'Text',
                                    props: {
                                      variant: 'body',
                                      text: '$12.95',
                                    },
                                  },
                                ],
                              },
                              {
                                id: 'ffb-175',
                                type: 'Text',
                                props: {
                                  variant: 'body',
                                  text: 'Farro, black beans, roasted corn, peppers, cilantro & chipotle-lime crema.',
                                },
                              },
                              {
                                id: 'ffb-178',
                                type: 'Stack',
                                props: {},
                                class:
                                  'mx-auto w-full max-w-site flex flex-col @3xl:flex-row flex-wrap gap-2',
                                children: [
                                  {
                                    id: 'ffb-176',
                                    type: 'Badge',
                                    props: {
                                      label: 'Hearty',
                                    },
                                  },
                                  {
                                    id: 'ffb-177',
                                    type: 'Badge',
                                    props: {
                                      label: 'Local',
                                    },
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                id: 'ffb-183',
                type: 'Button',
                props: {
                  label: 'Order the full menu',
                  href: '/menu',
                },
                class: 'st-btn st-c-accent st-v-solid st-btn--sz-md',
              },
            ],
          },
          {
            id: 'ffb-196',
            type: 'Section',
            class: 'w-full bg-neutral text-neutral-content',
            props: {},
            name: 'How it works',
            children: [
              {
                id: 'ffb-196__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-6 items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'ffb-185',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Fresh in three simple steps',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-195',
                    type: 'Section',
                    props: {},
                    class: 'grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
                    children: [
                      {
                        id: 'ffb-188',
                        type: 'Stack',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
                        children: [
                          {
                            id: 'ffb-186',
                            type: 'Heading',
                            props: {
                              level: 'h3',
                              text: '1 · We source',
                            },
                            class: 'text-center',
                          },
                          {
                            id: 'ffb-187',
                            type: 'Text',
                            props: {
                              variant: 'body',
                              text: 'Produce is picked from partner farms the morning it’s served — nothing sits in storage.',
                            },
                            class: 'text-center',
                          },
                        ],
                      },
                      {
                        id: 'ffb-191',
                        type: 'Stack',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
                        children: [
                          {
                            id: 'ffb-189',
                            type: 'Heading',
                            props: {
                              level: 'h3',
                              text: '2 · We blend',
                            },
                            class: 'text-center',
                          },
                          {
                            id: 'ffb-190',
                            type: 'Text',
                            props: {
                              variant: 'body',
                              text: 'Every bowl is built to order and portioned for balanced macros by our in-house team.',
                            },
                            class: 'text-center',
                          },
                        ],
                      },
                      {
                        id: 'ffb-194',
                        type: 'Stack',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
                        children: [
                          {
                            id: 'ffb-192',
                            type: 'Heading',
                            props: {
                              level: 'h3',
                              text: '3 · We deliver',
                            },
                            class: 'text-center',
                          },
                          {
                            id: 'ffb-193',
                            type: 'Text',
                            props: {
                              variant: 'body',
                              text: 'Grab it at the counter or get free local delivery — always in compostable packaging.',
                            },
                            class: 'text-center',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-213',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site flex flex-col gap-6 items-center p-8 @3xl:p-16 text-center',
            name: 'Locations',
            children: [
              {
                id: 'ffb-197',
                type: 'Heading',
                props: {
                  level: 'h2',
                  text: 'Two neighborhoods, one fresh standard',
                },
                class: 'text-center',
              },
              {
                id: 'ffb-212',
                type: 'Section',
                props: {},
                class: 'grid grid-cols-1 @3xl:grid-cols-2 gap-6',
                children: [
                  {
                    id: 'ffb-204',
                    type: 'Card',
                    props: {},
                    class:
                      'mx-auto w-full max-w-site rounded-box flex flex-col gap-2 items-start p-6 @3xl:p-10 bg-white shadow-lg border border-base-300',
                    children: [
                      {
                        id: 'ffb-198',
                        type: 'Heading',
                        props: {
                          level: 'h3',
                          text: 'Riverside Market',
                        },
                      },
                      {
                        id: 'ffb-199',
                        type: 'Text',
                        props: {
                          variant: 'body',
                          text: '214 Orchard Lane, Riverside, CA 92501',
                        },
                      },
                      {
                        id: 'ffb-200',
                        type: 'Text',
                        props: {
                          variant: 'meta',
                          text: 'Mon–Fri · 7am–7pm · Sat–Sun · 8am–5pm',
                        },
                      },
                      {
                        id: 'ffb-203',
                        type: 'Stack',
                        props: {},
                        class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2',
                        children: [
                          {
                            id: 'ffb-201',
                            type: 'Button',
                            props: {
                              label: 'Order Pickup',
                              href: '/menu',
                            },
                            class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
                          },
                          {
                            id: 'ffb-202',
                            type: 'Button',
                            props: {
                              label: 'Directions',
                              href: '/locations',
                            },
                            class: 'st-btn st-c-primary st-v-soft st-btn--sz-md',
                          },
                        ],
                      },
                    ],
                  },
                  {
                    id: 'ffb-211',
                    type: 'Card',
                    props: {},
                    class:
                      'mx-auto w-full max-w-site rounded-box flex flex-col gap-2 items-start p-6 @3xl:p-10 bg-white shadow-lg border border-base-300',
                    children: [
                      {
                        id: 'ffb-205',
                        type: 'Heading',
                        props: {
                          level: 'h3',
                          text: 'Downtown Commons',
                        },
                      },
                      {
                        id: 'ffb-206',
                        type: 'Text',
                        props: {
                          variant: 'body',
                          text: '88 Maple Street, Suite B, Riverside, CA 92507',
                        },
                      },
                      {
                        id: 'ffb-207',
                        type: 'Text',
                        props: {
                          variant: 'meta',
                          text: 'Mon–Fri · 6:30am–8pm · Sat–Sun · 8am–6pm',
                        },
                      },
                      {
                        id: 'ffb-210',
                        type: 'Stack',
                        props: {},
                        class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2',
                        children: [
                          {
                            id: 'ffb-208',
                            type: 'Button',
                            props: {
                              label: 'Order Pickup',
                              href: '/menu',
                            },
                            class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
                          },
                          {
                            id: 'ffb-209',
                            type: 'Button',
                            props: {
                              label: 'Directions',
                              href: '/locations',
                            },
                            class: 'st-btn st-c-primary st-v-soft st-btn--sz-md',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-228',
            type: 'Section',
            class: 'w-full bg-base-200',
            props: {},
            name: 'Testimonials',
            children: [
              {
                id: 'ffb-228__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-6 items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'ffb-214',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Loved by the neighborhood',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-227',
                    type: 'Section',
                    props: {},
                    class: 'grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
                    children: [
                      {
                        id: 'ffb-218',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col gap-2 items-start p-6 @3xl:p-10 bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-215',
                            type: 'Text',
                            props: {
                              variant: 'body',
                              text: '★★★★★',
                            },
                          },
                          {
                            id: 'ffb-216',
                            type: 'Text',
                            props: {
                              variant: 'body',
                              text: '“The Midnight Açaí is my morning ritual now. You can actually taste how fresh everything is.”',
                            },
                          },
                          {
                            id: 'ffb-217',
                            type: 'Text',
                            props: {
                              variant: 'meta',
                              text: 'Maya R. · Riverside',
                            },
                          },
                        ],
                      },
                      {
                        id: 'ffb-222',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col gap-2 items-start p-6 @3xl:p-10 bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-219',
                            type: 'Text',
                            props: {
                              variant: 'body',
                              text: '★★★★★',
                            },
                          },
                          {
                            id: 'ffb-220',
                            type: 'Text',
                            props: {
                              variant: 'body',
                              text: '“Finally a place where I trust every ingredient. The team knows their farmers by name.”',
                            },
                          },
                          {
                            id: 'ffb-221',
                            type: 'Text',
                            props: {
                              variant: 'meta',
                              text: 'Daniel K. · Downtown',
                            },
                          },
                        ],
                      },
                      {
                        id: 'ffb-226',
                        type: 'Card',
                        props: {},
                        class:
                          'mx-auto w-full max-w-site rounded-box flex flex-col gap-2 items-start p-6 @3xl:p-10 bg-white shadow-lg border border-base-300',
                        children: [
                          {
                            id: 'ffb-223',
                            type: 'Text',
                            props: {
                              variant: 'body',
                              text: '★★★★★',
                            },
                          },
                          {
                            id: 'ffb-224',
                            type: 'Text',
                            props: {
                              variant: 'body',
                              text: '“Balanced, filling, and genuinely delicious. Gets me through marathon training weeks.”',
                            },
                          },
                          {
                            id: 'ffb-225',
                            type: 'Text',
                            props: {
                              variant: 'meta',
                              text: 'Priya S. · Riverside',
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-237',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 p-8 @3xl:p-16',
            name: 'Catering & gifts',
            children: [
              {
                id: 'ffb-232',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-primary text-primary-content flex flex-col gap-4 justify-between items-start p-8 @3xl:p-16',
                children: [
                  {
                    id: 'ffb-229',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '🥗 Catering & Events',
                    },
                  },
                  {
                    id: 'ffb-230',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Bowl bars, smoothie stations and grain platters for offices, weddings and team workouts. Built fresh, delivered on time.',
                    },
                  },
                  {
                    id: 'ffb-231',
                    type: 'Button',
                    props: {
                      label: 'Plan an event',
                      href: '/catering',
                    },
                    class: 'st-btn st-c-accent st-v-solid st-btn--sz-md',
                  },
                ],
              },
              {
                id: 'ffb-236',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-secondary text-secondary-content flex flex-col gap-4 justify-between items-start p-8 @3xl:p-16',
                children: [
                  {
                    id: 'ffb-233',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '🎁 Gift Cards',
                    },
                  },
                  {
                    id: 'ffb-234',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Give the gift of good food. Digital gift cards arrive instantly and never expire — redeemable at both locations and online.',
                    },
                  },
                  {
                    id: 'ffb-235',
                    type: 'Button',
                    props: {
                      label: 'Buy a gift card',
                      href: '/catering',
                    },
                    class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-242',
            type: 'Section',
            class: 'w-full bg-accent text-accent-content',
            props: {},
            name: 'Order',
            children: [
              {
                id: 'ffb-242__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'ffb-238',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Ready to eat fresh?',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-239',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Order online for pickup or free local delivery — or join our list for seasonal menus, new flavors, and the occasional treat.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-240',
                    type: 'Button',
                    props: {
                      label: 'Start an order',
                      href: '/menu',
                    },
                    class: 'st-btn st-c-surface st-v-glass st-btn--sz-md',
                  },
                  {
                    id: 'ffb-241',
                    type: 'Signup',
                    props: {
                      cta: 'Sign up',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      seoTitle: 'Farm Fresh Bowls — Here to deliver health',
      seoDescription:
        'Balanced, nutritious bowls made with local ingredients — açaí bowls, smoothies and salads.',
    },
    {
      name: 'Our Story',
      kind: 'singleton',
      slug: 'story',
      tree: {
        id: 'ffb-276',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Story',
        children: [
          {
            id: 'ffb-246',
            type: 'Section',
            class:
              'w-full flex items-center justify-center bg-primary text-primary-content min-h-[50vh]',
            props: {},
            name: 'Story hero',
            children: [
              {
                id: 'ffb-246__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'ffb-244',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      size: 'display',
                      text: 'Our Farm Fresh story',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-245',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Healthy bowls from healthy people, to make people healthy and happy.',
                    },
                    class: 'text-center',
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-254',
            type: 'Section',
            class: 'w-full bg-base-200',
            props: {},
            name: 'We really do care',
            children: [
              {
                id: 'ffb-254__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 items-center p-8 @3xl:p-16',
                props: {},
                children: [
                  {
                    id: 'ffb-251',
                    type: 'Stack',
                    props: {},
                    class:
                      'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-start',
                    children: [
                      {
                        id: 'ffb-247',
                        type: 'Section',
                        props: {},
                        class: 'mx-auto w-full max-w-site h-[3px] w-16 rounded-full bg-accent',
                      },
                      {
                        id: 'ffb-248',
                        type: 'Heading',
                        props: {
                          level: 'h2',
                          text: 'We really do care',
                        },
                        class: 'text-4xl @3xl:text-5xl font-bold leading-tight text-accent',
                      },
                      {
                        id: 'ffb-249',
                        type: 'Text',
                        props: {
                          variant: 'body',
                          text: 'It started in 2018 with one counter, a blender, and a standing order from three farms we could drive to.',
                        },
                      },
                      {
                        id: 'ffb-250',
                        type: 'Text',
                        props: {
                          variant: 'body',
                          text: 'We care about your health — and we believe feeling good is where everything starts.',
                        },
                      },
                    ],
                  },
                  {
                    id: 'ffb-253',
                    type: 'Section',
                    props: {},
                    class:
                      'rounded-box bg-primary text-primary-content min-h-[50vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                    children: [
                      {
                        id: 'ffb-252',
                        type: 'Heading',
                        props: {
                          level: 'h1',
                          size: 'display',
                          text: '🥗',
                        },
                        class: 'text-center',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-262',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 items-center p-8 @3xl:p-16',
            name: 'Food that loves you back',
            children: [
              {
                id: 'ffb-261',
                type: 'Section',
                props: {},
                class:
                  'rounded-box bg-base-200 min-h-[50vh] flex flex-col justify-center items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-260',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      size: 'display',
                      text: '🥣',
                    },
                    class: 'text-center',
                  },
                ],
              },
              {
                id: 'ffb-259',
                type: 'Stack',
                props: {},
                class: 'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-start',
                children: [
                  {
                    id: 'ffb-255',
                    type: 'Section',
                    props: {},
                    class: 'mx-auto w-full max-w-site h-[3px] w-16 rounded-full bg-accent',
                  },
                  {
                    id: 'ffb-256',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Food that loves you back',
                    },
                    class: 'text-4xl @3xl:text-5xl font-bold leading-tight text-accent',
                  },
                  {
                    id: 'ffb-257',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Every bowl is built to order from local, wholesome ingredients — balanced for the nutrients you need.',
                    },
                  },
                  {
                    id: 'ffb-258',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Nothing artificial, nothing frozen, and never a shortcut on quality.',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-275',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6 p-8 @3xl:p-16',
            name: 'Values',
            children: [
              {
                id: 'ffb-265',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-263',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '🌾  Locally Sourced',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-264',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: 'From farms within 60 miles',
                    },
                    class: 'text-center',
                  },
                ],
              },
              {
                id: 'ffb-268',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-266',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '🚫  No Preservatives',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-267',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: 'Nothing artificial, ever',
                    },
                    class: 'text-center',
                  },
                ],
              },
              {
                id: 'ffb-271',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-269',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '⚖️  Balanced Macros',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-270',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: 'Portioned by nutritionists',
                    },
                    class: 'text-center',
                  },
                ],
              },
              {
                id: 'ffb-274',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-272',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '♻️  Eco Packaging',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-273',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: '100% compostable bowls',
                    },
                    class: 'text-center',
                  },
                ],
              },
            ],
          },
        ],
      },
      seoTitle: 'Our Story — Farm Fresh Bowls',
    },
    {
      name: 'Locations',
      kind: 'singleton',
      slug: 'locations',
      tree: {
        id: 'ffb-294',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Locations',
        children: [
          {
            id: 'ffb-279',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site flex flex-col gap-2 items-center p-8 @3xl:p-16 text-center',
            name: 'Locations intro',
            children: [
              {
                id: 'ffb-277',
                type: 'Heading',
                props: {
                  level: 'h1',
                  text: 'Find us',
                },
                class: 'text-center',
              },
              {
                id: 'ffb-278',
                type: 'Text',
                props: {
                  variant: 'body',
                  text: 'Two neighborhoods, one fresh standard. Pickup and free local delivery at both.',
                },
                class: 'text-center',
              },
            ],
          },
          {
            id: 'ffb-286',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 items-center p-8 @3xl:p-16',
            name: 'Riverside Market',
            children: [
              {
                id: 'ffb-284',
                type: 'Stack',
                props: {},
                class: 'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-start',
                children: [
                  {
                    id: 'ffb-280',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Riverside Market',
                    },
                  },
                  {
                    id: 'ffb-281',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: '214 Orchard Lane, Riverside, CA 92501',
                    },
                  },
                  {
                    id: 'ffb-282',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: 'Mon–Fri · 7am–7pm · Sat–Sun · 8am–5pm',
                    },
                  },
                  {
                    id: 'ffb-283',
                    type: 'Button',
                    props: {
                      label: 'Order Pickup',
                      href: '/menu',
                    },
                    class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
                  },
                ],
              },
              {
                id: 'ffb-285',
                type: 'Map',
                props: {
                  query: '214 Orchard Lane, Riverside, CA 92501',
                },
              },
            ],
          },
          {
            id: 'ffb-293',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 items-center p-8 @3xl:p-16',
            name: 'Downtown Commons',
            children: [
              {
                id: 'ffb-291',
                type: 'Stack',
                props: {},
                class: 'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-start',
                children: [
                  {
                    id: 'ffb-287',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Downtown Commons',
                    },
                  },
                  {
                    id: 'ffb-288',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: '88 Maple Street, Suite B, Riverside, CA 92507',
                    },
                  },
                  {
                    id: 'ffb-289',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: 'Mon–Fri · 6:30am–8pm · Sat–Sun · 8am–6pm',
                    },
                  },
                  {
                    id: 'ffb-290',
                    type: 'Button',
                    props: {
                      label: 'Order Pickup',
                      href: '/menu',
                    },
                    class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
                  },
                ],
              },
              {
                id: 'ffb-292',
                type: 'Map',
                props: {
                  query: '88 Maple Street, Suite B, Riverside, CA 92507',
                },
              },
            ],
          },
        ],
      },
      seoTitle: 'Locations — Farm Fresh Bowls',
    },
    {
      name: 'Catering',
      kind: 'singleton',
      slug: 'catering',
      tree: {
        id: 'ffb-312',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Catering',
        children: [
          {
            id: 'ffb-297',
            type: 'Section',
            class:
              'w-full flex items-center justify-center bg-primary text-primary-content min-h-[50vh]',
            props: {},
            name: 'Catering hero',
            children: [
              {
                id: 'ffb-297__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'ffb-295',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                      size: 'display',
                      text: 'Catering & events',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-296',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Bowl bars, smoothie stations and grain platters — built fresh, delivered on time.',
                    },
                    class: 'text-center',
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-307',
            type: 'Section',
            props: {},
            class:
              'w-full mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
            name: 'Catering options',
            children: [
              {
                id: 'ffb-300',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-298',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '🥣  Bowl bars',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-299',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: 'Build-your-own açaí & smoothie stations for any crowd.',
                    },
                    class: 'text-center',
                  },
                ],
              },
              {
                id: 'ffb-303',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-301',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '🥗  Grain platters',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-302',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: 'Seasonal salad and grain platters, portioned and labeled.',
                    },
                    class: 'text-center',
                  },
                ],
              },
              {
                id: 'ffb-306',
                type: 'Card',
                props: {},
                class:
                  'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
                children: [
                  {
                    id: 'ffb-304',
                    type: 'Heading',
                    props: {
                      level: 'h3',
                      text: '🚲  On-time delivery',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-305',
                    type: 'Text',
                    props: {
                      variant: 'meta',
                      text: 'Set up and delivered fresh, in compostable packaging.',
                    },
                    class: 'text-center',
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-311',
            type: 'Section',
            class: 'w-full bg-primary text-primary-content',
            props: {},
            name: 'Catering CTA',
            children: [
              {
                id: 'ffb-311__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'ffb-308',
                    type: 'Heading',
                    props: {
                      level: 'h2',
                      text: 'Plan your event',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-309',
                    type: 'Text',
                    props: {
                      variant: 'body',
                      text: 'Tell us the date, the headcount, and the vibe — we’ll handle the fresh part.',
                    },
                    class: 'text-center',
                  },
                  {
                    id: 'ffb-310',
                    type: 'Signup',
                    props: {
                      cta: 'Request a quote',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      seoTitle: 'Catering & Events — Farm Fresh Bowls',
    },
    {
      name: 'Product',
      kind: 'collection',
      recordType: 'commerce.product',
      isDefault: true,
      tree: {
        id: 'ffb-318',
        type: 'Section',
        props: {},
        class:
          'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 items-start p-8 @3xl:p-16',
        name: 'Product',
        children: [
          {
            id: 'ffb-313',
            type: 'Image',
            props: {
              ratio: 'square',
              alt: 'Bowl',
            },
            binding: {
              path: 'product.images',
            },
          },
          {
            id: 'ffb-317',
            type: 'Stack',
            props: {},
            class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start',
            children: [
              {
                id: 'ffb-314',
                type: 'Heading',
                props: {
                  level: 'h1',
                },
                binding: {
                  path: 'product.title',
                },
              },
              {
                id: 'ffb-315',
                type: 'Prose',
                props: {},
                binding: {
                  path: 'product.description',
                },
              },
              {
                id: 'ffb-316',
                type: 'BuyBox',
                props: {},
                binding: {
                  path: 'product',
                },
              },
            ],
          },
        ],
      },
    },
    {
      name: 'Blog Post',
      kind: 'collection',
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: {
        id: 'ffb-323',
        type: 'Section',
        props: {},
        class: 'w-full flex flex-col',
        name: 'Post',
        children: [
          {
            id: 'ffb-320',
            type: 'Section',
            class: 'w-full bg-base-200',
            props: {},
            name: 'Post header',
            children: [
              {
                id: 'ffb-320__c',
                type: 'Stack',
                class:
                  'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
                props: {},
                children: [
                  {
                    id: 'ffb-319',
                    type: 'Heading',
                    props: {
                      level: 'h1',
                    },
                    class: 'text-center',
                    binding: {
                      path: 'page.title',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'ffb-322',
            type: 'Section',
            props: {},
            class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 p-6 @3xl:p-10',
            name: 'Post body',
            children: [
              {
                id: 'ffb-321',
                type: 'Prose',
                props: {},
                binding: {
                  path: 'page.body',
                },
              },
            ],
          },
        ],
      },
    },
  ],
  emails: [
    {
      name: 'Welcome',
      subject: 'Welcome to Farm Fresh Bowls',
      preheader: 'Fresh menus, new flavors, and the occasional treat.',
      tree: {
        id: 'ffb-329',
        type: 'Section',
        props: {},
        class: 'flex flex-col gap-4',
        name: 'Email body',
        children: [
          {
            id: 'ffb-324',
            type: 'email_wordmark',
            props: {
              treatment: 'lockup',
              align: 'center',
              size: 'md',
            },
          },
          {
            id: 'ffb-325',
            type: 'Heading',
            props: {
              level: 'h1',
              text: 'Welcome to the table 🌱',
            },
          },
          {
            id: 'ffb-326',
            type: 'Text',
            props: {
              variant: 'body',
              text: 'Thanks for joining Farm Fresh Bowls. You’ll be first to hear about seasonal menus, new flavors, and the occasional treat.',
            },
          },
          {
            id: 'ffb-327',
            type: 'Button',
            props: {
              label: 'Start an order',
              href: '/menu',
            },
            class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
          },
          {
            id: 'ffb-328',
            type: 'Text',
            props: {
              variant: 'meta',
              text: 'Here to deliver health — one bowl at a time.',
            },
          },
        ],
      },
    },
  ],
};
