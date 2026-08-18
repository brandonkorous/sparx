# Home — 1 app tour, 4 feature tours

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-17

Home is 18 screens and today has **no tour at all** — `GUIDE_KEY_BY_APP` in
[lib/tour/types.ts](../../apps/workbench/lib/tour/types.ts) skips it on the
grounds that the shell tour covers it. The shell tour covers the shell. It does
not cover Business details, Domains, Sites, security, or the setup checklist, and
those are where a new owner spends their first hour.

Needs `'home'` added to `TOUR_MODULES` in
[api-rest me.ts](../../../wizeworks/services/api-rest/src/routes/v1/me.ts) — see
[README.md](README.md) §7.

---

## App tour · `home` · 7 steps

Offered the first time the Home panel is opened. Every step sets `app: 'home'`.

### 1 · `home.start` — `nav-piggles.home`

**Start here every morning**

> Whatever needs you today — an order to send, an invoice nobody has paid, a
> booking tomorrow — is on this one screen. If you only ever open one thing in
> Piggles, make it this.

### 2 · `home.pulse` — `nav-platform.pulse`

**What has been happening**

> Every notable thing, newest first: a sale, a new customer, a payment landing.
> It is the running commentary you would otherwise have to go and look for in five
> different apps.

### 3 · `home.setup` — `nav-workbench.welcome`

**The bits that are not finished yet**

> A short list of what is still to do before your business is fully set up — a
> logo, a web address, a way to take payment. Anything you skipped when you signed
> up is waiting here rather than lost.

### 4 · `home.dashboards` — `nav-analytics.dashboards.list`

**Numbers, arranged the way you want them**

> Build a screen of the figures you actually check — takings, bookings, stock,
> whatever matters in your trade — and keep it. Most people make one and never
> touch it again, which is the point.

### 5 · `home.migrate` — `nav-platform.migrate`

**Coming from somewhere else?**

> If your products, customers or posts are sitting in another system, bring them
> across here instead of retyping them. It will tell you what it found before it
> changes anything.

### 6 · `home.feedback` — `nav-platform.feedback.list`

**What you told us**

> Anything you have sent us, and what came of it. A real person reads every one,
> and this is where the reply lands — so asking for something is not the same as
> shouting into a void.

### 7 · `home.handoff` — `nav-platform.settings.general` · map step

**And the rest of it is settings**

> Everything below here is set once and forgotten — your details, who can sign in,
> what you have connected. Each group has a short walk of its own if you want it;
> the wand beside a heading starts one.

---

## Feature tour · Your business · `home.your-business` · 6 steps

Five screens that between them describe the business itself. Launched from the
**Your business** heading.

### 1 · opening — no anchor

**Who you are, in five screens**

> These are the answers Piggles gives out on your behalf — on your site, on an
> invoice, in an email. Worth ten minutes once, and then you are done with them.

### 2 · `nav-platform.settings.general`

**Your details**

> Trading name, address, phone, tax number, the currency you work in. This is what
> prints on an invoice and shows in the footer of your site, so it is the one to
> get right first.

### 3 · `nav-platform.settings.team`

**Who can sign in**

> Everybody with a login, and how much of Piggles each of them can see. Somebody
> who only does the diary never has to be shown your takings. Not the same as My
> Team, which is about hours and pay.

### 4 · `nav-platform.settings.sites`

**Your shopfronts**

> One site is the normal case. If you run two businesses — a shop and a studio,
> say — each gets its own name, look and customers here, and the switcher at the
> top moves you between them.

### 5 · `nav-platform.settings.domains`

**Your web address**

> Point the address you own at your site, or buy one here if you have not got one
> yet. It handles the certificate itself, so nobody ever sees a "not secure"
> warning on your shop.

### 6 · `nav-platform.settings.notifications`

**What we tell you about**

> Which things reach you by email, which go to the bell at the top, and which stay
> quiet. Set it once so the important ones are not buried under the routine ones.

---

## Feature tour · How Piggles is set up · `home.how-piggles-is-set-up` · 2 steps

### 1 · `nav-platform.settings.industry`

**What kind of business you are**

> Your trade decides a lot of small things — what a "job" is called, which screens
> lead, what a new product asks you for. Change it here if the answer you gave at
> signup no longer fits.

### 2 · `nav-platform.settings.sample-data`

**Practice on made-up data**

> Fills your business with fake customers, orders and products so you can have a
> proper go at everything without touching anything real. Clear it out in one
> click when you are done.

---

## Feature tour · Who can get in · `home.who-can-get-in` · 3 steps

### 1 · `nav-platform.settings.integrations`

**The other software you use**

> Your accounts package, your card machine, your calendar, your shipping labels.
> Connect one here and the two stop being two jobs.

### 2 · `nav-platform.settings.ai`

**Your own AI assistant**

> If you already pay for one, you can point it at your business from here using
> your own account. Piggles never runs one for you and never puts one on your
> bill — it stays your subscription and your key.

### 3 · `nav-platform.settings.security`

**Signing in, and keeping it yours**

> Change your password, and turn on the extra code at sign-in so a stolen password
> on its own is not enough. Worth doing on the account that can see the money.

---

## Feature tour · Setting it up · `home.setting-it-up` · 2 steps

Both of these re-open the setup questions from signup. They are one heading in the
panel and one short walk here.

### 1 · `nav-workbench.onboarding.story`

**Tell us about the business again**

> Describe what you do in your own words and Piggles rearranges itself around the
> answer. Useful when the business has changed — you started selling as well as
> booking, say.

### 2 · `nav-workbench.onboarding`

**Or go through it step by step**

> The same questions as a proper walkthrough, one at a time, if you would rather
> be asked than have to think of it. Nothing here is a one-shot — you can come
> back and change any answer.
