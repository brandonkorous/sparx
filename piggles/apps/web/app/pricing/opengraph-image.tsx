import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { MASCOT_POSES } from '@piggles/mascot';
import { PRICE_LABEL } from '@piggles/config/pricing';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = `Piggles pricing — ${PRICE_LABEL} a month, all fifteen apps`;

export default function Image() {
  return renderOg({
    title: `${PRICE_LABEL} a month. All fifteen apps.`,
    subtitle: 'No tiers, no per-app unlocks, and no upgrade button in the way of your work.',
    // The one money pose that belongs on a marketing card. DESIGN.md keeps her out
    // of a customer's OWN money moments — a failed payment, a tax filing, a payroll
    // run. A price we are asking for is ours, not theirs, and the coin is the page.
    pose: MASCOT_POSES['money-minder'],
  });
}
