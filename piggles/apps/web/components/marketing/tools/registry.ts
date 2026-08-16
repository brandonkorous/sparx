import {
    faAddressBook,
    faBarcode,
    faBracketsCurly,
    faCalculator,
    faCircleHalfStroke,
    faEnvelopeCircleCheck,
    faFileCircleCheck,
    faFileMagnifyingGlass,
    faGlobe,
    faLink,
    faPalette,
    faQrcode,
    faReceipt,
    faScroll,
    faShareNodes,
    faSignature,
    faWindow,
} from '@fortawesome/pro-solid-svg-icons';
import type { PigglesIcon } from '@piggles/ui';
import type { PigglesGroup } from '@piggles/brand';
import { APP_BY_ID, APP_GROUP } from '@piggles/config';

/**
 * The free tools, and the single source of truth for all of them.
 *
 * One entry drives, with nothing to keep in step by hand: the card on /tools, the
 * tool page's own title, description, keywords, canonical and social card, its
 * entry in the sitemap, the color the page wears, and the app it hands you on to
 * at the bottom.
 *
 * ── WHY THE CLOSE IS NOT AN UPSELL ──────────────────────────────────────────
 *
 * The genre convention is that a free tool ends by naming the paid thing it is a
 * sample of — "you have used the free favicon maker, now buy the Website
 * module". Piggles has nothing to sell that way. There is one plan, every app is
 * in it, and there is no smaller version of Piggles to be upgraded from
 * (CLAUDE.md RULE #2). So the close does a different job: it names the app that
 * carries on where the tool stops, and the honest fact that it is not a separate
 * purchase.
 *
 * That is a better close than the one it replaces, not a weaker one. "This is
 * included" beats "this is available" every time, and it is true.
 *
 * ── AND WHY THE NAMES ARE NOT THE SEARCH TERMS ──────────────────────────────
 *
 * `slug` is what somebody types into Google. `name` is what they understand once
 * they arrive, and the two are allowed to differ: nobody has ever wanted an
 * "Open Graph image", they want the picture that shows up when their link gets
 * posted. The searchable phrasing lives in `description` and `keywords`, where it
 * does its work without a florist having to read the words "structured data" to
 * find out what a page does. Slugs stay query-shaped; headings stay human.
 *
 * Data-as-code. Deliberately verbose — this file IS the copy.
 */

export interface PigglesTool {
    /** URL segment: /tools/<slug>. Query-shaped — this is the part Google reads. */
    slug: string;
    /** What a person sees: the card title and the page's heading. */
    name: string;
    /** One line under the heading, and the same line on the hub card. */
    tagline: string;
    /** The long version — meta description, and the expanded card. */
    description: string;
    /** The searches this page should deserve to win. */
    keywords: string[];
    /** The Piggles app that carries on where the tool stops. Sets the page's
     *  color (through the app's group) and the destination of the close. */
    app: string;
    /** Card and heading glyph. */
    icon: PigglesIcon;
    /** The close. No `cta` field — the label is built from the app, so a renamed
     *  app can never leave seventeen buttons pointing at the old name. */
    ladder: { headline: string; body: string };
    /**
     * What leaves the browser, in the customer's words.
     *
     * Absent means nothing does, and the assurance strip says so. Two of these
     * seventeen genuinely have to ask the internet a question — you cannot find out
     * whether a domain is taken without asking somebody — and a blanket "nothing is
     * uploaded" printed across all seventeen would be a lie on two of them.
     *
     * DESIGN.md §10: a claim on a Piggles surface has to be true, and the assurance
     * strip is the single most load-bearing place on a free-tool page for that,
     * because it is the sentence that decides whether somebody types their
     * customer's address into the invoice form.
     */
    leaves?: string;
}

