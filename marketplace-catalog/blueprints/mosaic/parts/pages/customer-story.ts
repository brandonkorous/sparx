// Mosaic — Customer Story page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/mosaic/.

export default {
  id: 'msc-595',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Customer story',
  children: [
    {
      id: 'msc-591',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Story header',
      children: [
        {
          id: 'msc-591__c',
          type: 'Stack',
          class: 'mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
          props: {},
          children: [
            {
              id: 'msc-588',
              type: 'el:a',
              props: {
                href: '/customers',
                text: '← All customer stories',
              },
              class: 'text-sm font-medium text-primary',
            },
            {
              id: 'msc-589',
              type: 'Heading',
              props: {
                level: 'h1',
              },
              class: 'text-4xl font-bold tracking-tight text-[#191918] @2xl:text-5xl',
              binding: {
                path: 'blog_post.title',
              },
            },
            {
              id: 'msc-590',
              type: 'Text',
              props: {
                variant: 'body',
              },
              class: 'max-w-2xl text-lg text-base-content/60',
              binding: {
                path: 'blog_post.excerpt',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'msc-594',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 p-8 @3xl:p-16',
      name: 'Story body',
      children: [
        {
          id: 'msc-592',
          type: 'Image',
          props: {
            ratio: 'wide',
            alt: 'Cover',
          },
          class: 'w-full rounded-2xl',
          binding: {
            path: 'blog_post.featuredImage',
          },
        },
        {
          id: 'msc-593',
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
