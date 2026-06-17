// @sparx/builder-render — the single Builder render path (docs/builder/02).
//
// The per-type leaf map, the interactive islands, and the edit-mode runtime that
// the live storefront renderer (apps/site) and the dashboard editor canvas
// (apps/dashboard) both consume — so "the canvas IS production" is literally true.
// Zero server-only deps (no @sparx/db, no next/headers): presentational + injected
// data, with the genuinely-interactive atoms as 'use client' islands.

// The unified leaf render + the host-shared predicates/helpers.
export {
  renderLeaf,
  leafWearsClass,
  resolveBuilderProduct,
  youtubeEmbed,
  mapEmbed,
  parseFaqItems,
  parseFeatureItems,
  type LeafRenderArgs,
  type RenderMode,
  type RenderSurface,
} from './render-leaf';

// The injected side-effect runtime + the edit-mode flag.
export {
  BuilderRuntimeProvider,
  useBuilderRuntime,
  EditModeProvider,
  useEditMode,
  type BuilderRuntime,
} from './runtime-context';

// Interactive islands — rendered identically on both surfaces.
export { BuilderCarousel, type BuilderCarouselProps } from './carousel';
export { BuilderIcon } from './icon';
export { SignupForm } from './signup';
export {
  BuilderBuyBox,
  BuilderVariantPicker,
  BuilderQuantity,
  BuilderAddToCart,
  BuilderActionButton,
  ProductFormProvider,
  useProductForm,
} from './commerce';
export type {
  BuilderProduct,
  BuilderOption,
  BuilderOptionValue,
  BuilderVariant,
} from './commerce-types';

// The canvas sample product (the commerce atoms' edit-mode fallback).
export { SAMPLE_BUILDER_PRODUCT } from './sample-product';

// The sanctioned behavior runtime (docs/98 Pillar 5) — the closed data-sx-* set,
// the React hydration island both surfaces mount, and the node-props → attribute
// lowering the walkers emit.
export { BuilderBehaviors } from './behaviors/runtime-island';
export {
  hydrateBehaviors,
  behaviorAttrs,
  sxAttrs,
  SX_ROLES,
  BEHAVIOR_NAMES,
  BEHAVIOR_DESCRIPTORS,
  type BehaviorName,
  type BehaviorContext,
  type SxRole,
  type BehaviorDescriptor,
  type BehaviorParam,
} from './behaviors';

// View HTML — serialize a node/subtree to clean publish HTML (docs/98 §3.8/§4.2).
export {
  serializeNodeToHtml,
  serializeTreeToHtml,
  type SerializeOptions,
} from './serialize-html';