export const TOOLS: readonly PigglesTool[] = [
    {
        slug: 'favicon',
        name: 'Favicon maker',
        tagline:
            'The little picture in the browser tab. Drop your logo in and get every size a laptop, a phone and a bookmark bar quietly expect.',
        description:
            'Free favicon generator. Drop in a PNG, SVG or JPG and download the whole set a real website needs — a multi-size .ico, the Apple touch icon phones use when somebody saves you to their home screen, the 192 and 512 pixel versions, a maskable icon for Android, a web manifest, and the exact lines of code to paste. It happens in your browser, so the picture never leaves your computer.',
        keywords: [
            'favicon generator',
            'png to ico',
            'favicon converter',
            'ico converter',
            'apple touch icon',
            'site webmanifest',
            'favicon package',
            'browser tab icon',
        ],
        app: 'site',
        icon: faWindow,
        ladder: {
            headline: 'A tab icon is the smallest part of looking real.',
            body: 'My Site is the rest of it — pages you can move around without touching code, your own web address, and the padlock beside it taken care of. The favicon you just made drops straight in.',
        },
    },
    {
        slug: 'qr-code',
        name: 'QR code maker',
        tagline:
            'A code people scan with a phone camera — for a menu, a table, a shelf tag, your Wi-Fi, or your own contact details. Your colors, your logo, no expiry.',
        description:
            'Free QR code generator. Turn a web address, a message, your Wi-Fi login, your contact details, an email or a phone number into a sharp, scannable code. Choose the colors, drop your logo in the middle, and download a PNG for printing or an SVG that stays crisp at any size — poster or business card. No sign-up, no watermark, and it never stops working.',
        keywords: [
            'qr code generator',
            'free qr code',
            'wifi qr code',
            'vcard qr code',
            'qr code with logo',
            'svg qr code',
            'menu qr code',
            'table qr code',
        ],
        app: 'sell',
        icon: faQrcode,
        ladder: {
            headline: 'A code is only as good as what it opens.',
            body: 'Print one on a table card and point it at something that can actually take the order. Sell holds the products, the prices, the checkout and the stock count behind every scan — the same list whether somebody scans it, walks in, or rings you.',
        },
    },
    {
        slug: 'utm-builder',
        name: 'Link tracker',
        tagline:
            'Build a link that tells you where somebody came from — the post, the newsletter, the flyer — so you can stop guessing which one is working.',
        description:
            'Free UTM link builder. Add the tags analytics tools read — source, medium, campaign — to any link, with ready-made presets for the places you actually post, live checks for the small mistakes that quietly break tracking, a saved history of every link you have built, and a one-tap QR code for the printed version.',
        keywords: [
            'utm builder',
            'utm link builder',
            'campaign url builder',
            'utm generator',
            'google analytics utm',
            'utm parameters',
            'trackable link',
        ],
        app: 'get_found',
        icon: faLink,
        ladder: {
            headline: 'Tagging the click is half of it.',
            body: 'Get Found shows which posts, searches and links bring people in. And because it sits on the same customer list as your orders, a tagged click does not stop at a number — it carries on into who they turned out to be.',
        },
    },
    {
        slug: 'og-image',
        name: 'Share image maker',
        tagline:
            'The picture that shows up when somebody posts your link. Make one that looks chosen, instead of whatever the internet grabbed.',
        description:
            'Free social share image maker. Design the 1200 × 630 preview card that appears when your link is pasted into a message, a post or a group chat — a headline, your color, your logo, light or dark — and download a PNG ready to use as your og:image. It is the difference between a link that looks published and one that looks pasted.',
        keywords: [
            'open graph image generator',
            'og image maker',
            'twitter card generator',
            'social share image',
            '1200x630 image',
            'link preview image',
        ],
        app: 'content',
        icon: faShareNodes,
        ladder: {
            headline: 'A good cover in front of something worth opening.',
            body: 'Content is where the thing behind the link lives — articles, pages and pictures you write once and use in several places, with the fiddly search bits filled in as you publish rather than afterwards.',
        },
    },
    {
        slug: 'email-signature',
        name: 'Email signature maker',
        tagline:
            'The few tidy lines under everything you send. Build one, copy it, paste it into Gmail, Outlook or Apple Mail.',
        description:
            'Free email signature generator. Put in your name, what you do, your phone number and your links, pick a layout and a color, and copy a clean signature straight into Gmail, Outlook or Apple Mail. Built the sturdy, old-fashioned way that survives every mail app — including the ones that break everything else.',
        keywords: [
            'email signature generator',
            'html email signature',
            'gmail signature',
            'outlook signature',
            'professional email signature',
            'free email signature',
        ],
        app: 'messages',
        icon: faSignature,
        ladder: {
            headline: 'One email looks right. Now do the next four thousand.',
            body: 'Messages sends the rest — the receipt, the reminder, the once-a-month note to everybody — from your own address, with the plumbing that keeps it out of spam already done.',
        },
    },
    {
        slug: 'invoice',
        name: 'Invoice maker',
        tagline:
            'An itemised invoice with your logo, your tax and the totals worked out — as a PDF you can print or attach. No account, nothing stamped across it.',
        description:
            'Free invoice generator. Add your details and your customer’s, list what you did, set the tax and any discount, and download a clean, print-ready PDF with your logo on it. The totals add themselves, any currency works, and your own details are remembered on this device for next time. No sign-up and no watermark.',
        keywords: [
            'invoice generator',
            'free invoice generator',
            'invoice maker',
            'pdf invoice',
            'invoice template',
            'create an invoice',
        ],
        app: 'invoices',
        icon: faReceipt,
        ladder: {
            headline: 'Invoice number one is a PDF. Number two hundred is a job.',
            body: 'Invoices keeps the running list — who has been billed, who has paid, who is three weeks late — and sends the polite nudge for you, so chasing money stops being a Sunday evening activity.',
        },
    },
    {
        slug: 'email-deliverability',
        name: 'Email delivery checker',
        tagline:
            'Three settings on your domain decide whether your email lands in the inbox or the spam folder. Check yours, or generate the ones you are missing.',
        description:
            'Free SPF, DKIM and DMARC checker and generator. Look up what your domain publishes today — live, from your browser — and see in plain words whether it is right. Missing one? Generate the exact record to paste into your domain settings. These three lines are the most common reason a real business’s email quietly stops arriving.',
        keywords: [
            'spf record generator',
            'dkim record',
            'dmarc record generator',
            'spf checker',
            'dmarc checker',
            'email deliverability',
            'email going to spam',
        ],
        app: 'messages',
        icon: faEnvelopeCircleCheck,
        ladder: {
            headline: 'Nobody should have to learn what DKIM is.',
            body: 'Messages sets all three up when you connect your domain, then keeps an eye on them — so “is our email arriving?” is a screen you can look at, rather than something you find out from a customer.',
        },
        leaves:
            'Checking a domain looks it up in public DNS, so the domain name you type is sent to a public lookup service. Nothing else is, and generating a record sends nothing at all.',
    },
    {
        slug: 'meta-tags',
        name: 'Search result preview',
        tagline:
            'Write the title and the description Google shows, and see exactly how they will look — before the page goes live.',
        description:
            'Free meta tag generator with a live search preview. Type your title and description and watch the Google result and the social card update as you go, with the character counts that decide whether your sentence gets cut off halfway thr… Then copy the finished block for your page — title, description, canonical, and the social tags.',
        keywords: [
            'meta tag generator',
            'serp preview',
            'title tag',
            'meta description',
            'google preview tool',
            'open graph tags',
            'seo meta tags',
        ],
        app: 'get_found',
        icon: faFileMagnifyingGlass,
        ladder: {
            headline: 'That little grey line is your shop window.',
            body: 'Get Found writes one for every page you publish, finds the pages you forgot, and tells you which searches are actually bringing people in — instead of leaving you to guess at a hundred pages by hand.',
        },
    },
    {
        slug: 'color-palette',
        name: 'Color palette maker',
        tagline:
            'Press the space bar until something looks right. Keep the colors you like, shuffle the rest, and see the whole set on a real shop page before you commit to it.',
        description:
            'Free brand color palette generator. Press space for a new set, keep the ones worth keeping and re-roll the rest, drag them into the order you want, and open any color for every lighter and darker step. Then see the palette on an actual shop page, a phone and an invoice — with which color is the button and which is the writing worked out for you, every readable pairing measured, and a check for how it all looks to somebody who is color blind. Take it away as a silicaui theme, CSS variables, Tailwind, SCSS, a picture, or just the link.',
        keywords: [
            'color palette generator',
            'complementary color generator',
            'color harmony',
            'color scheme generator',
            'brand colors',
            'tailwind color generator',
            'css variables colors',
            'color blindness simulator',
            'color contrast checker',
        ],
        app: 'site',
        icon: faPalette,
        ladder: {
            headline: 'Choosing the colors is the fun part.',
            body: 'My Site is the other part — it takes a palette and puts it everywhere at once, every button and every heading and every page, and changes all of them again when you change your mind. Which you will.',
        },
    },
    {
        slug: 'margin-calculator',
        name: 'Pricing calculator',
        tagline:
            'What should I charge? Put in any two numbers — what it costs, what you sell it for, the margin you want — and get the rest, including how many you need to sell to break even.',
        description:
            'Free margin and markup calculator. Enter what something costs you and what you sell it for, or what it costs and the margin you are aiming at, and see the margin, the markup, the profit on each one, and the price that gets you there. Add your fixed monthly costs and it works out how many you have to sell before you are actually ahead. The sum every owner redoes on the back of an envelope.',
        keywords: [
            'margin calculator',
            'markup calculator',
            'profit margin calculator',
            'pricing calculator',
            'break even calculator',
            'gross margin',
            'what should i charge',
        ],
        app: 'money',
        icon: faCalculator,
        ladder: {
            headline: 'Working the number out is easy. Holding the line is the hard bit.',
            body: 'Money shows what actually came in, what went out and what you kept — per product and overall — so the margin you calculated in January is something you can check in June rather than assume.',
        },
    },
    {
        slug: 'quote',
        name: 'Quote maker',
        tagline:
            'A tidy, itemised quote with your logo, the totals and a date it runs out — as a PDF you can send today.',
        description:
            'Free quote and estimate generator. Put in your details and the customer’s, list the work, add tax and a valid-until date, and download a professional PDF with your logo. Totals calculate themselves, any currency works, and your own details are kept on this device for the next one. No sign-up, no watermark.',
        keywords: [
            'quote generator',
            'estimate generator',
            'free quote template',
            'pdf quote',
            'price quote maker',
            'sales estimate',
        ],
        app: 'invoices',
        icon: faFileCircleCheck,
        ladder: {
            headline: 'The quote you send is the easy half. The four you are waiting on are not.',
            body: 'Invoices keeps every quote in one list — sent, seen, accepted, gone quiet — and turns an accepted one into the actual bill without you retyping a single line.',
        },
    },
    {
        slug: 'structured-data',
        name: 'Google business markup',
        tagline:
            'The hidden lines that tell Google your opening hours, your prices and your ratings — so it can show them in the result instead of just a link.',
        description:
            'Free structured data generator. Fill in a short form about your business, a product, an article or your common questions, and copy out the code search engines read to show the extra bits: opening hours, address, price, ratings, and questions that unfold right in the results. No knowledge of schema.org required — that is rather the point.',
        keywords: [
            'json-ld generator',
            'structured data generator',
            'schema markup generator',
            'rich results',
            'schema.org generator',
            'local business schema',
            'google opening hours',
        ],
        app: 'get_found',
        icon: faBracketsCurly,
        ladder: {
            headline: 'Nobody should be hand-writing this, page by page.',
            body: 'Get Found works it out from what you have already typed. Describe a product or an event once and the markup, the sitemap and the search tags come with it — on every page, kept current, without a second thought.',
        },
    },
    {
        slug: 'contrast-checker',
        name: 'Contrast checker',
        tagline:
            'Can everybody actually read that? Check a text color against its background — and find out what size it starts working at.',
        description:
            'Free color contrast checker. Put in a text color and a background color and get the exact ratio, whether it passes the accessibility standards for normal and large text, and a live preview at real sizes. Pale grey on white looks refined on your screen and disappears on a phone in daylight — this is how you find out before a customer does.',
        keywords: [
            'contrast checker',
            'wcag contrast',
            'color contrast ratio',
            'accessibility checker',
            'aa aaa contrast',
            'text contrast',
            'readable text color',
        ],
        app: 'site',
        icon: faCircleHalfStroke,
        ladder: {
            headline: 'One pair takes a second. A whole site takes a habit.',
            body: 'My Site is built so this is handled already — readable text, focus outlines you can see, and headings in a sensible order come with the blocks, rather than being something you audit afterwards.',
        },
    },
    {
        slug: 'barcode',
        name: 'Barcode maker',
        tagline:
            'Scannable barcodes for products, shelves and stock takes — Code128, UPC, EAN — with the check digit worked out for you.',
        description:
            'Free barcode generator. Make real, scannable Code128, UPC-A, EAN-13, EAN-8 and Code39 barcodes for products, shelf labels and stock counts, with the check digit calculated and validated so a scanner does not reject it at the till. Set the size and the label, then download a PNG or an SVG that stays sharp however big you print it.',
        keywords: [
            'barcode generator',
            'upc generator',
            'ean barcode',
            'code128 barcode',
            'sku barcode',
            'free barcode maker',
            'shelf label barcode',
        ],
        app: 'stock',
        icon: faBarcode,
        ladder: {
            headline: 'A label is only useful if something is counting.',
            body: 'Stock is what sits behind the scan — how many are left, where they are, which ones are about to run out, and a number that is the same whether it sold online, over the counter, or over the phone.',
        },
    },
    {
        slug: 'digital-card',
        name: 'Digital business card',
        tagline:
            'Your details as a code somebody scans — landing straight in their phone’s contacts, spelt correctly.',
        description:
            'Free digital business card and vCard generator. Enter your name, what you do and how to reach you, and get a downloadable contact file plus a scannable code that drops the lot into anybody’s phone in one tap. No app to install, nothing to sign up for, and nobody typing your surname wrong.',
        keywords: [
            'digital business card',
            'vcard generator',
            'qr business card',
            'vcf generator',
            'contact card qr',
            'virtual business card',
        ],
        app: 'customers',
        icon: faAddressBook,
        ladder: {
            headline: 'Getting the number is the start of it.',
            body: 'Customers is where that person stops being a contact and becomes a history — what they bought, what you last said, what they asked for and never got. In one place, so the answer is not in somebody’s inbox.',
        },
    },
    {
        slug: 'privacy-policy',
        name: 'Privacy policy writer',
        tagline:
            'The privacy policy and terms every website is expected to have — written in plain English from a few questions, rather than copied off a competitor.',
        description:
            'Free privacy policy and terms of service generator. Answer some straightforward questions about your business and what you collect, and get a clear, readable privacy policy and set of terms to copy or download. A genuine starting point for any website or shop — written to be understood rather than to be long. It is not legal advice, and for anything unusual you should get some.',
        keywords: [
            'privacy policy generator',
            'free privacy policy',
            'terms of service generator',
            'terms and conditions generator',
            'gdpr privacy policy',
            'website legal pages',
        ],
        app: 'content',
        icon: faScroll,
        ladder: {
            headline: 'Writing it once is fine. Remembering to change it is not.',
            body: 'Content publishes your policy as a real page with a proper address, keeps every previous version, and shows when it was last touched — which matters on the one page where “last updated 2019” is the whole problem.',
        },
    },
    {
        slug: 'domain-checker',
        name: 'Domain name finder',
        tagline:
            'Check whether the name you want is free — across .com, .co, .shop and the rest — before you print it on anything.',
        description:
            'Free domain availability checker. Type a name and see straight away which endings are still free, using live registry data rather than a guess. Find out before the signage, the cards and the packaging — and before you have told everybody what the business is called.',
        keywords: [
            'domain availability checker',
            'domain name search',
            'is this domain available',
            'check domain availability',
            'find a domain',
            'business name checker',
        ],
        app: 'site',
        icon: faGlobe,
        ladder: {
            headline: 'A name you own, pointing at something.',
            body: 'Buy it wherever you like, then point it at My Site. The certificate, the padlock and the renewals are handled — a real site on your own address, rather than a name parked at a registrar with nothing behind it.',
        },
        leaves:
            'There is no way to find out whether a name is taken without asking, so the name you type is sent to the public registry that knows. We do not keep it, and nobody is told you were interested.',
    },
];

