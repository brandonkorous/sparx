import { fillPlatformName } from '@wizeworks/brand-core';

/**
 * Every `{platform}` in a provider's descriptor, filled with the tenant's brand.
 *
 * The descriptors are built once for every brand, so they carry the token. The
 * integrations list filled it; these two routes did not, and the connect page
 * read "Connect {platform} Shipping · by {platform}" (sparx persona issue 312).
 * Strings anywhere in the value are filled, so a new field is covered too.
 */
export function fillDeep<T>(value: T, brand: string): T {
  if (typeof value === 'string') return fillPlatformName(value, brand) as T;
  if (Array.isArray(value)) return value.map((v) => fillDeep(v, brand)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, fillDeep(v, brand)])
    ) as T;
  }
  return value;
}
