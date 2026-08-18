import type { ProductTypeDefinition } from '../schema';
import { apparelType } from './apparel';
import { cosmeticsType } from './cosmetics';
import { foodBeverageType } from './food-beverage';
import { homeGoodsType } from './home-goods';
import { electronicsType } from './electronics';
import { generalType } from './general';
import { autoPartType } from './auto-part';

export {
  apparelType,
  cosmeticsType,
  foodBeverageType,
  homeGoodsType,
  electronicsType,
  generalType,
  autoPartType,
};

// The starter vocabulary of product types every tenant sees (docs/143 §5). The
// seed migration 20270206000000 establishes these rows under the platform tenant
// on a cold-start DB, mirroring this array byte-for-byte. Order is not
// significant — types don't cross-reference. Tenants add their own via the
// field-builder; this set is the starting vocabulary, not a ceiling.
export const BUILT_IN_PRODUCT_TYPES: readonly ProductTypeDefinition[] = [
  apparelType,
  cosmeticsType,
  foodBeverageType,
  homeGoodsType,
  electronicsType,
  generalType,
  autoPartType,
];

// The sentinel Sparx Platform tenant that owns built-in rows — the same id the
// CMS uses (PLATFORM_TENANT_ID in @wizeworks/cms-schemas). Duplicated here so
// commerce doesn't take a dependency on cms just for a constant.
export const PLATFORM_TENANT_ID = '00000000-0000-0000-0000-000000000000';
