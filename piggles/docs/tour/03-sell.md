# Sell — 1 app tour, 8 feature tours

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-17

38 screens — the second-biggest app in Piggles, and the one a shop owner opens
first. 47 steps across 9 tours. Replaces the four-step `SELL_GUIDE` in
[lib/tour/app-tours/sell.ts](../../apps/workbench/lib/tour/app-tours/sell.ts).

**The app tour is a map, not a walk.** Four steps of it ring the FIRST row of a
group and say what the group is for; that row's own step lives in the group's
tour. Thirty-eight screens cannot be taught in one sitting, and the thing a
newcomer is missing is not a screen — it is the shape.

---

## App tour · `commerce` · 5 steps

### 1 · `sell.orders` — `nav-commerce.orders.list`

**Everything lands here**

> Every order, from the moment it comes in to the moment it goes out the door.
> Open one and you get the whole story: what they bought, what they paid, where it
> is going. This is the screen to leave open on a busy day.

### 2 · `sell.catalog` — `nav-commerce.products.list`

**Below that is everything you sell**

> Products, and the seven ways of grouping and configuring them underneath. Add
> one product and your site has something on it; the rest of this group is for
> when one product is not the whole story.

### 3 · `sell.pricing` — `nav-commerce.pricing.list`

**Then what you charge for it**

> A price is the start of it. Special prices for particular customers, discount
> codes, gift cards and credit on account all live in this group, and they all
> apply themselves at the checkout.

### 4 · `sell.after` — `nav-commerce.returns.list`

**And what happens afterwards**

> Returns, reviews, questions and wishlists. Kept apart from live orders on
> purpose — a refund and an order needing packing are two different afternoons.

### 5 · `sell.handoff` — `nav-commerce.reports`

**How it is all going**

> Takings, best sellers, where the orders came from. Every group in this list has
> a short walk of its own — the wand beside a heading starts one, and Wholesale
> at the bottom is worth a look if you sell to trade.

---

## Feature tour · What you sell · `sell.what-you-sell` · 8 steps

### 1 · opening — no anchor

**Seven ways of describing what you offer**

> One of these is essential and six are optional. Do Products, put something on
> your site, and come back to the rest when a customer asks you something the
> product page could not answer.

### 2 · `nav-commerce.products.list`

**Start with what you sell**

> Everything you offer goes in here — a price, some photos, a description.
> Nothing appears on your site until you have at least one, so this is usually the
> first stop.

### 3 · `nav-commerce.collections.list`

**Groups of products**

> A set you have put together and want shown as a set — Christmas, Under £20, New
> in. You choose what goes in, and it becomes a page on your site.

### 4 · `nav-commerce.categories.list`

**Categories**

> The filing cabinet, not the shop window. Categories nest inside each other and
> are how somebody narrows down what they are looking for; a group of products is
> how you show them something you picked.

### 5 · `nav-commerce.bundles.list`

**Bundles**

> Several things sold as one, usually for less than the parts. Piggles takes each
> item out of stock when a bundle sells, so you are not counting it by hand.

### 6 · `nav-commerce.fitment.list`

**What fits what**

> If what you sell has to match something the customer already owns — a part for a
> machine, a filter for a model, a size for a frame — this is where you say so,
> once. Your site turns it into a "will this fit mine?" question.

### 7 · `nav-commerce.configurator.list`

**Build-your-own**

> For anything a customer specifies rather than picks off a shelf. Set out the
> choices and what each one adds to the price, and the site does the sum.

### 8 · `nav-commerce.product-types.list`

**Kinds of product**

> If everything you sell needs the same handful of extra details — a wattage, a
> vintage, a fabric — define that shape once here so every new product asks for
> them instead of you remembering.

---

## Feature tour · On a product · `sell.on-a-product` · 8 steps

> This group is seven deep links into a single product's own tabs. They are
> listed for findability and the group opens **folded** for exactly that reason
> ([PIGGLES_QUIET_SECTIONS](../../apps/workbench/lib/console/section-names.ts)) —
> nobody opens one of these cold. The tour says so in its first step.

### 1 · opening — no anchor

**These are tabs on a product, not screens of their own**

> Each one is a panel you get when you open something you sell. They are listed
> here so you can find one by name — but the normal way in is to open a product
> and pick the tab.

### 2 · `nav-commerce.product.fitment`

**What it fits**

> The machines, models or sizes this particular thing works with. Fill it in and a
> customer can check before they buy instead of after they open the box.

### 3 · `nav-commerce.product.configurator`

**Build-your-own options**

> The choices a customer makes on this one — length, finish, engraving — and what
> each adds to the price.

### 4 · `nav-commerce.product.reviews`

**Reviews and questions**

> What people have said about it and what they have asked. Answer a question here
> and the answer sits on the product page for the next person who wonders.

### 5 · `nav-commerce.product.channels`

**Where it is listed**

> Which of the places you sell this one appears in — your own site, and anywhere
> else you have connected. Useful for the thing you want in the shop but not
> online.

### 6 · `nav-commerce.product.subscriptions`

**Repeat order options**

> Whether somebody can have this delivered every month, and what they save for
> committing. Some products suit it and most do not.

### 7 · `nav-commerce.product.trade-pricing`

**Wholesale price**

> What a trade customer pays for this one, as against the public price. Only shows
> its worth if you sell to businesses as well — and it beats keeping a second
> price list in a spreadsheet.

### 8 · `nav-commerce.product.dropship`

**Shipped by a supplier**

> When the parcel goes straight from your supplier to your customer and you never
> touch it. Set which supplier here, and the order goes to them automatically.

