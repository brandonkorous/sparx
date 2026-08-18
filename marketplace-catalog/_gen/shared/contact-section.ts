// The CONTACT band every starter site ships — the shared builder behind the Contact
// page of all 190 bundles, in every family (service, template/retail/b2b/restaurant,
// portfolio, and the golden `sparx` bundle).
//
// WHY IT EXISTS. An audit on 2026-08-12 graded every page of every shipped bundle and
// found the Contact page was the thinnest page on every site — a median of 52 words
// with no image — and, more to the point:
//
//   · NOT ONE of the 190 sites had a phone number anywhere. Including 97 service
//     bundles: plumbers, HVAC, roofers, movers, dentists, vets, law firms — trades
//     whose customers reach for the phone first.
//   · NOT ONE had a contact form on its contact page. 111 had no email either, so
//     they offered no way at all to reach the business.
//   · 68 shipped `hello@example.com` as the ONLY route to the business.
//
// The catalogue already had the parts: `enquiryForm()`/`callbackForm()` in
// silica-catalog's `sections/convert.ts`, over a form pipeline wired end-to-end (a
// submit reaches the tenant's Form submissions inbox and sends the
// `form-submission-notification` email). No starter used any of it, and the service
// harness had reimplemented `findUs()` WITHOUT the phone and email the catalogue's own
// version carries. That is the whole defect: parts on the shelf, not fitted.
//
// ── NOTHING HERE IS INVENTED ─────────────────────────────────────────────────────
// The phone, email and address are BOUND to `site.identity.*`, which the business fills
// in once under Site settings → How customers reach you. Each row is wrapped in
// `visibleWhen`, so before they fill it in the row is DROPPED rather than rendering a
// placeholder number — a starter site never ships a fake phone line that reads as real,
// and never shows an empty label where a number should be.
//
// The FORM is unconditional, and that is the point: from the first minute the site is
// live, before its owner has configured anything, a visitor can still reach them.
//
// WHY RELATIVE IMPORTS — see the harness headers (marketplace-catalog has no
// node_modules, so a bare `@sparx/*` specifier cannot resolve from here).

import {
    action,
    behave,
    bind,
    el,
    type Node,
} from '../../../wizeworks/packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { bindAttr } from '../../../wizeworks/packages/silica-catalog/src/attr-binding';
import { visibleWhen } from '../../../wizeworks/packages/silica-catalog/src/conditional';

/** Where the details come from — the per-site contact block a business types once. */
const REF = {
    phone: 'site.identity.phone',
    phoneHref: 'site.identity.phoneHref',
    email: 'site.identity.email',
    emailHref: 'site.identity.emailHref',
    address: 'site.identity.address',
} as const;

/**
 * ONE contact channel: a labelled, clickable row that renders only when the business
 * has filled that field in.
 *
 * Three nested elements rather than one, because a node carries exactly ONE `data`
 * binding (see silica-catalog/src/conditional.ts): the outer decides whether anything
 * renders at all, the anchor binds its `href`, and the inner span binds the text. The
 * authored text is what an author sees on the builder canvas; the binding replaces it
 * on the live site.
 */
function channel(label: string, sample: string, valueRef: string, hrefRef: string): Node {
    return visibleWhen(
        el('div', 'flex flex-col gap-1', {
            children: [
                el('span', 'text-base font-medium text-base-content', { text: label }),
                // `text-base-content` + an underline, NOT `text-primary`. `--color-primary` is a
                // FILL token with a `-content` pair for text ON it; used as INK it inherits
                // whatever lightness the theme's brand color happens to have, and on the pale
                // themes that is unreadable — the sweep measured 2.0:1 on `sparx-workshop` and
                // flagged 100+ findings the first time this shipped. It is the same mistake the
                // catalogue already made once on a product price (blueprint-sweep.test.ts's
                // header records it). The underline is what says "link" instead.
                bindAttr(
                    el('a', 'text-lg font-semibold text-base-content underline underline-offset-4', {
                        children: [bind(el('span', '', { text: sample }), valueRef)],
                    }),
                    'href',
                    hrefRef
                ),
            ],
        }),
        valueRef
    );
}

/** The postal address, as an `<address>` so it is marked up as one. Same three-level
 *  shape as `channel`, minus the link. `whitespace-pre-line` is what makes the
 *  business's own line breaks survive — they typed it the way it goes on an envelope. */
function addressBlock(label: string): Node {
    return visibleWhen(
        el('div', 'flex flex-col gap-1', {
            children: [
                el('span', 'text-base font-medium text-base-content', { text: label }),
                bind(
                    el('address', 'text-lg leading-relaxed whitespace-pre-line not-italic text-base-content', {
                        text: '123 Main Street\nPortland, OR 97204',
                    }),
                    REF.address
                ),
            ],
        }),
        REF.address
    );
}

/** A labelled field. The label WRAPS the control, so the pair needs no `id` — two of
 *  these on one page would otherwise emit duplicate ids, which the pre-publish check
 *  reports. Mirrors silica-catalog's own `sections/convert.ts`. */
