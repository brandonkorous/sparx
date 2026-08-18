# P05 — Priya Anand · Wildwater Climbing

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

**Status:** not started
**Run:** —
**Trade:** Fitness & wellbeing (`fitness`) · **Rail groups:** people · sell · money

## Account

| Field         | Value                    |
| ------------- | ------------------------ |
| Email         | `p05.priya@piggles.test` |
| Tenant id     | —                        |
| Subdomain     | —                        |
| Published URL | —                        |

## The person

Priya Anand, 36, she/her. Co-founded a bouldering gym four years ago with a
business partner who left last year. She now runs it with three part-time
instructors and a rota she maintains in a group chat.

Her problem is not sales, it is **recurring money and finite capacity**. 210
members pay monthly; classes hold twelve people and regularly get fourteen
signups; two people a month want to freeze their membership while travelling.

**What made her look:** her direct debit provider and her class booking tool do
not know about each other, so members pay for classes they already have credit
for.

## The business

**Wildwater Climbing** — one building, one wall, one desk.

- **Memberships**, monthly, on a card, cancellable
- **Classes** with a hard capacity and a waitlist that must actually work
- **Ten-visit packs** for people who will not commit monthly
- **Day passes** and gear hire at the desk
- Everyone signs a **waiver** before their first climb — no waiver, no entry
- Under-18s need a guardian on the account

## Why she is here today

1. "Members pay every month without me touching anything."
2. "A class is full at twelve, and the thirteenth person gets a waitlist place
   that turns into a real one when somebody drops."
3. "Freezing a membership takes one click and does not lose the person."

## Onboarding answers

| Question       | Answer                                                   |
| -------------- | -------------------------------------------------------- |
| Business name  | `Wildwater Climbing`                                     |
| Trade          | Fitness & wellbeing                                      |
| What do you do | I deal with customers · I sell things · I invoice people |
| Look           | first services-shelf option; record which                |

## The data

### Memberships and passes

| Thing                         | Price   | Recurrence                    |
| ----------------------------- | ------- | ----------------------------- |
| Monthly membership — full     | $79.00  | monthly                       |
| Monthly membership — off-peak | $54.00  | monthly                       |
| Monthly membership — under 18 | $42.00  | monthly                       |
| Ten-visit pack                | $140.00 | one-off, expires in 12 months |
| Day pass                      | $22.00  | one-off                       |
| Day pass + shoe hire          | $28.00  | one-off                       |
| Shoe hire only                | $7.00   | one-off                       |
| Chalk bag                     | $24.00  | retail                        |
| Climbing tape, two rolls      | $9.00   | retail                        |

### Classes

| Class                 | Capacity | Length | Price                    | When                 |
| --------------------- | -------- | ------ | ------------------------ | -------------------- |
| Intro to bouldering   | 12       | 90 min | $35 (free to members)    | Tue 18:30, Sat 10:00 |
| Improvers technique   | 10       | 60 min | included with membership | Thu 19:00            |
| Youth club, 8–12s     | 16       | 60 min | $18                      | Sat 09:00            |
| Women's session       | 14       | 90 min | included                 | Wed 19:30            |
| Private coaching, 1:1 | 1        | 60 min | $70                      | by arrangement       |

### Instructors

| Who           | Teaches                     | Works         |
| ------------- | --------------------------- | ------------- |
| Priya Anand   | everything                  | Mon–Fri       |
| Callum Petrie | Intro, Improvers            | Tue, Thu, Sat |
| Yusra Haddad  | Youth club, Women's session | Wed, Sat      |

### Members to load

At least 30, including:

- **Bex Trevelyan** — full membership, 2 years, books everything
- **Gil Ambrose** — off-peak, wants to freeze for six weeks in March
- **Noor Haddad** — under 18, guardian **Yusra Haddad** on the account
- **Trent Bowles** — lapsed, card failed twice, still turning up
- **Marguerite Delacroix-Whitfield** — a name long enough to break a class roster

## The run

### Act 1 — Sign up and onboard

