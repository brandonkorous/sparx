// Farm Fresh — Blog Post page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh-bowls/.

export default {
  id: 'ffb-402',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Post',
  children: [
    {
      id: 'ffb-399',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Post header',
      children: [
        {
          id: 'ffb-399__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'ffb-398',
              type: 'Heading',
              props: {
                level: 'h1',
              },
              class: 'text-center',
              binding: {
                path: 'page.title',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-401',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 p-6 @3xl:p-10',
      name: 'Post body',
      children: [
        {
          id: 'ffb-400',
          type: 'Prose',
          props: {},
          binding: {
            path: 'page.body',
          },
        },
      ],
    },
  ],
};
