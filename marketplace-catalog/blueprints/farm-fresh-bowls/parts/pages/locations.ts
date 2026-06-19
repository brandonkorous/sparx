// Farm Fresh — Locations page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh-bowls/.

export default {
  id: 'ffb-370',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Locations',
  children: [
    {
      id: 'ffb-355',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site flex flex-col gap-2 items-center p-8 @3xl:p-16 text-center',
      name: 'Locations intro',
      children: [
        {
          id: 'ffb-353',
          type: 'Heading',
          props: {
            level: 'h1',
            text: 'Find us',
          },
          class: 'text-center',
        },
        {
          id: 'ffb-354',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Two neighborhoods, one fresh standard. Pickup and free local delivery at both.',
          },
          class: 'text-center',
        },
      ],
    },
    {
      id: 'ffb-362',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 items-center p-8 @3xl:p-16',
      name: 'Riverside Market',
      children: [
        {
          id: 'ffb-360',
          type: 'Stack',
          props: {},
          class: 'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-start',
          children: [
            {
              id: 'ffb-356',
              type: 'Heading',
              props: {
                level: 'h2',
                text: 'Riverside Market',
              },
            },
            {
              id: 'ffb-357',
              type: 'Text',
              props: {
                variant: 'body',
                text: '214 Orchard Lane, Riverside, CA 92501',
              },
            },
            {
              id: 'ffb-358',
              type: 'Text',
              props: {
                variant: 'meta',
                text: 'Mon–Fri · 7am–7pm · Sat–Sun · 8am–5pm',
              },
            },
            {
              id: 'ffb-359',
              type: 'Button',
              props: {
                label: 'Order Pickup',
                href: '/menu',
              },
              class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
            },
          ],
        },
        {
          id: 'ffb-361',
          type: 'Map',
          props: {
            query: '214 Orchard Lane, Riverside, CA 92501',
          },
        },
      ],
    },
    {
      id: 'ffb-369',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 items-center p-8 @3xl:p-16',
      name: 'Downtown Commons',
      children: [
        {
          id: 'ffb-367',
          type: 'Stack',
          props: {},
          class: 'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-start',
          children: [
            {
              id: 'ffb-363',
              type: 'Heading',
              props: {
                level: 'h2',
                text: 'Downtown Commons',
              },
            },
            {
              id: 'ffb-364',
              type: 'Text',
              props: {
                variant: 'body',
                text: '88 Maple Street, Suite B, Riverside, CA 92507',
              },
            },
            {
              id: 'ffb-365',
              type: 'Text',
              props: {
                variant: 'meta',
                text: 'Mon–Fri · 6:30am–8pm · Sat–Sun · 8am–6pm',
              },
            },
            {
              id: 'ffb-366',
              type: 'Button',
              props: {
                label: 'Order Pickup',
                href: '/menu',
              },
              class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
            },
          ],
        },
        {
          id: 'ffb-368',
          type: 'Map',
          props: {
            query: '88 Maple Street, Suite B, Riverside, CA 92507',
          },
        },
      ],
    },
  ],
};
