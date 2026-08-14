import {
  Boxes,
  CalendarClock,
  ContactRound,
  FileText,
  Globe,
  Handshake,
  House,
  MessageSquare,
  Newspaper,
  Plug,
  Search,
  ShoppingBag,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

// The rail icon for each Piggles app — an explicit editorial choice, and the
// reason it is not simply "the primary module's icon".
//
// The shared workbench chooses icons per MODULE, and a Piggles app is not a
// module: "Sell" fronts three of them, so inheriting one would make the rail's
// most persistent glyph an accident of which module happened to be listed first.
// The rail is the piece of UI a person looks at most; its icons should be chosen.
//
// ── WHY THIS SITS IN @piggles/config AND NOT IN THE CONSOLE ─────────────────
//
// It started in `apps/workbench/lib/console/`, which was right while the console
// was the only thing with a rail. It is not any more: the account app draws a
// PREVIEW of that rail during onboarding, so somebody choosing what they do can
// see what they are about to get. Two copies of this map would drift on the
// first app added, and the drift would be silent — a rail and its own preview
// showing different glyphs for the same app is the kind of wrongness nobody
// files a bug about and everybody notices.
//
// So it lives beside the registry it keys off. `APPS` and `APP_ICONS` are one
// fact about an app split across two files only because one of them needs React.
//
// Two decisions worth not re-litigating:
//
//   • Money is a WALLET, not a piggy bank. The pun is right there and the brand
//     is playful — but piggles/CLAUDE.md is explicit that money, tax and payroll
//     are plain and calm, and the mascot earns its keep in empty states, not in
//     the nav. A wallet says "money" without a wink at the one place a wink is
//     unwelcome.
//   • Customers is `Users` and My Team is `ContactRound`. Two people-shaped apps
//     must not be the same glyph at 16px, and the distinction that survives
//     shrinking is a crowd versus a single person on a card.

export const APP_ICONS: Record<string, LucideIcon> = {
  home: House,
  site: Globe,
  content: Newspaper,
  get_found: Search,
  sell: ShoppingBag,
  stock: Boxes,
  customers: Users,
  messages: MessageSquare,
  bookings: CalendarClock,
  invoices: FileText,
  money: Wallet,
  team: ContactRound,
  automations: Workflow,
  partners: Handshake,
  connections: Plug,
};

/** An app's chosen icon. Falls back to `House` for an app added to the registry
 *  without one — a visible-but-wrong glyph beats a hole in the rail, and it is
 *  obvious enough to get fixed. */
export function appIcon(appId: string): LucideIcon {
  return APP_ICONS[appId] ?? House;
}
