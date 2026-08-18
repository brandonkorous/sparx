// Commerce module presets — commerce's entries in the platform module-preset
// registry (the reusable install seam). One file per kind (data-as-code);
// `commercePresets` is the flat array the api-rest registry aggregates.
//
// Every preset installs through the REAL commerce service path (taxService,
// shippingService, categoryService, …) so a config pack stamped via the
// à-la-carte picker, via an industry starter, or via the demo seed is identical.

import type { ModulePreset } from '@wizeworks/auth';

import { categoryPresets } from './categories';
import { collectionPresets } from './collections';
import { fitmentPresets } from './fitment';
import { markupPresets } from './markup';
import { paymentPresets } from './payments';
import { shippingPresets } from './shipping';
import { surchargePresets } from './surcharge';
import { taxPresets } from './tax';

/** Every commerce module preset, in picker order (kind by kind). */
export const commercePresets: ModulePreset[] = [
  ...fitmentPresets,
  ...taxPresets,
  ...shippingPresets,
  ...categoryPresets,
  ...collectionPresets,
  ...markupPresets,
  ...surchargePresets,
  ...paymentPresets,
];
