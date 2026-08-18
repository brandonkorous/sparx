# Stock and Partners — 2 app tours, 11 feature tours

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-17

57 screens between them, and the pair a business grows into rather than starts
with. 67 steps across 13 tours. Replaces `STOCK_GUIDE` and `PARTNERS_GUIDE` in
[lib/tour/app-tours/sell.ts](../../apps/workbench/lib/tour/app-tours/sell.ts).

**Partners is off the rail for a new business** (`defaultEnabled: false`), so most
people meet it through the All apps door. Its app tour opens by saying what it is,
because unlike every other app nobody chose to put it there.

---

# Stock · 40 screens

The largest app in Piggles. Almost nobody needs all of it: a florist needs four
screens and a parts distributor needs thirty-five. The app tour therefore teaches
**the four that everybody needs** and then points at the rest as a map.

## App tour · `inventory` · 6 steps

### 1 · `stock.levels` — `nav-inventory.stock.list`

**How much of everything you have**

> One line per thing, with what is on the shelf and what is already spoken for by
> orders. This is the number your site uses to stop you selling what you have not
> got, and for a lot of businesses it is the only screen in this app they ever
> open.

### 2 · `stock.setup` — `nav-inventory.setup`

**Getting the numbers right the first time**

> Before any of this is worth trusting, Piggles has to know what you have today.
> This walks you through putting your opening numbers in — by hand, from a
> spreadsheet, or by counting as you go.

### 3 · `stock.reorder` — `nav-inventory.reorder`

**What to order before you run out**

> We watch how fast things sell and how long your suppliers take, and tell you
> what is about to run short. You still decide — this just means nobody has to
> remember.

### 4 · `stock.on-a-product` — `nav-commerce.product.stock`

**And the same thing for one product**

> The stock panel you get when you open something you sell — this row is a
> shortcut to it. Handy when the question is about one item rather than the shelf.

### 5 · `stock.map` — `nav-inventory.warehouses.list`

**Everything below this is the detail**

> Where things are kept, barcodes, picking and packing, what you are making, and
> what the figures say. Nothing below here is needed to sell — it earns its keep
> once one shelf becomes three.

### 6 · `stock.handoff` — no anchor

**Take the ones that sound like you**

> Each group in this list has its own short walk — the wand beside a heading
> starts it. If a heading does not describe anything you do, it almost certainly
> is not for you.

---

## Feature tour · Where it lives · `stock.where-it-lives` · 9 steps

### 1 · opening — no anchor

**When one shelf becomes three**

> The moment stock is in more than one place, "how many have we got" stops being
> one number. These eight screens are how you keep track of which, where and whose.

### 2 · `nav-inventory.warehouses.list`

**Locations**

> A shop, a stockroom, a van, a unit. Each place you keep things is a location,
> and every count from here on is a count in one of them.

### 3 · `nav-inventory.bins.labels`

**Shelf labels**

> Printable labels for the shelves themselves, so what is written on the rack
> matches what is on the screen. Do this before you start scanning, not after.

### 4 · `nav-inventory.bins.list`

**Shelves**

> Inside a location, the actual shelves, racks and bays. Useful once "it is in the
> stockroom" has stopped being a helpful answer to anybody.

### 5 · `nav-inventory.transfers.list`

**Moving stock**

> Sending things from one of your places to another. It comes off one location
> when it leaves and lands on the other when it arrives, so nothing is in two
> places or none.

### 6 · `nav-inventory.counts.list`

**When the shelf disagrees with the screen**

> A count is you walking round with a phone and putting the real numbers in.
> Piggles works out the difference and tells you what it was worth.

### 7 · `nav-inventory.movements.list`

**Every change, and who made it**

> A running list of every single thing that has moved a number — a sale, a
> delivery, a count, a correction. This is the screen that answers "where did
> those twelve go".

### 8 · `nav-inventory.lots.list`

