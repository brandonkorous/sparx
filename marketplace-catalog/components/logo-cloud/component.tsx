// Logo Cloud — a Sparx first-party marketplace component (docs/85). The payload is
// a composed builder node-tree + propSpec; the ingest validates it and writes it
// to storage as the artifact "Add" clones into a tenant's component library.
export default {
  tree: {
    id: 'mc-39',
    type: 'Section',
    props: {},
    class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-center p-6 @3xl:p-10 text-center',
    name: 'Logo cloud',
    children: [
      {
        id: 'mc-32',
        type: 'Text',
        props: {
          variant: 'meta',
          text: 'Trusted by teams everywhere',
        },
        class: 'text-center',
      },
      {
        id: 'mc-38',
        type: 'Grid',
        props: {},
        class:
          'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-5 gap-6 items-center',
        name: 'Logos',
        children: [
          {
            id: 'mc-33',
            type: 'Image',
            props: {
              bgImage: 'https://picsum.photos/seed/logo-1/240/120',
            },
            class: 'min-h-[25vh]',
            name: 'Logo 1',
          },
          {
            id: 'mc-34',
            type: 'Image',
            props: {
              bgImage: 'https://picsum.photos/seed/logo-2/240/120',
            },
            class: 'min-h-[25vh]',
            name: 'Logo 2',
          },
          {
            id: 'mc-35',
            type: 'Image',
            props: {
              bgImage: 'https://picsum.photos/seed/logo-3/240/120',
            },
            class: 'min-h-[25vh]',
            name: 'Logo 3',
          },
          {
            id: 'mc-36',
            type: 'Image',
            props: {
              bgImage: 'https://picsum.photos/seed/logo-4/240/120',
            },
            class: 'min-h-[25vh]',
            name: 'Logo 4',
          },
          {
            id: 'mc-37',
            type: 'Image',
            props: {
              bgImage: 'https://picsum.photos/seed/logo-5/240/120',
            },
            class: 'min-h-[25vh]',
            name: 'Logo 5',
          },
        ],
      },
    ],
  },
  propSpec: [],
};
