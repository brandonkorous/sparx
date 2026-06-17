/**
 * Per-tool SEO + AIO (answer-engine) data. Three things search and AI engines
 * reward that the registry doesn't already carry:
 *
 *  - `seoTitle`: a keyword-front-loaded <title> (the head term first, then
 *    modifiers) — better than a brand-led title for ranking and CTR.
 *  - `answer`: one or two crisp, self-contained sentences that directly answer
 *    "what is X / does X" — the quotable block featured snippets and AI
 *    overviews extract. Also used as the WebApplication schema description.
 *  - `howTo`: short, ordered steps. Rendered as a visible list (featured-snippet
 *    and AI-overview food) and emitted as HowTo schema.
 *
 * Data-as-code (page copy), exempt from the file-size lint. Keyed by tool slug.
 */
export interface ToolHowToStep {
  name: string;
  text: string;
}

export interface ToolSeo {
  seoTitle: string;
  answer: string;
  howTo: { name: string; steps: ToolHowToStep[] };
}

export const TOOL_SEO: Record<string, ToolSeo> = {
  favicon: {
    seoTitle: 'Free Favicon Generator — PNG/SVG to ICO + Manifest',
    answer:
      'A favicon generator turns one image into the icon files browsers and phones need — a multi-size favicon.ico, Apple touch icon, PWA icons, and a web manifest. This one is free, runs entirely in your browser, and gives you the exact HTML to paste.',
    howTo: {
      name: 'How to make a favicon',
      steps: [
        { name: 'Upload an image', text: 'Drop in a square PNG or SVG, ideally at least 512×512.' },
        {
          name: 'Adjust the look',
          text: 'Set the background, padding, corner radius, theme color, and app name.',
        },
        {
          name: 'Download the package',
          text: 'Download the full favicon set, including the .ico, PNGs, and manifest, as a zip.',
        },
        {
          name: 'Add it to your site',
          text: 'Paste the generated HTML — or use the Next.js App Router files — into your project.',
        },
      ],
    },
  },
  'qr-code': {
    seoTitle: 'Free QR Code Generator — URL, Wi-Fi, vCard + Logo',
    answer:
      'A QR code generator encodes a link, Wi-Fi login, contact card, or message into a scannable square. This free tool lets you customize the colors, add a center logo, and export a high-resolution PNG or scalable SVG — no watermark, no sign-up, no expiry.',
    howTo: {
      name: 'How to make a QR code',
      steps: [
        {
          name: 'Pick the content type',
          text: 'Choose URL, text, Wi-Fi, contact card, email, SMS, or phone.',
        },
        { name: 'Enter the details', text: 'Fill in the content you want the code to carry.' },
        {
          name: 'Style it',
          text: 'Set the foreground and background colors and optionally add a center logo.',
        },
        { name: 'Download', text: 'Export a PNG for screens or an SVG for print.' },
      ],
    },
  },
  'utm-builder': {
    seoTitle: 'Free UTM Builder — Campaign URL Generator + QR',
    answer:
      'A UTM builder adds tracking parameters (utm_source, utm_medium, utm_campaign) to a link so your analytics knows where each visitor came from. This free tool builds clean, consistent campaign URLs with channel presets, lowercase hygiene, a saved history, and a QR code.',
    howTo: {
      name: 'How to build a UTM link',
      steps: [
        {
          name: 'Enter your destination URL',
          text: 'Paste the page the link should send people to.',
        },
        {
          name: 'Add source, medium, and campaign',
          text: 'Use a channel preset or type your own values.',
        },
        {
          name: 'Copy the tagged link',
          text: 'Copy the full campaign URL, kept lowercase for clean reports.',
        },
        {
          name: 'Save or share it',
          text: 'Save it to your history, or grab the auto-generated QR code.',
        },
      ],
    },
  },
  'og-image': {
    seoTitle: 'Free Open Graph Image Generator — 1200×630 Cards',
    answer:
      'An Open Graph image generator creates the 1200×630 preview image shown when your link is shared on social media. This free tool designs a clean card with a headline, accent color, and logo, then exports the PNG for your og:image tag.',
    howTo: {
      name: 'How to make an Open Graph image',
      steps: [
        {
          name: 'Write your headline',
          text: 'Type the title and eyebrow that should appear on the card.',
        },
        {
          name: 'Pick a theme and accent',
          text: 'Choose light or dark and set your brand accent color.',
        },
        { name: 'Add your logo', text: 'Optionally drop a logo into the corner.' },
        {
          name: 'Download the PNG',
          text: 'Export the 1200×630 image and add it to your og:image tag.',
        },
      ],
    },
  },
  'email-signature': {
    seoTitle: 'Free Email Signature Generator — Gmail & Outlook HTML',
    answer:
      'An email signature generator creates a professional HTML signature with your name, title, photo, and links. This free tool produces client-safe, table-based HTML you can copy straight into Gmail, Outlook, or Apple Mail.',
    howTo: {
      name: 'How to make an email signature',
      steps: [
        {
          name: 'Enter your details',
          text: 'Add your name, title, company, and contact information.',
        },
        {
          name: 'Add links and a photo',
          text: 'Include social links and optionally a photo or logo.',
        },
        { name: 'Pick a layout and accent', text: 'Choose a layout and your brand accent color.' },
        {
          name: 'Copy it in',
          text: 'Click Copy signature and paste it into your email client settings.',
        },
      ],
    },
  },
  invoice: {
    seoTitle: 'Free Invoice Generator — Branded PDF, No Sign-Up',
    answer:
      'An invoice generator creates an itemized bill with your logo, line items, tax, and totals. This free tool calculates the totals automatically and downloads a print-ready PDF in any currency — no account, no watermark.',
    howTo: {
      name: 'How to create an invoice',
      steps: [
        {
          name: 'Add your business and client',
          text: 'Enter your details, a logo, and who you are billing.',
        },
        { name: 'Enter line items', text: 'Add each item with quantity and unit price.' },
        {
          name: 'Set tax, discount, and currency',
          text: 'The subtotal, tax, and total calculate automatically.',
        },
        { name: 'Download the PDF', text: 'Download a print-ready PDF to send.' },
      ],
    },
  },
  'email-deliverability': {
    seoTitle: 'Free SPF, DKIM & DMARC Checker + Record Generator',
    answer:
      'SPF, DKIM, and DMARC are the three DNS records that decide whether your email reaches the inbox or the spam folder. This free tool generates the records you need to publish and checks any domain’s existing records live, right in your browser.',
    howTo: {
      name: 'How to set up email authentication',
      steps: [
        {
          name: 'Check your current records',
          text: 'Enter your domain to see its live SPF, DKIM, and DMARC.',
        },
        {
          name: 'Generate an SPF record',
          text: 'Pick your email provider and policy to build the TXT record.',
        },
        { name: 'Generate a DMARC record', text: 'Choose a policy and a reporting address.' },
        {
          name: 'Publish and re-check',
          text: 'Add the records as TXT entries in your DNS, then check again.',
        },
      ],
    },
  },
  'meta-tags': {
    seoTitle: 'Free Meta Tag Generator — Title, Description + Preview',
    answer:
      'A meta tag generator writes the title, description, and Open Graph tags that control how your page appears in Google and on social media. This free tool shows a live search and social preview with character counts, then gives you the full meta block to paste.',
    howTo: {
      name: 'How to write meta tags',
      steps: [
        {
          name: 'Enter your title and description',
          text: 'Watch the character counts to avoid truncation.',
        },
        {
          name: 'Add your URL and OG image',
          text: 'Set the canonical URL and an optional social image.',
        },
        { name: 'Check the previews', text: 'Confirm the Google and social card look right.' },
        { name: 'Copy the meta block', text: 'Paste the full set of tags into your <head>.' },
      ],
    },
  },
  'color-palette': {
    seoTitle: 'Free Color Palette Generator — Harmony + Tailwind Scale',
    answer:
      'A color palette generator turns one brand color into a complete, harmonious scheme. This free tool generates complementary, analogous, triadic, tetradic, monochromatic, or fully random accent colors from your base, lets you shuffle for fresh variations and lock the colors you like, previews the palette on real UI, and exports a full 50–950 tint and shade scale for every color as CSS variables or a Tailwind config.',
    howTo: {
      name: 'How to build a color palette',
      steps: [
        { name: 'Pick your brand color', text: 'Enter the hex of your primary color.' },
        {
          name: 'Choose a harmony',
          text: 'Pick a scheme — complementary, analogous, triadic, tetradic, or monochromatic — and how many accent colors to generate.',
        },
        {
          name: 'Shuffle and lock',
          text: 'Press Shuffle (or the spacebar) to explore variations, and lock the colors you want to keep so they stay fixed while the rest re-roll.',
        },
        {
          name: 'Copy the export',
          text: 'Copy the full CSS variables or Tailwind config — a 50–950 scale for the primary and every accent.',
        },
      ],
    },
  },
  'margin-calculator': {
    seoTitle: 'Free Margin & Markup Calculator — Price + Break-Even',
    answer:
      'A margin calculator works out profit margin, markup, profit per unit, and break-even from your cost and price. This free tool also reverses the math — enter a target margin and it tells you the price to charge.',
    howTo: {
      name: 'How to calculate margin',
      steps: [
        { name: 'Enter cost and price', text: 'Type your unit cost and sale price.' },
        {
          name: 'Read the results',
          text: 'See margin %, markup %, and profit per unit instantly.',
        },
        {
          name: 'Price for a target margin',
          text: 'Enter a target margin to get the price to charge.',
        },
        { name: 'Find break-even', text: 'Add fixed costs to see how many units cover them.' },
      ],
    },
  },
  quote: {
    seoTitle: 'Free Quote & Estimate Generator — Branded PDF',
    answer:
      'A quote generator creates an itemized estimate with your logo, line items, totals, and a valid-until date. This free tool calculates totals automatically and downloads a print-ready PDF in any currency — no account, no watermark.',
    howTo: {
      name: 'How to create a quote',
      steps: [
        {
          name: 'Add your business and client',
          text: 'Enter your details and who the quote is for.',
        },
        { name: 'Enter line items', text: 'Add each item with quantity and price.' },
        { name: 'Set a valid-until date', text: 'Choose how long the quote stays good.' },
        { name: 'Download the PDF', text: 'Download a print-ready PDF to send.' },
      ],
    },
  },
  'structured-data': {
    seoTitle: 'Free JSON-LD Schema Generator — Rich Results Markup',
    answer:
      'A structured data generator creates the JSON-LD schema.org markup Google reads to show rich results like ratings, prices, and FAQs. This free tool builds valid markup for Local Business, Product, Article, and FAQ — fill the form and copy the script.',
    howTo: {
      name: 'How to add structured data',
      steps: [
        { name: 'Pick a schema type', text: 'Choose Local Business, Product, Article, or FAQ.' },
        { name: 'Fill in the details', text: 'Enter the fields for your content.' },
        { name: 'Copy the JSON-LD', text: 'Copy the generated script block.' },
        {
          name: 'Paste and test',
          text: 'Add it to your page and verify with the Rich Results Test.',
        },
      ],
    },
  },
  'contrast-checker': {
    seoTitle: 'Free Color Contrast Checker — WCAG AA & AAA',
    answer:
      'A color contrast checker measures the ratio between text and its background and tells you whether it passes WCAG AA and AAA for accessibility. This free tool shows the exact ratio with a live preview for normal and large text.',
    howTo: {
      name: 'How to check color contrast',
      steps: [
        { name: 'Enter your text color', text: 'Set the foreground color.' },
        { name: 'Enter your background color', text: 'Set the color behind the text.' },
        { name: 'Read the ratio', text: 'See the exact contrast ratio.' },
        { name: 'Check AA and AAA', text: 'Confirm it passes for normal and large text.' },
      ],
    },
  },
  barcode: {
    seoTitle: 'Free Barcode Generator — Code128, UPC, EAN + SKU',
    answer:
      'A barcode generator encodes a number or SKU into a scannable barcode with a valid check digit. This free tool supports Code128, UPC-A, EAN-13, EAN-8, and Code39, and exports a crisp PNG or scalable SVG.',
    howTo: {
      name: 'How to make a barcode',
      steps: [
        { name: 'Choose a format', text: 'Pick Code128, UPC, EAN, or Code39 for your use.' },
        { name: 'Enter your value', text: 'Type the number or SKU to encode.' },
        { name: 'Style it', text: 'Set the colors, height, and whether to show the number.' },
        { name: 'Download', text: 'Export a PNG or SVG.' },
      ],
    },
  },
  'digital-card': {
    seoTitle: 'Free Digital Business Card — vCard + QR Generator',
    answer:
      'A digital business card generator creates a vCard (.vcf) file and a QR code that saves your contact details into any phone with a tap or scan. This free tool builds both from your name, title, company, and links.',
    howTo: {
      name: 'How to make a digital business card',
      steps: [
        { name: 'Enter your details', text: 'Add your name, title, company, and contact info.' },
        { name: 'Review the card', text: 'Check the preview and the generated QR code.' },
        { name: 'Download the .vcf', text: 'Download the vCard file to share.' },
        { name: 'Share the QR', text: 'Let people scan it to save your contact instantly.' },
      ],
    },
  },
  'privacy-policy': {
    seoTitle: 'Free Privacy Policy Generator — + Terms of Service',
    answer:
      'A privacy policy generator assembles a clear, plain-language privacy policy and terms of service from a few questions about your business and the data you collect. This free tool covers the common GDPR and CCPA sections — a solid starting point, not legal advice.',
    howTo: {
      name: 'How to create a privacy policy',
      steps: [
        { name: 'Enter your business details', text: 'Add your name, website, and contact email.' },
        { name: 'Choose what you collect', text: 'Toggle the data types and services you use.' },
        { name: 'Pick the regions you serve', text: 'Include the right GDPR and CCPA language.' },
        { name: 'Copy or download', text: 'Grab the privacy policy and terms as markdown.' },
      ],
    },
  },
  'domain-checker': {
    seoTitle: 'Free Domain Availability Checker — .com, .io & more',
    answer:
      'A domain availability checker tells you whether a domain name is registered or free across multiple extensions at once, using live registry (RDAP) data. This free tool checks .com, .co, .io, .app, and more in a single search.',
    howTo: {
      name: 'How to check domain availability',
      steps: [
        { name: 'Enter a name', text: 'Type the name you want — we add the extensions.' },
        { name: 'Pick extensions', text: 'Select .com, .co, .io, .app, and any others.' },
        { name: 'Run the check', text: 'Check availability across all of them at once.' },
        { name: 'See the results', text: 'Find which extensions are still available.' },
      ],
    },
  },
};

export function getToolSeo(slug: string): ToolSeo | undefined {
  return TOOL_SEO[slug];
}