---

## Feature tour · What you charge · `sell.what-you-charge` · 5 steps

### 1 · opening — no anchor

**Four ways of not just charging the list price**

> A price on a product is the default. These four are the exceptions — a better
> price for a good customer, a code, a voucher, money already on account.

### 2 · `nav-commerce.pricing.list`

**Special prices**

> A different price for particular customers, a season, or somewhere you sell.
> Set it once here and the right person sees the right price without you doing
> anything at the till.

### 3 · `nav-commerce.discounts.list`

**Sales, codes and offers**

> Money off, a code for a newsletter, free delivery over a certain amount. Set the
> rule once and it applies itself at the checkout.

### 4 · `nav-commerce.giftcards.list`

**Gift cards**

> Sell one, and it is money in the till today for something they collect later.
> Every card issued and what is left on it is listed here.

### 5 · `nav-commerce.account-credit.list`

**Credit on account**

> Money a customer already has with you — a refund you kept as credit, a goodwill
> gesture, an overpayment. It comes off their next order on its own.

---

## Feature tour · Half-finished · `sell.half-finished` · 3 steps

### 1 · `nav-commerce.carts.list`

**Baskets left behind**

> Somebody filled a basket and did not buy. Usually the most valuable list in this
> app: these people already chose, and a nudge is cheaper than finding a new
> customer.

### 2 · `nav-commerce.checkout-sessions.list`

**Half-finished checkouts**

> A step further on — they were entering their card. If a lot of people stop here,
> something on your checkout is going wrong rather than them changing their mind.

### 3 · `nav-commerce.subscriptions.list`

**Repeat orders**

> Everybody on a regular delivery, what they get, and when the next one goes.
> Pause, skip or change one from here; the customer gets told either way.

---

## Feature tour · After the sale · `sell.after-the-sale` · 5 steps

### 1 · opening — no anchor

**Once the parcel has gone**

> Four screens, and none of them is about money coming in. This is the group that
> decides whether somebody buys from you a second time.

### 2 · `nav-commerce.returns.list`

**When something comes back**

> Returns and refunds have their own screen so they never get lost in with live
> orders. Approving one puts the stock back and the money out in one go.

### 3 · `nav-commerce.reviews.list`

**What people said**

> Every review, and whether it is showing on your site yet. Reply to one and your
> reply sits under it — a good answer to a bad review sells more than the review
> costs.

### 4 · `nav-commerce.qa.list`

**Questions people ask**

> Questions asked on a product page, waiting for an answer. Answer once and it
> stays there for everybody who wonders the same thing.

### 5 · `nav-commerce.wishlists.list`

**What people are saving for later**

> Things customers have put aside without buying. Worth a look before you decide
> what to discount or what to reorder.

---

## Feature tour · Where you sell · `sell.where-you-sell` · 3 steps

### 1 · `nav-commerce.channels.list`

**The places you sell**

> Your own site, and anywhere else you have connected. Each one can carry a
> different slice of what you offer, and orders from all of them land in the same
> list.

### 2 · `nav-commerce.shipping.list`

**Postage and delivery**

> What you charge to send things, and where you will send them. Set a flat rate, a
> rate by weight, free over a threshold, or collection only.

### 3 · `nav-commerce.tax.list`

**Tax**

> Which tax applies where, and whether your prices already include it. Get this
> right once and every order after it is right without a thought.

---

## Feature tour · Setting it up · `sell.setting-it-up` · 5 steps

> The panel puts two wholesale screens in this group because the platform
> registers them under a section string that resolves to the same heading. It
> reads oddly — two rows about trade under a heading between "How you take
> payment" and nothing else — and is worth separating in the catalog. Until then
> the tour walks what is actually on screen.

### 1 · opening — no anchor

**Four things you set once**

> Two are about your shop and two are about selling to trade. None of them needs
> revisiting once it is right.

### 2 · `nav-commerce.providers`

**How you take payment**

> Connect the account that takes the money — card, wallet, bank transfer. Until
> one is connected your site can show a price but cannot take a penny.

### 3 · `nav-commerce.settings`

**Selling settings**

> The small decisions: whether people can buy without an account, whether you sell
> past zero stock, what an order number looks like, which currency.

### 4 · `nav-b2b.pricing-tiers.list`

**Wholesale prices**

> If you sell to trade as well as the public, a tier is a named price list you put
> a customer on — Trade, Distributor, Key account. They sign in and see their own
> prices.

### 5 · `nav-b2b.approvals`

**Orders to approve**

> Trade customers often need a manager's yes before an order stands. Anything
> waiting for one sits here, and nothing ships until it has been given.

---

## Feature tour · Wholesale · `sell.wholesale` · 5 steps

### 1 · opening — no anchor

**Selling to other businesses**

> Trade customers buy differently: they ask for a quote, order on account, and pay
> on an invoice at the end of the month. These four screens are that whole shape.

### 2 · `nav-b2b.accounts.list`

**Wholesale customers**

> Each business you supply, who is allowed to order for them, what they are
> allowed to spend, and which prices they get.

### 3 · `nav-b2b.orders.list`

**Wholesale orders**

> Trade orders, kept apart from the public ones. Bigger, on account, and usually
> waiting on an approval rather than a payment.

### 4 · `nav-b2b.quotes.list`

**Quotes**

> A price you have put in writing, with a date it runs out. Accept one and it
> becomes an order without anybody retyping it.

### 5 · `nav-b2b.invoices.list`

**Wholesale invoices**

> What each trade customer owes, and how long they have had. This is where a
> friendly account quietly becomes an expensive one, so it is worth a Monday look.
