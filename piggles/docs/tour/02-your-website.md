# Your website — My Site, Content, Get Found

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-17

31 screens across three apps. 3 app tours, 6 feature tours, 36 steps.
Replaces [lib/tour/app-tours/web.ts](../../apps/workbench/lib/tour/app-tours/web.ts),
and takes Get Found with it — it lives in `sell.ts` today for no reason that
survives reading it.

---

# My Site · 11 screens

## App tour · `builder` · 8 steps

### 1 · `site.pages` — `nav-builder.page`

**Your pages live here**

> Every page on your website — the front page, About, anything you add. Open one
> and you edit it directly: drag things around, change the words, add a section.

### 2 · `site.layout` — `nav-builder.layout`

**The bits that are on every page**

> The menu across the top and everything down at the bottom — your logo, your
> links, your opening hours. Change them once here rather than on every page.

### 3 · `site.theme` — `nav-builder.theme`

**The look, in one place**

> Colors, fonts and spacing for the whole site. Change them here and every page
> follows — you never have to restyle a page one at a time.

### 4 · `site.email` — `nav-builder.email`

**And the same for your emails**

> Order confirmations, booking reminders, receipts. They are built the same way
> your pages are, so what lands in somebody's inbox looks like it came from the
> same business as the website.

### 5 · `site.publish` — `nav-builder.publish`

**Nothing is live until you say so**

> Everything you change sits as a draft. This screen shows you exactly what is
> about to go out, lets you look at it as a visitor would, and puts it on the real
> site when you are happy. If it looks wrong afterwards, the history puts it back.

_Rewritten from two steps into one. The old `site.preview` step anchored
`nav-builder.preview`, and `builder.preview` is `listed: false` — it needs a
document open, so it is never a row and that step rang nothing. See
[README.md](README.md) §8._

### 6 · `site.forms` — `nav-builder.forms`

**What people have sent you**

> Every enquiry, quote request and contact form off your site, in one list. It
> does not matter which page the form was on — the replies all land here.

### 7 · `site.pages-report` — `nav-builder.pages`

**Which pages are doing the work**

> How many people saw each page, and what they did next. Usually one page is
> earning its keep and three are not, and this is how you find out which.

### 8 · `site.handoff` — no anchor

**There is more under Your pages**

> Whole ready-made sites, and the pieces you have saved to reuse. That group has
> a short walk of its own — the wand beside the heading starts it.

---

## Feature tour · Your pages · `site.your-pages` · 5 steps

> **Naming collision, worth fixing before this ships.** The panel shows
> **Saved piece** (`builder.piece`, the editor for one) at the top and
> **Saved pieces** (`builder.components`, the list) in this group. Two rows, one
> word, a plural apart. This tour teaches the list first and the editor second,
> which is the right order, but the names should still be pulled apart in
> [lib/console/vocabulary.ts](../../apps/workbench/lib/console/vocabulary.ts).

### 1 · opening — no anchor

**Starting from something rather than nothing**

> A blank page is the hardest thing in this app. These four screens are the ways
> round it — a whole site somebody already built, or a piece you liked enough to
> keep.

### 2 · `nav-builder.site`

**The site as a whole**

> Every page at once, and how they hang together — what is in the menu, what is
> buried, what nothing links to. Easier to spot a missing page from here than by
> clicking through.

### 3 · `nav-builder.blueprints`

**Ready-made sites**

> Complete sites for a shop, a studio, a trade, a restaurant — pages, wording and
> all. Pick one, put your own words and photos in, and you have skipped the hard
> part.

### 4 · `nav-builder.components`

**Pieces you have saved**

> A section you built once and want again — your opening hours, a testimonial
> block, a booking prompt. Save it here and drop it onto any page.

### 5 · `nav-builder.piece`

**And this is where you edit one**

> Change a saved piece here and it changes everywhere you have used it. That is
> the point of saving it, and it is also the thing to be careful about.

---

# Content · 10 screens

## App tour · `cms` · 4 steps

### 1 · `content.entries` — `nav-cms.content.list`

**Everything you write goes here**

> Blog posts, news, notices, case studies — whatever kinds of writing your site
> has. Write it once here and the site shows it wherever it belongs.

### 2 · `content.translations` — `nav-cms.translations.list`

**Saying it in another language**

> If you sell to people who read something other than English, every piece of
> writing can carry a second version. Visitors get the one that matches them and
> never see the switch happen.

### 3 · `content.product-translations` — `nav-commerce.product.translations`

**Including your products**

> The same thing for what you sell — names, descriptions and options in another
> language. It is one screen on a product, and it is listed here so you can find
> it without hunting through a product first.

### 4 · `content.handoff` — no anchor

**Three more groups below**

> Your photos and files, how your writing is organised, and the settings you touch
> once. Each has its own short walk — the wand beside a heading starts it.

