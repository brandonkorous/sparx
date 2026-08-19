// @wizeworks/studio — the headless half.
//
// Documents, ops, per-document history, the session that holds them, and the
// theme → layout → page resolution a canvas draws through. No React, so api-rest
// and the workers can import the document types and the op vocabulary without
// pulling a framework in behind them.
//
// The React builders are at `@wizeworks/studio/react`.

export type {
  ComponentDoc,
  DocumentBase,
  DocumentKind,
  DocumentRef,
  EmailDoc,
  FrameChoice,
  LayoutDoc,
  PageDoc,
  PageSeo,
  StudioDoc,
  ThemeDoc,
  ThemeOrigin,
  TreeDoc,
} from './documents/types';
export { NO_FRAME, docKey, isEditable, isTreeDoc, refOf } from './documents/types';

export type { EmailTreeOp, FieldOp, OpBatch, StudioOp, ThemeOp, TreeOp } from './ops/types';
export { isEmailTreeOp, isThemeOp, isTreeOp } from './ops/types';
export { applyOp, type Applied } from './ops/apply';
export { applyTreeOp, type TreeApplied } from './ops/apply-tree';
export { applyEmailOp, type EmailApplied } from './ops/apply-email';

export type { AddressableNode, NodePlace } from './tree/walk';
export {
  ancestorsOf,
  childNodes,
  collectIds,
  containsOutlet,
  findNode,
  findPlace,
  idOf,
  isAddressable,
  isNodeChild,
  isWithin,
  walkTree,
} from './tree/walk';
export { insertChild, moveNode, removeNode, replaceNode } from './tree/edit';

export type { EmailPlace } from './email/walk';
export {
  collectEmailIds,
  emailAncestors,
  emailChildren,
  findEmailNode,
  findEmailPlace,
  isEmailContainer,
  isWithinEmail,
  walkEmail,
} from './email/walk';
export {
  insertEmailChild,
  moveEmailNode,
  patchEmailNode,
  removeEmailNode,
  replaceEmailNode,
  stampEmailTree,
} from './email/edit';
export { resolveEmailDrop, type EmailDropTarget } from './email/drop';

export { History, HISTORY_LIMIT } from './session/history';
export { DocumentStore, type DocSnapshot, type StoreListener } from './session/document-store';
export { StudioSession, type SessionSnapshot, type SiteContext } from './session/session';

export {
  inheritsSiteTheme,
  resolveCanvas,
  resolveTheme,
  type CanvasResolution,
  type ResolveOptions,
} from './resolve/chain';
