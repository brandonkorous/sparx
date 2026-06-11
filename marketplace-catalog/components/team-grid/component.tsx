// Team Grid — a Sparx first-party marketplace component (docs/85). The payload is
// a composed builder node-tree + propSpec; the ingest validates it and writes it
// to storage as the artifact "Add" clones into a tenant's component library.
export default {
  tree: {
    id: 'mc-58',
    type: 'Section',
    props: {},
    class: 'mx-auto w-full max-w-site flex flex-col gap-6 p-8 @3xl:p-16',
    name: 'Team',
    children: [
      {
        id: 'mc-40',
        type: 'Heading',
        props: {
          level: 'h2',
          text: 'Meet the team',
        },
      },
      {
        id: 'mc-57',
        type: 'Grid',
        props: {},
        class: 'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6',
        name: 'People',
        children: [
          {
            id: 'mc-44',
            type: 'Card',
            props: {},
            class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-3',
            name: 'Person',
            children: [
              {
                id: 'mc-41',
                type: 'Image',
                props: {
                  bgImage: 'https://picsum.photos/seed/team-a/600/600',
                },
                class: 'min-h-[50vh]',
              },
              {
                id: 'mc-42',
                type: 'Heading',
                props: {
                  level: 'h3',
                  text: 'Team member',
                },
              },
              {
                id: 'mc-43',
                type: 'Text',
                props: {
                  variant: 'meta',
                  text: 'Role / title',
                },
              },
            ],
          },
          {
            id: 'mc-48',
            type: 'Card',
            props: {},
            class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-3',
            name: 'Person',
            children: [
              {
                id: 'mc-45',
                type: 'Image',
                props: {
                  bgImage: 'https://picsum.photos/seed/team-b/600/600',
                },
                class: 'min-h-[50vh]',
              },
              {
                id: 'mc-46',
                type: 'Heading',
                props: {
                  level: 'h3',
                  text: 'Team member',
                },
              },
              {
                id: 'mc-47',
                type: 'Text',
                props: {
                  variant: 'meta',
                  text: 'Role / title',
                },
              },
            ],
          },
          {
            id: 'mc-52',
            type: 'Card',
            props: {},
            class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-3',
            name: 'Person',
            children: [
              {
                id: 'mc-49',
                type: 'Image',
                props: {
                  bgImage: 'https://picsum.photos/seed/team-c/600/600',
                },
                class: 'min-h-[50vh]',
              },
              {
                id: 'mc-50',
                type: 'Heading',
                props: {
                  level: 'h3',
                  text: 'Team member',
                },
              },
              {
                id: 'mc-51',
                type: 'Text',
                props: {
                  variant: 'meta',
                  text: 'Role / title',
                },
              },
            ],
          },
          {
            id: 'mc-56',
            type: 'Card',
            props: {},
            class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-3',
            name: 'Person',
            children: [
              {
                id: 'mc-53',
                type: 'Image',
                props: {
                  bgImage: 'https://picsum.photos/seed/team-d/600/600',
                },
                class: 'min-h-[50vh]',
              },
              {
                id: 'mc-54',
                type: 'Heading',
                props: {
                  level: 'h3',
                  text: 'Team member',
                },
              },
              {
                id: 'mc-55',
                type: 'Text',
                props: {
                  variant: 'meta',
                  text: 'Role / title',
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
