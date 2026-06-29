// Forge — Insight Story page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/forge/.

export default {
  id: 'fg-724',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Insight',
  children: [
    {
      id: 'fg-720',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Story header',
      children: [
        {
          id: 'fg-720__c',
          type: 'Stack',
          class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
          props: {},
          children: [
            {
              id: 'fg-717',
              type: 'el:a',
              props: {
                href: '/insights',
                text: '← All insights',
              },
              class: 'text-sm font-medium text-[#C6F24E]',
            },
            {
              id: 'fg-718',
              type: 'Heading',
              props: {
                level: 'h1',
              },
              class:
                'font-heading text-4xl font-medium tracking-tight text-[#ECE7DD] @2xl:text-5xl',
              binding: {
                path: 'blog_post.title',
              },
            },
            {
              id: 'fg-719',
              type: 'Text',
              props: {
                variant: 'body',
              },
              class: 'max-w-2xl text-lg text-base-content/70',
              binding: {
                path: 'blog_post.excerpt',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'fg-723',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 p-8 @3xl:p-16',
      name: 'Story body',
      children: [
        {
          id: 'fg-721',
          type: 'Image',
          props: {
            ratio: 'wide',
            alt: 'Cover',
          },
          class: 'w-full rounded-[1.5rem]',
          binding: {
            path: 'blog_post.featuredImage',
          },
        },
        {
          id: 'fg-722',
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
