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

// The starter vocabulary of product types every tenant sees (docs/143 §5).
//
// THIS ARRAY IS THE SOURCE OF TRUTH, AND IT IS APPLIED ON EVERY DEPLOY.
// `seedBuiltInProductTypes` in wizeworks/packages/db/prisma/platform-seed.ts
// upserts it under the platform tenant as part of the release pipeline's data
// stage, so an edit here ships with the code that makes it.
//
// It did not always work that way, and the two failures are why the seed step
// exists. Migration 20270206000000 wrote these rows once and asked the next
// person to keep the two "in lockstep"; nobody could, because a migration runs
// once. The icons drifted first (a symbol here, the NAME of one in the rows) and
// needed a second migration, 20270406000000, to catch the databases up. Then the
// descriptions drifted, and eight strings sat wrong on every deployed database
// with the fix committed here. scripts/check-platform-seed.mjs now fails a push
// that leaves this array with no deploy stage applying it.
//
// Order is not significant — types don't cross-reference. Tenants add their own
// via the field-builder; this set is the starting vocabulary, not a ceiling.
//
// `icon` is a SYMBOL, not the name of one. The console renders it as text, so an
// icon-library name lands beside the type as a stray word (issue 167).
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
