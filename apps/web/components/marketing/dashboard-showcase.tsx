import { SparxMark } from '@sparx/ui';
import {
  BarChart3,
  Boxes,
  Briefcase,
  Building2,
  CheckSquare,
  ChevronDown,
  Clock,
  Component,
  Copy,
  CornerUpRight,
  CreditCard,
  Database,
  Eye,
  File,
  FileText,
  Filter,
  Fingerprint,
  FolderTree,
  Gauge,
  Gift,
  Globe,
  Heart,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Inbox,
  LayoutGrid,
  LayoutTemplate,
  List,
  type LucideIcon,
  Mail,
  MoreHorizontal,
  Moon,
  Navigation,
  Package,
  Package2,
  Percent,
  Plug,
  Plus,
  Receipt,
  RefreshCw,
  Repeat2,
  Scale,
  Search,
  Send,
  Settings,
  Settings2,
  ShieldOff,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Tags,
  Truck,
  User,
  Users,
  Wallet,
  Warehouse,
  Webhook,
  Workflow,
} from 'lucide-react';

// Faithful recreation of the real dashboard shell (apps/dashboard): the thin
// gray icon rail + contextual panel + top bar + page bodies. Navigation is
// stateless — one hidden radio per *page* (a module overview, or one of its
// marquee section list pages) drives everything through CSS `:has()`: it
// recolors `--m`, swaps the visible panel + main page, and moves the rail and
// section highlights. No `useState`, so this stays a Server Component. Module
// colors, icons (lucide, same as the app), and section names mirror the
// manifests; the marquee sections render the dashboard's list archetype
// (PageHeader → toolbar → table) with sample data.

const TENANT = 'Lumen & Co.';

interface Stat {
  label: string;
  value: string;
  delta: string;
  up: boolean;
  icon: LucideIcon;
}

interface Column {
  label: string;
  kind?: 'title' | 'badge' | 'num';
}

interface ListPage {
  slug: string;
  label: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  primary: string;
  count: string;
  filters: string[];
  columns: Column[];
  // Each cell is a string. A `title` column may carry a "\n" to split the
  // bold primary line from a muted sub-line.
  rows: string[][];
}

interface SectionItem {
  label: string;
  icon: LucideIcon;
  // Present = the item links to a page (`overview` or a list slug); absent =
  // inert (a faithful label that simply doesn't navigate).
  slug?: string;
}

interface ModuleDef {
  key: string;
  label: string;
  color: string;
  tint: string;
  text: string;
  icon: LucideIcon;
  page: { title: string; desc: string; primary: string };
  sections: SectionItem[];
  stats: Stat[];
  charts: { title: string; sub: string }[];
  cards: { desc: string; name: string }[];
  lists: ListPage[];
}