**Batches and serial numbers**

> If you have to know which batch something came from, or track individual units
> by serial, this is where. Food, medical, anything under warranty, anything you
> might have to recall.

### 9 · `nav-inventory.ownership`

**Whose stock it actually is**

> Things sitting in your unit that you have not paid for yet, or that belong to
> somebody else entirely. Keeping it apart here keeps it out of what your stock is
> worth.

---

## Feature tour · Barcodes and scanning · `stock.barcodes-and-scanning` · 5 steps

### 1 · opening — no anchor

**When typing it in stops being realistic**

> Scanning is worth setting up the week counting starts taking a whole morning.
> Any phone camera works — there is nothing to buy to try it.

### 2 · `nav-inventory.barcodes.list`

**Barcodes**

> Every code you have on file and what it points at. A product can have several —
> the manufacturer's, the box's, and one of your own.

### 3 · `nav-inventory.barcodes.labels`

**Product labels**

> Print barcodes for things that arrived without one. Choose a label size, pick
> what to print, and it lays the sheet out for you.

### 4 · `nav-inventory.barcodes.conflicts`

**Codes pointing at two things**

> The same barcode on two products means a scan is a coin toss. Anything
> ambiguous is listed here so you can fix it before it costs you a wrong parcel.

### 5 · `nav-inventory.warehouse`

**Scanner mode**

> A stripped-back screen for a phone in one hand: scan, count, move, receive, pick.
> This is the one to open when you are on the shop floor rather than at a desk.

---

## Feature tour · Counting it · `stock.counting-it` · 2 steps

### 1 · `nav-inventory.stock.import`

**Import from a spreadsheet**

> If your numbers already live in a spreadsheet, bring them in rather than
> retyping. It shows you what it read and what it would change before it changes
> anything.

### 2 · `nav-inventory.stock.grid`

**Edit a lot at once**

> A grid you can tab across and type into, like a spreadsheet. For the afternoon
> after a stocktake when forty numbers are wrong and opening forty screens is not
> happening.

---

## Feature tour · Going out the door · `stock.going-out-the-door` · 5 steps

### 1 · opening — no anchor

**Getting it from the shelf to the customer**

> Two screens for the doing and two for the waiting. If you post more than a
> handful of parcels a day, the first two will save you the most time of anything
> in this app.

### 2 · `nav-inventory.picking.list`

**Picking walks**

> Piggles works out the shortest route round the shelves for a batch of orders and
> hands it to whoever is picking. Fewer laps, fewer wrong items.

### 3 · `nav-inventory.packing.bench`

**Pack bench**

> Scan each thing as it goes in the box. It checks the order off against what you
> scanned, so the wrong item cannot leave in a sealed parcel.

### 4 · `nav-inventory.backorders`

**Waiting list**

> Orders you have taken but cannot fill yet. When the stock arrives, these are the
> people it is already promised to — and they get filled first.

### 5 · `nav-inventory.preorders`

**Preorders**

> Things sold before they exist, with a date you expect them. Different from a
> backorder: the customer knew when they bought it.

---

## Feature tour · Making things · `stock.making-things` · 2 steps

### 1 · `nav-inventory.boms.list`

**Recipes**

> What goes into something you make — the parts, the quantities, the time. A
> bouquet, a hamper, an assembled kit. Piggles works out how many you could build
> from what is on the shelf.

### 2 · `nav-inventory.assemblies.list`

**Making runs**

> An actual batch being made. Starting one takes the parts out of stock; finishing
> it puts the finished thing in.

---

## Feature tour · How it is going · `stock.how-it-is-going` · 8 steps

### 1 · opening — no anchor

**What the numbers are telling you**

> Seven ways of looking at the same stock. The first two answer most questions;
> the rest are for when something specific has gone wrong.

### 2 · `nav-inventory.reports`

**Stock reports**

> What you are holding, what it is worth, what is moving and what is not. The
> starting point, and the one to send your accountant.