function field(label: string, name: string, type = 'text', required = true): Node {
    return el('label', 'flex flex-col gap-2', {
        children: [
            el('span', 'text-base font-medium text-base-content', { text: label }),
            el('input', 'input input-bordered w-full', {
                attrs: required ? { type, name, required: true } : { type, name },
            }),
        ],
    });
}

/** A labelled multi-line field. */
function textField(label: string, name: string): Node {
    return el('label', 'flex flex-col gap-2', {
        children: [
            el('span', 'text-base font-medium text-base-content', { text: label }),
            el('textarea', 'textarea textarea-bordered min-h-32 w-full', { attrs: { name } }),
        ],
    });
}

export interface ContactSectionOptions {
    /** The page heading. This is an `h1` — the Contact page is a page, and 90 of the 190
     *  bundles had no `h1` on it at all before this shipped. */
    heading?: string;
    /** The lines under the heading, in the template's own voice. A plain string is the
     *  common case; an array is for the few templates that say it in two or three. */
    intro?: string | string[];
    /** The submit button's words. A service business says "Send my request"; a shop says
     *  "Send message". Naming the action beats a generic "Submit". */
    submitLabel?: string;
    /** Ask for a phone number as well as an email. True for trades that call you back,
     *  false for a shop that will simply reply. */
    askPhone?: boolean;
    /** An optional second, non-form action beside the submit button — "See the work
     *  first", "Browse the shop". A handful of templates offered one next to their old
     *  email button, and it is a real affordance rather than placeholder chrome, so it
     *  survives the conversion. Outline, so the form's own submit stays the point. */
    secondary?: { label: string; href: string };
    /** Show the postal address here. FALSE for the service family, whose Contact page
     *  already carries a `findUs` band binding the same `site.identity.address` beside
     *  its hours and map — printing it twice on one page is the defect this avoids. */
    showAddress?: boolean;
}

/**
 * The Contact page's working half: a heading, the business's own channels (each hidden
 * until set), and a real enquiry form that submits to the tenant's Form submissions
 * inbox.
 *
 * Laid out two-up on wide viewports — details beside the form — and stacked below it.
 * `@3xl` is a CONTAINER step, not a viewport one: the editor's phone and tablet previews
 * resize the block rather than the window, so a `sm:`/`lg:` variant here would show no
 * change in the preview built to check it (the sweep flags that as `class-preview-blind`).
 */
export function contactSection(o: ContactSectionOptions = {}): Node {
    const fields: Node[] = [
        field('Your name', 'name'),
        field('Email address', 'email', 'email'),
        ...(o.askPhone ? [field('Phone number', 'phone', 'tel', false)] : []),
        textField('How can we help?', 'message'),
    ];

    return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-8', {
                children: [
                    el('div', 'flex flex-col gap-3', {
                        children: [
                            el('h1', 'text-4xl font-bold tracking-tight text-base-content @3xl:text-5xl', {
                                text: o.heading ?? 'Get in touch',
                            }),
                            ...(o.intro === undefined ? [] : Array.isArray(o.intro) ? o.intro : [o.intro]).map(
                                (line) =>
                                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', { text: line })
                            ),
                        ],
                    }),
                    // STACKED, and each channel a DIRECT sibling rather than sharing a wrapper.
                    //
                    // Two columns side by side would leave a dead half-width gutter on exactly the
                    // sites that have not been configured yet — which is every site on its first
                    // day. And a wrapper `div` around the three would survive its children being
                    // dropped: an empty flex item still takes a gap on each side, so an
                    // un-configured page got a DOUBLE gap between the intro and the form. The
                    // obvious patch for that (`empty:hidden`) is a trap here — `empty:` is not in
                    // `builder-vocabulary.css` and this file is outside the `@source` scan, so it
                    // would compile in a preview and emit NOTHING on a real tenant's stored tree,
                    // which is the invisible failure that vocabulary file exists to prevent. No
                    // wrapper means neither problem exists to patch.
                    channel('Call us', '(555) 123-4567', REF.phone, REF.phoneHref),
                    channel('Email us', 'hello@yourbusiness.com', REF.email, REF.emailHref),
                    ...(o.showAddress === false ? [] : [addressBlock('Visit us')]),
                    // The form. Deliberately NOT conditional — this is what makes a starter site
                    // reachable on day one, before anything is configured. Held to a readable
                    // measure rather than stretched across the full band.
                    action(
                        behave(
                            el('form', 'flex w-full max-w-xl flex-col gap-5', {
                                children: [
                                    ...fields,
                                    el('div', 'flex flex-wrap items-center gap-3', {
                                        children: [
                                            el('button', 'btn btn-primary btn-lg', {
                                                attrs: { type: 'submit' },
                                                text: o.submitLabel ?? 'Send message',
                                            }),
                                            ...(o.secondary
                                                ? [
                                                    el('a', 'btn btn-outline btn-lg', {
                                                        attrs: { href: o.secondary.href },
                                                        text: o.secondary.label,
                                                    }),
                                                ]
                                                : []),
                                        ],
                                    }),
                                ],
                            }),
                            { type: 'form' }
                        ),
                        'submit'
                    ),
                ],
            }),
        ],
    });
}
