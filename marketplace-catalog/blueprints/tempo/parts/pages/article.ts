// Tempo — Article page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/tempo/.

export default {
  id: 'tmp-678',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Article',
  children: [
    {
      id: 'tmp-674',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Article header',
      children: [
        {
          id: 'tmp-674__c',
          type: 'Stack',
          class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-8 @3xl:p-16',
          props: {},
          children: [
            {
              id: 'tmp-672',
              type: 'el:p',
              props: {
                text: 'News',
              },
              class:
                'font-heading text-xs font-bold uppercase tracking-[0.2em] text-base-content/50',
              binding: {
                path: 'blog_post.date',
              },
            },
            {
              id: 'tmp-673',
              type: 'Heading',
              props: {
                level: 'h1',
              },
              class:
                'font-heading max-w-3xl text-3xl font-black uppercase leading-[0.95] tracking-tightest text-base-content @2xl:text-5xl',
              binding: {
                path: 'blog_post.title',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'tmp-677',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 p-6 @3xl:p-10',
      name: 'Article body',
      children: [
        {
          id: 'tmp-675',
          type: 'Image',
          props: {
            ratio: 'wide',
            alt: 'Cover',
          },
          class: 'w-full bg-base-200',
          binding: {
            path: 'blog_post.featuredImage',
          },
        },
        {
          id: 'tmp-676',
          type: 'Prose',
          props: {},
          binding: {
            path: 'blog_post.body',
          },
        },
      ],
    },
  ],
};
