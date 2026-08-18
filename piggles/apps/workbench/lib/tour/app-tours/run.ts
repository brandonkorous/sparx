// The Run apps — My Team, Automations and Connections.

import type { Guide } from '../types';

export const TEAM_GUIDE: Guide = {
  id: 'staff',
  offer: 'First time in My Team? Show me around',
  steps: [
    {
      id: 'team.people',
      app: 'team',
      anchor: 'nav-staff.people',
      title: 'Who works with you',
      body: 'Everyone on the team, what they are paid and what they are allowed to see. Somebody who only does the diary never has to be shown your takings.',
    },
    {
      id: 'team.schedule',
      app: 'team',
      anchor: 'nav-staff.schedule',
      title: 'Who is on when',
      body: 'The rota, week by week. It sits next to the diary on purpose — a booking with nobody rostered to do it is the mistake this screen exists to catch.',
    },
    {
      id: 'team.timesheets',
      app: 'team',
      anchor: 'nav-staff.timesheets',
      title: 'Hours worked',
      body: 'What people actually did, against what they were rostered for. It is what payroll runs off, so it is worth a glance before the end of the week rather than after.',
    },
    {
      id: 'team.timeoff',
      app: 'team',
      anchor: 'nav-staff.timeoff',
      title: 'And who is away',
      body: 'Holiday, sickness, a half day. Approve it here and the rota and the diary both know, so nothing gets booked into an empty slot.',
    },
  ],
};

export const AUTOMATIONS_GUIDE: Guide = {
  id: 'automations',
  offer: 'First time in Automations? Show me around',
  steps: [
    {
      id: 'automations.recipes',
      app: 'automations',
      anchor: 'nav-automations.recipes',
      title: 'Start with one somebody already wrote',
      body: 'Ready-made ones for the things most businesses want — thank somebody after their first order, flag a customer who has gone quiet, tell you when stock runs low. Pick one, change the words, switch it on.',
    },
    {
      id: 'automations.list',
      app: 'automations',
      anchor: 'nav-automations.list',
      title: 'Everything running for you',
      body: 'Each one is "when this happens, do that". You can switch any of them off at any moment, and nothing here can spend money or message a customer without you having said so.',
    },
    {
      id: 'automations.runs',
      app: 'automations',
      anchor: 'nav-automations.runs',
      title: 'What it actually did',
      body: 'Every time one of them fired, and what came of it. If something has been sending things you did not expect, this is the screen that tells you which one and when.',
    },
  ],
};

export const CONNECTIONS_GUIDE: Guide = {
  id: 'connections',
  offer: 'First time in Connections? Show me around',
  steps: [
    {
      id: 'connections.overview',
      app: 'connections',
      anchor: 'nav-ai.overview',
      title: 'Bringing your own assistant',
      body: 'If you already pay for an AI assistant, you can point it at your own business from here using your own account. Piggles never runs one for you and never puts one on your bill — it stays your subscription and your key.',
    },
    {
      id: 'connections.instructions',
      app: 'connections',
      anchor: 'nav-ai.prompts',
      title: 'Telling it how you work',
      body: 'How you talk to customers, what your returns policy actually is, the things you would tell a new member of staff in their first week. Written once here, so you are not explaining it every time.',
    },
    {
      id: 'connections.tools',
      app: 'connections',
      anchor: 'nav-ai.tools',
      title: 'And deciding what it may touch',
      body: 'You choose exactly what it is allowed to read and change — look at orders but never issue a refund, say. Everything starts off, and nothing turns itself on.',
    },
  ],
};
