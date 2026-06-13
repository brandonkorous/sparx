// Centered Hero — a Sparx first-party marketplace component (docs/85). The payload is
// a composed builder node-tree + propSpec; the ingest validates it and writes it
// to storage as the artifact "Add" clones into a tenant's component library.
export default {
  tree: {
    id: 'mc-10',
    type: 'Section',
    class: 'w-full flex items-center justify-center h-[75vh] text-white',
    props: {
      bgImage: 'https://picsum.photos/seed/centered-hero/2000/1100',
      bgOverlay: 'dark',
    },
    name: 'Centered hero',
    children: [
      {
        id: 'mc-10__c',
        type: 'Stack',
        class:
          'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
        props: {},
        children: [
          {
            id: 'mc-7',
            type: 'Heading',
            props: {
              level: 'h1',
              text: {
                $prop: 'heading',
              },
            },
            class: 'text-center',
          },
          {
            id: 'mc-8',
            type: 'Text',
            props: {
              variant: 'body',
              text: {
                $prop: 'subheading',
              },
            },
            class: 'text-center',
          },
          {
            id: 'mc-9',
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
    ],
  },
  propSpec: [
    {
      key: 'heading',
      label: 'Heading',
      kind: 'text',
      default: 'Make a strong first impression',
    },
    {
      key: 'subheading',
      label: 'Subheading',
      kind: 'text',
      default: 'One clear line about what you do.',
    },
    {
      key: 'buttonLabel',
      label: 'Button label',
      kind: 'text',
      default: 'Explore',
    },
    {
      key: 'buttonHref',
      label: 'Button link',
      kind: 'url',
      default: '/',
    },
  ],
};
