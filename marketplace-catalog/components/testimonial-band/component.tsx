// Testimonial Band — a sparx first-party marketplace component (docs/85). The payload is
// a composed builder node-tree + propSpec; the ingest validates it and writes it
// to storage as the artifact "Add" clones into a tenant's component library.
export default {
  tree: {
    id: 'mc-31',
    type: 'Section',
    props: {},
    class:
      'mx-auto w-full max-w-site bg-base-200 flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
    name: 'Testimonial',
    children: [
      {
        id: 'mc-29',
        type: 'Heading',
        props: {
          level: 'h2',
          text: {
            $prop: 'quote',
          },
        },
        class: 'text-center',
      },
      {
        id: 'mc-30',
        type: 'Text',
        props: {
          variant: 'meta',
          text: {
            $prop: 'author',
          },
        },
        class: 'text-center',
      },
    ],
  },
  propSpec: [
    {
      key: 'quote',
      label: 'Quote',
      kind: 'text',
      default: '“This changed how our whole team works.”',
    },
    {
      key: 'author',
      label: 'Attribution',
      kind: 'text',
      default: 'Alex Rivera, Founder at Acme',
    },
  ],
};
