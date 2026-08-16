'use client';

// The platform mark — a social network's own logo, in its own color, on a disc.
//
// COLOR. This is the ONE sanctioned place in the workbench for hard-coded color,
// cleared with Brandon on 2026-07-28. The rule it steps around (RULE #1: color comes from
// tokens, so it can answer light/dark) exists to keep OUR surfaces coherent. These are not
// our surfaces: Pinterest red and Facebook blue belong to Pinterest and Facebook, mean
// nothing else, and are the fastest thing on screen to recognise — which is the whole job
// of a disc sitting behind an account's face. A token cannot express them. The glyph on
// top is always white: a fixed foreground on a fixed background is theme-independent by
// construction, so there is no light/dark question and no token to reach for.
//
// ARTWORK. The paths and the hex values are the real marks, taken from simple-icons
// (https://simpleicons.org, CC0 1.0) — the source commonly pointed at for the brands
// it does not carry. They are vendored rather than installed: nine icons that change maybe
// once a decade do not justify a dependency, and copying them keeps the bundle flat.
//
// Vendored on 2026-07-28 from simple-icons@latest. To refresh one:
//   curl -sL https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/<slug>.svg
//   curl -sL https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/<slug>.js   # hex
// Do not hand-edit a path. An earlier version of this file drew these by hand and shipped
// a Pinterest mark that read as a keyhole and a Threads mark that read as a capital G.
//
// The three brands whose color IS black (X, TikTok, Threads) let their disc melt into a
// dark theme's surface. That is fine and not worth a workaround: the white glyph carries
// the recognition, and inside an `AvatarGroup` silica's own base-100 gap draws the edge.

/** Each platform's own color, as the brand publishes it. Not tokens, and not eligible to
 *  become tokens — see above. */
const BRAND_HEX: Record<string, string> = {
    facebook_page: '#1877F2',
    instagram: '#E4405F',
    threads: '#000000',
    linkedin: '#0A66C2',
    x: '#000000',
    tiktok: '#000000',
    pinterest: '#BD081C',
    youtube: '#FF0000',
    google_business: '#4285F4',
};

/** The 24×24 solid glyph for each platform, verbatim from simple-icons. */
const GLYPH: Record<string, string> = {
    facebook_page:
        'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
    instagram:
        'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
    threads:
        'M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z',
    linkedin:
        'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
    x: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
    tiktok:
        'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
    pinterest:
        'M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z',
    youtube:
        'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
    // simple-icons still ships this under Google's older "My Business" name; the product is
    // now Google Business Profile and the mark is unchanged.
    google_business:
        'M3.273 1.636c-.736 0-1.363.492-1.568 1.16L0 9.272c0 1.664 1.336 3 3 3a3 3 0 003-3c0 1.664 1.336 3 3 3a3 3 0 003-3c0 1.65 1.35 3 3 3 1.664 0 3-1.336 3-3 0 1.664 1.336 3 3 3s3-1.336 3-3l-1.705-6.476a1.646 1.646 0 00-1.568-1.16zm8.729 9.326c-.604 1.063-1.703 1.81-3.002 1.81-1.304 0-2.398-.747-3-1.806-.604 1.06-1.702 1.806-3 1.806-.484 0-.944-.1-1.363-.277v8.232c0 .9.736 1.637 1.636 1.637h17.454c.9 0 1.636-.737 1.636-1.637v-8.232a3.48 3.48 0 01-1.363.277c-1.304 0-2.398-.746-3-1.804-.602 1.058-1.696 1.804-3 1.804-1.299 0-2.394-.75-2.998-1.81zm5.725 3.765c.808 0 1.488.298 2.007.782l-.859.859a1.623 1.623 0 00-1.148-.447c-.98 0-1.772.827-1.772 1.806 0 .98.792 1.807 1.772 1.807.882 0 1.485-.501 1.615-1.191h-1.615v-1.16h2.826c.035.196.054.4.054.613 0 1.714-1.147 2.931-2.88 2.931a3 3 0 010-6z',
};

/** Inset of the 24-grid glyph inside the 24-grid disc. 0.56 leaves a ring of brand color
 *  wide enough to read as a disc rather than a squashed logo, at every size this is used. */
const GLYPH_SCALE = 0.56;
const GLYPH_OFFSET = (24 - 24 * GLYPH_SCALE) / 2;

/** Whether this platform has a mark to draw. Callers that lay out around it ask first, so
 *  an unknown platform collapses the space instead of reserving a hole in it. */
export function hasPlatformMark(platform: string): boolean {
    return platform in GLYPH;
}

/**
 * One platform's mark. `className` sets the size; everything inside scales to it, so a
 * 14px mark and a 40px one are the same drawing.
 *
 * `platform` is a plain string because that is what the API hands back — the workbench
 * deliberately does not narrow it. An unrecognised one renders NOTHING rather than a guess
 * or a mystery grey disc: a mark that cannot say which network this is has no job.
 *
 * Decorative by default: it is nearly always paired with the account name in the same row,
 * and a screen reader announcing "Pinterest" twice per destination is noise. Pass `label`
 * where the mark stands alone.
 */
export function PlatformMark({
    platform,
    className = 'size-4',
    label,
}: {
    platform: string;
    className?: string;
    label?: string;
}) {
    const glyph = GLYPH[platform];
    if (!glyph) return null;
    return (
        // One SVG, two shapes — no nested positioning, so this owns no `relative`/`absolute`
        // and can never fight a placement its caller passes in.
        <svg
            viewBox="0 0 24 24"
            className={`shrink-0 ${className}`}
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
        >
            <circle cx="12" cy="12" r="12" fill={BRAND_HEX[platform]} />
            <path
                d={glyph}
                fill="#FFFFFF"
                transform={`translate(${String(GLYPH_OFFSET)} ${String(GLYPH_OFFSET)}) scale(${String(GLYPH_SCALE)})`}
            />
        </svg>
    );
}