export const TOOL_SLUGS: readonly string[] = TOOLS.map((t) => t.slug);

export function getTool(slug: string): PigglesTool | undefined {
    return TOOLS.find((t) => t.slug === slug);
}

/**
 * The photograph a tool page carries, chosen by group.
 *
 * ── THE ALT TEXT IS COPIED, NOT WRITTEN ─────────────────────────────────────
 *
 * Every caption here is lifted verbatim from `content/apps.ts`, where it was
 * written by somebody who had opened the file. `public/photos/README.md` records
 * a caption that once shipped describing a picture nobody had looked at, which
 * is exactly what happens when alt text is invented from a filename.
 *
 * That is also why this maps by GROUP rather than one photo per tool: there are
 * twelve photographs and only seven have a caption I can stand behind. Four
 * good ones used deliberately beat seventeen with guessed descriptions — and a
 * shared photo per group reinforces the same grouping the color already
 * carries.
 */
const GROUP_PHOTOS: Record<string, { src: string; alt: string }> = {
    web: {
        src: '/photos/working-late-portrait.jpg',
        alt: 'Someone still working at a laptop after dark, city lights in the window behind them',
    },
    sell: {
        src: '/photos/market.jpg',
        alt: 'Punnets of tomatoes and corn on a market stall',
    },
    people: {
        src: '/photos/barber.jpg',
        alt: 'A barber finishing a client’s cut',
    },
    money: {
        src: '/photos/carpenter.jpg',
        alt: 'A joiner marking a length of timber',
    },
    home: {
        src: '/photos/coffee-shop.jpg',
        alt: 'Staff working behind the counter of a busy café',
    },
    run: {
        src: '/photos/garage.jpg',
        alt: 'A car on a lift above a working bench of tools and a toolbox',
    },
};