Spine at speed. Note what the `fitness` starter and pack install — this is the
trade whose sample data most resembles the real business, so say whether it
helped or got in the way.

**Done when:** in the console, `industry = 'fitness'` confirmed.

### Act 2 — The things people buy

Create the nine memberships, passes and retail items. The three memberships must
be genuinely recurring, not a product somebody buys repeatedly.

Watch for: whether a recurring price and a one-off price live in the same place,
and whether an expiry can be put on the ten-visit pack.

**Done when:** all nine exist with the right recurrence and expiry.

### Act 3 — The timetable

Set up the three instructors and the five classes with their real capacities and
times, running weekly. Private coaching is capacity 1 and by arrangement.

**Done when:** the week's timetable is right, with the right instructor on each
class.

### Act 4 — The site and the timetable page

Publish a site with a timetable a stranger can read, a membership page with the
three prices, and a "first time here?" page that explains the waiver.

**Done when:** published, and the live timetable matches act 3.

### Act 5 — Be the new member

Clean browser, published site:

1. Join on the **full monthly membership** with a test card.
2. Sign the waiver as part of joining — or discover there is nowhere to.
3. Book **Intro to bouldering** on Saturday, which should be free as a member.
4. Book **Youth club** for a child and see what happens about the guardian.

**Done when:** the membership is live, the first payment taken, and the two
bookings exist — or each gap is filed.

### Act 6 — Fill the class, then overfill it

Book Saturday's Intro up to its capacity of 12 (mix of console and public site),
then attempt a 13th booking as a stranger.

- The 13th must be **refused or waitlisted**, never quietly accepted
- If waitlisted, cancel one of the 12 and confirm the waitlisted person is
  promoted and told

**Done when:** capacity holds and the waitlist behaves, or the exact failure is
filed. A 13th silent booking is a blocker.

### Act 7 — The month runs

- Confirm the recurring charges are scheduled for the members created
- Fail one deliberately (Trent Bowles) and see what the software does — is there
  a dunning path, or does he simply become free?
- Freeze **Gil Ambrose** for six weeks and check both the money and his access
- Resume him early

**Done when:** each outcome is recorded, with the money right.

### Act 8 — At the desk

A walk-in on a Tuesday: sell a **day pass + shoe hire**, take payment, and get
them into that evening's Intro class. Then sell a ten-visit pack to somebody else
and use one visit from it.

**Done when:** both are possible from one screen at the desk without hunting.

### Act 9 — Who is in the building

Check in the twelve people booked into Saturday's class. Mark one a no-show.
Then answer: how many members are active, how many classes ran this week, how
much recurring revenue is committed next month.

**Done when:** check-in works for a full roster and the three numbers are right.

### Act 10 — Leaving

**Bex Trevelyan** cancels. Take the cancellation the way Priya would — end of the
paid period, not immediately — and confirm she keeps access until then, her
history survives, and next month's committed revenue drops by $79.

**Done when:** the cancellation is correct in access, money and record.

## What only this persona proves

**Recurring revenue with capacity**: subscriptions that renew, a failed card, a
freeze and resume, a cancellation at period end — against classes with a hard
limit, a waitlist that promotes, and a check-in desk. Plus a minor's account with
a guardian and a waiver gate before first entry.

## Verification

| Check                                                          | Result |
| -------------------------------------------------------------- | ------ |
| Three memberships recur; packs and passes do not               | —      |
| Ten-visit pack expires and decrements per visit                | —      |
| Class capacity of 12 cannot be exceeded from the public site   | —      |
| Waitlist promotes on a cancellation and tells the person       | —      |
| Failed payment produces a visible state, not silent free entry | —      |
| Freeze pauses billing and access; resume restores both         | —      |
| Cancellation ends at period end, history intact                | —      |
| Waiver blocks a first climb until signed                       | —      |
| Under-18 account carries its guardian                          | —      |
| Committed monthly revenue is correct before and after          | —      |

## Run log

| Date | Act | What happened |
| ---- | --- | ------------- |
| —    | —   | —             |

## Issues found

| #   | Severity | What |
| --- | -------- | ---- |
| —   | —        | —    |
