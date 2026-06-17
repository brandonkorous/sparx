/**
 * Per-tool editorial content — the "Good to know" explainer + FAQ shown on
 * every tool page (rendered by ToolLearn, with the FAQ also emitted as
 * schema.org JSON-LD for rich results). This is what keeps the pages
 * substantial SEO landing pages rather than bare utilities.
 *
 * Data-as-code: this is the catalog of page copy, exempt from the file-size
 * lint. Keyed by tool slug; every slug in registry.ts should have an entry.
 */
export interface ToolPoint {
  title: string;
  body: string;
}

export interface ToolFaqItem {
  q: string;
  a: string;
}

export interface ToolContent {
  /** Section heading; defaults to "Good to know". */
  heading?: string;
  points: ToolPoint[];
  faq: ToolFaqItem[];
}

export const TOOL_CONTENT: Record<string, ToolContent> = {
  favicon: {
    points: [
      {
        title: "What's in the package",
        body: 'From one image we render the full real-world set: a multi-resolution favicon.ico (16/32/48), standalone PNGs, an apple-touch-icon, 192 and 512 PWA icons, a maskable icon for Android, and a site.webmanifest — plus the exact markup to paste.',
      },
      {
        title: 'Everything stays on your device',
        body: 'Your image is processed entirely in your browser with the Canvas API. Nothing is uploaded, so there is no queue, no watermark, and no privacy trade-off — the reason most online generators feel slow and sketchy.',
      },
    ],
    faq: [
      {
        q: 'What size should my source image be?',
        a: 'A square PNG or SVG of at least 512×512 looks best — it scales down cleanly to every icon size. SVG is ideal because it is resolution-independent.',
      },
      {
        q: 'Where do I put the files?',
        a: "Drop them in your site's root directory and paste the generated <link> tags into your <head>. If you use Next.js, the App Router export shows the file-convention names to use instead.",
      },
      {
        q: 'What is a maskable icon?',
        a: 'Android masks app icons into circles, squircles, and other shapes. A maskable icon adds padding (a "safe zone") and a solid background so it looks right whatever shape the device applies.',
      },
    ],
  },
  'qr-code': {
    points: [
      {
        title: 'Encode more than links',
        body: 'Switch the content type to make a QR for a URL, plain text, a Wi-Fi login, a contact card (vCard), an email, an SMS, or a phone number. Each builds the correct format so phones recognize it instantly.',
      },
      {
        title: 'Add a logo without breaking the scan',
        body: 'Drop your logo in the center and we automatically raise the error-correction level so the code still scans reliably. Export a crisp PNG or an infinitely-scalable SVG for print.',
      },
    ],
    faq: [
      {
        q: 'Do these QR codes expire?',
        a: 'No. The code encodes your content directly — there is no redirect or tracking link in between — so it works forever and never depends on our servers.',
      },
      {
        q: 'PNG or SVG — which should I use?',
        a: 'Use PNG for screens and quick prints. Use SVG for anything large or professionally printed (posters, packaging, signage) because it stays sharp at any size.',
      },
      {
        q: 'Will a logo stop it from scanning?',
        a: 'Not if you keep it centered and modest in size. We bump error correction to High when you add a logo, which lets the code tolerate the covered area.',
      },
    ],
  },
  'utm-builder': {
    points: [
      {
        title: 'Tag links so analytics can read them',
        body: 'UTM parameters (utm_source, utm_medium, utm_campaign…) tell Google Analytics and most tools where a visitor came from. Consistent tags are the difference between clean attribution and a pile of "direct / none".',
      },
      {
        title: 'Presets and lowercase keep it consistent',
        body: 'Channel presets fill source and medium for you, and the lowercase toggle prevents "Google" and "google" from splitting into two reports. Saved links keep naming consistent across a team.',
      },
    ],
    faq: [
      {
        q: "What's the difference between source and medium?",
        a: 'Source is where the traffic comes from (google, newsletter, facebook). Medium is the type of traffic (cpc, email, social). Campaign is the specific promotion (spring_sale).',
      },
      {
        q: 'Should UTM values be lowercase?',
        a: 'Yes — analytics treats Source and source as different values, which splits your reports. Keeping everything lowercase (the default here) avoids that.',
      },
      {
        q: 'Do UTMs hurt my SEO?',
        a: 'No. Search engines ignore UTM parameters for ranking. Just avoid putting them on internal links between your own pages, which can confuse analytics.',
      },
    ],
  },
  'og-image': {
    points: [
      {
        title: 'The image every shared link needs',
        body: 'When someone posts your URL on X, LinkedIn, Slack, or iMessage, the platform shows the Open Graph image. Without one you get a blank or cropped mess; with one your link looks designed.',
      },
      {
        title: '1200×630, the size that works everywhere',
        body: 'We render at 1200×630 — the ratio every major platform accepts — with an auto-fitting headline so short or long titles both look composed. Download the PNG and reference it in your og:image tag.',
      },
    ],
    faq: [
      {
        q: 'What size should an OG image be?',
        a: "1200×630 pixels (a 1.91:1 ratio). It's the size Facebook, LinkedIn, and X all render cleanly, and what this tool exports.",
      },
      {
        q: "How do I use the image once I've downloaded it?",
        a: 'Upload it to your site, then add the og:image and twitter:image meta tags to your <head>. The snippet on this page has the full block.',
      },
      {
        q: 'Why does my link still show the old image?',
        a: "Platforms cache OG images. Use the platform's sharing debugger (e.g. LinkedIn Post Inspector) to force a refresh after you update it.",
      },
    ],
  },
  'email-signature': {
    points: [
      {
        title: 'Built to survive every email client',
        body: 'The signature is table-based HTML with fully inlined styles — the only structure Gmail, Outlook, and Apple Mail render consistently. Social links are text, not images, because most clients block remote images by default.',
      },
      {
        title: 'Copy once, paste anywhere',
        body: '"Copy signature" puts formatted HTML on your clipboard so you can paste it straight into your email client\'s signature settings — no HTML knowledge needed. "Copy HTML" gives you the source instead.',
      },
    ],
    faq: [
      {
        q: 'How do I add this to Gmail?',
        a: 'Click Copy signature, then in Gmail go to Settings → General → Signature, create a signature, and paste. The formatting comes across intact.',
      },
      {
        q: 'Will my photo and logo show up?',
        a: 'They\'re embedded directly in the signature, so they travel with it. Very strict clients may ask the recipient to "show images", which is normal for any email graphic.',
      },
      {
        q: 'Are my details stored anywhere?',
        a: 'Only in your own browser (localStorage), so your signature is ready next time. Nothing is sent to a server.',
      },
    ],
  },
  invoice: {
    points: [
      {
        title: 'Itemized, calculated, and branded',
        body: 'Add line items, a tax rate, and a discount, and the subtotal, tax, and total update live. Drop in your logo and pick an accent color, and the PDF matches your brand.',
      },
      {
        title: 'A real PDF, built in your browser',
        body: 'The download is a genuine, print-ready PDF generated client-side — not a screenshot. Any currency is supported, and your business details are saved locally so the next invoice starts filled in.',
      },
    ],
    faq: [
      {
        q: 'Is the PDF really free with no watermark?',
        a: 'Yes. No account, no watermark, and no limit on how many invoices you create. Everything happens in your browser.',
      },
      {
        q: 'Can I use my own currency?',
        a: 'Yes — pick from common currencies and every amount formats correctly, including the symbol and decimal rules for that currency.',
      },
      {
        q: 'Do you store my invoices or client data?',
        a: "No. Your business details are saved only in your browser so you don't retype them; nothing is uploaded.",
      },
    ],
  },
  'email-deliverability': {
    points: [
      {
        title: 'The three records that decide the inbox',
        body: 'SPF says which servers may send for your domain, DKIM cryptographically signs your mail, and DMARC tells receivers what to do on failure. Get all three right and your email stops landing in spam.',
      },
      {
        title: 'Generate, then verify — live',
        body: "Build the exact DNS records to publish, then check any domain's existing SPF, DKIM, and DMARC straight from your browser using public DNS — no account, no waiting on a tool to email you a report.",
      },
    ],
    faq: [
      {
        q: "What's the difference between SPF, DKIM, and DMARC?",
        a: 'SPF authorizes sending servers, DKIM signs the message so it cannot be tampered with, and DMARC ties them together and tells mailbox providers how to handle failures (and where to send reports).',
      },
      {
        q: 'Why are my emails going to spam?',
        a: "The most common cause is missing or misconfigured authentication. If SPF, DKIM, and DMARC aren't all passing for your sending domain, providers like Gmail and Outlook are far more likely to filter you.",
      },
      {
        q: 'How long do DNS changes take?',
        a: "Usually minutes to a few hours, depending on your record's TTL. Re-run the checker after you publish to confirm the records are live.",
      },
    ],
  },
  'meta-tags': {
    points: [
      {
        title: 'See it before Google does',
        body: 'Type your title, description, and URL and watch the live Google result and social card update, with character counts so you stay inside the limits that get truncated (~60 chars for titles, ~155 for descriptions).',
      },
      {
        title: 'Copy a complete, correct block',
        body: 'The generated markup includes the title, meta description, canonical, and the Open Graph and Twitter tags that control how the page looks when shared — not just the two everyone remembers.',
      },
    ],
    faq: [
      {
        q: 'How long should a title tag be?',
        a: "Aim for under ~60 characters so Google doesn't truncate it in results. This tool warns you as you approach the limit.",
      },
      {
        q: "What's a canonical tag for?",
        a: 'It tells search engines the preferred URL for a page, which prevents duplicate-content issues when the same content is reachable from multiple URLs.',
      },
      {
        q: 'Do meta keywords matter?',
        a: 'No — Google has ignored the meta keywords tag for years. Focus on a strong title, description, and Open Graph tags, which this tool generates.',
      },
    ],
  },
  'color-palette': {
    points: [
      {
        title: 'One color, a whole scheme',
        body: 'Pick a single brand color and get matching accents from color theory — complementary, analogous, triadic, tetradic, or monochromatic — by rotating your hue around the color wheel, or switch to a free-form Random mode when you want more variety. A slider sets how many accents you want, from one to four.',
      },
      {
        title: 'Shuffle, then lock what you love',
        body: 'Hit Shuffle (or tap the spacebar) to roll fresh variations within your scheme, and lock any color to keep it fixed while the rest re-roll. A live preview applies the palette to real UI — buttons, badges, charts, alerts — so you judge it in context, not as a flat strip.',
      },
      {
        title: 'Copy it the way you build',
        body: 'Export every color — primary and each accent — as a full 50–950 ramp of CSS custom properties or a Tailwind color config, with text-on-background pairings checked against WCAG so you know which steps are safe to put words on.',
      },
    ],
    faq: [
      {
        q: 'What is a complementary color?',
        a: "It's the color directly opposite yours on the color wheel — a 180° hue rotation. Complementary pairs have the most contrast and make accents pop. Analogous colors sit next to yours for a calmer, blended look; triadic and tetradic spread three or four colors evenly for a balanced multi-color scheme.",
      },
      {
        q: 'How do I keep one color and change the rest?',
        a: 'Lock it. Click the lock on any color and it stays fixed while Shuffle — or the spacebar — re-rolls the others, so you can explore variations around a color you’ve already committed to. Unlock the primary too if you want to roll the entire palette from scratch.',
      },
      {
        q: 'How many accent colors should a brand use?',
        a: 'Most brands lean on one primary plus one or two accents, then a neutral gray. Start with one or two accents here; reach for triadic or tetradic only when you genuinely need a richer, multi-color system.',
      },
      {
        q: 'What do the 50–950 numbers mean?',
        a: "It's the convention design systems (including Tailwind) use: 50 is the lightest tint, 500 is roughly your base color, and 950 is the darkest shade — a consistent set of steps to design with. Each color in your palette gets its own ramp.",
      },
      {
        q: 'Can I use these colors with Tailwind?',
        a: "Yes — copy the Tailwind config output into your theme's colors and the whole scale, plus each accent, is available as utility classes.",
      },
    ],
  },
  'margin-calculator': {
    points: [
      {
        title: 'Any two numbers, all the answers',
        body: 'Enter cost and price, or cost and a target margin, and get margin %, markup %, profit per unit, and the price to charge. Same math whether you price a product, a service, or a project.',
      },
      {
        title: 'Know your break-even',
        body: 'Add fixed costs and the calculator shows how many units you must sell to break even — the number that says whether a price actually works for the business, not just the spreadsheet.',
      },
    ],
    faq: [
      {
        q: "What's the difference between margin and markup?",
        a: 'Markup is profit as a percentage of cost; margin is profit as a percentage of price. A 50% markup is only a 33% margin — mixing them up is a common, expensive mistake.',
      },
      {
        q: 'How do I price for a target margin?',
        a: "Enter your cost and the margin you want, and the calculator gives you the price to charge. It works backwards from the margin so you don't have to guess.",
      },
      {
        q: "What counts as 'cost'?",
        a: 'Use your fully-loaded unit cost — materials, manufacturing, inbound shipping, and per-unit fees. The more complete the cost, the more honest the margin.',
      },
    ],
  },
  quote: {
    points: [
      {
        title: 'An estimate, not yet an invoice',
        body: "A quote is a price you're offering, valid until a date you set. Add line items, tax, and a valid-until, and totals calculate live — then download a branded PDF to send.",
      },
      {
        title: 'Built to become an order',
        body: 'Quotes are the front of the B2B sales motion: send a price, the buyer accepts, it becomes an order. This generates the document; sparx B2B runs the whole flow.',
      },
    ],
    faq: [
      {
        q: "What's the difference between a quote and an invoice?",
        a: 'A quote is an offer of price before the work or sale; an invoice is a request for payment after. A quote usually includes an expiry date — this tool adds one.',
      },
      {
        q: 'How long should a quote be valid?',
        a: "It's up to you, but 14–30 days is common — long enough for the buyer to decide, short enough that your pricing and availability are still accurate.",
      },
      {
        q: 'Is it free and unwatermarked?',
        a: 'Yes. Unlimited quotes, no account, no watermark, and your business details saved locally for the next one.',
      },
    ],
  },
  'structured-data': {
    points: [
      {
        title: 'The markup behind rich results',
        body: 'Structured data is the JSON-LD that lets Google show stars, prices, FAQs, and business details right in search. Pick a type — LocalBusiness, Product, Article, FAQ — fill the form, copy a valid script.',
      },
      {
        title: 'Valid by construction',
        body: "The output follows schema.org and Google's required and recommended fields, so you avoid the missing-field warnings that stop rich results from showing.",
      },
    ],
    faq: [
      {
        q: 'What is JSON-LD?',
        a: "It's the format Google recommends for structured data — a small script block you add to your page. It describes your content to search engines without changing how the page looks.",
      },
      {
        q: 'Where do I put the script?',
        a: 'Anywhere in the page HTML — the <head> or <body> both work. Paste the generated block once per page that the schema describes.',
      },
      {
        q: 'Will this guarantee rich results?',
        a: "No tool can — Google decides when to show them. But valid, complete structured data is a requirement, and this generates exactly that. Verify with Google's Rich Results Test.",
      },
    ],
  },
  'contrast-checker': {
    points: [
      {
        title: 'The number accessibility is graded on',
        body: 'WCAG measures readability as a contrast ratio between text and background, from 1:1 to 21:1. Enter two colors and see the exact ratio and whether it passes AA and AAA for normal and large text.',
      },
      {
        title: 'Where it actually matters',
        body: 'Low contrast is the most common accessibility failure — and the one enterprise buyers and audits check first. This tells you instantly whether your colors are readable, before it is a problem.',
      },
    ],
    faq: [
      {
        q: 'What contrast ratio do I need?',
        a: 'WCAG AA requires 4.5:1 for normal text and 3:1 for large text. AAA is stricter at 7:1 and 4.5:1. This tool shows pass/fail for each.',
      },
      {
        q: "What counts as 'large' text?",
        a: '24px or larger, or 18.66px (14pt) and bold. Large text is allowed a lower contrast ratio because it is easier to read.',
      },
      {
        q: 'Does contrast affect conversions?',
        a: 'Indirectly, yes — readable pages keep users engaged, and accessibility is increasingly a legal and procurement requirement. It is cheap insurance against losing users and contracts.',
      },
    ],
  },
  barcode: {
    points: [
      {
        title: 'The right symbology, with a valid check digit',
        body: 'Pick Code128 for SKUs and internal tracking, or UPC-A and EAN-13 for retail products. We validate the input and compute the check digit so the barcode actually scans at a register.',
      },
      {
        title: 'Print-ready output',
        body: 'Download a crisp PNG for screens and labels, or an SVG that stays sharp at any size for professional printing — with an optional human-readable number beneath the bars.',
      },
    ],
    faq: [
      {
        q: 'Which barcode type should I use?',
        a: 'Use UPC-A or EAN-13 for products sold in retail, Code128 for internal SKUs and shipping, and Code39 for simple asset tags.',
      },
      {
        q: 'Do I need to buy a UPC number?',
        a: "To sell in major retail, yes — UPC/EAN numbers are issued by GS1. This tool encodes any valid number into a scannable barcode, but it doesn't assign you an official one.",
      },
      {
        q: 'Will these scan reliably?',
        a: 'Yes — the encoding and check digits follow the standards. For retail, print at adequate size and keep a quiet zone (blank margin) around the bars.',
      },
    ],
  },
  'digital-card': {
    points: [
      {
        title: 'Tap or scan, contact saved',
        body: 'A digital business card is a vCard (.vcf) — the format every phone understands. Download the file to share by AirDrop or attachment, or let people scan the QR to drop your details into their contacts.',
      },
      {
        title: 'Always current, nothing to reprint',
        body: 'Update your details and re-share — no reprinting a stack of cards. The QR and file carry your name, title, company, phone, email, and links.',
      },
    ],
    faq: [
      {
        q: 'What is a vCard?',
        a: 'A .vcf file — the universal contact format. When someone opens it or scans the QR, their phone offers to save your details as a new contact, complete with phone, email, and links.',
      },
      {
        q: 'Do they need an app to scan it?',
        a: 'No. The built-in camera on modern iPhones and Android phones reads the QR and offers to add the contact directly.',
      },
      {
        q: 'Can I use it on my lock screen or by NFC?',
        a: 'This generates the vCard and QR that power those flows. Save the QR as your lock-screen image or share the .vcf by tap, scan, or attachment.',
      },
    ],
  },
  'privacy-policy': {
    points: [
      {
        title: 'Answer a few questions, get the document',
        body: 'Tell us your business name, your site, what data you collect, and the regions you serve, and we assemble a clear, plain-language privacy policy and terms you can copy or download.',
      },
      {
        title: 'A solid starting point — read it',
        body: 'The output covers the sections most sites need (data collected, cookies, third parties, your rights, contact). Adapt it to how your business actually works; it is a strong draft, not legal advice.',
      },
    ],
    faq: [
      {
        q: 'Is this a substitute for a lawyer?',
        a: "It's a well-structured starting point, not legal advice. For regulated industries or high-risk data, have a professional review it. For a typical small site or store, it covers the essentials clearly.",
      },
      {
        q: 'Does it cover GDPR and CCPA?',
        a: 'It includes the common sections those laws expect (lawful basis, data-subject rights, contact for requests). Pick the regions you serve and the relevant language is included — then confirm it matches your real practices.',
      },
      {
        q: 'Where do I publish it?',
        a: 'Link it in your site footer and anywhere you collect data (signup, checkout). Keep it current as your data practices change.',
      },
    ],
  },
  'domain-checker': {
    points: [
      {
        title: 'Check the whole shortlist at once',
        body: 'Enter a name and we check availability across .com, .co, .io, .app and more in one pass, using live registry (RDAP) data — so you find an open name before you fall for a taken one.',
      },
      {
        title: 'Authoritative, not a guess',
        body: 'RDAP is the registries\' structured WHOIS successor, so an "available" result reflects the actual registry, not a cached guess. Register through any registrar you like.',
      },
    ],
    faq: [
      {
        q: 'How accurate is the availability check?',
        a: "It queries RDAP, the registries' authoritative data, so it's accurate at the moment you check. Premium or reserved names can still carry special pricing at the registrar.",
      },
      {
        q: 'Does checking a domain here register it?',
        a: 'No — this only checks availability. To register, take the name to a domain registrar. Nothing you type is stored.',
      },
      {
        q: 'Why are some extensions skipped?',
        a: "We check the most common extensions for startups and businesses. A few niche TLDs don't expose public RDAP and are skipped rather than guessed.",
      },
    ],
  },
};

export function getToolContent(slug: string): ToolContent | undefined {
  return TOOL_CONTENT[slug];
}
