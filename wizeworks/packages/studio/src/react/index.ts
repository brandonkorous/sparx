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

export type {
  CatalogScope,
  ClassDenial,
  ClassVerdict,
  EmailPreviewHost,
  InspectorContext,
  PickedAsset,
  StudioHost,
} from './host';

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

export { EmailCanvas, EMAIL_DRAG_TYPE } from './email/canvas';
export { EmailNavigator } from './email/navigator';
export { EmailPalette } from './email/palette';
export { EmailInspector } from './email/inspector/inspector';
export { emailLayerRows, emailRowLabel, type EmailLayerRow } from './email/layers';
export { resolveMergeTags } from './email/tokens';
export { emailStylesheet } from './email/style';
export { useEmailShortcuts } from './email/shortcuts';

export { TreeBuilder } from './builders/tree-builder';
export { EmailBuilder } from './builders/email-builder';
export { ThemeBuilder } from './builders/theme-builder';
export { ThemePreview } from './builders/theme-preview';
export { canRemove, useBuilderShortcuts } from './builders/shortcuts';