const MODULES: ModuleDef[] = [
  {
    key: 'builder',
    label: 'Builder',
    color: '#6366F1',
    tint: '#EEF2FF',
    text: '#4338CA',
    icon: Boxes,
    page: { title: 'Builder', desc: '2 properties · last 14 days', primary: 'New page' },
    sections: [
      { label: 'Overview', icon: Boxes, slug: 'overview' },
      { label: 'Brand', icon: Fingerprint },
      { label: 'Site', icon: Globe, slug: 'site' },
      { label: 'Page', icon: File, slug: 'page' },
      { label: 'Email', icon: Mail },
      { label: 'Components', icon: Component, slug: 'component' },
    ],
    stats: [
      { label: 'Published', value: '24', delta: '+3 this week', up: true, icon: File },
      { label: 'Avg load', value: '<50ms', delta: 'edge cached', up: false, icon: Gauge },
      { label: 'Properties', value: '2', delta: 'one back office', up: false, icon: Boxes },
      { label: 'Uptime', value: '99.9%', delta: 'last 30 days', up: false, icon: BarChart3 },
    ],
    charts: [
      { title: 'Page views', sub: 'Across properties, 14d' },
      { title: 'Publishes', sub: 'Changes shipped, 14d' },
    ],
    cards: [
      { desc: 'Drafts & live, per property', name: 'Pages' },
      { desc: 'Header, footer, layouts', name: 'Site' },
      { desc: 'Logo, colors, type', name: 'Brand' },
    ],
    lists: [
      {
        slug: 'page',
        label: 'Page',
        icon: File,
        title: 'Pages',
        desc: 'Drafts and live pages across your properties. Draft → Publish ships to the live site.',
        primary: 'New page',
        count: '24 pages',
        filters: ['Status', 'Property'],
        columns: [
          { label: 'Title', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Property' },
          { label: 'Updated' },
        ],
        rows: [
          ['Home\n/', 'Published', 'Main site', '2h ago'],
          ['About\n/about', 'Published', 'Main site', 'Yesterday'],
          ['Spring Lookbook\n/lookbook', 'Draft', 'Main site', '3d ago'],
          ['Wholesale\n/wholesale', 'Published', 'Trade portal', 'Jun 1'],
          ['Contact\n/contact', 'Published', 'Main site', 'May 28'],
        ],
      },
      {
        slug: 'site',
        label: 'Site',
        icon: Globe,
        title: 'Site',
        desc: 'Layouts, header, footer, and navigation. One layout is live at a time.',
        primary: 'New layout',
        count: '3 layouts',
        filters: ['Status'],
        columns: [
          { label: 'Layout', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Pages', kind: 'num' },
          { label: 'Updated' },
        ],
        rows: [
          ['Default\nHeader · footer · sidebar', 'Live', '18', '2h ago'],
          ['Campaign\nFull-bleed hero', 'Draft', '3', 'Yesterday'],
          ['Minimal\nNo sidebar', 'Draft', '1', 'May 30'],
        ],
      },
      {
        slug: 'component',
        label: 'Components',
        icon: Component,
        title: 'Components',
        desc: 'Reusable building blocks — system primitives plus your own saved components.',
        primary: 'New component',
        count: '32 components',
        filters: ['Type', 'Source'],
        columns: [
          { label: 'Name', kind: 'title' },
          { label: 'Type' },
          { label: 'Version' },
          { label: 'Used on', kind: 'num' },
        ],
        rows: [
          ['Hero banner\ncustom:hero', 'Section', 'v3', '12'],
          ['Product grid\ncustom:grid', 'Section', 'v2', '8'],
          ['Newsletter signup\ncustom:signup', 'Block', 'v1', '6'],
          ['Testimonial\ncustom:quote', 'Block', 'v4', '4'],
        ],
      },
    ],
  },
  {
    key: 'commerce',
    label: 'Commerce',
    color: '#F97316',
    tint: '#FFF7ED',
    text: '#C2410C',
    icon: ShoppingCart,
    page: { title: 'Commerce', desc: 'Last 30 days', primary: 'New product' },
    sections: [
      { label: 'Overview', icon: ShoppingCart, slug: 'overview' },
      { label: 'Products', icon: Package, slug: 'products' },
      { label: 'Categories', icon: FolderTree },
      { label: 'Collections', icon: LayoutGrid },
      { label: 'Pricing', icon: Tag, slug: 'pricing' },
      { label: 'Discounts', icon: Percent, slug: 'discounts' },
      { label: 'Inventory', icon: Boxes, slug: 'inventory' },
      { label: 'Warehouses', icon: Warehouse },
      { label: 'Bundles', icon: Package2 },
      { label: 'Configurator', icon: Settings2 },
      { label: 'Gift cards', icon: Gift },
      { label: 'Account credit', icon: Wallet },
      { label: 'Carts', icon: ShoppingCart },
      { label: 'Checkout sessions', icon: CreditCard },
      { label: 'Subscriptions', icon: Repeat2 },
      { label: 'Returns', icon: Inbox },
      { label: 'Reviews', icon: Star },
      { label: 'Q&A', icon: HelpCircle },
      { label: 'Wishlists', icon: Heart },
      { label: 'Reports', icon: BarChart3 },
      { label: 'Shipping', icon: Truck },
      { label: 'Tax', icon: Receipt },
      { label: 'Providers', icon: Plug },
      { label: 'Settings', icon: Settings2 },
    ],
    stats: [
      { label: 'Net revenue', value: '$48,291', delta: '+8% MoM', up: true, icon: Receipt },
      { label: 'Orders', value: '284', delta: '+12 today', up: true, icon: Package },
      { label: 'Conversion', value: '3.2%', delta: '+0.4 pt', up: true, icon: Percent },
      { label: 'Avg order', value: '$170', delta: '+6%', up: true, icon: Tag },
    ],
    charts: [
      { title: 'Revenue', sub: 'Net revenue, last 14 days' },
      { title: 'Orders', sub: 'Orders placed, last 14 days' },
    ],
    cards: [
      { desc: 'Variants, images, SEO', name: 'Products' },
      { desc: 'Stock across warehouses', name: 'Inventory' },
      { desc: 'Price lists, B2B tiers', name: 'Pricing' },
    ],
    lists: [
      {
        slug: 'products',
        label: 'Products',
        icon: Package,
        title: 'Products',
        desc: 'Your catalog. Variants, options, and fitment hang off each product. Draft → Active publishes to the site.',
        primary: 'New product',
        count: '284 products',
        filters: ['Status', 'Vendor', 'Type'],
        columns: [
          { label: 'Title', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Vendor' },
          { label: 'Variants', kind: 'num' },
          { label: 'Price', kind: 'num' },
          { label: 'Updated' },
        ],
        rows: [
          ['Trail Tee\n/trail-tee', 'Active', 'Lumen', '3', '$28', '2h ago'],
          ['Summit Hoodie\n/summit-hoodie', 'Active', 'Lumen', '5', '$64', 'Yesterday'],
          ['Field Cap\n/field-cap', 'Draft', 'Northwind', '2', '$22', '3d ago'],
          ['Canvas Tote\n/canvas-tote', 'Active', 'Lumen', '1', '$18', 'Jun 1'],
          ['Wool Beanie\n/wool-beanie', 'Archived', 'Northwind', '4', '$24', 'May 20'],
        ],
      },
      {
        slug: 'pricing',
        label: 'Pricing',
        icon: Tag,
        title: 'Pricing',
        desc: 'Price lists and B2B tiers. Assign a list to a customer group for per-account pricing.',
        primary: 'New price list',
        count: '6 price lists',
        filters: ['Currency', 'Group'],
        columns: [
          { label: 'Name', kind: 'title' },
          { label: 'Type' },
          { label: 'Customers', kind: 'num' },
          { label: 'Items', kind: 'num' },
          { label: 'Updated' },
        ],
        rows: [
          ['Retail (USD)\nDefault list', 'Base', '—', '284', '2h ago'],
          ['Wholesale tier 1\nNet-30', 'Group', '12', '284', 'Yesterday'],
          ['Wholesale tier 2\nNet-60', 'Group', '4', '284', 'Jun 2'],
          ['VIP\nFlat 15% off', 'Group', '38', '284', 'May 29'],
        ],
      },
      {
        slug: 'discounts',
        label: 'Discounts',
        icon: Percent,
        title: 'Discounts',
        desc: 'Codes and automatic promotions. Stack rules and limits control how they combine.',
        primary: 'New discount',
        count: '9 active',
        filters: ['Status', 'Type'],
        columns: [
          { label: 'Code', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Type' },
          { label: 'Used', kind: 'num' },
          { label: 'Ends' },
        ],
        rows: [
          ['SPRING20\n20% off order', 'Active', 'Code', '142', 'Jun 30'],
          ['FREESHIP\nFree shipping', 'Active', 'Automatic', '310', '—'],
          ['WELCOME10\n10% first order', 'Active', 'Code', '88', '—'],
          ['BUNDLE5\nBuy 3 save 5%', 'Scheduled', 'Automatic', '0', 'Jul 1'],
        ],
      },
      {
        slug: 'inventory',
        label: 'Inventory',
        icon: Boxes,
        title: 'Inventory',
        desc: 'Stock on hand across warehouses. Low-stock thresholds trigger reorder alerts.',
        primary: 'Adjust stock',
        count: '284 tracked',
        filters: ['Warehouse', 'Status'],
        columns: [
          { label: 'SKU', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Warehouse' },
          { label: 'On hand', kind: 'num' },
          { label: 'Committed', kind: 'num' },
        ],
        rows: [
          ['TRL-TEE-M\nTrail Tee · M', 'In stock', 'Main', '420', '12'],
          ['SUM-HOOD-L\nSummit Hoodie · L', 'Low stock', 'Main', '8', '3'],
          ['FLD-CAP-OS\nField Cap', 'In stock', 'West', '210', '0'],
          ['CNV-TOTE\nCanvas Tote', 'Out of stock', 'Main', '0', '5'],
          ['WOL-BEAN\nWool Beanie', 'In stock', 'West', '96', '1'],
        ],
      },
    ],
  },
  {
    key: 'cms',
    label: 'CMS',
    color: '#14B8A6',
    tint: '#F0FDFA',
    text: '#0F766E',
    icon: FileText,
    page: { title: 'CMS', desc: 'Last 30 days', primary: 'New post' },
    sections: [
      { label: 'Overview', icon: FileText, slug: 'overview' },
      { label: 'Content', icon: FileText, slug: 'content' },
      { label: 'Content types', icon: Database },
      { label: 'Navigation', icon: Navigation },
      { label: 'Media', icon: ImageIcon, slug: 'media' },
      { label: 'Authors', icon: User, slug: 'authors' },
      { label: 'Taxonomy', icon: Tags },
      { label: 'Redirects', icon: CornerUpRight },
      { label: 'Legal', icon: Scale },
      { label: 'Webhooks', icon: Webhook },
    ],
    stats: [
      { label: 'Readers', value: '2,480', delta: '+38%', up: true, icon: Eye },
      { label: 'Avg SEO', value: '94', delta: '12 posts', up: false, icon: Gauge },
      { label: 'Subscribers', value: '1,204', delta: '+38 new', up: true, icon: Users },
      { label: 'Posts', value: '86', delta: 'published', up: false, icon: FileText },
    ],
    charts: [
      { title: 'Readers', sub: 'Unique readers, 14d' },
      { title: 'Posts', sub: 'Published, last 14 days' },
    ],
    cards: [
      { desc: 'Posts, pages, entries', name: 'Content' },
      { desc: 'Images & files', name: 'Media' },
      { desc: 'Model your fields', name: 'Content types' },
    ],
    lists: [
      {
        slug: 'content',
        label: 'Content',
        icon: FileText,
        title: 'Content',
        desc: 'Posts, pages, and custom entries. Each entry type carries its own fields and template.',
        primary: 'New post',
        count: '86 entries',
        filters: ['Type', 'Status', 'Author'],
        columns: [
          { label: 'Title', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Type' },
          { label: 'Author' },
          { label: 'Updated' },
        ],
        rows: [
          [
            'Field Notes: Spring\n/blog/field-notes-spring',
            'Published',
            'Post',
            'A. Rivera',
            '2h ago',
          ],
          ['Our Materials\n/pages/materials', 'Published', 'Page', 'M. Chen', 'Yesterday'],
          ['Trail Care Guide\n/blog/trail-care', 'Draft', 'Post', 'A. Rivera', '3d ago'],
          ['Sizing\n/pages/sizing', 'Published', 'Page', 'M. Chen', 'Jun 1'],
          ['Summer Preview\n/blog/summer-preview', 'Scheduled', 'Post', 'J. Park', 'Jul 1'],
        ],
      },
      {
        slug: 'media',
        label: 'Media',
        icon: ImageIcon,
        title: 'Media',
        desc: 'Images and files. Alt text and focal points carry through every surface that uses them.',
        primary: 'Upload',
        count: '512 files',
        filters: ['Type', 'Folder'],
        columns: [
          { label: 'File', kind: 'title' },
          { label: 'Type' },
          { label: 'Size', kind: 'num' },
          { label: 'Used on', kind: 'num' },
          { label: 'Added' },
        ],
        rows: [
          ['hero-spring.jpg\n2400×1600', 'JPEG', '842 KB', '4', '2h ago'],
          ['trail-tee.png\n1200×1200', 'PNG', '310 KB', '2', 'Yesterday'],
          ['lookbook.pdf\nSpring 2026', 'PDF', '3.1 MB', '1', '3d ago'],
          ['logo-mark.svg\nVector', 'SVG', '12 KB', '—', 'May 12'],
        ],
      },
      {
        slug: 'authors',
        label: 'Authors',
        icon: User,
        title: 'Authors',
        desc: 'Bylines for your content. Each author carries a bio, avatar, and social links.',
        primary: 'New author',
        count: '5 authors',
        filters: ['Role'],
        columns: [
          { label: 'Name', kind: 'title' },
          { label: 'Role' },
          { label: 'Posts', kind: 'num' },
          { label: 'Updated' },
        ],
        rows: [
          ['Ana Rivera\nana@lumen.co', 'Editor', '34', '2h ago'],
          ['Marcus Chen\nmarcus@lumen.co', 'Writer', '22', 'Yesterday'],
          ['Jordan Park\njordan@lumen.co', 'Writer', '18', 'Jun 1'],
          ['Sam Lee\nsam@lumen.co', 'Contributor', '12', 'May 20'],
        ],
      },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    color: '#06B6D4',
    tint: '#ECFEFF',
    text: '#0E7490',
    icon: Users,
    page: { title: 'CRM', desc: '1,204 customers', primary: 'New customer' },
    sections: [
      { label: 'Overview', icon: Users, slug: 'overview' },
      { label: 'Customers', icon: Users, slug: 'customers' },
      { label: 'B2B accounts', icon: Building2 },
      { label: 'Deals', icon: Briefcase, slug: 'deals' },
      { label: 'Pipelines', icon: Workflow },
      { label: 'Quotes', icon: FileText },
      { label: 'Orders', icon: Receipt, slug: 'orders' },
      { label: 'Segments', icon: Filter, slug: 'segments' },
      { label: 'Tasks', icon: CheckSquare },
      { label: 'Reports', icon: BarChart3 },
      { label: 'Duplicates', icon: Copy },
    ],
    stats: [
      { label: 'Customers', value: '1,204', delta: '+46 this week', up: true, icon: Users },
      { label: 'Open deals', value: '12', delta: 'in pipeline', up: false, icon: Briefcase },
      { label: 'Pipeline', value: '$84k', delta: '+11%', up: true, icon: BarChart3 },
      { label: 'Segments', value: '8', delta: 'materialized', up: false, icon: Filter },
    ],
    charts: [
      { title: 'New customers', sub: 'Added, last 14 days' },
      { title: 'Deals', sub: 'Won, last 14 days' },
    ],
    cards: [
      { desc: 'People & companies', name: 'Customers' },
      { desc: 'Pipeline & quotes', name: 'Deals' },
      { desc: 'Materialized lists', name: 'Segments' },
    ],
    lists: [
      {
        slug: 'customers',
        label: 'Customers',
        icon: Users,
        title: 'Customers',
        desc: 'People and companies. The one customer record every module reads from.',
        primary: 'New customer',
        count: '1,204 customers',
        filters: ['Type', 'Segment', 'Status'],
        columns: [
          { label: 'Name', kind: 'title' },
          { label: 'Type' },
          { label: 'Orders', kind: 'num' },
          { label: 'Lifetime', kind: 'num' },
          { label: 'Added' },
        ],
        rows: [
          ['Dana Whitfield\ndana@example.com', 'Person', '12', '$1,840', '2h ago'],
          ['Northwind Supply\nbuyer@northwind.co', 'Company', '46', '$28,400', 'Yesterday'],
          ['Priya Anand\npriya@example.com', 'Person', '3', '$420', '3d ago'],
          ['Ridgeline Co.\nops@ridgeline.io', 'Company', '19', '$9,210', 'Jun 1'],
          ['Tom Becker\ntom@example.com', 'Person', '1', '$64', 'May 30'],
        ],
      },
      {
        slug: 'deals',
        label: 'Deals',
        icon: Briefcase,
        title: 'Deals',
        desc: 'Opportunities moving through your pipeline. Advance a deal to its next stage.',
        primary: 'New deal',
        count: '12 open',
        filters: ['Pipeline', 'Stage', 'Owner'],
        columns: [
          { label: 'Deal', kind: 'title' },
          { label: 'Stage', kind: 'badge' },
          { label: 'Owner' },
          { label: 'Value', kind: 'num' },
          { label: 'Close' },
        ],
        rows: [
          ['Northwind Q3 reorder\nNorthwind Supply', 'Proposal', 'A. Rivera', '$12,400', 'Jun 20'],
          ['Ridgeline fleet\nRidgeline Co.', 'Negotiation', 'J. Park', '$28,000', 'Jun 28'],
          ['Summit wholesale\nSummit Outfitters', 'Won', 'A. Rivera', '$8,600', 'Jun 5'],
          ['Trailhead pilot\nTrailhead Gear', 'New', 'M. Chen', '$3,200', 'Jul 10'],
        ],
      },
      {
        slug: 'orders',
        label: 'Orders',
        icon: Receipt,
        title: 'Orders',
        desc: 'Every order across channels. Fulfilment, payment, and returns roll up here.',
        primary: 'New order',
        count: '284 orders',
        filters: ['Status', 'Channel'],
        columns: [
          { label: 'Order', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Customer' },
          { label: 'Total', kind: 'num' },
          { label: 'Placed' },
        ],
        rows: [
          ['#1042\n3 items', 'Paid', 'Dana Whitfield', '$92', '2h ago'],
          ['#1041\n12 items', 'Paid', 'Northwind Supply', '$1,240', 'Yesterday'],
          ['#1040\n1 item', 'Refunded', 'Priya Anand', '$28', '3d ago'],
          ['#1039\n5 items', 'Paid', 'Ridgeline Co.', '$410', 'Jun 1'],
          ['#1038\n2 items', 'Pending', 'Tom Becker', '$56', 'Jun 1'],
        ],
      },
      {
        slug: 'segments',
        label: 'Segments',
        icon: Filter,
        title: 'Segments',
        desc: 'Materialized customer lists. Rules recompute membership as data changes.',
        primary: 'New segment',
        count: '8 segments',
        filters: ['Type'],
        columns: [
          { label: 'Segment', kind: 'title' },
          { label: 'Type' },
          { label: 'Members', kind: 'num' },
          { label: 'Updated' },
        ],
        rows: [
          ['VIP buyers\nLifetime > $1k', 'Dynamic', '38', '2h ago'],
          ['Wholesale\nB2B accounts', 'Dynamic', '37', 'Yesterday'],
          ['Lapsed 90d\nNo order in 90 days', 'Dynamic', '142', 'Jun 1'],
          ['Newsletter\nOpted in', 'Static', '1,204', 'May 28'],
        ],
      },
    ],
  },
  {
    key: 'email',
    label: 'Email',
    color: '#0EA5E9',
    tint: '#F0F9FF',
    text: '#0369A1',
    icon: Send,
    page: { title: 'Email', desc: 'Last 30 days', primary: 'New broadcast' },
    sections: [
      { label: 'Overview', icon: Send, slug: 'overview' },
      { label: 'Broadcasts', icon: Send, slug: 'broadcasts' },
      { label: 'Automations', icon: Workflow, slug: 'automations' },
      { label: 'Templates', icon: LayoutTemplate, slug: 'templates' },
      { label: 'Suppressions', icon: ShieldOff },
      { label: 'Sending domains', icon: Globe },
      { label: 'Settings', icon: Settings },
    ],
    stats: [
      { label: 'Sent', value: '18,420', delta: '4 broadcasts', up: false, icon: Send },
      { label: 'Open rate', value: '41%', delta: '+3 pts', up: true, icon: Eye },
      { label: 'Click rate', value: '6.2%', delta: '2.6% avg', up: true, icon: Percent },
      { label: 'Subscribers', value: '9,310', delta: '+1.2k', up: true, icon: Users },
    ],
    charts: [
      { title: 'Opens', sub: 'Across sends, 14d' },
      { title: 'Sends', sub: 'Emails sent, last 14 days' },
    ],
    cards: [
      { desc: 'One-off sends', name: 'Broadcasts' },
      { desc: 'Triggered flows', name: 'Automations' },
      { desc: 'Reusable designs', name: 'Templates' },
    ],
    lists: [
      {
        slug: 'broadcasts',
        label: 'Broadcasts',
        icon: Send,
        title: 'Broadcasts',
        desc: 'One-off campaigns. Build in the Email Builder, then send to a segment.',
        primary: 'New broadcast',
        count: '4 this month',
        filters: ['Status'],
        columns: [
          { label: 'Campaign', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Audience' },
          { label: 'Open', kind: 'num' },
          { label: 'Sent' },
        ],
        rows: [
          ['Spring Launch\nField Notes', 'Sent', 'All subscribers', '44%', '2h ago'],
          ['VIP Early Access\nLookbook', 'Sent', 'VIP buyers', '61%', 'Yesterday'],
          ['Restock Alert\nSummit Hoodie', 'Scheduled', 'Lapsed 90d', '—', 'Jun 12'],
          ['June Newsletter\nMonthly', 'Draft', 'Newsletter', '—', '—'],
        ],
      },
      {
        slug: 'automations',
        label: 'Automations',
        icon: Workflow,
        title: 'Automations',
        desc: 'Triggered flows. An event starts the flow; steps wait, branch, and send.',
        primary: 'New automation',
        count: '6 live',
        filters: ['Status', 'Trigger'],
        columns: [
          { label: 'Flow', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Trigger' },
          { label: 'In flow', kind: 'num' },
          { label: 'Updated' },
        ],
        rows: [
          ['Welcome series\n3 emails', 'Live', 'Signup', '142', '2h ago'],
          ['Abandoned cart\n2 emails', 'Live', 'Cart idle 1h', '38', 'Yesterday'],
          ['Post-purchase\n1 email', 'Live', 'Order paid', '96', 'Jun 1'],
          ['Win-back\n2 emails', 'Paused', 'No order 90d', '0', 'May 20'],
        ],
      },
      {
        slug: 'templates',
        label: 'Templates',
        icon: LayoutTemplate,
        title: 'Templates',
        desc: 'Reusable email designs. Built from atomic blocks so brand stays consistent.',
        primary: 'New template',
        count: '11 templates',
        filters: ['Type'],
        columns: [
          { label: 'Name', kind: 'title' },
          { label: 'Type' },
          { label: 'Used by', kind: 'num' },
          { label: 'Updated' },
        ],
        rows: [
          ['Newsletter\nMonthly layout', 'Marketing', '4', '2h ago'],
          ['Receipt\nOrder confirmation', 'Transactional', '1', 'Yesterday'],
          ['Shipping update\nIn transit', 'Transactional', '1', 'Jun 1'],
          ['Announcement\nFull-bleed', 'Marketing', '2', 'May 28'],
        ],
      },
    ],
  },
  {
    key: 'b2b',
    label: 'B2B',
    color: '#475569',
    tint: '#F1F5F9',
    text: '#334155',
    icon: Building2,
    page: { title: 'B2B', desc: '37 accounts · Net-30', primary: 'New quote' },
    sections: [
      { label: 'Overview', icon: Building2, slug: 'overview' },
      { label: 'Accounts', icon: Building2, slug: 'accounts' },
      { label: 'Price lists', icon: Tag, slug: 'price-lists' },
      { label: 'Quotes', icon: FileText, slug: 'quotes' },
      { label: 'Net terms', icon: Receipt },
      { label: 'Approvals', icon: CheckSquare },
    ],
    stats: [
      { label: 'Open quotes', value: '9', delta: '$42k', up: false, icon: Receipt },
      { label: 'Accounts', value: '37', delta: 'on terms', up: false, icon: Building2 },
      { label: 'Avg PO', value: '$576', delta: '+12 items', up: true, icon: Package },
      { label: 'Net terms', value: '$42k', delta: 'outstanding', up: false, icon: Tag },
    ],
    charts: [
      { title: 'Quote value', sub: 'Issued, last 14 days' },
      { title: 'Purchase orders', sub: 'Received, 14d' },
    ],
    cards: [
      { desc: 'Companies & contacts', name: 'Accounts' },
      { desc: 'Per-account pricing', name: 'Price lists' },
      { desc: 'Invoices & approvals', name: 'Net terms' },
    ],
    lists: [
      {
        slug: 'accounts',
        label: 'Accounts',
        icon: Building2,
        title: 'Accounts',
        desc: 'Companies buying on terms. Each carries contacts, a price list, and a credit limit.',
        primary: 'New account',
        count: '37 accounts',
        filters: ['Terms', 'Status'],
        columns: [
          { label: 'Account', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Terms' },
          { label: 'Open AR', kind: 'num' },
          { label: 'Added' },
        ],
        rows: [
          ['Northwind Supply\n3 buyers', 'Active', 'Net-30', '$4,200', '2h ago'],
          ['Ridgeline Co.\n2 buyers', 'Active', 'Net-60', '$12,800', 'Yesterday'],
          ['Summit Outfitters\n1 buyer', 'Active', 'Net-30', '$0', 'Jun 1'],
          ['Trailhead Gear\n2 buyers', 'Hold', 'Net-30', '$1,640', 'May 28'],
        ],
      },
      {
        slug: 'quotes',
        label: 'Quotes',
        icon: FileText,
        title: 'Quotes',
        desc: 'Draft pricing for an account. An accepted quote converts straight to an order.',
        primary: 'New quote',
        count: '9 open',
        filters: ['Status', 'Account'],
        columns: [
          { label: 'Quote', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Account' },
          { label: 'Value', kind: 'num' },
          { label: 'Expires' },
        ],
        rows: [
          ['Q-2041\n12 items', 'Quoted', 'Northwind Supply', '$12,400', 'Jun 20'],
          ['Q-2040\n6 items', 'Draft', 'Ridgeline Co.', '$8,000', '—'],
          ['Q-2039\n3 items', 'Accepted', 'Summit Outfitters', '$3,200', 'Jun 5'],
          ['Q-2038\n20 items', 'Expired', 'Trailhead Gear', '$5,600', 'May 30'],
        ],
      },
      {
        slug: 'price-lists',
        label: 'Price lists',
        icon: Tag,
        title: 'Price lists',
        desc: 'Per-account and per-tier pricing. Assign a list to a group and it follows every order.',
        primary: 'New price list',
        count: '4 lists',
        filters: ['Currency'],
        columns: [
          { label: 'Name', kind: 'title' },
          { label: 'Tier' },
          { label: 'Accounts', kind: 'num' },
          { label: 'Items', kind: 'num' },
        ],
        rows: [
          ['Tier 1\nNet-30', 'Standard', '12', '284'],
          ['Tier 2\nNet-60', 'Volume', '4', '284'],
          ['Contract — Ridgeline\nCustom', 'Custom', '1', '284'],
          ['Retail\nDefault', 'Base', '—', '284'],
        ],
      },
    ],
  },
  {
    key: 'dropship',
    label: 'Dropship',
    color: '#10B981',
    tint: '#ECFDF5',
    text: '#047857',
    icon: Truck,
    page: { title: 'Dropship', desc: '6 suppliers · 3 regions', primary: 'Add supplier' },
    sections: [
      { label: 'Overview', icon: Truck, slug: 'overview' },
      { label: 'Suppliers', icon: Truck, slug: 'suppliers' },
      { label: 'Catalog', icon: Package, slug: 'catalog' },
      { label: 'Routing', icon: Filter },
      { label: 'Orders', icon: Receipt, slug: 'orders' },
      { label: 'Sync', icon: RefreshCw },
    ],
    stats: [
      { label: 'Suppliers', value: '6', delta: '3 regions', up: false, icon: Truck },
      { label: 'SKUs synced', value: '12,840', delta: 'hourly', up: false, icon: Package },
      { label: 'Auto-routed', value: '98%', delta: 'of orders', up: true, icon: Percent },
      { label: 'Regions', value: '3', delta: 'fulfilment', up: false, icon: Globe },
    ],
    charts: [
      { title: 'Routed orders', sub: 'Auto-routed, 14d' },
      { title: 'SKU syncs', sub: 'Updates, last 14 days' },
    ],
    cards: [
      { desc: 'Connections & sync', name: 'Suppliers' },
      { desc: 'Imported SKUs', name: 'Catalog' },
      { desc: 'Order assignment', name: 'Routing' },
    ],
    lists: [
      {
        slug: 'suppliers',
        label: 'Suppliers',
        icon: Truck,
        title: 'Suppliers',
        desc: 'Connected dropship partners. Sync pulls their catalog and stock on a schedule.',
        primary: 'Add supplier',
        count: '6 suppliers',
        filters: ['Region', 'Status'],
        columns: [
          { label: 'Supplier', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Region' },
          { label: 'SKUs', kind: 'num' },
          { label: 'Synced' },
        ],
        rows: [
          ['Pacific Goods\nAPI', 'Synced', 'West', '4,200', '12m ago'],
          ['Atlas Wholesale\nCSV', 'Synced', 'Central', '3,100', '1h ago'],
          ['Nordic Supply\nAPI', 'Synced', 'East', '2,840', '30m ago'],
          ['Harbor Imports\nAPI', 'Error', 'West', '0', '3h ago'],
        ],
      },
      {
        slug: 'catalog',
        label: 'Catalog',
        icon: Package,
        title: 'Catalog',
        desc: 'Imported SKUs from every supplier. Map them to your products to start selling.',
        primary: 'Import',
        count: '12,840 SKUs',
        filters: ['Supplier', 'Status'],
        columns: [
          { label: 'SKU', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Supplier' },
          { label: 'Cost', kind: 'num' },
          { label: 'Stock', kind: 'num' },
        ],
        rows: [
          ['PG-4471\nInsulated Bottle', 'In stock', 'Pacific Goods', '$6.20', '1,200'],
          ['AW-1180\nCanvas Pack', 'In stock', 'Atlas Wholesale', '$11.40', '640'],
          ['NS-3322\nMerino Socks', 'Low stock', 'Nordic Supply', '$4.10', '45'],
          ['PG-4490\nTrail Poles', 'Out of stock', 'Pacific Goods', '$18.00', '0'],
        ],
      },
      {
        slug: 'orders',
        label: 'Orders',
        icon: Receipt,
        title: 'Orders',
        desc: 'Customer orders routed to suppliers. Routing picks the best partner automatically.',
        primary: 'New order',
        count: '142 routed',
        filters: ['Supplier', 'Status'],
        columns: [
          { label: 'Order', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Supplier' },
          { label: 'Total', kind: 'num' },
          { label: 'Placed' },
        ],
        rows: [
          ['#D-2042\n2 items', 'Routed', 'Pacific Goods', '$48', '12m ago'],
          ['#D-2041\n1 item', 'Shipped', 'Atlas Wholesale', '$22', '1h ago'],
          ['#D-2040\n3 items', 'Routed', 'Nordic Supply', '$71', '2h ago'],
          ['#D-2039\n1 item', 'Hold', 'Harbor Imports', '$18', '3h ago'],
        ],
      },
    ],
  },
  {
    key: 'ai',
    label: 'AI',
    color: '#EC4899',
    tint: '#FDF2F8',
    text: '#9D174D',
    icon: Sparkles,
    page: { title: 'AI', desc: '24 tools · 4 clients', primary: 'New tool' },
    sections: [
      { label: 'Overview', icon: Sparkles, slug: 'overview' },
      { label: 'Assistant', icon: Sparkles },
      { label: 'MCP tools', icon: Component, slug: 'mcp-tools' },
      { label: 'Workflows', icon: Workflow, slug: 'workflows' },
      { label: 'Knowledge', icon: FileText },
      { label: 'Logs', icon: BarChart3, slug: 'logs' },
    ],
    stats: [
      { label: 'MCP calls', value: '3,120', delta: 'via MCP', up: false, icon: Sparkles },
      { label: 'Tools live', value: '24', delta: 'all modules', up: false, icon: Component },
      { label: 'Clients', value: '4', delta: 'Claude, GPT…', up: false, icon: Users },
      { label: 'Actions', value: '1,860', delta: '+18%', up: true, icon: BarChart3 },
    ],
    charts: [
      { title: 'MCP calls', sub: 'Tool calls, last 14 days' },
      { title: 'Actions', sub: 'Completed, 14 days' },
    ],
    cards: [
      { desc: 'Ask in plain language', name: 'Assistant' },
      { desc: 'Every module, exposed', name: 'MCP tools' },
      { desc: 'Multi-step actions', name: 'Workflows' },
    ],
    lists: [
      {
        slug: 'mcp-tools',
        label: 'MCP tools',
        icon: Component,
        title: 'MCP tools',
        desc: 'Every module exposed as an MCP tool. Connect any AI client and it can act for you.',
        primary: 'New tool',
        count: '24 tools',
        filters: ['Module', 'Status'],
        columns: [
          { label: 'Tool', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Module' },
          { label: 'Calls', kind: 'num' },
          { label: 'Updated' },
        ],
        rows: [
          ['create_order\ncommerce', 'Live', 'Commerce', '420', '2h ago'],
          ['search_customers\ncrm', 'Live', 'CRM', '310', 'Yesterday'],
          ['send_broadcast\nemail', 'Live', 'Email', '88', 'Jun 1'],
          ['publish_page\nbuilder', 'Live', 'Builder', '142', 'May 28'],
        ],
      },
      {
        slug: 'workflows',
        label: 'Workflows',
        icon: Workflow,
        title: 'Workflows',
        desc: 'Multi-step actions an assistant can run. Chain tools across modules safely.',
        primary: 'New workflow',
        count: '7 workflows',
        filters: ['Status'],
        columns: [
          { label: 'Workflow', kind: 'title' },
          { label: 'Status', kind: 'badge' },
          { label: 'Steps', kind: 'num' },
          { label: 'Runs', kind: 'num' },
          { label: 'Updated' },
        ],
        rows: [
          ['Restock + announce\nInventory → Email', 'Live', '4', '38', '2h ago'],
          ['New customer welcome\nCRM → Email', 'Live', '3', '142', 'Yesterday'],
          ['Quote → order\nB2B → Commerce', 'Live', '5', '22', 'Jun 1'],
          ['Daily digest\nReports → Email', 'Paused', '2', '0', 'May 20'],
        ],
      },
      {
        slug: 'logs',
        label: 'Logs',
        icon: BarChart3,
        title: 'Logs',
        desc: 'Every AI action, with the tool called and the result. A full audit trail.',
        primary: 'Export',
        count: '3,120 calls',
        filters: ['Tool', 'Client', 'Result'],
        columns: [
          { label: 'Action', kind: 'title' },
          { label: 'Result', kind: 'badge' },
          { label: 'Client' },
          { label: 'Tool' },
          { label: 'When' },
        ],
        rows: [
          ['Created order #1042\nDana Whitfield', 'Completed', 'Claude', 'create_order', '2m ago'],
          ['Searched customers\n"wholesale"', 'Completed', 'Claude', 'search_customers', '8m ago'],
          ['Sent broadcast\nSpring Launch', 'Completed', 'GPT', 'send_broadcast', '1h ago'],
          ['Published page\n/lookbook', 'Completed', 'Claude', 'publish_page', '2h ago'],
        ],
      },
    ],
  },
];

const DEFAULT = MODULES.find((m) => m.key === 'commerce')!;
const DEFAULT_PAGE = 'commerce-overview';

// Every selectable page (a module overview + each marquee list page). The page
// id is `${module}-${slug}`; the overview slug is literally `overview`.
const PAGES = MODULES.flatMap((m) => [
  { id: `${m.key}-overview`, label: `${m.label} overview` },
  ...m.lists.map((l) => ({ id: `${m.key}-${l.slug}`, label: `${m.label} · ${l.label}` })),
]);

// CSS-only interactivity: each radio's `:checked` state recolors `--m`, reveals
// its matching `.dsx-page` + the owning module's `.dsx-panel`, and highlights
// the rail tile + section item — no client JS. A grouped `:has()` per module
// keeps the panel/color stable across all that module's pages. `:has()` is
// supported everywhere current; older browsers fall back to the default
// (Commerce overview) view. Section item + rail styles live in classes (not
// inline) so the `:checked` rules can win on specificity.
const INTERACTIVE_CSS = `
.dsx-frame{position:relative;--m:${DEFAULT.color};--m-tint:color-mix(in oklab, var(--m) 15%, var(--color-base-100));--m-text:var(--m);}
.dsx-radio{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;}
.dsx-railtile{color:color-mix(in oklab, var(--color-base-content) 50%, transparent);cursor:pointer;transition:background .15s ease,color .15s ease;}
.dsx-railtile:hover{background:var(--color-base-200);color:color-mix(in oklab, var(--color-base-content) 70%, transparent);}
.dsx-secitem{display:flex;align-items:center;gap:8px;height:32px;flex-shrink:0;padding:0 8px;border-radius:6px;font-family:var(--font-sans);font-size:13px;font-weight:400;color:color-mix(in oklab, var(--color-base-content) 70%, transparent);background:transparent;}
.dsx-secitem--link{cursor:pointer;}
.dsx-secitem--link:hover{background:var(--color-base-200);}
.dsx-secicon{display:inline-flex;flex-shrink:0;color:color-mix(in oklab, var(--color-base-content) 50%, transparent);}
.dsx-panel{display:none;flex-direction:column;flex:1;min-height:0;}
.dsx-panel--commerce{display:flex;}
.dsx-page{display:none;flex-direction:column;flex:1;min-height:0;overflow-y:auto;}
.dsx-page--commerce-overview{display:flex;}
.dsx-frame:has(.dsx-radio:checked) .dsx-panel{display:none;}
.dsx-frame:has(.dsx-radio:checked) .dsx-page{display:none;}
${MODULES.map((m) => {
  const ids = [`${m.key}-overview`, ...m.lists.map((l) => `${m.key}-${l.slug}`)];
  const has = (suffix: string) =>
    ids.map((id) => `.dsx-frame:has(#dsx-${id}:checked)${suffix}`).join(',');
  return `
${has('')}{--m:${m.color};}
${has(` .dsx-panel--${m.key}`)}{display:flex;}
${has(` .dsx-railtile--${m.key}`)}{background:var(--m-tint);color:var(--m);}`;
}).join('')}
${PAGES.map(
  (p) => `
.dsx-frame:has(#dsx-${p.id}:checked) .dsx-page--${p.id}{display:flex;}
.dsx-frame:has(#dsx-${p.id}:checked) .dsx-secitem--${p.id}{background:var(--m-tint);color:var(--m-text);font-weight:500;}
.dsx-frame:has(#dsx-${p.id}:checked) .dsx-secitem--${p.id} .dsx-secicon{color:var(--m);}`
).join('')}
`;

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// Status badge families — mapped from the cell text (lowercased). Mirrors the
// dashboard's success / neutral / warning / danger Badge colors.
const STATUS_FAMILIES = {
  success: { bg: '#ECFDF5', fg: '#047857' },
  neutral: {
    bg: 'var(--color-base-200)',
    fg: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
  },
  warning: { bg: '#FEF3C7', fg: '#B45309' },
  danger: { bg: '#FFE4E6', fg: '#BE123C' },
} as const;

const STATUS_LOOKUP: Record<string, keyof typeof STATUS_FAMILIES> = {
  active: 'success',
  published: 'success',
  live: 'success',
  paid: 'success',
  won: 'success',
  sent: 'success',
  shipped: 'success',
  delivered: 'success',
  completed: 'success',
  approved: 'success',
  accepted: 'success',
  synced: 'success',
  routed: 'success',
  'in stock': 'success',
  draft: 'neutral',
  scheduled: 'neutral',
  paused: 'neutral',
  pending: 'neutral',
  new: 'neutral',
  queued: 'neutral',
  proposal: 'neutral',
  negotiation: 'neutral',
  archived: 'warning',
  'low stock': 'warning',
  backorder: 'warning',
  hold: 'warning',
  review: 'warning',
  failed: 'danger',
  refunded: 'danger',
  'out of stock': 'danger',
  suppressed: 'danger',
  lost: 'danger',
  error: 'danger',
  expired: 'danger',
};

function statusColor(value: string) {
  return STATUS_FAMILIES[STATUS_LOOKUP[value.toLowerCase()] ?? 'neutral'];
}

/**
 * The interactive dashboard mockup — a functional UI recreation, not
 * editorial marketing type, so it never needs re-skinning per page. Callers
 * wrap it in their own section shell/header/copy (the homepage's dashboard
 * section does this) rather than forking these ~2,200 lines.
 */
export function DashboardFrame({ bleed = false }: { bleed?: boolean } = {}) {
  return (
    <>
      {/* The board is a wide, faithful recreation of the real app; on phones it
          scrolls horizontally rather than cramming. A quiet hint tells touch
          users to swipe (desktop never sees it). */}
      <span
        className="mkt-tablet-down-only"
        style={{
          marginTop: '-40px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
        }}
      >
        Swipe to explore the dashboard →
      </span>

      {/* `bleed` pulls the scroller out to the page gutter so the board can use the
          full width on a phone. It is OPT-IN because it only cancels out if the
          caller's section pads by exactly `--gutter-page` (clamp(20px, 5vw, 80px)) —
          a section on Tailwind `px-6` gets a ~40px overshoot that escapes the
          section and scrolls the whole page sideways. It's also wrong inside a
          rounded card, where a full-bleed child spills past the corners. */}
      <div
        style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          ...(bleed
            ? {
                margin: '0 calc(var(--gutter-page) * -1)',
                padding: '0 var(--gutter-page)',
              }
            : {}),
        }}
      >
        <div
          className="dsx-frame"
          style={{
            border: '1px solid var(--color-base-300)',
            borderRadius: '12px 12px',
            overflow: 'hidden',
            backgroundColor: 'var(--color-base-100)',
            minWidth: '960px',
          }}
        >
          <style dangerouslySetInnerHTML={{ __html: INTERACTIVE_CSS }} />
          {PAGES.map((p) => (
            <input
              key={p.id}
              className="dsx-radio"
              type="radio"
              name="dsx-page"
              id={`dsx-${p.id}`}
              defaultChecked={p.id === DEFAULT_PAGE}
              aria-label={p.label}
            />
          ))}

          <BrowserChrome />

          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              height: '600px',
              backgroundColor: 'var(--color-base-200)',
            }}
          >
            <Rail />
            <Panel />
            <Main />
          </div>
        </div>
      </div>
    </>
  );
}

function BrowserChrome() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 20px',
        backgroundColor: 'var(--color-base-200)',
        borderBottom: '1px solid var(--color-base-300)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span style={{ width: 11, height: 11, borderRadius: 9999, backgroundColor: '#FF5F57' }} />
        <span style={{ width: 11, height: 11, borderRadius: 9999, backgroundColor: '#FEBC2E' }} />
        <span style={{ width: 11, height: 11, borderRadius: 9999, backgroundColor: '#28C840' }} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          backgroundColor: 'var(--color-base-100)',
          border: '1px solid var(--color-base-300)',
          borderRadius: '6px',
          flex: 1,
          maxWidth: '520px',
          marginLeft: '24px',
        }}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 1L3 5V11C3 16 7 21 12 23C17 21 21 16 21 11V5L12 1Z"
            stroke="color-mix(in oklab, var(--color-base-content) 70%, transparent)"
            strokeWidth={2}
          />
        </svg>
        <span
          style={{
            fontFamily: MONO,
            fontSize: '12px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          }}
        >
          app.sparx.works/dashboard
        </span>
      </div>
    </div>
  );
}

// ── Rail (thin gray icon column; module tiles are radio labels → overview) ──

function Rail() {
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '56px',
        flexShrink: 0,
        backgroundColor: 'var(--color-base-100)',
        borderRight: '1px solid var(--color-base-300)',
        padding: '12px 0 10px',
        gap: '4px',
      }}
    >
      <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SparxMark size={20} />
      </div>
      <RailStatic icon={Search} label="Search" />
      <RailStatic icon={Home} label="Home" />
      <RailDivider />
      {MODULES.map((m) => {
        const Icon = m.icon;
        return (
          <label
            key={m.key}
            htmlFor={`dsx-${m.key}-overview`}
            className={`dsx-railtile dsx-railtile--${m.key}`}
            title={m.label}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={17} strokeWidth={1.8} />
          </label>
        );
      })}
      <RailDivider />
      <div style={{ flex: 1 }} />
      <RailStatic icon={Gauge} label="SEO" />
      <RailStatic icon={Settings} label="Settings" />
    </aside>
  );
}

function RailStatic({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span
      title={label}
      aria-hidden
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
      }}
    >
      <Icon size={17} strokeWidth={1.8} />
    </span>
  );
}

function RailDivider() {
  return (
    <span
      aria-hidden
      style={{
        width: 26,
        height: 1,
        backgroundColor: 'var(--color-base-300)',
        margin: '5px 0',
      }}
    />
  );
}

// ── Contextual panel (one per module; marquee sections link, rest are inert) ──

function Panel() {
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '212px',
        flexShrink: 0,
        backgroundColor: 'var(--color-base-100)',
        borderRight: '1px solid var(--color-base-300)',
        overflow: 'hidden',
      }}
    >
      {MODULES.map((m) => (
        <div key={m.key} className={`dsx-panel dsx-panel--${m.key}`}>
          <div style={{ padding: '13px 16px 10px' }}>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              Module
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '3px' }}>
              <span
                style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: 'var(--m)' }}
              />
              <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: '14px' }}>{m.label}</span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              padding: '2px 8px 12px',
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            {m.sections.map((s) => {
              const Icon = s.icon;
              const id = s.slug ? `${m.key}-${s.slug}` : null;
              const inner = (
                <>
                  <span className="dsx-secicon">
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  {s.label}
                </>
              );
              return id ? (
                <label
                  key={s.label}
                  htmlFor={`dsx-${id}`}
                  className={`dsx-secitem dsx-secitem--link dsx-secitem--${id}`}
                >
                  {inner}
                </label>
              ) : (
                <div key={s.label} className="dsx-secitem">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

// ── Main column (one page per radio: overview + each marquee list page) ──

function Main() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        backgroundColor: 'var(--color-base-200)',
      }}
    >
      {MODULES.flatMap((m) => [
        <OverviewPage key={`${m.key}-overview`} module={m} />,
        ...m.lists.map((l) => <ListPageView key={`${m.key}-${l.slug}`} module={m} page={l} />),
      ])}
    </div>
  );
}

function OverviewPage({ module: m }: { module: ModuleDef }) {
  return (
    <div className={`dsx-page dsx-page--${m.key}-overview`}>
      <TopBar module={m} />
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '8px 24px 26px' }}
      >
        <PageHead module={m} />
        <StatRow module={m} />
        <ChartRow module={m} />
        <CardRow module={m} />
      </div>
    </div>
  );
}

function ListPageView({ module: m, page }: { module: ModuleDef; page: ListPage }) {
  return (
    <div className={`dsx-page dsx-page--${m.key}-${page.slug}`}>
      <TopBar module={m} crumb={page.label} />
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px 26px' }}
      >
        <ListPageHead page={page} />
        <ListToolbar page={page} />
        <ListTable page={page} />
      </div>
    </div>
  );
}

function TopBar({ module: m, crumb }: { module: ModuleDef; crumb?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '11px 22px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          fontFamily: SANS,
          fontSize: '13px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--color-base-content)',
          }}
        >
          {TENANT}
          <ChevronDown size={13} style={{ opacity: 0.7 }} />
        </span>
        <span style={{ color: 'color-mix(in oklab, var(--color-base-content) 30%, transparent)' }}>
          /
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--m-text)',
          }}
        >
          {m.label}
          <ChevronDown size={13} style={{ opacity: 0.7 }} />
        </span>
        {crumb ? (
          <>
            <span
              style={{ color: 'color-mix(in oklab, var(--color-base-content) 30%, transparent)' }}
            >
              /
            </span>
            <span
              style={{ color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)' }}
            >
              {crumb}
            </span>
          </>
        ) : null}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
        }}
      >
        <Clock size={16} strokeWidth={1.8} />
        <MoreHorizontal size={16} strokeWidth={1.8} />
        <Moon size={16} strokeWidth={1.8} />
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 9999,
            marginLeft: 4,
            background: 'linear-gradient(135deg, #EEF2FF, #FDF2F8)',
          }}
        />
      </div>
    </div>
  );
}

function PrimaryAction({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '9px 14px',
        borderRadius: 9,
        backgroundColor: 'var(--m)',
        color: '#FFFFFF',
        fontFamily: SANS,
        fontWeight: 500,
        fontSize: '13px',
        whiteSpace: 'nowrap',
      }}
    >
      <Plus size={14} strokeWidth={2.2} />
      {label}
    </span>
  );
}

function PageHead({ module: m }: { module: ModuleDef }) {
  const Icon = m.icon;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--m-tint)',
            color: 'var(--m)',
            marginTop: 2,
          }}
        >
          <Icon size={20} strokeWidth={1.8} />
        </span>
        <div>
          <h3
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: '24px',
              letterSpacing: '-0.02em',
              color: 'var(--color-base-content)',
              margin: 0,
            }}
          >
            {m.page.title}
          </h3>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '13px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              margin: '3px 0 0',
            }}
          >
            {m.page.desc}
          </p>
        </div>
      </div>
      <PrimaryAction label={m.page.primary} />
    </div>
  );
}

function ListPageHead({ page }: { page: ListPage }) {
  const Icon = page.icon;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--m-tint)',
            color: 'var(--m)',
            marginTop: 2,
            flexShrink: 0,
          }}
        >
          <Icon size={20} strokeWidth={1.8} />
        </span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '24px',
                letterSpacing: '-0.02em',
                color: 'var(--color-base-content)',
                margin: 0,
              }}
            >
              {page.title}
            </h3>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '11px',
                padding: '2px 9px',
                borderRadius: 9999,
                backgroundColor: 'var(--m-tint)',
                color: 'var(--m-text)',
                whiteSpace: 'nowrap',
              }}
            >
              {page.count}
            </span>
          </div>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '13px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              margin: '4px 0 0',
              maxWidth: '52ch',
              lineHeight: 1.5,
            }}
          >
            {page.desc}
          </p>
        </div>
      </div>
      <PrimaryAction label={page.primary} />
    </div>
  );
}

// ── List toolbar (static-but-faithful: search + filter chips + sort + view) ──

function ListToolbar({ page }: { page: ListPage }) {
  const chip = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '7px 11px',
    border: '1px solid var(--color-base-300)',
    borderRadius: 8,
    backgroundColor: 'var(--color-base-100)',
    fontFamily: SANS,
    fontSize: '12.5px',
    color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
    whiteSpace: 'nowrap' as const,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: '0 1 280px',
          minWidth: 180,
          padding: '7px 12px',
          backgroundColor: 'var(--color-base-100)',
          border: '1px solid var(--color-base-300)',
          borderRadius: 8,
        }}
      >
        <Search
          size={14}
          strokeWidth={1.8}
          style={{ color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)' }}
        />
        <span
          style={{
            fontFamily: SANS,
            fontSize: '13px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          Search…
        </span>
      </div>
      {page.filters.map((f) => (
        <span key={f} style={chip}>
          {f}
          <ChevronDown size={12} style={{ opacity: 0.6 }} />
        </span>
      ))}
      <span style={{ flex: 1 }} />
      <span style={chip}>
        Recently updated
        <ChevronDown size={12} style={{ opacity: 0.6 }} />
      </span>
      <span
        style={{
          display: 'inline-flex',
          border: '1px solid var(--color-base-300)',
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: 'var(--color-base-100)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            padding: '7px 9px',
            backgroundColor: 'var(--color-base-200)',
            color: 'var(--color-base-content)',
          }}
        >
          <List size={14} strokeWidth={1.8} />
        </span>
        <span
          style={{
            display: 'inline-flex',
            padding: '7px 9px',
            borderLeft: '1px solid var(--color-base-300)',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          <LayoutGrid size={14} strokeWidth={1.8} />
        </span>
      </span>
    </div>
  );
}

// ── List table (the dashboard's primary archetype, with sample rows) ──

function ListTable({ page }: { page: ListPage }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: 11,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS }}>
        <thead>
          <tr>
            {page.columns.map((c) => (
              <th
                key={c.label}
                style={{
                  textAlign: c.kind === 'num' ? 'right' : 'left',
                  padding: '10px 14px',
                  fontSize: '10.5px',
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                  borderBottom: '1px solid var(--color-base-300)',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.rows.map((row, ri) => {
            const last = ri === page.rows.length - 1;
            return (
              <tr key={ri}>
                {row.map((cell, ci) => {
                  const col = page.columns[ci]!;
                  const base = {
                    padding: '11px 14px',
                    borderBottom: last ? 'none' : '1px solid var(--color-base-300)',
                    fontSize: '13px',
                    verticalAlign: 'middle' as const,
                  };
                  if (col.kind === 'title') {
                    const parts = cell.split('\n');
                    const main = parts[0] ?? '';
                    const sub = parts[1];
                    return (
                      <td key={ci} style={base}>
                        <div style={{ fontWeight: 500, color: 'var(--color-base-content)' }}>
                          {main}
                        </div>
                        {sub ? (
                          <div
                            style={{
                              fontSize: '11.5px',
                              color:
                                'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                              marginTop: 1,
                            }}
                          >
                            {sub}
                          </div>
                        ) : null}
                      </td>
                    );
                  }
                  if (col.kind === 'badge') {
                    const c = statusColor(cell);
                    return (
                      <td key={ci} style={base}>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '2px 8px',
                            borderRadius: 9999,
                            fontSize: '11px',
                            fontWeight: 500,
                            backgroundColor: c.bg,
                            color: c.fg,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cell}
                        </span>
                      </td>
                    );
                  }
                  if (col.kind === 'num') {
                    return (
                      <td
                        key={ci}
                        style={{
                          ...base,
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                        }}
                      >
                        {cell}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={ci}
                      style={{
                        ...base,
                        color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                      }}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatRow({ module: m }: { module: ModuleDef }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
      {m.stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            style={{
              backgroundColor: 'var(--color-base-200)',
              borderRadius: 10,
              padding: '13px 14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '10px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                }}
              >
                {s.label}
              </span>
              <span
                style={{
                  width: 25,
                  height: 25,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--m-tint)',
                  color: 'var(--m)',
                }}
              >
                <Icon size={13} strokeWidth={1.8} />
              </span>
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '23px',
                letterSpacing: '-0.02em',
                color: 'var(--color-base-content)',
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: '11.5px',
                marginTop: 3,
                color: s.up
                  ? '#047857'
                  : 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {s.delta}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChartRow({ module: m }: { module: ModuleDef }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <ChartCard title={m.charts[0]!.title} sub={m.charts[0]!.sub}>
        <AreaChart />
      </ChartCard>
      <ChartCard title={m.charts[1]!.title} sub={m.charts[1]!.sub}>
        <BarChart />
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: 11,
        padding: '14px 16px 10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: '13.5px',
              color: 'var(--color-base-content)',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: '11.5px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              marginTop: 1,
            }}
          >
            {sub}
          </div>
        </div>
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: 9999,
            backgroundColor: '#FEF3C7',
            color: '#B45309',
            whiteSpace: 'nowrap',
          }}
        >
          Sample data
        </span>
      </div>
      <div style={{ height: 80 }}>{children}</div>
    </div>
  );
}

const AREA_PATH =
  'M0,62 C24,55 38,46 56,49 C80,53 90,66 110,57 C138,45 150,30 176,36 C204,42 214,54 240,33 C270,12 292,22 300,18';
const BARS = [34, 44, 29, 50, 60, 47, 38, 55, 66, 52, 70, 58];

function AreaChart() {
  return (
    <svg
      viewBox="0 0 300 80"
      preserveAspectRatio="none"
      style={{ width: '100%', height: 80, display: 'block' }}
    >
      <path d={`${AREA_PATH} L300,80 L0,80 Z`} style={{ fill: 'var(--m)', fillOpacity: 0.12 }} />
      <path
        d={AREA_PATH}
        style={{ fill: 'none', stroke: 'var(--m)', strokeWidth: 2 }}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BarChart() {
  const w = 300;
  const h = 80;
  const gap = 7;
  const bw = (w - gap * (BARS.length - 1)) / BARS.length;
  return (
    <svg
      viewBox="0 0 300 80"
      preserveAspectRatio="none"
      style={{ width: '100%', height: 80, display: 'block' }}
    >
      {BARS.map((v, i) => {
        const bh = (v / 72) * h;
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={h - bh}
            width={bw}
            height={bh}
            rx={1.5}
            style={{ fill: 'var(--m)' }}
          />
        );
      })}
    </svg>
  );
}

function CardRow({ module: m }: { module: ModuleDef }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
      {m.cards.map((c) => (
        <div
          key={c.name}
          style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--color-base-100)',
            border: '1px solid var(--color-base-300)',
            borderRadius: 11,
            overflow: 'hidden',
          }}
        >
          <div style={{ height: 3, backgroundColor: 'var(--m)' }} />
          <div
            style={{ display: 'flex', flexDirection: 'column', padding: '13px 15px 14px', flex: 1 }}
          >
            <span
              style={{
                fontFamily: SANS,
                fontSize: '11.5px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {c.desc}
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '15px',
                letterSpacing: '-0.01em',
                color: 'var(--color-base-content)',
                marginTop: 2,
              }}
            >
              {c.name}
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 14,
              }}
            >
              <span
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '10.5px',
                  padding: '2px 8px',
                  borderRadius: 9999,
                  backgroundColor: 'var(--m-tint)',
                  color: 'var(--m-text)',
                }}
              >
                Active
              </span>
              <span
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '12px',
                  padding: '5px 12px',
                  borderRadius: 7,
                  backgroundColor: 'var(--m)',
                  color: '#FFFFFF',
                }}
              >
                Open
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
