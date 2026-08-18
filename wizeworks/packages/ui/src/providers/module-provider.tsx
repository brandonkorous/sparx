import * as React from 'react';

export type SparxModule =
  // Legacy Site Builder color identity (the `/sitebuilder` dashboard surface).
  // The billable site-building module is now `builder`; `storefront` survives
  // only to color the legacy surfaces until /sitebuilder folds into /builder.
  | 'storefront'
  // The site-building module (docs/40), `/builder` — the billable foundation
  // module (themes, layouts, pages, domains). Formerly marketed as "Storefront".
  | 'builder'
  | 'commerce'
  | 'cms'
  | 'crm'
  | 'email'
  | 'b2b'
  | 'invoicing'
  | 'ai'
  | 'dropship'
  | 'inventory'
  | 'chat'
  | 'scheduling'
  // Social (docs/133) — organic posting to Facebook/Instagram/Pinterest. A real
  // independently-gated module (it owns a dashboard surface), simply priced at $0.
  | 'social'
  // Automations, SEO + Finance are platform surfaces (always-on, not separately
  // billed), but they own a brand color so their pages read in-module. They are
  // intentionally NOT in moduleManifests — they get no gated sidebar slot.
  | 'automations'
  | 'seo'
  // Finance (docs/109) is the money hub — a peer of Settings, but it owns a hue
  // so its surfaces pop AND a finance signal embedded in another module (e.g. the
  // Payouts card on the Commerce overview) reads as finance, not that module.
  | 'finance'
  // Staff (docs/149) — the people who do the work. A real billable module with its
  // own surfaces, and a hue of its own so a staff signal embedded in another
  // module (the technician on a job, the person a booking is assigned to) reads as
  // staff rather than as that module.
  | 'staff'
  // Partner Portal (docs/114 §B.7) — a first-class platform area (the Finance
  // pattern), NOT a module: no manifest, no billing. It owns a violet hue so the
  // whole portal + any partner signal (a referral badge, a commission tile) reads
  // as "partner" wherever it surfaces.
  | 'partner'
  | 'platform';

/**
 * Paints a subtree with a module's identity: everything inside resolves
 * `color="module"`, `bg-module`, `text-module` and the `bg-module bg-soft` tint
 * to that module's registered hue.
 *
 * It renders **one attribute** and nothing else. The mapping from
 * `data-module="commerce"` to `--color-module` / `--color-module-content` lives
 * in `@sparx/brand/theme.css` (the "module bridge" block), beside the tokens it
 * maps — so this file knows a module's NAME and never its color.
 *
 * ## Why it used to be bigger, and what that cost
 *
 * It carried its own `MODULE_COLORS` table of nineteen hardcoded hexes and
 * pushed two of them onto an inline `style`. The theme.css bridge already
 * existed and already emitted the correct values from the same `data-module`
 * attribute this component was already setting — that file's comment even said
 * so, and added that ModuleProvider "can drop its style prop whenever that's
 * worth doing", on the stated assumption that *"both paths land on identical
 * results"*.
 *
 * They did not. The table had drifted: `content` was `#ffffff` for sixteen of
 * the nineteen modules, including every hue white cannot sit on. Because an
 * inline style beats any selector, the drifted copy won on every screen inside a
 * provider. Measured on /tools/qr-code, `btn-module` rendered white on Commerce
 * orange at **2.80:1**, while `badge-module-commerce` on the identical fill —
 * reaching the real token, outside this override — measured **5.58:1**. The
 * theme.css entry has carried the correct ink, and a note recording that exact
 * 2.80:1 figure, the whole time.
 *
 * Someone had already patched `inventory` and `seo` to a dark ink, which is the
 * shape of this class of bug: the two most obviously-unreadable hues get fixed
 * by hand while `cms`, `crm`, `email`, `dropship` and `finance` fail just as
 * hard, a shade less visibly.
 *
 * So the table is deleted rather than corrected. A second copy of a palette is a
 * second thing to keep in sync, and this one is the proof of what happens when
 * it isn't.
 *
 * ## It is a Server Component now
 *
 * The `'use client'` directive and the React context went with the table. The
 * context existed only to power `useModule()`, which had no caller anywhere in
 * the repo outside its own test — so every consumer was paying a client boundary
 * to set one attribute. `sparx/apps/web`'s eighteen tool pages and `wizeworks/apps/admin`'s
 * console layout render this from the server now and cross no boundary at all.
 *
 * The workbench's `<ModuleScope>` compiles to the same attribute, so the two
 * genuinely do land on identical results.
 */
export function ModuleProvider({
  module,
  children,
  className,
  style,
}: {
  module: SparxModule;
  children: React.ReactNode;
  className?: string;
  /** Layout only. It is NOT a hook for color — the hue comes from the
   *  attribute, and an inline style here is what caused the bug above. */
  style?: React.CSSProperties;
}) {
  return (
    <div data-module={module} className={className} style={style}>
      {children}
    </div>
  );
}
