// Farm Fresh — Journal page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-315',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Journal',
  children: [
    {
      id: 'ffb-312',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Journal intro',
      children: [
        {
          id: 'ffb-312__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'ffb-310',
              type: 'Heading',
              props: {
                level: 'h1',
                size: 'display',
                text: 'The Journal',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-311',
              type: 'Text',
              props: {
                variant: 'body',
                text: 'Notes from the counter — how we source, what’s in season, and the people behind the bowls.',
              },
              class: 'text-center max-w-xl',
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-314',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site flex flex-col justify-center items-center p-8 @3xl:p-16 text-center',
      name: 'Posts',
      children: [
        {
          id: 'ffb-313',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Fresh posts are on the way — check back soon.',
          },
          class: 'text-center text-base-content/60',
        },
      ],
    },
  ],
};
