// Campaigns — a named path to an outcome, and whether people finish it.
//
// Two surfaces and no more. The list is the module landing; the campaign is
// where it is set up AND where its report is read, because those are the same
// thing to look at and splitting them would mean two panes open to answer one
// question.
//
// The campaign surface is unlisted: it is reached from the list or from a deep
// link, never from the nav, and `createSurface` on the list is what turns "start
// a new one" into a single click from the rail.

import { Target, Waypoints } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';

import { CampaignsSurface } from '../../../surfaces/funnels/campaigns';
import { CampaignSurface } from '../../../surfaces/funnels/campaign';

export const FUNNEL_SURFACES: SurfaceDefinition[] = [
  {
    key: 'funnels.campaigns',
    title: 'Campaigns',
    module: 'funnels',
    icon: Waypoints,
    order: 1,
    keywords: [
      'campaign',
      'funnel',
      'conversion',
      'leads',
      'drop off',
      'landing page',
      'promotion',
      'sign ups',
    ],
    component: CampaignsSurface,
    createSurface: 'funnels.campaign',
    createLabel: 'New campaign',
  },
  {
    key: 'funnels.campaign',
    title: (params) => (params.id === 'new' ? 'New campaign' : 'Campaign'),
    module: 'funnels',
    icon: Target,
    component: CampaignSurface,
    listed: false,
    besideWidth: 0.5,
  },
];
