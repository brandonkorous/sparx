// Tempo — Home page · The Club (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/tempo/.

export default {
  id: 'tmp-374',
  type: 'Section',
  props: {},
  class:
    'w-full mx-auto w-full max-w-site flex flex-col @3xl:flex-row flex-wrap gap-6 justify-between items-center p-8 @3xl:p-16 bg-secondary',
  name: 'The Club',
  children: [
    {
      id: 'tmp-370',
      type: 'el:div',
      props: {},
      class: 'max-w-2xl',
      children: [
        {
          id: 'tmp-367',
          type: 'el:div',
          props: {},
          class: 'mb-3 flex items-center gap-2',
          children: [
            {
              id: 'tmp-365',
              type: 'el:span',
              props: {
                text: '»',
              },
              class: 'inline-block font-heading font-black leading-none text-base-100 text-lg',
            },
            {
              id: 'tmp-366',
              type: 'el:span',
              props: {
                text: 'The Club',
              },
              class: 'font-heading text-lg font-black uppercase tracking-tightest text-base-100',
            },
          ],
        },
        {
          id: 'tmp-368',
          type: 'el:h2',
          props: {
            text: 'Join the Club. Score every time you shop.',
          },
          class:
            'font-heading text-2xl font-black uppercase leading-[0.95] tracking-tightest text-base-100 @2xl:text-4xl',
        },
        {
          id: 'tmp-369',
          type: 'el:p',
          props: {
            text: 'Free membership. Earn points on every order, get members-only access to drops and free shipping — plus a birthday surprise.',
          },
          class: 'mt-3 max-w-xl text-sm text-base-100/85',
        },
      ],
    },
    {
      id: 'tmp-373',
      type: 'el:div',
      props: {},
      class: 'flex shrink-0 flex-col gap-3 @sm:flex-row',
      children: [
        {
          id: 'tmp-371',
          type: 'el:a',
          props: {
            href: '/club',
            text: 'Join For Free',
          },
          class:
            'inline-flex items-center justify-center gap-2 font-heading font-bold uppercase tracking-wide transition-colors px-7 py-3.5 text-sm bg-base-100 text-base-content hover:bg-base-100/85',
        },
        {
          id: 'tmp-372',
          type: 'el:a',
          props: {
            href: '/club',
            text: 'Sign In',
          },
          class:
            'inline-flex items-center justify-center gap-2 font-heading font-bold uppercase tracking-wide transition-colors px-7 py-3.5 text-sm border-2 border-base-100 text-base-100 hover:bg-base-100/10',
        },
      ],
    },
  ],
};
