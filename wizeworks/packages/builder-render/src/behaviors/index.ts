// The behavior runtime entrypoint (docs/98 Pillar 5).
//
// `hydrateBehaviors(root, ctx)` scans a rendered subtree for the closed
// `data-sx-<name>` vocabulary and wires each match, returning ONE cleanup that
// detaches them all. React-free + side-effect-only — the React boundary is the
// `<BuilderBehaviors>` island (runtime-island.tsx), which both surfaces mount: the
// live storefront (ctx.edit=false → full behavior) and the editor canvas
// (ctx.edit=true → non-hijacking preview).

import { type Behavior, type BehaviorContext, BEHAVIOR_NAMES } from './types';
import { carousel } from './carousel';
import { disclosure } from './disclosure';
import { tabs } from './tabs';
import { scrollspy } from './scrollspy';
import { marquee } from './marquee';
import { menu } from './menu';
import { counter } from './counter';
import { dismiss } from './dismiss';
import { toc } from './toc';
import { reveal } from './reveal';

const REGISTRY: Record<(typeof BEHAVIOR_NAMES)[number], Behavior> = {
  carousel,
  disclosure,
  tabs,
  scrollspy,
  marquee,
  menu,
  counter,
  dismiss,
  toc,
  reveal,
};

/** Wire every behavior under `root` (inclusive of `root` itself). Returns a single
 *  idempotent cleanup. A behavior that throws is isolated — it never breaks the
 *  rest, nor the page. */
export function hydrateBehaviors(root: HTMLElement, ctx: BehaviorContext): () => void {
  const cleanups: (() => void)[] = [];
  for (const name of BEHAVIOR_NAMES) {
    const behavior = REGISTRY[name];
    const selector = `[data-sx-${name}]`;
    const matches: HTMLElement[] = [];
    if (typeof root.matches === 'function' && root.matches(selector)) matches.push(root);
    matches.push(...Array.from(root.querySelectorAll<HTMLElement>(selector)));
    for (const el of matches) {
      try {
        cleanups.push(behavior(el, ctx));
      } catch {
        /* one behavior failing must never break the others or the page */
      }
    }
  }
  return () => {
    for (const cleanup of cleanups.splice(0)) {
      try {
        cleanup();
      } catch {
        /* ignore — teardown is best-effort */
      }
    }
  };
}

export { BEHAVIOR_NAMES, type BehaviorName, type BehaviorContext } from './types';
export {
  behaviorAttrs,
  sxAttrs,
  SX_ROLES,
  type SxRole,
  BEHAVIOR_DESCRIPTORS,
  type BehaviorDescriptor,
  type BehaviorParam,
} from './attrs';
