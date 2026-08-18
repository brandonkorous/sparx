/**
 * Single source of truth for the free-tools hub (`/tools`).
 *
 * Each entry drives, with no drift: the hub grid card, the tool's own page
 * metadata (<title>, description, keywords, canonical, OG), the sitemap entry,
 * the module color the page wears, and the "ladder" CTA that connects the free
 * tool to the paid sparx module it belongs to. This mirrors how lib/modules.ts
 * is the SSOT for the module marketing pages.
 *
 * Data-as-code: this file is the catalog, so it's exempt from the file-size
 * lint (one entry per tool, intentionally verbose marketing copy).
 */
import type { LucideIcon } from 'lucide-react';
import {
  AppWindow,
  Barcode,
  Braces,
  Calculator,
  Contact,
  Contrast,
  FileCheck2,
  Globe,
  Link2,
  MailCheck,
  Palette,
  QrCode,
  ReceiptText,
  ScrollText,
  Share2,
  Signature,
  Tags,
} from 'lucide-react';
import type { MarketingModule } from '../primitives';

export interface ToolMeta {
  /** URL segment: /tools/<slug>. */
  slug: string;
  /** Display name ("Favicon generator"). */
  name: string;
  /** Hub-card + hero one-liner. */
  tagline: string;
  /** Longer body for <meta name="description"> and the hub card. */
  description: string;
  /** SEO keywords — the high-intent queries this page should earn. */
  keywords: string[];
  /** Module that owns this tool: sets the page color + ladder target. */
  module: MarketingModule;
  /** lucide icon for the hub card + hero chip. */
  icon: LucideIcon;
  /** Connects the free tool up to the paid module. */
  ladder: {
    headline: string;
    body: string;
    /** CTA label; always links to /<module>. */
    cta: string;
  };
}

