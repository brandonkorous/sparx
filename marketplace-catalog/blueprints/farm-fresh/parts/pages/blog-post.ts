// Farm Fresh — Blog Post page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-445',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Post',
  children: [
    {
      id: 'ffb-441',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Post header',
      children: [
        {
          id: 'ffb-441__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'ffb-439',
              type: 'Text',
              props: {},
              class: 'text-center text-primary text-sm font-medium',
              binding: {
                path: 'blog_post.date',
              },
            },
            {
              id: 'ffb-440',
              type: 'Heading',
              props: {
                level: 'h1',
              },
              class: 'text-center',
              binding: {
                path: 'blog_post.title',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-444',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 p-6 @3xl:p-10',
      name: 'Post body',
      children: [
        {
          id: 'ffb-442',
          type: 'Image',
          props: {
            ratio: 'wide',
            alt: 'Cover',
          },
          class: 'w-full rounded-box',
          binding: {
            path: 'blog_post.featuredImage',
          },
        },
        {
          id: 'ffb-443',
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
