// The product shape the Builder buy-box reads — a subset of the storefront's
// PublicProduct, mapped by `productToBuilderRecord` in apps/site/lib/builder-data.
// Carries cents + currency so the client formats per selected variant. Kept in a
// dependency-free module so both the interactive atoms (commerce.tsx) and the
// canvas sample fixture (sample-product.ts) share one definition without a cycle.

export interface BuilderOptionValue {
  id: string;
  value: string;
  swatchHex: string | null;
}

export interface BuilderOption {
  id: string;
  name: string;
  displayType: string;
  values: BuilderOptionValue[];
}

export interface BuilderVariant {
  id: string;
  sku: string;
  title: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  isDefault: boolean;
  inStock: boolean;
  available: number | null;
  optionValueIds: string[];
}

export interface BuilderProduct {
  title: string;
  price: number | null;
  compareAtPrice: number | null;
  description: string;
  images: { url: string; alt: string }[];
  sku: string;
  currency: string;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  options: BuilderOption[];
  variants: BuilderVariant[];
}
