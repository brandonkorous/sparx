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
