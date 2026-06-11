// Stats Strip — a Sparx first-party marketplace component (docs/85). The payload is
// a composed builder node-tree + propSpec; the ingest validates it and writes it
// to storage as the artifact "Add" clones into a tenant's component library.
export default {
  tree: {
    id: 'mc-63',
    type: 'Section',
    props: {},
    class:
      'mx-auto w-full max-w-site bg-neutral text-neutral-content grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6 p-8 @3xl:p-16',
    name: 'Stats',
    children: [
      {
        id: 'mc-59',
        type: 'Stat',
        props: {
          value: '10k+',
          label: 'Customers',
        },
      },
      {
        id: 'mc-60',
        type: 'Stat',
        props: {
          value: '99.9%',
          label: 'Uptime',
        },
      },
      {
        id: 'mc-61',
        type: 'Stat',
        props: {
          value: '4.9/5',
          label: 'Rating',
        },
      },
      {
        id: 'mc-62',
        type: 'Stat',
        props: {
          value: '24/7',
          label: 'Support',
        },
      },
    ],
  },
  propSpec: [],
};
