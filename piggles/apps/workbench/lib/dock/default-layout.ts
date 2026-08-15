import type { SurfaceParams } from '@/lib/surfaces/descriptor';

// What a brand-new Piggles workspace opens with.
//
// ── ONE PANE, AND WHY IT USED TO BE SIX ─────────────────────────────────────
//
// This list opened with six surfaces — Home, Site, Customers, Calendar, Inbox,
// Invoices — and the argument for it was reasonable on paper: Piggles' audience
// has no mental model of a workspace to arrange, so "the shape of a working day"
// says what the app is for faster than an empty canvas could.
//
// Put on a screen, it was wrong three separate ways, and none of them were
// visible from the code:
//
//   1. They do not tile. `controller.open()` defaults to `target: 'tab'`, so six
//      calls produce ONE group with six tabs — not six windows and not a grid.
//      In windows mode that is a single floating box holding all of them.
//   2. The active pane is the LAST one opened, so a brand-new business's first
//      view of Piggles was an empty Invoices list, with Home a tab away and the
//      Invoices tab itself pushed into the overflow menu.
//   3. Six tabs is not an invitation, it is six things already open. The exact
//      feeling the product exists to avoid, delivered in the first second.
//
// ── THE PREMISE CHANGED ─────────────────────────────────────────────────────
//
// The six-pane argument rested on "an empty canvas with one panel is a blank
// page". That was true when the only Home was the platform's Start here, which
// is a lesson in window management. It stopped being true the day Piggles got
// its own Home (surfaces/home.tsx): a screen that greets somebody by name, tells
// them in sentences what is waiting, and offers four things to start. It is not
// a blank page — it is the answer to the question they arrived with, and every
// other surface here is one row of it away.
//
// So: ONE pane, filling the workspace, and the shape of a working day is
// something they build rather than something they arrive to and have to dismiss.
// Adding a second entry is a real decision — say what question the person has
// on first open that Home does not already answer.

export interface DefaultLayoutEntry {
  surface: string;
  params?: SurfaceParams;
}

// EVERY key below is verified against the surface registry. A key that does not
// resolve opens nothing and reports nothing — the workspace simply comes up
// emptier than intended, with no error anywhere. An earlier draft guessed four
// of six (`crm.customers`, `scheduling.bookings`, `chat.conversations`,
// `invoicing.invoices`) and every one of them was wrong. Grep `key: '` in
// lib/surfaces/catalog before adding one.
export const DEFAULT_LAYOUT: readonly DefaultLayoutEntry[] = [
  // Piggles' OWN home (lib/surfaces/piggles-catalog.ts), not the platform's
  // Start here: that pane teaches window management, which is the wrong first
  // thing to hand somebody who did not choose to be in software today.
  { surface: 'piggles.home' },
];
