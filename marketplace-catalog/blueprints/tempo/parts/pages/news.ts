// Tempo — News page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/tempo/.

export default {
  id: 'tmp-628',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'News',
  children: [
    {
      id: 'tmp-596',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Page hero',
      children: [
        {
          id: 'tmp-596__c',
          type: 'Stack',
          class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start p-8 @3xl:p-16',
          props: {},
          children: [
            {
              id: 'tmp-593',
              type: 'el:p',
              props: {
                text: 'The Latest',
              },
              class:
                'font-heading text-xs font-bold uppercase tracking-[0.2em] text-base-content/50',
            },
            {
              id: 'tmp-594',
              type: 'el:h1',
              props: {
                text: 'News & Stories',
              },
              class:
                'font-heading max-w-3xl text-3xl font-black uppercase leading-[0.95] tracking-tightest text-base-content @2xl:text-5xl',
            },
            {
              id: 'tmp-595',
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
      id: 'tmp-627',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-4 p-8 @3xl:p-16',
      name: 'News grid',
      children: [
        {
          id: 'tmp-606',
          type: 'el:article',
          props: {},
          class: 'group flex flex-col border border-base-300',
          children: [
            {
              id: 'tmp-598',
              type: 'el:div',
              props: {},
              class:
                'relative flex items-center justify-center overflow-hidden bg-linear-to-br from-[#0ea5e9] to-[#1d4ed8] h-44 w-full',
              children: [
                {
                  id: 'tmp-597',
                  type: 'el:span',
                  props: {
                    text: '🏃',
                  },
                  class: 'text-[7rem] leading-none drop-shadow-2xl @2xl:text-[10rem]',
                },
              ],
            },
            {
              id: 'tmp-605',
              type: 'el:div',
              props: {},
              class: 'flex flex-1 flex-col gap-2 p-5',
              children: [
                {
                  id: 'tmp-600',
                  type: 'el:a',
                  props: {
                    href: '/blog/glide-boost-reengineered',
                  },
                  class: 'block transition-colors hover:text-base-content/70',
                  children: [
                    {
                      id: 'tmp-599',
                      type: 'el:h3',
                      props: {
                        text: 'Glide Boost: the daily trainer, reengineered',
                      },
                      class:
                        'font-heading text-lg font-black uppercase leading-tight tracking-tightest text-base-content',
                    },
                  ],
                },
                {
                  id: 'tmp-601',
                  type: 'el:p',
                  props: {
                    text: 'A new energy-return midsole and a one-piece knit upper — here’s what changed, and why your easy miles will feel it.',
                  },
                  class: 'flex-1 text-sm leading-relaxed text-base-content/65',
                },
                {
                  id: 'tmp-604',
                  type: 'el:a',
                  props: {
                    href: '/blog/glide-boost-reengineered',
                  },
                  class:
                    'group/al inline-flex w-fit items-center gap-2 border-b-2 border-current pb-1 font-heading text-xs font-bold uppercase tracking-wide  mt-1',
                  children: [
                    {
                      id: 'tmp-602',
                      type: 'el:span',
                      props: {
                        text: 'Read More',
                      },
                    },
                    {
                      id: 'tmp-603',
                      type: 'Icon',
                      props: {
                        name: 'arrow-right',
                      },
                      class: 'h-3.5 w-3.5 transition-transform group-hover/al:translate-x-1',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'tmp-616',
          type: 'el:article',
          props: {},
          class: 'group flex flex-col border border-base-300',
          children: [
            {
              id: 'tmp-608',
              type: 'el:div',
              props: {},
              class:
                'relative flex items-center justify-center overflow-hidden bg-linear-to-br from-[#15803d] to-[#052e16] h-44 w-full',
              children: [
                {
                  id: 'tmp-607',
                  type: 'el:span',
                  props: {
                    text: '🎟️',
                  },
                  class: 'text-[7rem] leading-none drop-shadow-2xl @2xl:text-[10rem]',
                },
              ],
            },
            {
              id: 'tmp-615',
              type: 'el:div',
              props: {},
              class: 'flex flex-1 flex-col gap-2 p-5',
              children: [
                {
                  id: 'tmp-610',
                  type: 'el:a',
                  props: {
                    href: '/blog/inside-the-club',
                  },
                  class: 'block transition-colors hover:text-base-content/70',
                  children: [
                    {
                      id: 'tmp-609',
                      type: 'el:h3',
                      props: {
                        text: 'Inside the Club: what membership actually unlocks',
                      },
                      class:
                        'font-heading text-lg font-black uppercase leading-tight tracking-tightest text-base-content',
                    },
                  ],
                },
                {
                  id: 'tmp-611',
                  type: 'el:p',
                  props: {
                    text: 'Free shipping, members-only drops, early access, and a birthday surprise — a quick tour of everything the Club gets you.',
                  },
                  class: 'flex-1 text-sm leading-relaxed text-base-content/65',
                },
                {
                  id: 'tmp-614',
                  type: 'el:a',
                  props: {
                    href: '/blog/inside-the-club',
                  },
                  class:
                    'group/al inline-flex w-fit items-center gap-2 border-b-2 border-current pb-1 font-heading text-xs font-bold uppercase tracking-wide  mt-1',
                  children: [
                    {
                      id: 'tmp-612',
                      type: 'el:span',
                      props: {
                        text: 'Read More',
                      },
                    },
                    {
                      id: 'tmp-613',
                      type: 'Icon',
                      props: {
                        name: 'arrow-right',
                      },
                      class: 'h-3.5 w-3.5 transition-transform group-hover/al:translate-x-1',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'tmp-626',
          type: 'el:article',
          props: {},
          class: 'group flex flex-col border border-base-300',
          children: [
            {
              id: 'tmp-618',
              type: 'el:div',
              props: {},
              class:
                'relative flex items-center justify-center overflow-hidden bg-linear-to-br from-[#0e7490] to-[#082f3a] h-44 w-full',
              children: [
                {
                  id: 'tmp-617',
                  type: 'el:span',
                  props: {
                    text: '♻️',
                  },
                  class: 'text-[7rem] leading-none drop-shadow-2xl @2xl:text-[10rem]',
                },
              ],
            },
            {
              id: 'tmp-625',
              type: 'el:div',
              props: {},
              class: 'flex flex-1 flex-col gap-2 p-5',
              children: [
                {
                  id: 'tmp-620',
                  type: 'el:a',
                  props: {
                    href: '/blog/made-to-be-remade',
                  },
                  class: 'block transition-colors hover:text-base-content/70',
                  children: [
                    {
                      id: 'tmp-619',
                      type: 'el:h3',
                      props: {
                        text: 'Made to be remade: inside our recycled program',
                      },
                      class:
                        'font-heading text-lg font-black uppercase leading-tight tracking-tightest text-base-content',
                    },
                  ],
                },
                {
                  id: 'tmp-621',
                  type: 'el:p',
                  props: {
                    text: 'How we’re building shoes from reclaimed materials — and designing them to come back when they’re worn out.',
                  },
                  class: 'flex-1 text-sm leading-relaxed text-base-content/65',
                },
                {
                  id: 'tmp-624',
                  type: 'el:a',
                  props: {
                    href: '/blog/made-to-be-remade',
                  },
                  class:
                    'group/al inline-flex w-fit items-center gap-2 border-b-2 border-current pb-1 font-heading text-xs font-bold uppercase tracking-wide  mt-1',
                  children: [
                    {
                      id: 'tmp-622',
                      type: 'el:span',
                      props: {
                        text: 'Read More',
                      },
                    },
                    {
                      id: 'tmp-623',
                      type: 'Icon',
                      props: {
                        name: 'arrow-right',
                      },
                      class: 'h-3.5 w-3.5 transition-transform group-hover/al:translate-x-1',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
