// CTA Banner — a sparx first-party marketplace component (docs/85). The payload is
// a composed builder node-tree + propSpec; the ingest validates it and writes it
// to storage as the artifact "Add" clones into a tenant's component library.
export default {
  tree: {
    id: 'mc-73',
    type: 'Section',
    class: 'w-full bg-neutral text-neutral-content',
    props: {},
    name: 'CTA banner',
    children: [
      {
        id: 'mc-73__c',
        type: 'Stack',
        class:
          'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
        props: {},
        children: [
          {
            id: 'mc-70',
            type: 'Heading',
            props: {
              level: 'h2',
              text: {
                $prop: 'heading',
              },
            },
            class: 'text-center',
          },
          {
            id: 'mc-71',
            type: 'Text',
            props: {
              variant: 'body',
              text: {
                $prop: 'body',
              },
            },
            class: 'text-center',
          },
          {
            id: 'mc-72',
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
      default: 'Ready to get started?',
    },
    {
      key: 'body',
      label: 'Body',
      kind: 'text',
      default: 'Join thousands already on board.',
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
