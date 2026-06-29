import * as React from 'react';
import {
  AlertTriangle,
  Banknote,
  Bot,
  Boxes,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  Eye,
  FileText,
  Mail,
  Megaphone,
  Package,
  Percent,
  Receipt,
  Repeat,
  Search,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

// Maps the data layer's string icon keys (KPIs, alerts, activity) to lucide
// icons, so builders stay JSX-free. Unknown keys fall back to a neutral dot.

const MAP: Record<string, LucideIcon> = {
  // KPIs
  revenue: CircleDollarSign,
  orders: ShoppingCart,
  conversion: Percent,
  aov: Receipt,
  visitors: Users,
  pageviews: Eye,
  collected: Banknote,
  leads: TrendingUp,
  mrr: Repeat,
  subscribers: Mail,
  // alerts
  stock: Package,
  invoice: Receipt,
  cart: ShoppingCart,
  approval: ClipboardCheck,
  b2b: Building2,
  task: AlertTriangle,
  automation: Bot,
  seo: Search,
  // module / activity
  commerce: ShoppingBag,
  cms: FileText,
  inventory: Boxes,
  email: Megaphone,
  crm: Users,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = MAP[name] ?? TrendingUp;
  return <Cmp className={className ?? 'h-4 w-4'} aria-hidden />;
}
