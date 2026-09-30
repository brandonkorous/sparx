import type { AppMarketing } from './types';
import { AUTOMATIONS_CHAPTERS } from './chapters/automations';

export const AUTOMATIONS: AppMarketing = {
  heading: 'The jobs that should just happen, happening.',
  lede: 'Automations does the small reliable things you would otherwise do by memory: the follow-up two days later, the low-stock warning, the tag on a customer who bought twice, the reminder before the appointment.',
  alsoKnownAs: ['workflow automation', 'marketing automation', 'triggers and actions'],
  does: [
    {
      title: 'When this, then that',
      body: 'Built from things that already happen in your business: an order paid, a booking made, stock below a level, a quote gone quiet.',
    },
    {
      title: 'Wait, then check again',
      body: 'Steps can pause for a day or a week and then confirm the situation still applies, so nobody gets chased for something they already did.',
    },
    {
      title: 'Start from a working example',
      body: 'A set of ready-made ones for the common jobs. Turn one on, change the wording, done.',
    },
    {
      title: 'See what it did',
      body: 'Every run is listed with what it acted on and what it changed. An automation you cannot inspect is one you will not trust.',
    },
    {
      title: 'Edit without breaking it',
      body: 'Changes wait as a draft until you publish them. The running version keeps going, and every earlier version is kept to go back to.',
    },
    {
      title: 'Off is one click',
      body: 'Pause anything immediately, without deleting it and rebuilding it later.',
    },
  ],
  chapters: AUTOMATIONS_CHAPTERS,
  worksWith: ['customers', 'messages', 'stock'],
};