---

## Feature tour · Your library · `content.your-library` · 3 steps

### 1 · `nav-cms.media.list`

**Your photos and files**

> Upload once, use anywhere. Anything you have already put on a page or a product
> is in here, so you are never hunting for the original.

### 2 · `nav-cms.authors.list`

**Who wrote it**

> A name, a photo and a line about them, shown at the bottom of anything they
> wrote. Worth doing if more than one of you writes, and worth skipping if not.

### 3 · `nav-cms.taxonomy.list`

**Tags and topics**

> How your writing is sorted, so a visitor reading one thing can find the rest of
> it. Tag as you go — going back and tagging forty old posts is nobody's afternoon.

---

## Feature tour · How it is organised · `content.how-it-is-organised` · 2 steps

### 1 · `nav-cms.types.list`

**Kinds of content**

> Recipes, venues, staff bios, a fleet list — you decide what a "thing" is and
> what goes on it, and your site gets a page for each one. Most businesses never
> need this, and it is here the day you do.

### 2 · `nav-cms.redirects.list`

**Old links that still have to work**

> When a page moves or goes, anyone with the old address ends up nowhere. Put the
> old address in here pointing at the new one and the link on that flyer from two
> years ago still works.

---

## Feature tour · Setting it up · `content.setting-it-up` · 2 steps

### 1 · `nav-cms.legal.list`

**The pages you are supposed to have**

> Privacy, terms, returns, cookies. Piggles gives you a plain-English starting
> point for each — read them, change anything that is not true of you, and put
> them live.

### 2 · `nav-cms.webhooks.list`

**Telling other software**

> If you have something else that needs to know when you publish — an app, a
> screen in the shop, a system somebody built you — this is how it gets told. Most
> businesses never open this screen.

---

# Get Found · 10 screens

**Social is marked Beta.** The networks are still reviewing our access, so parts
of it behave inconsistently. The feature tour says so plainly in its opening step
rather than leaving somebody to discover it — and that step comes out the day the
`BETA_MODULES` entry in [lib/surfaces/nav.ts](../../apps/workbench/lib/surfaces/nav.ts) does.

## App tour · `seo` · 4 steps

### 1 · `found.performance` — `nav-seo.performance`

**How people are finding you**

> What people typed into a search engine before they landed on you, and which of
> your pages they got. It is the closest thing there is to hearing what your
> customers were looking for.

### 2 · `found.audits` — `nav-seo.audits`

**What is holding you back**

> We check your pages for the things search engines quietly mark you down for — a
> missing description, a slow image, two pages saying the same thing — and list
> them plainly with what to do about each.

### 3 · `found.search-console` — `nav-seo.search-console`

**Straight from Google**

> Connect your Search Console account and Google's own figures show up here beside
> ours. Free, takes a couple of minutes, and it is the only source that is not us
> marking our own homework.

### 4 · `found.handoff` — no anchor

**The other half of getting found is posting**

> Everything under Social is about turning up where people already are. It has a
> walk of its own — the wand beside the heading starts it.

---

## Feature tour · Social · `get_found.social` · 6 steps

### 1 · opening — no anchor

**Posting, without living in the apps**

> Write once, choose where it goes and when, and Piggles puts it out. Worth
> knowing: this part is still in beta while the networks finish reviewing our
> access, so the odd thing will behave oddly. Nothing you write is ever lost when
> it does.

### 2 · `nav-social.calendar`

**What is going out, and when**

> A month at a time, everything scheduled in one view. Drag a post to move it.
> Easier to spot the fortnight you have nothing planned from here than from a list.

### 3 · `nav-social.queue`

**Every post you have written**

> Drafts, scheduled, gone out, and anything that failed to send. Rewrite one and
> send it again without starting from scratch.

### 4 · `nav-social.insights`

**Which ones actually landed**

> Reach, likes, comments and clicks, side by side across the networks. Usually one
> kind of post is doing all the work, and this is how you notice.

### 5 · `nav-social.inbox`

**Replies, in one place**

> Comments and messages from every network you have connected, in one list, so you
> are not opening five apps to see whether anyone said anything.

### 6 · `nav-social.approvals`

**When somebody else writes them**

> If a member of staff or an agency posts for you, their drafts wait here for a
> yes before anything goes out. Leave it off and everything posts straight away.

---

## Feature tour · Setting it up · `get_found.setting-it-up` · 2 steps

### 1 · `nav-social.connections`

**Linking your accounts**

> Sign in to each network once and Piggles can post to it. Disconnect any of them
> at any time; nothing else about them changes when you do.

### 2 · `nav-social.cadence`

**How often you want to post**

> Set the days and times you would like something to go out, and Piggles fits your
> posts into those slots instead of asking you to pick a moment for every one.
