/**
 * The reading matter on each tool page — what the thing is, and the questions
 * people actually arrive with.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 *
 * A free tool with no prose ranks for nothing. Somebody searching "png to ico"
 * is asking a question, and a page that answers it in one line and shows a file
 * picker gets closed the moment the download finishes. The pages that keep
 * earning traffic are the ones that explain the thing properly, so a person
 * leaves knowing something they did not know — and half of them remember where
 * they learnt it.
 *
 * ── AND WHY IT IS NOT WRITTEN THE WAY THAT GENRE USUALLY IS ─────────────────
 *
 * The convention is a wall of keyword-shaped filler under the fold: "In today's
 * digital landscape, favicons play a crucial role…". Nobody reads it, everybody
 * knows it is there for the crawler, and it makes the page feel like a trap.
 *
 * These are written for a person who genuinely does not know and is slightly
 * embarrassed about it — which is most people, about most of this. No jargon
 * without a definition attached, no paragraph that exists to contain a phrase,
 * and no sentence that would make a florist feel stupid for not already knowing.
 * That is a harder brief than keyword filler and it is also the only version
 * worth publishing (CLAUDE.md RULE #3, and the audience note: our reader did not
 * choose to be in software today).
 *
 * The FAQs are ALSO the FAQPage structured data, so an answer here can be shown,
 * unfolded, in the search result itself. Which means every answer has to stand
 * on its own away from the page — no "as described above", no "click the button
 * below". Write each one as though it is the only sentence anybody reads.
 */

export interface ToolSection {
  title: string;
  body: string;
}

export interface ToolFaq {
  q: string;
  a: string;
}

export interface ToolContent {
  /** The explainer, under the tool itself. Two to four short sections. */
  learn: ToolSection[];
  /** Real questions, answerable in a paragraph, standing alone. */
  faqs: ToolFaq[];
}