### 3 · `nav-inventory.reports.performance`

**How it is performing**

> How fast each thing sells, how long your money sits on a shelf before it comes
> back. The gap between a healthy business and a full stockroom.

### 4 · `nav-inventory.integrity`

**Things that do not add up**

> Numbers that cannot be right — negative stock, an item in two places at once, a
> count nobody finished. Worth clearing before you trust anything above.

### 5 · `nav-inventory.picking.throughput`

**How fast you pack**

> Orders out per hour, per person, per day. Useful before you hire, and useful for
> knowing whether Monday is genuinely worse than Thursday.

### 6 · `nav-inventory.reports.schedules`

**Sent to your inbox**

> Have any of these arrive by email on a Monday morning instead of you remembering
> to come and look. Set it once.

### 7 · `nav-inventory.expiring`

**Expiring stock**

> Anything with a date on it, soonest first. If you sell food, plants, chemicals
> or anything with a shelf life, this is the screen that stops you writing it off.

### 8 · `nav-inventory.reconciliation.books`

**Stock versus your books**

> What Piggles says your stock is worth against what your accounts say. When the
> two disagree, this shows you where — which is a much shorter conversation with
> an accountant than "somewhere".

---

## Feature tour · Looking ahead · `stock.looking-ahead` · 7 steps

### 1 · opening — no anchor

**Guessing better than you could by hand**

> This group is Piggles doing the arithmetic on how fast things sell and how long
> suppliers take. It never orders anything — it tells you what it thinks and
> leaves the decision with you.

### 2 · `nav-inventory.planning`

**At risk**

> What is about to run out, in the order it will happen. The one screen in this
> group to check weekly.

### 3 · `nav-inventory.planning.classes`

**What matters most**

> Sorts your stock by how much of your money it is actually responsible for.
> Usually a small handful of things carry the business, and they are the ones
> worth counting often.

### 4 · `nav-inventory.planning.idle`

**Not selling**

> Things that have not moved in months. Every one of them is money sitting on a
> shelf, and this is the list you discount from.

### 5 · `nav-inventory.planning.holding`

**What it costs to keep**

> Space, insurance, money tied up, things going out of date. Stock is never free
> to hold, and this puts a number on it.

### 6 · `nav-inventory.count-schedules`

**Counting schedules**

> Rather than shutting for a day once a year, count a slice each week. Set which
> things get counted how often and Piggles tells whoever is doing it.

### 7 · `nav-inventory.planning.settings`

**Planning settings**

> How cautious you want the warnings to be — how much buffer to keep, how far
> ahead to look. Leave it alone until the warnings start feeling wrong.

---

## Feature tour · Setting it up · `stock.setting-it-up` · 3 steps

### 1 · `nav-inventory.units`

**Units of measure**

> Whether you count in pieces, metres, kilos or litres, and how to convert between
> them when you buy in one and sell in another.

### 2 · `nav-inventory.costing.settings`

**How stock is valued**

> When the price you pay changes, this decides which cost the reports use. It
> affects what your profit says, so change it with your accountant rather than on
> a whim.

### 3 · `nav-inventory.custom-fields`

**Your own columns**

> Anything you need to record that Piggles did not think of — a rack number, a
> supplier's code, a hazard class. Add the column here and it is on every item.

---

# Partners · 17 screens

## App tour · `partners` · 5 steps

### 1 · `partners.dropship` — `nav-dropship.suppliers.list`

**The people you buy from**

> This app is your side of every supplier relationship — what they charge, what
> you have on order, what has turned up. It is not on your list by default, so if
> you are reading this you went looking for it. Start with the ones who post
> straight to your customer.

### 2 · `partners.dropship-products` — `nav-dropship.products.list`

**What they can send**

> Their catalogue, and which of it you have chosen to offer. You can list
> something without ever holding one, and the parcel goes from them to your
> customer.

