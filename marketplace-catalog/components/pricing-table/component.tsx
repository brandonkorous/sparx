// Pricing Table — a sparx first-party marketplace component (docs/85). The payload is
// a composed builder node-tree + propSpec; the ingest validates it and writes it
// to storage as the artifact "Add" clones into a tenant's component library.
export default {
  tree: {
    id: 'mc-28',
    type: 'Section',
    props: {},
    class: 'mx-auto w-full max-w-site flex flex-col gap-6 items-center p-8 @3xl:p-16',
    name: 'Pricing',
    children: [
      {
        id: 'mc-11',
        type: 'Heading',
        props: {
          level: 'h2',
          text: 'Simple, fair pricing',
        },
        class: 'text-center',
      },
      {
        id: 'mc-27',
        type: 'Grid',
        props: {},
        class: 'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
        name: 'Plans',
        children: [
          {
            id: 'mc-16',
            type: 'Card',
            props: {},
            class:
              'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
            name: 'Starter plan',
            children: [
              {
                id: 'mc-12',
                type: 'Heading',
                props: {
                  level: 'h3',
                  text: 'Starter',
                },
              },
              {
                id: 'mc-13',
                type: 'Heading',
                props: {
                  level: 'h2',
                  text: '$0',
                },
              },
              {
                id: 'mc-14',
                type: 'Text',
                props: {
                  variant: 'body',
                  text: 'Everything you need to get going.',
                },
              },
              {
                id: 'mc-15',
                type: 'Button',
                props: {
                  label: 'Choose plan',
                  style: 'soft',
                  href: '#',
                },
              },
            ],
          },
          {
            id: 'mc-21',
            type: 'Card',
            props: {},
            class:
              'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
            name: 'Pro plan',
            children: [
              {
                id: 'mc-17',
                type: 'Heading',
                props: {
                  level: 'h3',
                  text: 'Pro',
                },
              },
              {
                id: 'mc-18',
                type: 'Heading',
                props: {
                  level: 'h2',
                  text: '$19',
                },
              },
              {
                id: 'mc-19',
                type: 'Text',
                props: {
                  variant: 'body',
                  text: 'For growing teams that need more.',
                },
              },
              {
                id: 'mc-20',
                type: 'Button',
                props: {
                  label: 'Choose plan',
                  style: 'soft',
                  href: '#',
                },
              },
            ],
          },
          {
            id: 'mc-26',
            type: 'Card',
            props: {},
            class:
              'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-2 items-start p-6 @3xl:p-10',
            name: 'Scale plan',
            children: [
              {
                id: 'mc-22',
                type: 'Heading',
                props: {
                  level: 'h3',
                  text: 'Scale',
                },
              },
              {
                id: 'mc-23',
                type: 'Heading',
                props: {
                  level: 'h2',
                  text: '$49',
                },
              },
              {
                id: 'mc-24',
                type: 'Text',
                props: {
                  variant: 'body',
                  text: 'Advanced controls and support.',
                },
              },
              {
                id: 'mc-25',
                type: 'Button',
                props: {
                  label: 'Choose plan',
                  style: 'soft',
                  href: '#',
                },
              },
            ],
          },
        ],
      },
    ],
  },
  propSpec: [],
};