export const TOOL_CONTENT: Record<string, ToolContent> = {
  favicon: {
    learn: [
      {
        title: 'What a favicon actually is',
        body: 'It is the tiny picture beside a page’s name — in the browser tab, in your bookmarks, in the list of suggestions when somebody starts typing your address. It is about sixteen pixels across in the place it appears most, which is roughly the size of a full stop on this page. That is the whole design brief: it has to survive being that small.',
      },
      {
        title: 'Why one file is not enough any more',
        body: 'A tab wants a small square. A phone saving you to its home screen wants a much bigger one, with no transparency, because iOS puts it on a colored tile. Android wants one with room around the edges so it can crop it into a circle without cutting your logo in half. A browser showing a shortcut on a new tab page wants something in between. They all want different files, which is why a proper favicon is a set of about six things and a small text file listing them — and why generating it by hand is nobody’s idea of an afternoon.',
      },
      {
        title: 'The one design decision worth making',
        body: 'Your full logo, with the words, almost never works. At sixteen pixels the words become a grey smudge and the smudge looks identical to everybody else’s smudge. Take the one distinctive shape out of your logo — the mark, the first letter, the animal — and use that alone. Then squint at the preview: if you cannot tell it apart from the tab beside it, simplify again.',
      },
    ],
    faqs: [
      {
        q: 'What size should a favicon be?',
        a: 'Start with a square image at least 512 pixels across and let the generator make the rest. The set you actually need is 16, 32 and 48 pixels bundled inside a single .ico file, a 180-pixel Apple touch icon, 192 and 512-pixel versions for Android and for browsers, and a maskable version with padding so Android can crop it to a circle without clipping anything.',
      },
      {
        q: 'Do I still need a favicon.ico file?',
        a: 'Yes. Browsers request /favicon.ico from the root of a site even when you have not linked to it anywhere, so a site without one produces a steady trickle of 404s in its logs. It is also the fallback that older browsers and some link-preview scrapers use when they do not understand the newer tags.',
      },
      {
        q: 'Can I use a PNG with a transparent background?',
        a: 'Yes, but it depends on your logo, and the answer is not automatically yes. A see-through icon sits straight on the browser’s own color, and roughly a third of people browse in dark mode — so a black or navy mark that looks sharp in a white tab is close to invisible in a dark one. A see-through background is right when your mark is mid-toned enough to be seen against white and against near-black. If it is not, give it a solid background, which is the whole reason favicons have one. Separately, the Apple touch icon can never be see-through: iOS renders those pixels as black, so it is always filled with a color.',
      },
      {
        q: 'Should my favicon have a background or be transparent?',
        a: 'Look at your mark on its own and ask whether it would be visible on white and on near-black. A logo that uses a mid-strength color — a red, a teal, an orange — usually survives both, and see-through is the tidier choice. Black text, a dark navy wordmark or a very pale mark survives one and disappears on the other, and those need a solid background: white behind a dark mark, a dark tone behind a pale one. This tool measures your logo against both kinds of tab and tells you which case you are in, and it shows you the icon in a light tab strip and a dark one side by side so you can see it rather than take our word for it.',
      },
      {
        q: 'Does this remove the background from my picture?',
        a: 'No. Nothing here erases anything from your picture — a logo that arrives with a solid white background keeps it. Two things get mistaken for removal. The first is that a see-through PNG usually looks white in a photo viewer, because the viewer puts it on white, so a picture you believed was white was already see-through before it got here. The second is that an icon has to be square: a wide logo is fitted inside the square whole, which leaves an empty strip above and below it. Set "Behind your logo" to a solid color and that color is filled in behind your logo on every icon in the set.',
      },
      {
        q: 'Why is my tab icon see-through when my home-screen icon is not?',
        a: 'A home-screen icon cannot be see-through at all — iPhones turn those pixels black — so it is always filled with a color, whatever else you choose. A tab icon can go either way, which is why it is a choice rather than something decided for you. Set "Behind your logo" to a solid color and every icon in the set is built on exactly that color, the one you picked, unchanged.',
      },
      {
        q: 'Where do the files go on my site?',
        a: 'In the root folder, alongside your home page, and then linked from the head of every page. This tool gives you the markup to paste, in plain HTML and in the form modern site frameworks expect, so you can copy whichever matches what you are using.',
      },
    ],
  },

  'qr-code': {
    learn: [
      {
        title: 'A QR code is just writing, in a shape a camera can read',
        body: 'Whatever you put in — a web address, a message, a Wi-Fi password — is written into the pattern itself. That is why nothing here expires and nothing needs an account: the code does not point at us, or at any service in between. It contains the thing. Print it and it works in ten years.',
      },
      {
        title: 'The bit that trips people up: dynamic codes',
        body: 'Some services give you a code that points at their address, which then forwards to yours — so you can change the destination later without reprinting. That is genuinely useful, and it has a catch worth knowing before you print two thousand of them: the code stops working if that company disappears, changes its pricing, or decides your free plan has expired. Codes made here are the other kind. They point straight at your address and depend on nobody.',
      },
      {
        title: 'Why the error correction setting matters more than it sounds',
        body: 'A QR code carries spare copies of its own contents, so it still scans when part of it is damaged — a scratch, a coffee ring, a logo in the middle. Higher correction means more spare copies, which means a denser pattern. Use the higher settings if you are putting a logo in the centre or printing on something that will get handled; use a lower one if the code needs to stay simple enough to read from across a room.',
      },
    ],
    faqs: [
      {
        q: 'Do these QR codes expire?',
        a: 'No, and they cannot. The information is encoded in the pattern itself rather than stored on a server, so there is nothing to switch off. A code you print today will scan in ten years, whether or not this page still exists.',
      },
      {
        q: 'How small can I print a QR code?',
        a: 'About two centimetres square, or three quarters of an inch, is the practical floor for something scanned from a phone held normally. If it is going on a shelf edge or a business card, keep the content short — a shorter web address makes a simpler pattern, and a simpler pattern survives being small.',
      },
      {
        q: 'Should I download a PNG or an SVG?',
        a: 'PNG for anything on a screen or a quick print. SVG if it is going to a printer, on a sign, or anywhere it might later be resized — an SVG is drawn from instructions rather than pixels, so it stays perfectly sharp at any size, including a shop window.',
      },
      {
        q: 'Can I put my logo in the middle?',
        a: 'Yes, and it usually still scans, because the code carries spare copies of its own data. Keep the logo under about a fifth of the width and turn the error correction up to high. Then test it with two different phones before you print anything, which is advice worth taking literally.',
      },
    ],
  },

  'utm-builder': {
    learn: [
      {
        title: 'What those tags on the end of a link are',
        body: 'When you see a link ending in something like ?utm_source=instagram, those extra bits are notes attached to the link. They do nothing to the page — it opens exactly as normal — but analytics tools read them and record where the visitor came from. Without them, most of your traffic arrives labelled "direct", which is analytics-speak for "no idea".',
      },
      {
        title: 'The three that matter, in plain terms',
        body: 'Source is where it was: instagram, newsletter, the flyer. Medium is what kind of thing it was: social, email, print, paid. Campaign is which push it belonged to: spring-sale, new-menu. The other two — term and content — are for telling apart two versions of the same thing, like which of two buttons in the same email got clicked. Most businesses need the first three and can happily ignore the rest.',
      },
      {
        title: 'Why consistency matters more than cleverness',
        body: 'The tags are case-sensitive and nothing warns you. "Instagram" and "instagram" become two separate rows in your report, splitting one number in half and making both look worse than they are. Pick lower-case, pick one word per thing, and write it the same way every single time. This tool keeps a history of what you have used so you can copy your own past spelling rather than trusting your memory in six weeks.',
      },
    ],
    faqs: [
      {
        q: 'Do UTM tags slow down or break my page?',
        a: 'No. They are ignored by the page itself — the browser passes them along and the page loads exactly as it would without them. Only analytics tools read them.',
      },
      {
        q: 'Should I put UTM tags on links between my own pages?',
        a: 'No, and this is the most common mistake. Tagging an internal link makes your analytics think the visitor arrived fresh from somewhere else, which wipes out the record of how they actually found you. Only tag links that live somewhere other than your website.',
      },
      {
        q: 'Do the tags look untidy to visitors?',
        a: 'They are visible in the address bar, yes. If that matters — on a printed flyer, or a link you are reading aloud — use a short link or a QR code that points at the tagged address. The tags still do their job; the person just never sees them.',
      },
      {
        q: 'What is the difference between source and medium?',
        a: 'Source is the specific place — instagram, mailchimp, the poster in the window. Medium is the category it belongs to — social, email, print. You want both because "how are we doing on social?" and "how is Instagram doing?" are different questions, and one tag cannot answer both.',
      },
    ],
  },

  'og-image': {
    learn: [
      {
        title: 'The picture you did not choose',
        body: 'Paste a link into a message, a post or a group chat and something appears: a picture, a headline, a line of description. If you never specified one, the app guesses — and it usually grabs the first image on the page, which is often your logo, a stock photo of a handshake, or nothing at all. The share image is the one you choose on purpose.',
      },
      {
        title: 'Why 1200 by 630',
        body: 'It is the size nearly every messaging app and social network crops to, so an image at those proportions appears whole rather than with its edges chopped off. Anything important — words especially — should sit well inside the middle, because a few apps still crop tighter than they promise. Assume the outer tenth might vanish.',
      },
      {
        title: 'Put the words in the picture',
        body: 'The counter-intuitive part: a share card works better with text on it than without. In a feed the image is the thing the eye lands on, and the headline underneath is small grey text that half of people never read. A card with four or five large words on it does the whole job of the link on its own. Keep it to a phrase, not a sentence.',
      },
    ],
    faqs: [
      {
        q: 'What size should a social share image be?',
        a: '1200 pixels wide by 630 tall. That is the shape almost every platform crops to, and using it means your image appears in full rather than with the sides cut off.',
      },
      {
        q: 'Why is the old image still showing after I changed it?',
        a: 'Because the platform cached it, sometimes for days. Most of them offer a debugging tool that re-reads your page on demand — search for the platform’s name plus "sharing debugger". Adding a fresh address, or a version number to the image file name, also forces a re-read.',
      },
      {
        q: 'Do I need a different image for each social network?',
        a: 'No. One 1200 × 630 image tagged as og:image is understood by essentially all of them. Only add a separate Twitter card image if you specifically want a different picture there.',
      },
      {
        q: 'Does the share image affect my search ranking?',
        a: 'Not directly. It affects whether people click on your link when somebody shares it, which affects how much traffic you get, which is a different and more immediate thing than ranking.',
      },
    ],
  },

  'email-signature': {
    learn: [
      {
        title: 'A signature is a small business card that goes out a hundred times a day',
        body: 'It is the one piece of design that appears on every single thing you send, to every customer, supplier and stranger. Most are either a bare name or a cluttered block with three logos, a legal disclaimer and a picture of a tree asking you not to print the email. The good ones say who you are, what you do, and one reliable way to reach you.',
      },
      {
        title: 'Why email design is stuck in 1999',
        body: 'Mail apps are the most inconsistent software on earth. Outlook renders email using Microsoft Word, which does not understand most modern layout at all. So signatures that survive everywhere are built the old way — with tables, inline styling, and no clever positioning. This tool produces that sturdier, uglier-under-the-hood version on purpose, because it is the one that arrives looking right.',
      },
      {
        title: 'The things that break, and how to avoid them',
        body: 'Images hosted on your computer disappear the moment the email leaves it, so any logo must live at a proper web address. Web fonts do not load in most mail apps, so the safe faces are the ordinary ones everybody has. And many people read email with images turned off entirely — so if your whole signature is a picture, a good portion of your recipients see an empty rectangle where your phone number should be.',
      },
    ],
    faqs: [
      {
        q: 'How do I add this signature to Gmail?',
        a: 'Copy the preview here — the rendered version, not the code — then in Gmail open Settings, scroll down to Signature, create a new one and paste. Pasting the visual version keeps the formatting; pasting the code shows the code.',
      },
      {
        q: 'Why does my signature look wrong in Outlook?',
        a: 'Outlook renders email using Microsoft Word’s engine, which ignores much of modern layout. Signatures built with old-fashioned tables and inline styling survive it — which is how this one is built. If it still looks off, the usual culprits are a background image or a fancy font, neither of which Outlook will honour.',
      },
      {
        q: 'Should I put my photo in my email signature?',
        a: 'It depends on the work. If your customers deal with you personally — an agent, a consultant, a tradesperson — a photo helps them remember who they are talking to. If you are one of forty people at a company, a logo does more and clutters less.',
      },
      {
        q: 'How long should a signature be?',
        a: 'Four lines or so. Name, what you do, one phone number, one link. Every extra line makes the whole thing more likely to be skipped, and a long legal disclaimer at the bottom protects nobody while making every reply thread twice as long.',
      },
    ],
  },

  invoice: {
    learn: [
      {
        title: 'What has to be on an invoice',
        body: 'Rules vary by country, but the shape almost never does: who you are and how to reach you, who it is for, a unique invoice number, the date it was issued, what you are charging for line by line, any tax, the total owed, and when and how to pay. If a customer’s finance department has to email you to ask a question, the invoice was missing one of those.',
      },
      {
        title: 'The invoice number is not a formality',
        body: 'It has to be unique and it should never go backwards — most tax authorities expect a sequence with no gaps and no repeats, because that is how they check nothing has been quietly removed. Pick a format on day one and stick to it. Starting at 001 tells every customer you have never invoiced anybody before, which is a small thing you can simply choose not to advertise.',
      },
      {
        title: 'Payment terms decide when you actually get paid',
        body: 'An invoice with no due date is an invoice that gets paid whenever. Put the terms on it in words — "due 14 days from the date of issue", with the actual date spelt out — rather than leaving it implied. The single most effective change most small businesses make is shortening terms from thirty days to fourteen and saying so plainly on the document.',
      },
    ],
    faqs: [
      {
        q: 'Is an invoice made here legally valid?',
        a: 'An invoice is a commercial document, not a legal form, so there is no official template to fail. What matters is that it contains what your tax authority requires — typically your business details, a unique number, the date, an itemised list, the tax treatment and the total. Check your local rules for anything specific to your trade, particularly around tax registration numbers.',
      },
      {
        q: 'Do I need to charge tax on my invoice?',
        a: 'That depends on where you are, what you sell and whether you are registered for sales tax or VAT. This tool will calculate and display whatever rate you enter, and lets you leave it off entirely if you are not registered. It cannot tell you which applies to you — that one is worth ten minutes with an accountant.',
      },
      {
        q: 'What is the difference between an invoice and a receipt?',
        a: 'An invoice asks for money; a receipt confirms money has arrived. The same job usually produces both, in that order. If you were paid up front, what you owe the customer is a receipt.',
      },
      {
        q: 'Are my details stored anywhere?',
        a: 'Only in this browser, on this device, so you do not have to retype your business details for the next invoice. Nothing is sent anywhere, and clearing your browser data clears it. That also means it will not be there on your phone.',
      },
    ],
  },

  'email-deliverability': {
    learn: [
      {
        title: 'Why real business email ends up in spam',
        body: 'Almost never because of the words in it. The usual reason is that the receiving mail server could not confirm you were allowed to send as your own domain — so it treated your invoice the way it treats anybody claiming to be someone they are not. Three DNS settings answer that question. Getting them right is generally the difference between arriving and disappearing.',
      },
      {
        title: 'The three, without the acronyms',
        body: 'SPF is a list of who is allowed to send email using your domain name — your mail provider, your invoicing software, your newsletter tool. DKIM adds an invisible signature to every message so the receiver can check it really came from you and was not altered on the way. DMARC tells receiving servers what to do when a message fails those checks, and asks them to report back. In that order: who may send, prove it was them, and what to do if not.',
      },
      {
        title: 'The mistake almost everybody makes',
        body: 'You may only have one SPF record on a domain. Sign up for a new email tool, paste in the record it gives you, and you now have two — which most servers treat as an error and ignore entirely, so all your email fails the check at once. The right move is to merge the new sender into the record you already have. This checker shows what you are publishing today so you can see whether that has already happened to you.',
      },
    ],
    faqs: [
      {
        q: 'How long do DNS changes take to work?',
        a: 'Usually minutes, occasionally up to a day. The delay is caching — servers around the world hold on to the old answer for a set period. If a change has not appeared after a few hours, check it for typos rather than waiting longer; a mistyped record never propagates.',
      },
      {
        q: 'Do I need DMARC if I already have SPF and DKIM?',
        a: 'Increasingly yes. The large mail providers now expect it from anybody sending in volume, and without it your messages get treated with more suspicion. It also gives you reports on who is sending email as you, which is how businesses find out they are being impersonated.',
      },
      {
        q: 'Why can I only have one SPF record?',
        a: 'Because the specification says so, and mail servers enforce it strictly — two records on the same domain is an error condition, and many servers respond by ignoring both. When you add a new sending service, merge its entry into your existing record rather than publishing a second one.',
      },
      {
        q: 'What should I set my DMARC policy to at first?',
        a: 'Start with the monitoring-only setting. It changes nothing about how your mail is treated but sends you reports, so you can see everything sending as your domain before you start rejecting anything. Businesses that skip this step and go straight to strict enforcement usually discover, loudly, that their accounting software was sending as them too.',
      },
    ],
  },

  'meta-tags': {
    learn: [
      {
        title: 'The two lines that decide whether anybody clicks',
        body: 'A search result is a blue heading and a couple of lines of grey text. Those come from your page’s title tag and its meta description. You get to write both. Most sites leave them to chance, which is why so many results read "Home | Untitled" followed by a fragment of a cookie banner.',
      },
      {
        title: 'How long is too long',
        body: 'Google measures by width in pixels rather than by counting characters, so there is no exact limit — but titles are usually cut off somewhere around sixty characters and descriptions around a hundred and sixty. Put the important part first. A title that reads well truncated is better than a clever one that gets sliced in half.',
      },
      {
        title: 'The description does not affect ranking. Write it anyway',
        body: 'Search engines have said for years that the description is not a ranking factor, and this gets repeated as "so it does not matter". It decides whether the person who already found you actually clicks — which is the entire point of ranking in the first place. Write it as an advert, not a summary: say what somebody gets, not what the page contains.',
      },
    ],
    faqs: [
      {
        q: 'How long should a title tag be?',
        a: 'Around sixty characters is where most results get cut off, though the real limit is measured in pixels, so wide letters count for more. Front-load it — put the thing somebody searched for near the beginning, so it survives being shortened.',
      },
      {
        q: 'Why is Google showing a different description than the one I wrote?',
        a: 'Because it decided a different part of your page matched the search better. This is normal and often an improvement. If it keeps happening across a whole site, it usually means the descriptions are too generic to beat the actual page text.',
      },
      {
        q: 'Do meta keywords still do anything?',
        a: 'No. Search engines stopped using the keywords tag many years ago after it was abused into meaninglessness. You can safely leave it out entirely; nothing here generates one.',
      },
      {
        q: 'What is a canonical tag and do I need one?',
        a: 'It tells search engines which address is the real one when the same page can be reached several ways — with and without a trailing slash, with tracking tags on the end, and so on. Without it, one page can be counted as several and each gets a fraction of the credit.',
      },
    ],
  },

  'color-palette': {
    learn: [
      {
        title: 'A palette is a set of jobs, not a number of colors',
        body: 'Five is where this starts because five jobs have to be filled: the color that is unmistakably yours, one supporting it, one for highlights, the page everything sits on, and a quiet tone for edges. That is a starting point, not a ceiling. Each of those also needs a readable ink to go on top of it; real work needs a green for "that worked" and a red for "that did not"; and every color needs its lighter and darker steps for backgrounds and hover states. Five names becomes several dozen actual values in anything that ships, which is exactly what the software you use every day is doing. What goes wrong is never the count — it is a color nobody can say the job of, because then it gets used differently on every screen.',
      },
      {
        title: 'What the harmonies actually mean',
        body: 'Colors that sit opposite each other on the color wheel create contrast and energy, which is why they are used for buttons you want pressed. Colors that sit beside each other feel calm and related, which is why they suit backgrounds and large areas. Three or four spread evenly around the wheel give you variety without clashing. None of this is a rule, but all of it is a reliable starting point when staring at a blank page.',
      },
      {
        title: 'Why every color needs its lighter and darker versions',
        body: 'One pink is not enough to build anything. You need a pale version for backgrounds, the real one for buttons, and a darker one for the moment somebody hovers or presses. That range is what the fifty-to-nine-hundred numbers mean — one color in eleven strengths, all of them clearly the same color. Choosing them by eye is how you end up with a hover state that is a slightly different hue.',
      },
    ],
    faqs: [
      {
        q: 'How many colors should a brand have?',
        a: 'There is no right number, and anyone who gives you one is guessing. Open the apps you use every day and you will find far more than five. The question worth asking is whether each color has a job you can name out loud — this one is buttons, this one is the page, this one means something went wrong. Five is where this tool starts because those are the jobs a theme has to fill before anything else works. Add more the moment you have work for them to do; the one to drop is whichever one you cannot finish the sentence about.',
      },
      {
        q: 'What does the 50 to 950 numbering mean?',
        a: 'It is one color in eleven strengths, from very pale to very dark, with the number rising as it gets darker. 500 is usually the color you picked. It gives you consistent options for backgrounds, borders, buttons and hover states without inventing a new color each time.',
      },
      {
        q: 'How do I know if my color is readable?',
        a: 'Check the contrast between the text and what is behind it. A ratio of at least 4.5 to 1 is the standard for normal text, 3 to 1 for large headings. This tool checks the pairings for you, and there is a dedicated contrast checker if you want to test a specific combination.',
      },
      {
        q: 'Can I use these colors commercially?',
        a: 'Yes. A color cannot be owned in any general sense, and nothing here is licensed. The only caution is copying a well-known company’s exact palette in the same industry, which is a trademark question rather than a color one.',
      },
    ],
  },

  'margin-calculator': {
    learn: [
      {
        title: 'Margin and markup are not the same number',
        body: 'This catches out more businesses than anything else in pricing. Buy something for $10 and sell it for $15 and you have added fifty per cent — that is markup, measured against what it cost you. But your margin is thirty-three per cent, because it is measured against what you sold it for. Aim for a fifty per cent margin by adding fifty per cent and you will be short, every time, on everything.',
      },
      {
        title: 'The cost you forgot is the one that matters',
        body: 'The purchase price is the easy part. What genuinely comes out of that sale is also the payment processing fee, the packaging, the postage you undercharged for, the returns, and the twenty minutes somebody spent on the phone about it. Businesses that feel busy but not profitable are usually pricing off the purchase price and paying for the rest out of the margin without noticing.',
      },
      {
        title: 'Break-even is the number worth knowing by heart',
        body: 'Your rent, your software, your insurance and your own wage happen whether you sell anything or not. Break-even is how many you have to sell before those are covered and you start actually earning. It reframes the whole question: not "is this priced well" but "how many of these does this month need". It is usually a smaller number than people fear, and knowing it makes a slow week much less alarming.',
      },
    ],
    faqs: [
      {
        q: 'What is the difference between margin and markup?',
        a: 'Markup is measured against what something cost you; margin is measured against what you sold it for. A 50% markup is a 33% margin. Mixing them up means consistently underpricing, and it is the single most common pricing mistake in small business.',
      },
      {
        q: 'What is a good profit margin?',
        a: 'It varies enormously by trade. Grocery runs on very thin margins and makes it up in volume; a service business with few costs beyond time can run far higher. The useful comparison is against your own previous numbers and against your break-even, not against a figure from the internet.',
      },
      {
        q: 'Should I include my own wage in the costs?',
        a: 'Yes, and leaving it out is why so many small businesses look profitable and feel poor. If you are not paying yourself, the business is being subsidised by you, and pricing built on that assumption breaks the moment you hire anybody to do what you were doing.',
      },
      {
        q: 'How do I work out break-even?',
        a: 'Take your fixed monthly costs — rent, software, insurance, wages — and divide by the profit you make on one sale. That is how many you need to sell before you are ahead. Enter your fixed costs here and it does the sum for you.',
      },
    ],
  },

  quote: {
    learn: [
      {
        title: 'A quote and an estimate are different promises',
        body: 'A quote is a fixed price: this is what it will cost. An estimate is a considered guess: this is roughly what it will cost, and it may move. In many places that distinction has legal weight, so the word you use matters. If the work might change once you have opened the wall, say estimate and say why.',
      },
      {
        title: 'Always put an expiry date on it',
        body: 'Without one, a quote is open indefinitely — and a customer can accept a price you gave before your supplier put their costs up. Thirty days is the usual convention. It also does something quieter and more useful: it gives a customer who has gone quiet an honest reason to be nudged, which is a much easier email to write than one that begins "just following up".',
      },
      {
        title: 'Itemise more than feels necessary',
        body: 'A single line reading "kitchen refit — $8,000" invites one question: why so much. The same work broken into materials, labour, disposal and finishing invites better questions, and lets a customer take something out rather than walking away from all of it. Detail also protects you later, when somebody remembers a thing being included that was never on the list.',
      },
    ],
    faqs: [
      {
        q: 'Is a quote legally binding?',
        a: 'In many places a quote is treated as a firm offer, and once accepted it forms a contract at that price. An estimate generally is not. It varies by country and by trade, so if the difference matters to your work it is worth checking locally — and worth being precise about which word you use.',
      },
      {
        q: 'How long should a quote be valid for?',
        a: 'Thirty days is the common default and works for most trades. Shorten it if your material costs move quickly. The important part is that there is a date on it at all, so an old price cannot be accepted after your costs have changed.',
      },
      {
        q: 'Should I include tax in the quoted price?',
        a: 'Show it separately and make clear which figure is which. A customer comparing your quote with somebody else’s will compare the big number at the bottom, and if one includes tax and the other does not, you lose a job for a reason that has nothing to do with your price.',
      },
      {
        q: 'What happens after a customer accepts?',
        a: 'The quote becomes the basis for the work and, later, for the invoice. Keeping the two documents consistent matters — the fastest way to a payment dispute is an invoice with line items nobody remembers agreeing to.',
      },
    ],
  },

  'structured-data': {
    learn: [
      {
        title: 'Why some search results have stars and prices and yours does not',
        body: 'Search engines read your page the way a person does — as words on a screen — and words are ambiguous. "Open until 5" could be your opening hours or a sentence in a blog post. Structured data is a separate, invisible block that states it unambiguously: this is a business, these are the hours, this is the address. Given that, a search engine can show the hours in the result rather than hoping you click through to find them.',
      },
      {
        title: 'What it can get you',
        body: 'For a local business: opening hours, address and phone number shown directly in search. For a product: price, availability and star rating under the link. For an article: the author and date. For common questions: the questions themselves, expandable in the result. None of it is guaranteed — a search engine decides what to show — but without the markup it cannot show any of them.',
      },
      {
        title: 'The one rule that gets sites penalised',
        body: 'The markup has to describe what is genuinely on the page and genuinely true. Star ratings for reviews that do not exist, or a price that differs from the one you actually charge, is the fastest route to a manual penalty — and those are much harder to undo than to avoid. Describe what is really there. That is the whole of the compliance story.',
      },
    ],
    faqs: [
      {
        q: 'What is JSON-LD?',
        a: 'It is the format search engines prefer for structured data — a block of code in the head of your page that describes what the page is about. It sits separately from your visible content, so it does not affect how the page looks, and it is far easier to maintain than the older approach of tagging individual words.',
      },
      {
        q: 'Will adding structured data improve my ranking?',
        a: 'Not directly. It changes how your result is displayed rather than where it appears — and a result showing your opening hours, price or rating gets clicked more than a plain one at the same position. The benefit is real but it comes from clicks, not position.',
      },
      {
        q: 'How do I check my structured data is correct?',
        a: 'Paste the page address into Google’s Rich Results Test, which reports what it found and what it would be eligible to show. Schema.org’s own validator is stricter and useful for catching errors in less common types.',
      },
      {
        q: 'Can I have more than one type on a page?',
        a: 'Yes, and you often should — a page can reasonably be both an Organization and a LocalBusiness, or an Article with an FAQ on it. Keep them all describing the same page honestly; do not add a Product block to a page that does not sell anything.',
      },
    ],
  },

  'contrast-checker': {
    learn: [
      {
        title: 'Why pale grey text is the most common mistake on the web',
        body: 'It looks calm and expensive on a large bright screen in a dim office, which is exactly where design decisions get made. On a phone in daylight, or to eyes over about forty, or to the roughly one in twelve men with some color blindness, it starts to disappear. Contrast is the one accessibility measure that is genuinely just a number — you can check it, and then you know.',
      },
      {
        title: 'What the numbers mean',
        body: 'The ratio compares how much light comes off the text against the background, from 1 to 1 (identical, invisible) up to 21 to 1 (black on white). The accepted standard is 4.5 to 1 for ordinary text and 3 to 1 for large text, since bigger letters are easier to read at lower contrast. A stricter standard asks for 7 to 1, which is worth aiming at for anything that gets read at length.',
      },
      {
        title: 'The bits people forget to check',
        body: 'Text on top of a photo, where the background changes from one corner to the next. Text on a colored button, which is a foreground and a background you chose separately. Placeholder text in a form, which is almost always too faint. And the focus outline that shows where you are when navigating by keyboard — invisible on many sites, and the only way some people can use them at all.',
      },
    ],
    faqs: [
      {
        q: 'What contrast ratio do I need?',
        a: '4.5 to 1 for normal text and 3 to 1 for large text — which means roughly 24 pixels, or 19 pixels if bold. The stricter AAA standard asks for 7 to 1 and 4.5 to 1. Meeting the first is a reasonable minimum; meeting the second is noticeably easier to read.',
      },
      {
        q: 'Does contrast apply to buttons and icons too?',
        a: 'Yes. Text on a button follows the same text rules. Meaningful graphics — icons, chart lines, the outline of an input field — need at least 3 to 1 against what is behind them, otherwise people cannot see where to click.',
      },
      {
        q: 'Is this a legal requirement?',
        a: 'In many places, for many organisations, yes — public bodies and larger businesses in particular. It is also the accessibility failure most commonly cited in complaints, because unlike most it can be measured automatically at scale. Worth fixing regardless of whether anybody is obliged to.',
      },
      {
        q: 'Why does my dark mode fail when light mode passes?',
        a: 'Because they are different color pairings and each has to be checked separately. Pure white text on a pure black background is technically maximum contrast but causes visible smearing for many readers — slightly off-white on a very dark grey usually reads better and still passes comfortably.',
      },
    ],
  },

  barcode: {
    learn: [
      {
        title: 'Which barcode you need, in one paragraph',
        body: 'If it is going on a product sold in shops, you need a UPC or EAN — and you have to buy the numbers from GS1, because they are a globally unique registry rather than something to invent. If it is for your own use — shelf labels, stock takes, internal codes, asset tags — use Code128, which will happily encode whatever you type and costs nothing. Most small businesses need the second and think they need the first.',
      },
      {
        title: 'What the check digit is for',
        body: 'The last digit of a UPC or EAN is not part of the number; it is arithmetic done on the digits before it. A scanner recalculates it on every read, and if it disagrees it rejects the scan rather than recording the wrong item. It is why a slightly smudged barcode gives a beep of failure instead of quietly selling the wrong thing. This tool works it out for you and tells you if a number you have entered does not add up.',
      },
      {
        title: 'Printing barcodes that actually scan',
        body: 'Three things ruin more barcodes than anything else. Not enough plain space at either end — scanners need a clear margin to find where the code starts. Poor contrast: black on white, never color on color and never on a dark background. And scaling that squashes it horizontally, which changes the bar widths that carry the meaning. Print an SVG at its true proportions and leave the margin alone.',
      },
    ],
    faqs: [
      {
        q: 'Can I make my own UPC barcodes?',
        a: 'For your own internal use, yes — this will generate a valid, scannable one. For selling through retailers or on most marketplaces, no: those numbers must be bought from GS1, because the whole system depends on no two products anywhere sharing a code.',
      },
      {
        q: 'What is the difference between UPC and EAN?',
        a: 'UPC has twelve digits and is the North American standard; EAN has thirteen and is used more widely elsewhere. Modern scanners read both, and an EAN-13 beginning with a zero is a UPC-A with a leading zero added.',
      },
      {
        q: 'Which barcode should I use for internal stock?',
        a: 'Code128. It encodes letters as well as numbers, needs no registration, and packs more into less space than the older alternatives. It is the right answer for shelf labels, bins, internal SKUs and asset tags.',
      },
      {
        q: 'Why will my printed barcode not scan?',
        a: 'Usually one of three things: not enough blank space at either end, poor contrast between the bars and the background, or the image having been stretched horizontally at some point. Print from an SVG at its natural proportions and keep it black on white.',
      },
    ],
  },

  'digital-card': {
    learn: [
      {
        title: 'What a vCard is',
        body: 'A vCard is a small file — the .vcf you occasionally see attached to an email — that phones and computers universally understand as "here is a contact". Open one and it offers to save the person to your address book, with the name, number and email already filled in. It has worked the same way for thirty years and needs no app on either side.',
      },
      {
        title: 'Why a code beats saying your number out loud',
        body: 'The two normal ways of exchanging details both fail quietly. A paper card goes in a pocket and is found in a coat in March. Reading a number aloud gets one digit wrong roughly as often as you would expect. A scan puts every character in correctly, including the spelling of your surname, which nobody has ever got right first time.',
      },
      {
        title: 'Keep it to what you will still be doing next year',
        body: 'A contact saved today gets looked at in eighteen months, when somebody finally has the budget. Include the things that will still be true then — your name, your mobile, your website — and be sparing with a job title that might change or an address you might move out of. The point of the card is being findable later, not describing yourself completely today.',
      },
    ],
    faqs: [
      {
        q: 'Does the person need an app to scan my card?',
        a: 'No. Every phone camera made in the last several years reads these codes directly from the normal camera app, and the phone then offers to save the contact. Nothing to install on either side.',
      },
      {
        q: 'What is a .vcf file?',
        a: 'It is the standard contact file format, understood by every phone, mail app and address book. Opening one prompts to add the details to contacts. It is what gets attached when somebody shares a contact with you from their phone.',
      },
      {
        q: 'Can I put a QR code on a printed business card?',
        a: 'Yes, and it is the best of both — the card gets kept, the details get saved correctly. Keep the code at least two centimetres square, and put your name and number in readable text beside it too, for the people who will simply type it in.',
      },
      {
        q: 'Are my contact details sent anywhere?',
        a: 'No. The contact file and the code are both built here in your browser, from what you typed, and nothing is transmitted. Close the tab and it is gone.',
      },
    ],
  },

  'privacy-policy': {
    learn: [
      {
        title: 'Why even a small site needs one',
        body: 'If your website has a contact form, an email signup, an analytics tag or an online shop, you are collecting information about people — and most privacy law is built on the principle that people are entitled to be told what you collect and why. A policy is how you tell them. It is also the first thing a payment provider or a business customer asks for, so its absence tends to become a problem at the worst moment.',
      },
      {
        title: 'What has to be in it',
        body: 'What you collect, why you collect it, who else sees it, how long you keep it, and how somebody asks you to delete it. Then how to contact you about any of that. That is the substance. A policy that runs to nine pages of definitions usually contains the same five answers, buried, and buried is closer to hiding than to disclosing.',
      },
      {
        title: 'The version everybody skips',
        body: 'Copying a competitor’s policy is the standard move and it is a genuinely bad one — you inherit their tools, their retention periods and their legal jurisdiction, and end up with a document describing somebody else’s business. Worse, it names services you do not use and omits the ones you do, which is precisely the thing a regulator or an enterprise customer checks first.',
      },
    ],
    faqs: [
      {
        q: 'Is a generated privacy policy legally sufficient?',
        a: 'It is a solid starting point, not legal advice. It covers the standard disclosures most sites need. If you handle health data, work with children, operate in several countries with different regimes, or do anything unusual with personal information, have a lawyer look at it — that is a short and inexpensive conversation compared with getting it wrong.',
      },
      {
        q: 'Do I need one if I only have a contact form?',
        a: 'Yes. A contact form collects a name and an email address, which is personal information, and the obligation to explain what happens to it does not have a minimum size.',
      },
      {
        q: 'How often should I update it?',
        a: 'Whenever what you do changes — a new analytics tool, a new payment provider, a new mailing list. In practice, once a year with a proper look at whether it still describes reality is the habit that keeps it honest. Put the date on it.',
      },
      {
        q: 'What is the difference between a privacy policy and terms of service?',
        a: 'A privacy policy explains what you do with people’s information. Terms of service set the rules for using your site or buying from you — payment, delivery, returns, liability, what happens in a dispute. They are separate documents doing separate jobs, and most sites need both.',
      },
    ],
  },

  'domain-checker': {
    learn: [
      {
        title: 'Check before you commit, not after',
        body: 'The expensive order of operations is naming the business, printing the signage, and then discovering the domain has been parked since 2004. Names are cheap to change on a Tuesday afternoon and very expensive to change once they are on a van. Check first — it takes seconds and it occasionally saves a rebrand.',
      },
      {
        title: 'Which ending to buy',
        body: '.com still carries the most weight, largely because people type it out of habit when they half-remember a name. But local endings do very well for local businesses, and the trade-specific ones — .shop, .studio, .cafe — are widely available and read perfectly naturally now. What matters far more than the ending is that the name is easy to say down a phone without spelling it.',
      },
      {
        title: 'Available is not the same as free to use',
        body: 'A domain being unregistered says nothing about whether somebody holds a trademark on that name in your industry. The check here is a registry lookup, not a legal one. Before you build a brand on a name, search your national trademark register too — it is free, it takes ten minutes, and it is the search people wish they had done.',
      },
    ],
    faqs: [
      {
        q: 'How does the availability check work?',
        a: 'It asks the official registry for each domain ending, using the public lookup service registries provide for exactly this purpose. The answer comes from the authority that would sell you the name, rather than from a cached list.',
      },
      {
        q: 'Does searching a domain here risk somebody buying it first?',
        a: 'Not through us — nothing you type is recorded or passed to a registrar. The practice you may have heard of, where a searched name gets registered by someone else shortly afterwards, is associated with search boxes on registrar sites, not with registry lookups.',
      },
      {
        q: 'Should I buy several endings of my name?',
        a: 'Buy the one you will use, plus your local ending if you have one and it is cheap. Buying a dozen defensively costs more every year than most people expect and protects less than it feels like it does. If you later grow into the problem, you can buy more then.',
      },
      {
        q: 'What if the name I want is taken?',
        a: 'Try adding your trade or your town — "kellerplumbing" rather than "keller" — which usually reads better anyway and helps you turn up in local searches. Avoid hyphens and creative misspellings: both get lost every time somebody says the address out loud.',
      },
    ],
  },
};

export function toolLearn(slug: string): ToolSection[] {
  return TOOL_CONTENT[slug]?.learn ?? [];
}

export function toolFaqs(slug: string): ToolFaq[] {
  return TOOL_CONTENT[slug]?.faqs ?? [];
}
