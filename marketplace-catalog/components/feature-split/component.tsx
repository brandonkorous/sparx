// Feature Split — a Sparx first-party marketplace component (docs/85). The payload is
// a composed builder node-tree + propSpec; the ingest validates it and writes it
// to storage as the artifact "Add" clones into a tenant's component library.
export default {
  tree: {
    id: 'mc-69',
    type: 'Section',
    props: {},
    class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-6 items-center p-8 @3xl:p-16',
    name: 'Feature split',
    children: [
      {
        id: 'mc-64',
        type: 'Image',
        props: {
          bgImage: 'https://picsum.photos/seed/feature-split/1000/800',
        },
        class: 'min-h-[50vh]',
        name: 'Feature image',
      },
      {
        id: 'mc-68',
        type: 'Stack',
        props: {},
        class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start',
        children: [
          {
            id: 'mc-65',
            type: 'Heading',
            props: {
              level: 'h2',
              text: {
                $prop: 'heading',
              },
            },
          },
          {
            id: 'mc-66',
            type: 'Text',
            props: {
              variant: 'body',
              text: {
                $prop: 'body',
              },
            },
          },
          {
            id: 'mc-67',
            type: 'Button',
            props: {
              label: {
                $prop: 'buttonLabel',
              },
              href: {
                $prop: 'buttonHref',
              },
              style: 'soft',
            },
          },
        ],
      },
    ],
  },
  propSpec: [
    {
      key: 'heading',
      label: 'Heading',
      kind: 'text',
      default: 'A feature worth shouting about',
    },
    {
      key: 'body',
      label: 'Body',
      kind: 'text',
      default: 'Explain the benefit in a sentence or two.',
    },
    {
      key: 'buttonLabel',
      label: 'Button label',
      kind: 'text',
      default: 'Learn more',
    },
    {
      key: 'buttonHref',
      label: 'Button link',
      kind: 'url',
      default: '/features',
    },
  ],
};
