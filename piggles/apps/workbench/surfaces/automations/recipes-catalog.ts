// The Recipe Gallery's presentation catalog — a curated, pure-data mapping from a
// shipped SYSTEM automation's `name` to how it should read to a non-technical
// business owner: a GOAL group it belongs to ("Get paid on time"), a friendly
// title, a plain-English one-liner, a lucide glyph, and the module hue its icon
// wears.
//
// It is deliberately KEYED BY THE AUTOMATION NAME. The ~45 system automations are
// seeded elsewhere (packages/automation-actions/src/seeds/*) and this file never
// creates or edits one — it only decides how an already-installed rule is
// presented. A recipe whose automation is not installed on this tenant simply
// never renders; a system automation with no recipe here falls into the "More"
// group with its own server-set description. So the two can drift without either
// breaking: a new seed just shows up under "More" until someone adds a line here.
//
// Pure and client-safe: no hooks, no server imports, no data. Built for the
// workbench; it does not depend on the dashboard.

import {
  Bell,
  BellRing,
  Building2,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  CirclePause,
  CirclePlay,
  CircleX,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileText,
  Gift,
  HandCoins,
  Inbox,
  LayoutGrid,
  LifeBuoy,
  ListChecks,
  Megaphone,
  MessageSquareWarning,
  Newspaper,
  PackageCheck,
  PackageMinus,
  PackageOpen,
  PackagePlus,
  PackageX,
  Receipt,
  Repeat,
  RotateCcw,
  ShieldAlert,
  ShoppingCart,
  Smile,
  Sparkles,
  Star,
  StickyNote,
  Tag,
  Trophy,
  Truck,
  Undo2,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { WorkbenchModule } from '../../components/module-scope';
import { productCopy } from '../../lib/product';

/* ── goal groups ──────────────────────────────────────────────────────────── */

/** The stable id of a goal group. Ordering is the array order of {@link GOAL_GROUPS}. */
export type GoalKey =
  | 'welcome'
  | 'recover'
  | 'retain'
  | 'loyalty'
  | 'getpaid'
  | 'aftersale'
  | 'stayontop'
  | 'audience'
  | 'more';

export interface GoalGroup {
  key: GoalKey;
  /** The section heading a person reads. Grouped by OUTCOME, never by module. */
  title: string;
  /** One readable line under the heading saying what this whole group is for. */
  blurb: string;
  icon: LucideIcon;
}

/** Goal groups in the order they appear down the gallery. "More" is always last —
 *  it catches any installed system automation this catalog has not named yet. */
export const GOAL_GROUPS: readonly GoalGroup[] = [
  {
    key: 'welcome',
    title: 'Welcome & grow',
    blurb: 'Greet new customers and accounts, and turn website enquiries into contacts.',
    icon: Sparkles,
  },
  {
    key: 'recover',
    title: 'Recover lost sales',
    blurb:
      'Gently bring back a sale that nearly slipped away — a left-behind cart or a payment that did not go through.',
    icon: LifeBuoy,
  },
  {
    key: 'retain',
    title: 'Keep customers coming back',
    blurb: 'Stay in touch after the sale so customers return, and learn how you are doing.',
    icon: Repeat,
  },
  {
    key: 'loyalty',
    title: 'Reward loyalty',
    blurb: 'Spot your best customers automatically so you can treat them well.',
    icon: Gift,
  },
  {
    key: 'getpaid',
    title: 'Get paid on time',
    blurb:
      'Remind customers before invoices are due, chase the ones that are late, and confirm payments.',
    icon: HandCoins,
  },
  {
    key: 'aftersale',
    title: 'Keep customers in the loop',
    blurb:
      'Send the routine updates people expect — deliveries, refunds, returns and subscription changes — without lifting a finger.',
    icon: Truck,
  },
  {
    key: 'stayontop',
    title: 'Stay on top of things',
    blurb:
      'Get a heads-up when something needs you — a big order, low stock, a new lead or an unanswered chat.',
    icon: Bell,
  },
  {
    key: 'audience',
    title: 'Grow your audience',
    blurb: 'Share what is new on your social accounts the moment you publish.',
    icon: Megaphone,
  },
  {
    key: 'more',
    title: 'More helpers',
    blurb: productCopy('automations.recipes.otherGroup', 'Other automations sparx set up for you.'),
    icon: LayoutGrid,
  },
];

/** Every goal key in display order — handy for building the grouped view. */
export const GOAL_ORDER: readonly GoalKey[] = GOAL_GROUPS.map((g) => g.key);

/* ── recipes ──────────────────────────────────────────────────────────────── */

export interface RecipeMeta {
  /** The exact `name` of the shipped system automation this describes. */
  name: string;
  goal: GoalKey;
  /** A friendly, jargon-free heading for the card (the seed name can be terse). */
  title: string;
  /** One plain-English line: what it does for the owner, present tense. */
  blurb: string;
  icon: LucideIcon;
  /** Which module hue the card's icon wears. Any registered module identity. */
  module: WorkbenchModule;
}

/** The curated recipes, one per shipped system automation we have named. Order
 *  within a goal group follows this array. */
export const RECIPES: readonly RecipeMeta[] = [
  /* ── Welcome & grow ─────────────────────────────────────────────────────── */
  {
    name: 'Welcome new customers',
    goal: 'welcome',
    title: 'Welcome new customers',
    blurb: 'Sends a warm welcome email the moment someone becomes a customer.',
    icon: UserPlus,
    module: 'crm',
  },
  {
    name: 'Handle form submissions',
    goal: 'welcome',
    title: 'Handle your website form submissions',
    blurb:
      'When someone fills in a form on your site, emails you, replies to them, and saves them as a contact.',
    icon: Inbox,
    module: 'cms',
  },
  {
    name: 'New B2B account onboarding task',
    goal: 'welcome',
    title: 'Onboard new wholesale accounts',
    blurb: 'Opens a to-do to get a new wholesale account set up and looked after.',
    icon: Users,
    module: 'b2b',
  },
  {
    name: 'B2B account approved',
    goal: 'welcome',
    title: 'Welcome approved wholesale accounts',
    blurb: 'Emails a wholesale account’s main contact once their account is approved.',
    icon: Building2,
    module: 'b2b',
  },

  /* ── Recover lost sales ─────────────────────────────────────────────────── */
  {
    name: 'Abandoned cart nudge',
    goal: 'recover',
    title: 'Remind shoppers about their cart',
    blurb: 'Emails a shopper a couple of hours after they leave items behind without checking out.',
    icon: ShoppingCart,
    module: 'commerce',
  },
  {
    name: 'Payment failed — email',
    goal: 'recover',
    title: 'Ask a shopper to retry a failed payment',
    blurb: 'Emails a customer when their payment does not go through, so they can try again.',
    icon: CreditCard,
    module: 'commerce',
  },
  {
    name: 'B2B quote expiring',
    goal: 'recover',
    title: 'Nudge before a quote expires',
    blurb: 'Reminds a wholesale customer when their quote is about to run out.',
    icon: Clock,
    module: 'b2b',
  },

  /* ── Keep customers coming back ─────────────────────────────────────────── */
  {
    name: 'Win back inactive customers',
    goal: 'retain',
    title: 'Win back quiet customers',
    blurb: 'Emails a customer who used to buy but has gone quiet for a while.',
    icon: Repeat,
    module: 'crm',
  },
  {
    name: 'Post-purchase review request',
    goal: 'retain',
    title: 'Ask happy customers for a review',
    blurb: 'Emails a customer a few days after their order arrives, asking how it went.',
    icon: Star,
    module: 'commerce',
  },
  {
    name: 'Chat satisfaction survey',
    goal: 'retain',
    title: 'Ask how a chat went',
    blurb: 'Emails a short survey shortly after a chat conversation is wrapped up.',
    icon: Smile,
    module: 'chat',
  },

  /* ── Reward loyalty ─────────────────────────────────────────────────────── */
  {
    name: 'Tag VIP customers',
    goal: 'loyalty',
    title: 'Flag your best customers as VIP',
    blurb: 'Labels a customer “VIP” once their total spend passes your threshold.',
    icon: Trophy,
    module: 'crm',
  },

  /* ── Get paid on time ───────────────────────────────────────────────────── */
  {
    name: 'Invoice reminder (3 days before due)',
    goal: 'getpaid',
    title: 'Remind before an invoice is due',
    blurb: 'Sends a friendly heads-up three days before an invoice needs paying.',
    icon: CalendarClock,
    module: 'invoicing',
  },
  {
    name: 'Invoice overdue (7 days)',
    goal: 'getpaid',
    title: 'Chase an invoice a week overdue',
    blurb: 'Emails the customer when an invoice is seven days past due.',
    icon: CircleAlert,
    module: 'invoicing',
  },
  {
    name: 'Invoice overdue (14 days — second notice)',
    goal: 'getpaid',
    title: 'Send a second overdue notice',
    blurb: 'Emails a firmer reminder when an invoice is two weeks past due.',
    icon: CircleAlert,
    module: 'invoicing',
  },
  {
    name: 'Invoice overdue (30 days — final notice)',
    goal: 'getpaid',
    title: 'Send a final overdue notice',
    blurb: 'Emails a final reminder when an invoice is a month past due.',
    icon: ShieldAlert,
    module: 'invoicing',
  },
  {
    name: 'Payment received — send receipt',
    goal: 'getpaid',
    title: 'Send a receipt when you are paid',
    blurb: 'Emails the customer a receipt as soon as an invoice is paid in full.',
    icon: Receipt,
    module: 'invoicing',
  },
  {
    name: 'Estimate approved — advance task',
    goal: 'getpaid',
    title: 'Follow up when a quote is approved',
    blurb: 'Opens a to-do to move things along once a customer approves a quote or estimate.',
    icon: ClipboardCheck,
    module: 'invoicing',
  },
  {
    name: 'B2B invoice due reminder',
    goal: 'getpaid',
    title: 'Remind wholesale accounts before due',
    blurb: 'Emails a wholesale account three days before a net-terms invoice is due.',
    icon: CalendarClock,
    module: 'b2b',
  },
  {
    name: 'B2B overdue escalation',
    goal: 'getpaid',
    title: 'Handle overdue wholesale accounts',
    blurb: 'Chases past-due wholesale invoices and puts an account on hold if they stay unpaid.',
    icon: ShieldAlert,
    module: 'b2b',
  },

  /* ── Keep customers in the loop ─────────────────────────────────────────── */
  {
    name: 'Order delivered — email',
    goal: 'aftersale',
    title: 'Tell customers their order arrived',
    blurb: 'Emails the customer once their order is marked delivered.',
    icon: PackageCheck,
    module: 'commerce',
  },
  {
    name: 'Order cancelled — email',
    goal: 'aftersale',
    title: 'Confirm a cancelled order',
    blurb: 'Emails the customer when their order is cancelled.',
    icon: PackageX,
    module: 'commerce',
  },
  {
    name: 'Order refunded — email',
    goal: 'aftersale',
    title: 'Confirm a refund by email',
    blurb: 'Emails the customer when you refund their order.',
    icon: RotateCcw,
    module: 'commerce',
  },
  {
    name: 'Refund issued — CRM note',
    goal: 'aftersale',
    title: 'Note refunds on the customer',
    blurb: 'Adds a note to the customer’s history whenever an order is refunded.',
    icon: StickyNote,
    module: 'crm',
  },
  {
    name: 'Return approved — email',
    goal: 'aftersale',
    title: 'Confirm an approved return',
    blurb: 'Emails the customer with next steps when you approve their return.',
    icon: Undo2,
    module: 'commerce',
  },
  {
    name: 'Return received — email',
    goal: 'aftersale',
    title: 'Confirm returned items arrived',
    blurb: 'Emails the customer once their returned items reach you.',
    icon: PackageOpen,
    module: 'commerce',
  },
  {
    name: 'Return refunded — email',
    goal: 'aftersale',
    title: 'Confirm a return refund',
    blurb: 'Emails the customer when a refund for their return is issued.',
    icon: CircleDollarSign,
    module: 'commerce',
  },
  {
    name: 'Subscription confirmed — email',
    goal: 'aftersale',
    title: 'Welcome new subscribers',
    blurb: 'Emails the customer when a new subscription starts.',
    icon: Repeat,
    module: 'commerce',
  },
  {
    name: 'Subscription renewed — email',
    goal: 'aftersale',
    title: 'Confirm a subscription renewal',
    blurb: 'Emails the customer each time their subscription renews and reorders.',
    icon: RotateCcw,
    module: 'commerce',
  },
  {
    name: 'Subscription payment failed — email',
    goal: 'aftersale',
    title: 'Flag a failed subscription payment',
    blurb: 'Emails the customer when a subscription renewal payment fails, so they can fix it.',
    icon: CreditCard,
    module: 'commerce',
  },
  {
    name: 'Subscription paused — email',
    goal: 'aftersale',
    title: 'Confirm a paused subscription',
    blurb: 'Emails the customer when their subscription is paused.',
    icon: CirclePause,
    module: 'commerce',
  },
  {
    name: 'Subscription resumed — email',
    goal: 'aftersale',
    title: 'Confirm a resumed subscription',
    blurb: 'Emails the customer when their subscription starts up again.',
    icon: CirclePlay,
    module: 'commerce',
  },
  {
    name: 'Subscription cancelled — email',
    goal: 'aftersale',
    title: 'Confirm a cancelled subscription',
    blurb: 'Emails the customer when their subscription is cancelled.',
    icon: CircleX,
    module: 'commerce',
  },
  {
    name: 'B2B order approved — email',
    goal: 'aftersale',
    title: 'Tell buyers an order is approved',
    blurb: 'Emails a wholesale buyer when their pending order is approved.',
    icon: CircleCheck,
    module: 'b2b',
  },
  {
    name: 'B2B order rejected — email',
    goal: 'aftersale',
    title: 'Tell buyers an order was not approved',
    blurb: 'Emails a wholesale buyer when their pending order is not approved.',
    icon: CircleX,
    module: 'b2b',
  },
  {
    name: 'B2B quote received',
    goal: 'aftersale',
    title: 'Send wholesale quotes to buyers',
    blurb: 'Emails a wholesale customer their quote details when a quote is submitted.',
    icon: FileText,
    module: 'b2b',
  },

  /* ── Stay on top of things ──────────────────────────────────────────────── */
  {
    name: 'High-value order alert',
    goal: 'stayontop',
    title: 'Alert me to big orders',
    blurb: 'Emails your team when a large order comes in and is paid.',
    icon: BellRing,
    module: 'commerce',
  },
  {
    name: 'Low inventory alert',
    goal: 'stayontop',
    title: 'Warn me when stock runs low',
    blurb: 'Emails your team when a product is running low so you can restock.',
    icon: PackageMinus,
    module: 'commerce',
  },
  {
    name: 'Auto-reorder low stock',
    goal: 'stayontop',
    title: 'Auto-draft restock orders',
    blurb:
      'Drafts a purchase order to your supplier when a product hits its reorder point — you review and send it.',
    icon: PackagePlus,
    module: 'inventory',
  },
  {
    name: 'New lead follow-up task',
    goal: 'stayontop',
    title: 'Follow up with new leads',
    blurb: 'Opens a follow-up to-do, due tomorrow, whenever a new sales lead comes in.',
    icon: ListChecks,
    module: 'crm',
  },
  {
    name: 'Deal won — create invoice task',
    goal: 'stayontop',
    title: 'Invoice a won deal',
    blurb: 'Opens a to-do to raise the invoice as soon as a deal is marked won.',
    icon: Trophy,
    module: 'crm',
  },
  {
    name: 'Unresponded chat alert',
    goal: 'stayontop',
    title: 'Alert me to unanswered chats',
    blurb: 'Emails your team when a live chat has gone unanswered for a few minutes.',
    icon: MessageSquareWarning,
    module: 'chat',
  },
  {
    name: 'Notify — payment failed',
    goal: 'stayontop',
    title: 'Notify me of failed payments',
    blurb: 'Shows you a notification when a customer’s payment fails.',
    icon: BellRing,
    module: 'commerce',
  },
  {
    name: 'Notify — out of stock',
    goal: 'stayontop',
    title: 'Notify me when something sells out',
    blurb: 'Shows you a notification when a product runs out of stock.',
    icon: PackageX,
    module: 'inventory',
  },
  {
    name: 'Notify — subscription payment failed',
    goal: 'stayontop',
    title: 'Notify me of failed subscription payments',
    blurb: 'Shows you a notification when a subscription renewal payment fails.',
    icon: Bell,
    module: 'commerce',
  },

  /* ── Grow your audience ─────────────────────────────────────────────────── */
  {
    name: 'Announce new product',
    goal: 'audience',
    title: 'Announce new products on social',
    blurb: 'Drafts a social post when you publish a new product, ready for you to review.',
    icon: Tag,
    module: 'social',
  },
  {
    name: 'Announce new blog post',
    goal: 'audience',
    title: 'Announce new articles on social',
    blurb: 'Drafts a social post when you publish a new article, ready for you to review.',
    icon: Newspaper,
    module: 'social',
  },
];

const RECIPE_BY_NAME = new Map<string, RecipeMeta>(RECIPES.map((r) => [r.name, r]));

/** The curated recipe for a shipped automation, matched on its exact `name`, or
 *  `undefined` when this catalog has not named that automation yet (it then falls
 *  into the "More" group with its own server-set description). */
export function recipeMetaFor(name: string): RecipeMeta | undefined {
  return RECIPE_BY_NAME.get(name);
}

// A total map from every goal key to its group — so the lookup below is exhaustive
// (a Record over the finite key union has no undefined branch to guard).
const GOAL_BY_KEY = Object.fromEntries(GOAL_GROUPS.map((g) => [g.key, g])) as Record<
  GoalKey,
  GoalGroup
>;

/** The goal group's presentation for a key — total over the finite key union. */
export function goalGroup(key: GoalKey): GoalGroup {
  return GOAL_BY_KEY[key];
}
