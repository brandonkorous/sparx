// Newsletter Band — a sparx first-party marketplace component (docs/85). The payload is
// a composed builder node-tree + propSpec; the ingest validates it and writes it
// to storage as the artifact "Add" clones into a tenant's component library.
export default {
  tree: {
    id: 'mc-77',
    type: 'Section',
    class: 'w-full bg-base-200',
    props: {},
    name: 'Newsletter',
    binding: {
      path: 'crm.list',
    },
    children: [
      {
        id: 'mc-77__c',
        type: 'Stack',
        class:
          'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
        props: {},
        children: [
          {
            id: 'mc-74',
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
            id: 'mc-75',
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
            id: 'mc-76',
            type: 'Signup',
            props: {
              cta: 'Subscribe',
            },
            binding: {
              path: 'crm.list',
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
      default: 'Join the list',
    },
    {
      key: 'body',
      label: 'Body',
      kind: 'text',
      default: 'Occasional updates, no spam.',
    },
  ],
};
