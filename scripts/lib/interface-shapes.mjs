/**
 * The field names of every `export interface` in a file, without a compiler.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * `check:console-parity` compared the two consoles' FILES and never their
 * SHAPES, and that is how 54 fields came to exist in one console's wire types
 * and not the other's. Most were fixes: Piggles learned that a retired variant
 * must not read as an empty square, that a photo on a live page is "used", that
 * a booking has a customer with a name. Each fix landed in the console where it
 * was found, the other kept the old shape, and a missing field is invisible:
 * nothing reads it, so nothing breaks, so nothing says so.
 *
 * ── Why no TypeScript compiler ───────────────────────────────────────────────
 *
 * The parity check promises no dependencies, like every check in its family.
 * The trade is that this scanner must REFUSE, loudly, on any member it cannot
 * classify rather than skip it. A scanner that silently drops what it does not
 * understand reports green over the very divergence it was written to find.
 *
 * Two shapes bit the first version and are pinned by `selfTest()` below, which
 * the check runs before trusting a single result:
 *
 *   • `Record<string, unknown>` holds a comma. Angle brackets carry depth, or
 *     the member splits in half and `unknown>` arrives unclassified.
 *   • `=>` in a function type is an arrow, not a closing angle bracket. Miss it
 *     and depth goes negative on every callback field, swallowing the members
 *     after it without a sound.
 */

/** Blank out comments and string bodies so brackets inside them cannot move depth. */
export function declutter(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      out += ' ';
      i += 1;
      while (i < n) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          i += 1;
          break;
        }
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      out += ' ';
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/**
 * Every `export interface` in a file, as name -> sorted field names.
 * Throws on a body it cannot close: a file this cannot read must stop the run.
 */
export function shapesIn(file, src) {
  const clean = declutter(src);
  const shapes = new Map();
  const re = /\bexport\s+interface\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const name = m[1];
    const open = clean.indexOf('{', m.index + m[0].length);
    if (open === -1) throw new Error(`${file}: export interface ${name} has no body`);
    let depth = 0;
    let end = -1;
    for (let i = open; i < clean.length; i += 1) {
      if (clean[i] === '{') depth += 1;
      else if (clean[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) throw new Error(`${file}: export interface ${name} never closes`);
    try {
      shapes.set(name, fieldsOf(clean.slice(open + 1, end)));
    } catch (err) {
      throw new Error(`${file}: export interface ${name}: ${err.message}`);
    }
  }
  return shapes;
}

/** Depth-0 member names of an interface body. Nested object types are blanked
 *  so their inner names cannot masquerade as fields of the parent. */
function fieldsOf(body) {
  let flat = '';
  let depth = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '=' && body[i + 1] === '>') {
      if (depth === 0) flat += '  ';
      i += 1;
      continue;
    }
    if (ch === '{' || ch === '(' || ch === '[' || ch === '<') {
      // An index signature is a MEMBER, so its bracket stays readable at depth 0.
      if (ch === '[' && depth === 0) flat += '[';
      depth += 1;
      continue;
    }
    if (ch === '}' || ch === ')' || ch === ']' || ch === '>') {
      depth -= 1;
      if (depth < 0) throw new Error('a closing bracket with nothing open');
      if (ch === ']' && depth === 0) flat += ']';
      continue;
    }
    flat += depth === 0 ? ch : ch === '\n' ? '\n' : ' ';
  }
  if (depth !== 0) throw new Error(`the body ends ${depth} bracket(s) deep`);

  const names = new Set();
  // Members are separated by `;` or `,` at depth 0. Newline is NOT a separator:
  // a union written one branch per line would otherwise arrive as `| 'a'` parts.
  for (const part of flat.split(/[;,]/)) {
    const t = part.trim();
    if (t === '') continue;
    if (t.startsWith('[')) {
      names.add('[index]');
      continue;
    }
    const f = /^(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*\??\s*:/.exec(t);
    if (f) {
      names.add(f[1]);
      continue;
    }
    // A method shorthand `doThing?(x): y` loses its parens above and arrives as
    // a bare name. Anything else is unclassified and must be shouted about.
    const bare = /^([A-Za-z_$][\w$]*)\s*\??\s*$/.exec(t);
    if (bare) {
      names.add(bare[1]);
      continue;
    }
    throw new Error(`unclassified interface member: ${JSON.stringify(t.slice(0, 80))}`);
  }
  return [...names].sort();
}

/**
 * The two bugs the first version had, and the refusal, proved on every run.
 * Returns the problems found; an empty list means the scanner can be trusted.
 */
export function selfTest() {
  const problems = [];
  const expect = (label, src, want) => {
    let got;
    try {
      got = shapesIn('<self-test>', src).get('T');
    } catch (err) {
      problems.push(`${label}: refused a body it should read (${err.message})`);
      return;
    }
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      problems.push(`${label}: expected ${JSON.stringify(want)}, read ${JSON.stringify(got)}`);
    }
  };
  expect(
    'a comma inside a type argument',
    'export interface T { meta: Record<string, unknown>; after: number }',
    ['after', 'meta']
  );
  expect(
    'an arrow in a callback field',
    'export interface T { onPick: (id: string) => void; after?: string }',
    ['after', 'onPick']
  );
  expect(
    'a nested object is not its parent',
    'export interface T { outer: { inner: string }; ["x"]: 1; [k: string]: unknown }',
    ['[index]', 'outer']
  );
  expect(
    'comments and strings hold no brackets',
    "export interface T {\n  // a } here\n  kind: '{' | '>';\n  /* ) */ tail: number\n}",
    ['kind', 'tail']
  );
  try {
    shapesIn('<self-test>', 'export interface T { 42: number }');
    problems.push('a member it cannot classify was skipped instead of refused');
  } catch {
    // The refusal is the behavior under test.
  }
  return problems;
}
