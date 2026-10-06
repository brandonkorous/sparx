// What the shop tells a signed-in trade buyer about a part and their fleet (sparx
// persona issue 086).
//
// Three answers, and only three: it fits (name the vehicles), it has fitment data
// and fits none of them (warn, and still sell it), or there is nothing to say. A
// part with no fitment data at all gets nothing: "we do not know" is not "it does
// not fit", and printing it as one would tell a buyer that shop rags do not fit their
// trucks.

import { fitsSentence, type FleetFit } from '@wizeworks/commerce-schemas';
import type { SilicaColor } from '@wizeworks/silicaui-react';

/** The badge on a product card, or null for nothing to say. */
export function fleetFitBadge(
  fit: FleetFit | null | undefined
): { color: SilicaColor; text: string } | null {
  if (!fit) return null;
  return fit.fits
    ? { color: 'success', text: 'Fits your fleet' }
    : { color: 'warning', text: 'Does not fit your fleet' };
}

/** The sentence on a product page, or null for nothing to say. */
export function fleetFitNotice(
  fit: FleetFit | null | undefined
): { color: SilicaColor; text: string } | null {
  if (!fit) return null;
  if (fit.fits) {
    const sentence = fitsSentence(fit.vehicles);
    return { color: 'success', text: sentence ? `${sentence}.` : 'Fits your fleet.' };
  }
  return {
    color: 'warning',
    text: 'This part does not fit any vehicle in your fleet. Check the fitment details before you order. You can still buy it.',
  };
}
