// No color token may carry transparency.
//
// ── WHY THIS IS A CHECK ─────────────────────────────────────────────────────
//
// `--color-group-people: #8fc2c06e` shipped and nothing caught it. The eight
// digits are the six of a color plus an alpha byte, and `6e` is 43% — so every
// control in Customers, Messages and Bookings drew its fill at 43% opacity in
// dark mode, with the page showing through the Save button and through "Take a
// booking". Someone then set that group's `-content` to `#ffffff` to compensate,
// which is how a two-character slip becomes a second wrong value.
//
// It is invisible to everything else we run. It is valid CSS, valid hex, and it
// typechecks, lints and tests green; the only symptom is that three of fifteen
// apps look slightly washed out, which reads as a design choice. It survived
// because nobody put the two themes side by side.
//
// ── WHY TOKENS AND NOT THE WHOLE STYLESHEET ─────────────────────────────────
//
// Transparency is not banned — a scrim, a hover wash and a focus ring all need
// it, and they are written as `color-mix(… , transparent)` or `rgb(… / .5)` at
// the place that wants it. What is banned is a NAMED COLOR that arrives already
// faded, because every downstream use inherits the fade and none of them asked
// for it. So the rule is narrow: a `--color-*` custom property may not be
// declared as an 8-digit hex.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = [join(ROOT, 'packages'), join(ROOT, 'apps')];

/** Every `.css` under a root, skipping build output and installed packages. */
function stylesheets(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out.push(...stylesheets(path));
        else if (name.endsWith('.css')) out.push(path);
    }
    return out;
}

// `--color-<anything>: #rrggbbaa` — the four-byte form only. Six digits pass.
const FADED_TOKEN = /(--color-[\w-]+)\s*:\s*(#[0-9a-fA-F]{8})\b/;

function main() {
    const files = [];
    for (const root of ROOTS) {
        // A scan root that has been moved away must fail loudly rather than scan
        // nothing and print a tick — the whole point of a guard is the denominator.
        statSync(root);
        files.push(...stylesheets(root));
    }

    const bad = [];
    for (const file of files) {
        readFileSync(file, 'utf8')
            .split('\n')
            .forEach((line, index) => {
                const hit = FADED_TOKEN.exec(line);
                if (hit) bad.push({ file, line: index + 1, token: hit[1], value: hit[2] });
            });
    }

    if (bad.length > 0) {
        console.error('A color token is declared with transparency:\n');
        for (const row of bad) {
            console.error(
                `  ${relative(ROOT, row.file)}:${String(row.line)}  ${row.token}: ${row.value}` +
                `  →  ${row.value.slice(0, 7)} (drop the alpha byte)`
            );
        }
        console.error(
            '\nEverything painted from that token inherits the fade — fills, ink, borders,' +
            '\nfocus rings — and none of them asked for it. If one PLACE wants transparency,' +
            '\nwrite it there with color-mix() against the surface it sits on.'
        );
        process.exit(1);
    }

    console.log(`check:piggles-theme — ${String(files.length)} stylesheets, no faded color tokens`);
}

main();