### 3 · `partners.dropship-orders` — `nav-dropship.orders.list`

**What they are sending**

> Every order you have passed on, and where each one has got to. When a customer
> asks where their parcel is, this is the screen that knows.

### 4 · `partners.map` — `nav-inventory.suppliers.list`

**And below that, the ones you buy from properly**

> Suppliers you order from, receive from and pay — nine screens covering a
> purchase order from raised to paid. That group has a walk of its own and it is
> the one most businesses want.

### 5 · `partners.handoff` — no anchor

**Two smaller groups after that**

> How your suppliers are performing, and the limits on what can be ordered without
> a yes. Both have short walks — the wand beside a heading starts one.

---

## Feature tour · How it is going · `partners.how-it-is-going` · 3 steps

### 1 · `nav-dropship.analytics`

**What you made on it**

> What you charged against what the supplier charged you, per order. Selling
> things you never touch is easy money right up until it quietly is not.

### 2 · `nav-inventory.suppliers.scorecards`

**Supplier performance**

> Who delivers on time, who sends the right thing, who has put their prices up.
> The evidence for a conversation you would otherwise be having on a feeling.

### 3 · `nav-inventory.costing.variance`

**Cost vs plan**

> Where what you actually paid differs from what you expected to pay. Small gaps
> are normal; a pattern of them is a supplier worth ringing.

---

## Feature tour · Buying it in · `partners.buying-it-in` · 10 steps

### 1 · opening — no anchor

**A purchase order, from raised to paid**

> Nine screens, and they are in order: who you buy from, what you have ordered,
> who signed it off, where it is, what arrived, what you owe, what went back.

### 2 · `nav-inventory.suppliers.list`

**Who you buy from**

> Each supplier, what they sell you, what they charge and how long they usually
> take. That last one is what makes the reorder warnings worth trusting.

### 3 · `nav-inventory.purchase-orders.list`

**What you have on order**

> A purchase order is you telling a supplier what you want. It stays here until it
> arrives, so "have we ordered more of those?" is a question with an answer.

### 4 · `nav-inventory.purchase-orders.approvals`

**Waiting on a yes**

> Orders over your spending limit sit here until somebody approves them. If
> nothing ever appears here, you have not set a limit.

### 5 · `nav-inventory.purchase-orders.late`

**Overdue deliveries**

> Anything that should have arrived and has not. Chase from here rather than
> finding out when a customer asks.

### 6 · `nav-inventory.advance-ship-notices`

**On the way**

> When a supplier tells you in advance what is in the van and when it lands. Not
> every supplier does it; the ones who do make receiving a two-minute job.

### 7 · `nav-inventory.receiving.list`

**Booking stock in**

> Tick things off as the boxes come in. Whatever you receive goes onto your stock
> straight away, and anything short of what you ordered stays flagged.

### 8 · `nav-inventory.supplier-bills`

**Bills to pay**

> What each supplier has invoiced you against what you actually received. The
> screen that catches being billed for eleven of something when ten turned up.

### 9 · `nav-inventory.supplier-returns`

**Sent back**

> Wrong, damaged or surplus stock going the other way, and the credit you are owed
> for it. Credits get forgotten more often than invoices do.

### 10 · `nav-inventory.consignment`

**Paying for what sold**

> When a supplier leaves stock with you and is paid only for what you sell. This
> is the settlement — what has gone, and what you owe them for it.

---

## Feature tour · Setting it up · `partners.setting-it-up` · 2 steps

### 1 · `nav-inventory.sources`

**Counts from elsewhere**

> Stock figures coming in from a supplier's own system rather than from your
> shelves. It tells you what they say they have, so you are not selling what they
> have run out of.

### 2 · `nav-inventory.purchase-orders.approval-rules`

**Spending limits**

> Who can commit how much without asking. Set it once and the approvals screen
> starts doing its job; leave it and everything goes through unchecked.