export const TOOLS: ToolMeta[] = [
  {
    slug: 'favicon',
    name: 'Favicon generator',
    tagline:
      'Turn a PNG or SVG into a complete, real-world favicon set — .ico, Apple touch, maskable, web manifest, and the exact markup to paste.',
    description:
      'Free favicon generator. Drop in a PNG, SVG, or JPG and download a production favicon package — multi-resolution .ico, apple-touch-icon, 192/512 PWA icons, a maskable icon, site.webmanifest, and copy-paste HTML or Next.js App Router code. 100% in your browser, nothing uploaded.',
    keywords: [
      'favicon generator',
      'png to ico',
      'favicon converter',
      'ico converter',
      'apple touch icon',
      'site webmanifest',
      'favicon package',
      'next.js favicon',
    ],
    module: 'builder',
    icon: AppWindow,
    ladder: {
      headline: 'Your whole site, not just its favicon.',
      body: 'A favicon is the first pixel of your brand. sparx Builder runs the rest — themes, pages, a custom domain, and automatic SSL — and ships a real header, manifest, and SEO out of the box. Live in five minutes.',
      cta: 'Explore Builder',
    },
  },
  {
    slug: 'qr-code',
    name: 'QR code generator',
    tagline:
      'Make crisp, customizable QR codes for a link, menu, Wi-Fi, contact card, or message — with your colors and logo. Download PNG or SVG.',
    description:
      'Free QR code generator. Encode a URL, plain text, Wi-Fi login, vCard contact, email, SMS, or phone number into a high-resolution QR code. Customize colors, error correction, and drop your logo in the center. Export PNG or infinitely-scalable SVG — no watermark, no sign-up, no expiry.',
    keywords: [
      'qr code generator',
      'free qr code',
      'wifi qr code',
      'vcard qr code',
      'qr code with logo',
      'svg qr code',
      'menu qr code',
    ],
    module: 'commerce',
    icon: QrCode,
    ladder: {
      headline: 'Codes that go somewhere worth selling.',
      body: 'Print a QR on a shelf tag, a menu, or a flyer and point it at a real site. sparx Commerce puts products, cart, checkout, and live inventory behind every scan — D2C or B2B, on one bill.',
      cta: 'Explore Commerce',
    },
  },
  {
    slug: 'utm-builder',
    name: 'UTM link builder',
    tagline:
      'Build clean, consistent campaign URLs with proper utm_ parameters — presets, validation, a saved history, and a one-tap QR for every link.',
    description:
      'Free UTM link builder and campaign URL generator. Tag any link with utm_source, utm_medium, utm_campaign, term, and content — with channel presets, lowercase hygiene, live validation, a saved link history, and an instant QR code. Build trackable URLs that never break your analytics.',
    keywords: [
      'utm builder',
      'utm link builder',
      'campaign url builder',
      'utm generator',
      'google analytics utm',
      'utm parameters',
    ],
    module: 'crm',
    icon: Link2,
    ladder: {
      headline: 'Tag the click. See the customer.',
      body: 'A UTM is only worth tagging if something reads it. sparx CRM sits on the same database as your orders — so every tagged click ties back to the person, the deal, and the revenue. No Zapier, no export.',
      cta: 'Explore CRM',
    },
  },
  {
    slug: 'og-image',
    name: 'Open Graph image maker',
    tagline:
      'Design a sharp 1200×630 social share card — title, accent, logo, and theme — and download the PNG that makes your links look intentional.',
    description:
      'Free Open Graph and Twitter card image generator. Compose a 1200×630 social preview with a headline, eyebrow, accent color, and your logo, then download a ready-to-use PNG for og:image and twitter:image. Make every shared link look designed, not default.',
    keywords: [
      'open graph image generator',
      'og image maker',
      'twitter card generator',
      'social share image',
      '1200x630 image',
      'og:image generator',
    ],
    module: 'cms',
    icon: Share2,
    ladder: {
      headline: 'Great cards start with great content.',
      body: 'An OG image is the cover; sparx CMS is the book — a fast block editor, structured content, a media library, and SEO that auto-generates meta tags, sitemaps, and JSON-LD on publish.',
      cta: 'Explore CMS',
    },
  },
  {
    slug: 'email-signature',
    name: 'Email signature generator',
    tagline:
      'Build a clean, professional HTML email signature with your photo, logo, and links — then copy it straight into Gmail, Outlook, or Apple Mail.',
    description:
      'Free email signature generator. Fill in your name, title, company, phone, and links, pick a layout and accent color, and copy a polished, client-safe HTML signature into Gmail, Outlook, or Apple Mail. Table-based markup that survives every email client — no apps, no tracking.',
    keywords: [
      'email signature generator',
      'html email signature',
      'gmail signature',
      'outlook signature',
      'professional email signature',
    ],
    module: 'email',
    icon: Signature,
    ladder: {
      headline: 'One signature. Then every email.',
      body: "Your signature is one email's worth of brand. sparx Email runs the rest — transactional and marketing, sent from your own domain with SPF, DKIM, and DMARC handled — no per-email markup.",
      cta: 'Explore Email',
    },
  },
  {
    slug: 'invoice',
    name: 'Invoice generator',
    tagline:
      'Create a clean, itemized invoice with your logo, taxes, and totals — and download a print-ready PDF. No account, no watermark.',
    description:
      'Free invoice generator. Add your business and client details, line items, tax, and discounts, then download a professional, print-ready PDF invoice with your logo. Auto-calculated totals, any currency, and your details saved locally for next time — no sign-up, no watermark.',
    keywords: [
      'invoice generator',
      'free invoice generator',
      'invoice maker',
      'pdf invoice',
      'invoice template',
      'create an invoice',
    ],
    module: 'b2b',
    icon: ReceiptText,
    ladder: {
      headline: 'From one invoice to net terms at scale.',
      body: 'A one-off PDF is fine for invoice #1. sparx B2B does the rest — account pricing, purchase orders, net 15/30/60/90, aging reports, statements, and dunning — built for how industrial billing actually works.',
      cta: 'Explore B2B',
    },
  },
  {
    slug: 'email-deliverability',
    name: 'Email deliverability checker',
    tagline:
      'Generate and check your SPF, DKIM, and DMARC DNS records — so your email lands in the inbox instead of spam.',
    description:
      'Free SPF, DKIM, and DMARC tool. Generate the exact DNS records your sending domain needs, then check the records already published on any domain — live, from your browser. Fix the three settings that decide whether your email reaches the inbox or the spam folder.',
    keywords: [
      'spf record generator',
      'dkim record',
      'dmarc record generator',
      'spf checker',
      'dmarc checker',
      'email deliverability',
      'email authentication',
    ],
    module: 'email',
    icon: MailCheck,
    ladder: {
      headline: 'Stop fighting your DNS by hand.',
      body: 'SPF, DKIM, and DMARC are fiddly — and getting them wrong quietly kills your deliverability. sparx Email sends from your own domain with all three auto-provisioned and monitored, and alerts you the moment reputation drops.',
      cta: 'Explore Email',
    },
  },
  {
    slug: 'meta-tags',
    name: 'Meta tag generator',
    tagline:
      'Write title and description tags with a live Google and social preview — then copy the full meta block for your <head>.',
    description:
      'Free meta tag generator and SERP preview tool. Type your title, description, and URL and see exactly how the page looks in Google search results and on social cards, with live character counts. Copy a complete, correct meta block — title, description, canonical, Open Graph, and Twitter — for your <head>.',
    keywords: [
      'meta tag generator',
      'serp preview',
      'title tag',
      'meta description',
      'google preview tool',
      'open graph tags',
      'seo meta tags',
    ],
    module: 'cms',
    icon: Tags,
    ladder: {
      headline: 'Good tags are step one of good SEO.',
      body: 'Tags help a page rank; sparx CMS makes the whole site rank — per-page meta and OG, sitemaps generated, JSON-LD inferred from your content types, and a Lighthouse score on every publish.',
      cta: 'Explore CMS',
    },
  },
  {
    slug: 'color-palette',
    name: 'Brand color palette generator',
    tagline:
      'Turn one brand color into matching color harmonies plus a full 50–950 tint and shade scale, with CSS variables and Tailwind config — ready to paste.',
    description:
      'Free brand color palette generator. Pick one base color and get matching color harmonies — complementary, analogous, triadic, tetradic, monochromatic, or fully random. Shuffle for fresh variations, lock the colors you want to keep, and preview the palette on real UI. Export a full 50–950 tint and shade ramp for every color as CSS custom properties or a Tailwind config, with WCAG contrast-checked pairings — the same token approach the sparx design system uses.',
    keywords: [
      'color palette generator',
      'complementary color generator',
      'color harmony',
      'color scheme generator',
      'random color palette',
      'brand colors',
      'tailwind color generator',
      'css variables colors',
    ],
    module: 'builder',
    icon: Palette,
    ladder: {
      headline: 'A palette is the start of a brand.',
      body: 'Colors are the first decision; sparx Builder is where they live — themes that apply your palette across every page and component, with a custom domain and automatic SSL. No code, live in five minutes.',
      cta: 'Explore Builder',
    },
  },
  {
    slug: 'margin-calculator',
    name: 'Margin & markup calculator',
    tagline:
      'Work out price, margin, markup, profit, and break-even from any two numbers — the math founders redo every week.',
    description:
      'Free profit margin and markup calculator. Enter cost and price, or cost and target margin, and instantly see margin %, markup %, profit per unit, and the price you should charge — plus break-even units against fixed costs. The pricing math every founder and small business redoes constantly, in one place.',
    keywords: [
      'margin calculator',
      'markup calculator',
      'profit margin calculator',
      'pricing calculator',
      'break even calculator',
      'gross margin',
    ],
    module: 'commerce',
    icon: Calculator,
    ladder: {
      headline: 'Know the margin. Then sell at it.',
      body: 'A calculator gives you the number; sparx Commerce holds the line — per-product cost and price, discounts and gift cards, real inventory, and checkout that converts. D2C or B2B, on one bill.',
      cta: 'Explore Commerce',
    },
  },
  {
    slug: 'quote',
    name: 'Quote & estimate generator',
    tagline:
      'Create a clean, itemized quote or estimate with your logo, an expiry date, and totals — and download a print-ready PDF.',
    description:
      'Free quote and estimate generator. Add your business and client details, line items, tax, and a valid-until date, then download a professional, print-ready PDF quote with your logo. Auto-calculated totals, any currency, and your details saved locally for next time — no sign-up, no watermark.',
    keywords: [
      'quote generator',
      'estimate generator',
      'free quote template',
      'pdf quote',
      'price quote maker',
      'sales estimate',
    ],
    module: 'b2b',
    icon: FileCheck2,
    ladder: {
      headline: 'From one quote to a real RFQ pipeline.',
      body: 'A PDF quote is fine for one deal. sparx B2B runs the whole motion — buyers request quotes from a product page, you reply with line-item pricing and expiry, and an accepted quote converts straight to an order.',
      cta: 'Explore B2B',
    },
  },
  {
    slug: 'structured-data',
    name: 'Structured data generator',
    tagline:
      'Generate valid JSON-LD schema for your business, products, articles, and FAQs — the markup that earns rich results.',
    description:
      'Free JSON-LD structured data generator. Build valid schema.org markup for LocalBusiness, Organization, Product, Article, and FAQ — fill a form, copy the script. The structured data Google reads to show rich results: star ratings, prices, FAQs, and business info right in search.',
    keywords: [
      'json-ld generator',
      'structured data generator',
      'schema markup generator',
      'rich results',
      'schema.org generator',
      'local business schema',
    ],
    module: 'cms',
    icon: Braces,
    ladder: {
      headline: 'Markup is tedious. Let the CMS infer it.',
      body: 'Hand-writing JSON-LD per page does not scale. sparx CMS infers structured data from your content types automatically — define a Recipe or Product once and the schema, sitemaps, and meta come with it.',
      cta: 'Explore CMS',
    },
  },
  {
    slug: 'contrast-checker',
    name: 'Color contrast checker',
    tagline:
      'Check any text and background pair against WCAG AA and AAA — and see the largest readable size at a glance.',
    description:
      'Free WCAG color contrast checker. Enter a text and background color to get the exact contrast ratio and AA/AAA pass-fail for normal and large text, with a live preview. Make sure your site is readable and accessible — the check enterprise buyers and accessibility audits look for.',
    keywords: [
      'contrast checker',
      'wcag contrast',
      'color contrast ratio',
      'accessibility checker',
      'aa aaa contrast',
      'text contrast',
    ],
    module: 'builder',
    icon: Contrast,
    ladder: {
      headline: 'Accessible by default, not as a retrofit.',
      body: 'Checking one pair is easy; shipping an accessible site is the work. sparx Builder blocks are responsive and accessible out of the box, so contrast, focus states, and semantics are handled before you publish.',
      cta: 'Explore Builder',
    },
  },
  {
    slug: 'barcode',
    name: 'Barcode generator',
    tagline:
      'Generate scannable Code128, UPC, EAN, and SKU barcodes with a valid check digit — download PNG or SVG.',
    description:
      'Free barcode generator. Create scannable Code128, UPC-A, EAN-13, EAN-8, and Code39 barcodes for products, inventory, and SKUs, with automatic check-digit validation. Customize size and labels, then download a crisp PNG or infinitely-scalable SVG — no sign-up, no watermark.',
    keywords: [
      'barcode generator',
      'upc generator',
      'ean barcode',
      'code128 barcode',
      'sku barcode',
      'free barcode maker',
    ],
    module: 'commerce',
    icon: Barcode,
    ladder: {
      headline: 'A barcode is only useful if something tracks it.',
      body: 'Printing a label is the easy part. sparx Commerce tracks the inventory behind it — variants, bundles, reservations, and low-stock alerts, real-time across your site, manual orders, and your AI.',
      cta: 'Explore Commerce',
    },
  },
  {
    slug: 'digital-card',
    name: 'Digital business card',
    tagline:
      'Build a tap-to-save digital business card — a vCard download and a QR code that drops your details into any phone.',
    description:
      'Free digital business card and vCard generator. Enter your name, title, company, and contact details to create a downloadable .vcf file and a scannable QR code that saves your contact straight into any phone. Share your details by tap or scan — no app, no account.',
    keywords: [
      'digital business card',
      'vcard generator',
      'qr business card',
      'vcf generator',
      'contact card qr',
      'virtual business card',
    ],
    module: 'crm',
    icon: Contact,
    ladder: {
      headline: 'Save the contact. Then remember everything about them.',
      body: 'A vCard captures a name; sparx CRM captures the relationship — orders, emails, support, and AI conversations on one customer record, with segments and pipeline built on the same data as your sales.',
      cta: 'Explore CRM',
    },
  },
  {
    slug: 'privacy-policy',
    name: 'Privacy policy generator',
    tagline:
      'Generate a clear, customizable privacy policy and terms of service from a short form — copy or download in minutes.',
    description:
      'Free privacy policy and terms of service generator. Answer a few questions about your business and what data you collect, and get a clean, plain-language privacy policy and terms you can copy or download. A solid starting point for any website or store — not a substitute for legal advice.',
    keywords: [
      'privacy policy generator',
      'free privacy policy',
      'terms of service generator',
      'terms and conditions generator',
      'gdpr privacy policy',
      'website legal pages',
    ],
    module: 'cms',
    icon: ScrollText,
    ladder: {
      headline: 'Generate it once. Then keep it current.',
      body: 'A policy is not write-once — it changes as your business does. sparx CMS publishes and versions your legal pages alongside the rest of your content, with revisions on every save and a clean URL.',
      cta: 'Explore CMS',
    },
  },
  {
    slug: 'domain-checker',
    name: 'Domain availability checker',
    tagline:
      'Check whether a domain is available across popular extensions in one go — find the name before you build the brand.',
    description:
      'Free domain availability checker. Enter a name and instantly see whether it is available across .com, .co, .io, .app, and more, using live registry (RDAP) data. Find the domain before you commit to the brand — then point it at a real site in minutes.',
    keywords: [
      'domain availability checker',
      'domain name search',
      'is this domain available',
      'check domain availability',
      'domain name generator',
      'find a domain',
    ],
    module: 'builder',
    icon: Globe,
    ladder: {
      headline: 'Found the domain? Now give it a home.',
      body: 'A registered domain is just a name until something answers. Point it at sparx Builder and a Let’s Encrypt cert is provisioned automatically — a real, hosted, CDN-cached site on your domain, no DNS service or upcharge.',
      cta: 'Explore Builder',
    },
  },
];

export const TOOL_SLUGS = TOOLS.map((t) => t.slug);

export function getTool(slug: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

/** Other tools, in catalog order, for the "more tools" strip on a tool page. */
export function relatedTools(slug: string, limit = 5): ToolMeta[] {
  return TOOLS.filter((t) => t.slug !== slug).slice(0, limit);
}
