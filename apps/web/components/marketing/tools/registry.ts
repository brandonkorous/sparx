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
import { AppWindow, Link2, QrCode, ReceiptText, Share2, Signature } from 'lucide-react';
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
      body: 'Print a QR on a shelf tag, a menu, or a flyer and point it at a real storefront. sparx Commerce puts products, cart, checkout, and live inventory behind every scan — D2C or B2B, on one bill.',
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
];

export const TOOL_SLUGS = TOOLS.map((t) => t.slug);

export function getTool(slug: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

/** Other tools, in catalog order, for the "more tools" strip on a tool page. */
export function relatedTools(slug: string, limit = 5): ToolMeta[] {
  return TOOLS.filter((t) => t.slug !== slug).slice(0, limit);
}