export function toolPhoto(tool: PigglesTool): { src: string; alt: string } {
    return GROUP_PHOTOS[toolGroup(tool)] ?? GROUP_PHOTOS.web!;
}

/** The color a tool page wears — its app's group hue, never a hue of its own.
 *  Six groups is the whole color system (DESIGN.md §2); a tools section that
 *  invented an eighteenth would be the one part of the site not on it. */
export function toolGroup(tool: PigglesTool): PigglesGroup {
    return APP_GROUP[tool.app] ?? 'web';
}

/** The app's customer-facing name — "My Site", "Get Found" — for the close.
 *  Read from the registry rather than repeated in seventeen strings. */
export function toolAppLabel(tool: PigglesTool): string {
    return APP_BY_ID[tool.app]?.label ?? 'Piggles';
}

/**
 * The other tools worth showing at the bottom of one.
 *
 * Same group first — somebody who just made a favicon is far more likely to want
 * a color palette than a barcode — then the rest in catalog order to fill up.
 * The old version took the first five of the list for every tool, so the same
 * five sat at the bottom of all seventeen pages and the strip taught nobody
 * anything.
 */
export function relatedTools(slug: string, limit = 6): PigglesTool[] {
    const current = getTool(slug);
    const others = TOOLS.filter((t) => t.slug !== slug);
    if (!current) return others.slice(0, limit);

    const group = toolGroup(current);
    const near = others.filter((t) => toolGroup(t) === group);
    const far = others.filter((t) => toolGroup(t) !== group);
    return [...near, ...far].slice(0, limit);
}
