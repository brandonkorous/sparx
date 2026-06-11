// Hero Split — a Sparx first-party marketplace component (docs/85). The payload is
// a composed builder node-tree + propSpec; the ingest validates it and writes it
// to storage as the artifact "Add" clones into a tenant's component library.
export default {
  tree: {
    id: 'mc-6',
    type: 'Section',
    props: {},
    class:
      'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-6 items-center p-8 @3xl:p-16',
    name: 'Hero split',
    children: [
      {
        id: 'mc-4',
        type: 'Stack',
        props: {},
        class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start',
        children: [
          {
            id: 'mc-1',
            type: 'Heading',
            props: {
              level: 'h1',
              text: {
                $prop: 'heading',
              },
            },
          },
          {
            id: 'mc-2',
            type: 'Text',
            props: {
              variant: 'body',
              text: {
                $prop: 'subheading',
              },
            },
          },
          {
            id: 'mc-3',
            type: 'Button',
            props: {
              label: {
                $prop: 'buttonLabel',
              },
              href: {
                $prop: 'buttonHref',
              },
              style: 'primary',
            },
          },
        ],
      },
      {
        id: 'mc-5',
        type: 'Image',
        props: {
          bgImage: 'https://picsum.photos/seed/hero-split/1200/1000',
        },
        class: 'min-h-[50vh]',
        name: 'Hero image',
      },
    ],
  },
  propSpec: [
    {
      key: 'heading',
      label: 'Heading',
      kind: 'text',
      default: 'Build something people love',
    },
    {
      key: 'subheading',
      label: 'Subheading',
      kind: 'text',
      default: 'A short, punchy sentence about the value you deliver.',
    },
    {
      key: 'buttonLabel',
      label: 'Button label',
      kind: 'text',
      default: 'Get started',
    },
    {
      key: 'buttonHref',
      label: 'Button link',
      kind: 'url',
      default: '/signup',
    },
  ],
};
