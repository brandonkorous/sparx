# Who you deal with — Customers, Messages, Bookings

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-17

40 screens across three apps. 3 app tours, 8 feature tours, 52 steps.
Replaces [lib/tour/app-tours/people.ts](../../apps/workbench/lib/tour/app-tours/people.ts).

---

# Customers · 21 screens

The one app whose name has to do the most work. It is a CRM, and a person reading
this has never used one and must never be made to learn the word
([CLAUDE.md](../../CLAUDE.md) RULE #3). Every step here says _people_, _work you
are trying to win_, _things you said you would do_.

**No front-door section.** Customers is the only app whose panel opens straight
onto a heading, so its app tour is entirely a map.

## App tour · `crm` · 4 steps

### 1 · `customers.people` — `nav-crm.customers.list`

**Everyone you deal with**

> One page per person or company, with everything that has ever happened between
> you on it — orders, invoices, bookings, emails, notes. Nobody has to remember
> what was agreed. The three rows under this one are ways of grouping them.

### 2 · `customers.scoring` — `nav-crm.scoring`

**Who is worth chasing**

> Piggles scores your customers on what they have spent, how recently, and how
> they have been behaving lately. Not a judgement on people — a way of deciding
> who gets the phone call when you only have an hour.

### 3 · `customers.deals` — `nav-crm.deals.list`

**Work you are trying to win**

> A quote out, a job being discussed, a big order not yet placed. This group is
> that whole side of it — the deals, the stages they move through, and the things
> you said you would do about them.

### 4 · `customers.handoff` — no anchor

**And three more groups below**

> People asking for help, how it is all going, and the settings you touch once.
> Each has a short walk — the wand beside a heading starts it.

---

## Feature tour · People · `customers.people` · 5 steps

### 1 · opening — no anchor

**Four ways of looking at the same people**

> One record per person is the whole idea. These four are how you find them, group
> them, and stop the same person being in here twice.

### 2 · `nav-crm.customers.list`

**Everyone you deal with**

> One page per person, with everything that has ever happened between you on it —
> orders, invoices, bookings, emails, notes. Open somebody before you ring them
> and you already know the answer.

### 3 · `nav-crm.accounts.list`

**Companies**

> When you sell to a business rather than a person, the company is the customer
> and the people are contacts on it. Somebody leaving does not take the history
> with them.

### 4 · `nav-crm.segments.list`

**Groups that keep themselves up to date**

> "Bought in the last ninety days", "never ordered", "spent over £500". Describe
> the group once and people join and leave it on their own — which is what makes a
> mailout worth sending.

### 5 · `nav-crm.duplicates.list`

**Possible duplicates**

> The same person twice, usually because they used two email addresses. Piggles
> spots the likely pairs; you decide whether to merge, and the history from both
> comes with it.

---

## Feature tour · Winning work · `customers.winning-work` · 5 steps

### 1 · opening — no anchor

**Everything you have not been paid for yet**

> A quote is not an order and an order is not money in the bank. This group is the
> gap between them, and it exists so nothing quietly goes cold.

### 2 · `nav-crm.deals.list`

**Work you are trying to win**

> A quote out, a job being discussed, a big order not yet placed. Move it along a
> board as it progresses so you can see at a glance what is actually live.

### 3 · `nav-crm.pipelines.list`

**How a deal moves**

> The stages a piece of work goes through in your trade — enquiry, quoted, agreed,
> booked in. Set them to match how you actually work rather than how a piece of
> software imagines you do.

### 4 · `nav-crm.tasks.list`

**The things you said you would do**

> Ring them back, send the quote, chase the deposit. Tasks hang off the customer
> they are about, so opening somebody tells you what you owe them.

### 5 · `nav-crm.orders.list`

**What they have actually bought**

> Every order, listed by customer rather than by date. The quickest way to answer
> "what did we do for them last time".

---

## Feature tour · Helping people · `customers.helping-people` · 2 steps

### 1 · `nav-crm.tickets.list`

**Help requests**

> A question, a complaint, something that went wrong. Kept apart from sales so
> that somebody waiting on an answer is never buried under somebody being sold to.

### 2 · `nav-crm.sla-policies`

**Response times**

> How quickly you have promised to reply, and what counts as late. Anything about
> to break the promise is flagged before it does rather than after.

---

## Feature tour · How it is going · `customers.how-it-is-going` · 3 steps

### 1 · `nav-crm.reports`

**Customer reports**

> Who is spending, who has gone quiet, where new customers are coming from, what
> you are winning and losing. Ready-made, no setting up.

### 2 · `nav-crm.report.library`

**Build a report**

> When the ready-made ones do not ask your question, build one. Pick what to
> count, how to break it down, and save it so you never build it twice.

### 3 · `nav-crm.dashboards`

**Dashboards**

> Several of those on one screen, so the Monday morning look is one page rather
> than six.

---

## Feature tour · Setting it up · `customers.setting-it-up` · 8 steps

### 1 · opening — no anchor

**Seven things you set once**

> None of these is needed on day one. Come back when a habit has formed and you
> are tired of doing the same thing by hand.

### 2 · `nav-crm.object-types.list`

**Things you track**

> If your business keeps track of something Piggles has no word for — a vehicle, a
> property, a policy, a plot — you invent it here and decide what goes on it. Most
> businesses never need this.

### 3 · `nav-crm.templates.list`

**Email templates**

> Whole emails you send often — a quote follow-up, a welcome, a "we tried to
> call". Write it once, pick it from a list after that.

### 4 · `nav-crm.snippets.list`

**Saved paragraphs**

> Smaller than a template: the paragraph about your returns policy, your bank
> details, your parking instructions. Drop it into anything you are writing.

### 5 · `nav-crm.mailboxes.list`

**Mailboxes**

> Connect the email address you already use and the conversation appears on the
> customer's page automatically. No forwarding, no copying yourself in.

### 6 · `nav-crm.phone-systems.list`

**Phone systems**

> If your phones can talk to Piggles, calls get logged against the right person on
> their own, and the screen comes up when it rings.

### 7 · `nav-crm.meeting-links`

**Booking links**

> A link you can put in an email that lets somebody pick a slot in your diary.
> Saves the six messages it usually takes to agree a time.

### 8 · `nav-crm.settings`

**How this app behaves**

> The small decisions: what a new customer defaults to, who owns an enquiry that
> arrives, how long before somebody counts as gone quiet.

---

# Messages · 9 screens

Two different jobs under one name: **email you send out**, and **live chat with
somebody on your site right now**. The panel keeps them apart and so does the
tour, because writing a newsletter and answering a visitor are not the same
afternoon.

## App tour · `email` · 6 steps

### 1 · `messages.broadcasts` — `nav-email.broadcasts.list`

**One message, everybody at once**

> A newsletter, an offer, a "we are closed next Monday". Pick who it goes to from
> your customer groups, and see afterwards how many opened it.

### 2 · `messages.sequences` — `nav-email.sequences.list`

**Messages that send themselves**

> A welcome a day after somebody first orders, a nudge to anyone who left
> something in their basket. Set it up once and it keeps going without you.

### 3 · `messages.chat` — `nav-chat.inbox`

**And the other kind of message**

> Somebody on your site, wanting an answer now. Every live conversation lands
> here, and anything you miss turns into an email so nobody is left waiting.

### 4 · `messages.chat-overview` — `nav-chat.overview`

**How the chat is doing**

> How many people started a conversation, how quickly you answered, and what they
> were asking about. If the same question keeps coming up, your site is missing a
> sentence somewhere.

### 5 · `messages.domains` — `nav-email.domains.list`

**Send from your own address**

> Until you set this up, mail goes out from a Piggles address. Connecting yours
> takes a few minutes and means it arrives looking like it came from you — which
> is most of whether it arrives at all. The rest of that group is settings.

### 6 · `messages.handoff` — no anchor

**That is the shape of it**

> Everything else in this app is set once — who you must not email, how your
> messages look, and the ready-made replies for chat. The wand beside the heading
> walks you through them.

---

## Feature tour · Setting it up · `messages.setting-it-up` · 6 steps

### 1 · opening — no anchor

**Five things to sort before you send much**

> The first one matters more than the other four put together: mail from your own
> address is far likelier to arrive at all.

### 2 · `nav-email.domains.list`

**Sending addresses**

> Connect the address you want mail to come from. Piggles gives you a few settings
> to add wherever your web address is managed, and checks them for you.

### 3 · `nav-email.suppressions.list`

**Do not email**

> Anybody who has unsubscribed, bounced, or asked not to hear from you. Nothing
> here ever gets a marketing email again, whatever list they end up on — which is
> both the law and good manners.

### 4 · `nav-email.settings`

**Email settings**

> Your reply-to address, the footer at the bottom, and what an unsubscribe link
> says. Set once.

### 5 · `nav-chat.settings`

**Chat settings**

> Whether the chat box shows on your site, when, and what it says while nobody is
> there to answer. An honest "back at nine" beats a bot.

### 6 · `nav-chat.quick-replies`

**Quick replies**

> The answers you type twenty times a week — opening hours, where you are,
> delivery times. Saved here, one click away mid-conversation.

---

# Bookings · 10 screens

## App tour · `scheduling` · 4 steps

### 1 · `bookings.calendar` — `nav-scheduling.calendar`

**Your diary**

> Everything booked, by day or by week. Drag one to move it and the customer gets
> told — you never have to send that message yourself.

### 2 · `bookings.setup` — `nav-scheduling.services.list`

**What people can book, and when**

> Before the diary can fill itself, Piggles needs to know what you offer, who or
> what is needed for each, and the hours you are open to it. That is the group
> below, and it is worth half an hour once.

### 3 · `bookings.reports` — `nav-scheduling.reports`

**How bookings are going**

> How full you are, what gets booked most, how often people do not turn up. The
> last one is the number that quietly decides whether you take deposits.

### 4 · `bookings.handoff` — no anchor

**Two groups, two short walks**

> Your diary and the setting up. The wand beside either heading starts one.

---

## Feature tour · Your diary · `bookings.your-diary` · 3 steps

### 1 · `nav-scheduling.bookings.list`

**Bookings**

> The same appointments as the calendar, as a list you can search and filter.
> Easier for "what did we do for them in March" than scrolling a month view.

### 2 · `nav-scheduling.series.list`

**Repeating bookings**

> Every Tuesday at ten, the first Monday of the month. Change one and it asks
> whether you meant just that one or all of them.

### 3 · `nav-scheduling.waitlist`

**Waiting list**

> People who wanted a slot you did not have. When one frees up, they are the first
> to know — which turns a cancellation from a loss into a filled hour.

---

## Feature tour · Setting it up · `bookings.setting-it-up` · 6 steps

### 1 · opening — no anchor

**Half an hour, once**

> Five screens, and they build on each other in this order. Get them right and the
> diary stops filling up with times that never suited you.

### 2 · `nav-scheduling.services.list`

**What people can book**

> Each thing you offer, how long it takes and what it costs. This is what somebody
> sees on your site, so it is worth writing them the way you would say them out
> loud.

### 3 · `nav-scheduling.resources.list`

**People and equipment**

> Who or what has to be free for a booking to happen — a stylist, a room, a
> machine, a van. Piggles will not double-book any of them.

### 4 · `nav-scheduling.locations.list`

**Places**

> Where things happen, if you work from more than one. Travel time between them
> can be accounted for so the diary does not promise the impossible.

### 5 · `nav-scheduling.availability`

**When you are open to it**

> Your hours, your days off, and the times you would rather keep clear. Everything
> the booking page offers comes from this.

### 6 · `nav-scheduling.policies`

**Booking rules**

> How much notice you want, how far ahead people can book, whether they pay a
> deposit, and what happens when somebody cancels late.
