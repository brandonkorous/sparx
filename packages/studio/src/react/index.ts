// @wizeworks/studio/react — the pane-ready builders.
//
// Each builder is WHOLE: canvas, layers, insert and properties inside one pane,
// bound to one document. An app mounts `<StudioProvider>` once per site, then a
// `<DocumentProvider>` per pane, and supplies Save / Preview / Publish through the
// builder's `toolbar` slot — the package holds no endpoints.
//
// TAILWIND: this package ships className strings. A consuming app must add an
// `@source` line for it or every control renders unstyled while typecheck, lint
// and the build all pass.

export type { CatalogScope, ClassDenial, ClassVerdict, PickedAsset, StudioHost } from './host';

export {
  DocumentProvider,
  StudioProvider,
  useApply,
  useDirty,
  useDoc,
  useDocSnapshot,
  useDocumentStore,
  useHistoryState,
  useSelect,
  useSelectedNode,
  useSelection,
  useSessionSnapshot,
  useStudioHost,
  useStudioSession,
} from './context';

export { StudioIcon } from './icon';

export { Canvas, NODE_DRAG_TYPE, type CanvasDevice } from './canvas/canvas';
export {
  dropPosition,
  resolveDropTarget,
  siblingAxis,
  type Box,
  type DropPosition,
  type DropTarget,
  type Point,
} from './canvas/drop';
export { renderNode, type DropHint, type RenderContext } from './canvas/render-node';

export { Navigator } from './navigator/navigator';
export {
  isLayoutWrapper,
  layerRows,
  rowIcon,
  rowLabel,
  type LayerDepth,
  type LayerOptions,
  type LayerRow,
} from './navigator/layer-tree';

export { Palette } from './palette/palette';

export { Inspector } from './inspector/inspector';
export { DesignTab, prefixForDevice } from './inspector/design-tab';
export { SettingsTab } from './inspector/settings-tab';
export {
  CONTROL_SECTIONS,
  groupClasses,
  sectionsFor,
  type ControlGroup,
  type ControlOption,
  type ControlSection,
} from './inspector/class-groups';

export { TreeBuilder } from './builders/tree-builder';
export { ThemeBuilder } from './builders/theme-builder';
export { ThemePreview } from './builders/theme-preview';
export { canRemove, useBuilderShortcuts } from './builders/shortcuts';
