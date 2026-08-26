// Campaigns — a named path to an outcome, and whether people finish it.
//
// Two surfaces. The list is the app landing; the campaign is where it is set up
// AND where its report is read, because those are the same thing to look at.

import { faArrowProgress, faBullseyeArrow } from '@fortawesome/pro-solid-svg-icons';
import type { SurfaceDefinition } from '../registry';

import { CampaignsSurface } from '../../../surfaces/funnels/campaigns';
import { CampaignSurface } from '../../../surfaces/funnels/campaign';

export const FUNNEL_SURFACES: SurfaceDefinition[] = [
  {
    key: 'funnels.campaigns',
    title: 'Campaigns',
    module: 'funnels',
    icon: faArrowProgress,
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
    icon: faBullseyeArrow,
    component: CampaignSurface,
    listed: false,
    besideWidth: 0.5,
  },
];
