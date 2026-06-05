// Asset references inside OPAQUE JSON (docs/54 §6).
//
// Structured decls (products, categories, brand) carry explicit `*AssetId`
// fields the installer resolves to a MediaAsset id. But a content-entry `body`
// is opaque JSON validated against its content type at install time — so an
// `asset`-typed field there can't be a plain `*AssetId` key. It carries a
// sentinel instead: `{ $asset: '<assetDeclId>' }`, which the installer resolves
// to a MediaAsset id (the same shape-trick as the `$prop` / `$bind` sentinels in
// @sparx/builder-schemas). Page/email TREE images don't need this — those props
// accept a raw URL string and hot-link directly (docs/54 §6).
//
// Phase 1 only DECLARES + VALIDATES the convention; the installer (Phase 2)
// resolves it.

export const ASSET_REF_KEY = '$asset';

export interface AssetRef {
  $asset: string;
}

/** Build an asset reference for use inside a content-entry body. */
export function assetRef(id: string): AssetRef {
  return { $asset: id };
}

export function isAssetRef(v: unknown): v is AssetRef {
  return (
    typeof v === 'object' && v !== null && typeof (v as { $asset?: unknown }).$asset === 'string'
  );
}

/** Every asset-decl id referenced via a `{ $asset }` sentinel anywhere in a JSON
 *  value (deep). The integrity validator uses this to confirm content-body asset
 *  references resolve to a declared asset. Pure. */
export function collectAssetRefs(value: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (isAssetRef(v)) {
      out.push(v.$asset);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v && typeof v === 'object') {
      for (const child of Object.values(v as Record<string, unknown>)) walk(child);
    }
  };
  walk(value);
  return out;
}
