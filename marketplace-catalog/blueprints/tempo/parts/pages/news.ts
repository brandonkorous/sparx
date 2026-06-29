// Tempo — News page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/tempo/.

export default {
  id: 'tmp-541',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'News',
  children: [
    {
      id: 'tmp-538',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Page hero',
      children: [
        {
          id: 'tmp-538__c',
          type: 'Stack',
          class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-8 @3xl:p-16',
          props: {},
          children: [
            {
              id: 'tmp-535',
              type: 'el:p',
              props: {
                text: 'The Latest',
              },
              class:
                'font-heading text-xs font-bold uppercase tracking-[0.2em] text-base-content/50',
            },
            {
              id: 'tmp-536',
              type: 'el:h1',
              props: {
                text: 'News & Stories',
              },
              class:
                'font-heading max-w-3xl text-3xl font-black uppercase leading-[0.95] tracking-tightest text-base-content @2xl:text-5xl',
            },
            {
              id: 'tmp-537',
              type: 'el:p',
              props: {
                text: 'Drops, athlete stories, and what we’re building next — straight from the team.',
              },
              class: 'max-w-2xl text-base leading-relaxed text-base-content/70',
            },
          ],
        },
      ],
    },
    {
      id: 'tmp-540',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col items-start p-8 @3xl:p-16',
      name: 'News grid',
      children: [
        {
          id: 'tmp-539',
          type: 'el:p',
          props: {
            text: 'Fresh stories are on the way — check back soon.',
          },
          class: 'text-base text-base-content/60',
        },
      ],
    },
  ],
};
