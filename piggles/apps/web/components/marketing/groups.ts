import type { PigglesGroup } from '@piggles/brand';

// Group display names, for marketing surfaces only.
//
// The product rail shows APP names and never group names — a group is a color
// and an ordering, not a place you navigate to. These strings exist so the
// homepage grid, the footer index and /apps can say what a hue means, and they
// live here rather than in `@piggles/config` for exactly that reason: they are
// copy, not product structure. If the console ever needs to label a group, that
// is a lexicon entry, not an import from a marketing component.

export const GROUP_COPY: Record<PigglesGroup, { title: string; blurb: string; long: string }> = {
    home: {
        title: 'Your day',
        blurb: 'What needs you, first thing.',
        long: 'One screen that tells you what happened overnight and what is waiting — instead of five tabs you check in a fixed order because you once forgot one.',
    },
    web: {
        title: 'Your website',
        blurb: 'Pages, writing, and being findable.',
        long: 'The site people actually land on, the things you write to bring them there, and the unglamorous work of turning up in search when somebody looks for what you do.',
    },
    sell: {
        title: 'Selling',
        blurb: 'What you sell and what you have left.',
        long: 'Products or services, online or across the counter, one at a time or by the pallet — and always an honest answer to how many are left.',
    },
    people: {
        title: 'People',
        blurb: 'Customers, conversations, appointments.',
        long: 'Everyone you deal with, everything you have ever said to them, and every time they are booked in — in one history rather than three systems and a notebook.',
    },
    money: {
        title: 'Money',
        blurb: 'Getting paid, and knowing where you are.',
        long: 'Send the bill, chase the ones nobody paid, and see plainly what came in, what went out, and what you actually kept.',
    },
    run: {
        title: 'Running it',
        blurb: 'Your team, your tools, the routine parts.',
        long: 'The people who work with you and what each of them can see, the other software you already use, and the jobs that should just happen without anybody remembering.',
    },
};
