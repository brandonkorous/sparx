// Farm Fresh Bowls — Home page · Locations (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh-bowls/.

export default {
  id: 'ffb-213',
  type: 'Section',
  props: {},
  class:
    'w-full mx-auto w-full max-w-site flex flex-col gap-6 items-center p-8 @3xl:p-16 text-center',
  name: 'Locations',
  children: [
    {
      id: 'ffb-197',
      type: 'Heading',
      props: {
        level: 'h2',
        text: 'Two neighborhoods, one fresh standard',
      },
      class: 'text-center',
    },
    {
      id: 'ffb-212',
      type: 'Section',
      props: {},
      class: 'grid grid-cols-1 @3xl:grid-cols-2 gap-6',
      children: [
        {
          id: 'ffb-204',
          type: 'Card',
          props: {},
          class:
            'mx-auto w-full max-w-site rounded-box flex flex-col gap-2 items-start p-6 @3xl:p-10 bg-white shadow-lg border border-base-300',
          children: [
            {
              id: 'ffb-198',
              type: 'Heading',
              props: {
                level: 'h3',
                text: 'Riverside Market',
              },
            },
            {
              id: 'ffb-199',
              type: 'Text',
              props: {
                variant: 'body',
                text: '214 Orchard Lane, Riverside, CA 92501',
              },
            },
            {
              id: 'ffb-200',
              type: 'Text',
              props: {
                variant: 'meta',
                text: 'Mon–Fri · 7am–7pm · Sat–Sun · 8am–5pm',
              },
            },
            {
              id: 'ffb-203',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2',
              children: [
                {
                  id: 'ffb-201',
                  type: 'Button',
                  props: {
                    label: 'Order Pickup',
                    href: '/menu',
                  },
                  class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
                },
                {
                  id: 'ffb-202',
                  type: 'Button',
                  props: {
                    label: 'Directions',
                    href: '/locations',
                  },
                  class: 'st-btn st-c-primary st-v-soft st-btn--sz-md',
                },
              ],
            },
          ],
        },
        {
          id: 'ffb-211',
          type: 'Card',
          props: {},
          class:
            'mx-auto w-full max-w-site rounded-box flex flex-col gap-2 items-start p-6 @3xl:p-10 bg-white shadow-lg border border-base-300',
          children: [
            {
              id: 'ffb-205',
              type: 'Heading',
              props: {
                level: 'h3',
                text: 'Downtown Commons',
              },
            },
            {
              id: 'ffb-206',
              type: 'Text',
              props: {
                variant: 'body',
                text: '88 Maple Street, Suite B, Riverside, CA 92507',
              },
            },
            {
              id: 'ffb-207',
              type: 'Text',
              props: {
                variant: 'meta',
                text: 'Mon–Fri · 6:30am–8pm · Sat–Sun · 8am–6pm',
              },
            },
            {
              id: 'ffb-210',
              type: 'Stack',
              props: {},
              class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2',
              children: [
                {
                  id: 'ffb-208',
                  type: 'Button',
                  props: {
                    label: 'Order Pickup',
                    href: '/menu',
                  },
                  class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
                },
                {
                  id: 'ffb-209',
                  type: 'Button',
                  props: {
                    label: 'Directions',
                    href: '/locations',
                  },
                  class: 'st-btn st-c-primary st-v-soft st-btn--sz-md',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
