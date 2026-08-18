// Calculated fields — a read-only number worked out from the other fields on
// the same record. "Margin" is price minus cost; "total weight" is unit weight
// times quantity. A business owner should not have to keep those in their head,
// or in a column they update by hand and forget.
//
// THE SECURITY SHAPE. An expression is authored by a tenant and stored in the
// database, so it is UNTRUSTED INPUT that runs on our server. It therefore gets
// a hand-written recursive-descent parser over a tiny grammar — never `eval`,
// never `new Function`, and no access to anything but the sibling values it was
// handed. The grammar has no assignment, no property access, no calls other
// than the four named below, and no loops, so there is nothing to escape into.
//
// THE GRAMMAR
//   expression := term (('+' | '-') term)*
//   term       := unary (('*' | '/') unary)*
//   unary      := '-'? primary
//   primary    := number | identifier | call | '(' expression ')'
//   call       := ('round' | 'abs' | 'min' | 'max') '(' expression (',' expression)* ')'
//   identifier := a sibling field key (camelCase), resolved from the record
//
// A `currency` sibling resolves to its `amount`. Anything missing, null or
// non-numeric resolves to 0 — a half-filled record should show a partial answer,
// not an error badge. Division by zero yields null (the field renders blank),
// because 0 would be a lie and Infinity is not a number anyone wants to read.

import type { FieldDef, FieldSchema } from './types';

/** Depth cap. Bounded recursion keeps a pathological expression from the stack. */
const MAX_DEPTH = 32;

class CalcError extends Error {}

interface Token {
  kind: 'number' | 'ident' | 'op' | 'paren' | 'comma';
  value: string;
}

const FUNCTIONS = new Set(['round', 'abs', 'min', 'max']);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < source.length && /[0-9.]/.test(source[j]!)) j += 1;
      tokens.push({ kind: 'number', value: source.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < source.length && /[a-zA-Z0-9_]/.test(source[j]!)) j += 1;
      tokens.push({ kind: 'ident', value: source.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ kind: 'op', value: ch });
      i += 1;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ kind: 'paren', value: ch });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ kind: 'comma', value: ',' });
      i += 1;
      continue;
    }
    throw new CalcError(`"${ch}" cannot be used in a calculation.`);
  }
  return tokens;
}

/** Resolve one identifier to a number. Missing / blank / non-numeric → 0. */
function resolve(key: string, values: Record<string, unknown>): number {
  const raw = values[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  // A currency sibling contributes its amount.
  if (raw && typeof raw === 'object' && 'amount' in raw) {
    const { amount } = raw;
    return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  }
  if (typeof raw === 'boolean') return raw ? 1 : 0;
  return 0;
}

class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly values: Record<string, unknown>
  ) {}

  parse(): number {
    const value = this.expression(0);
    if (this.pos < this.tokens.length) {
      throw new CalcError('There is something extra at the end of this calculation.');
    }
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private expression(depth: number): number {
    if (depth > MAX_DEPTH) throw new CalcError('This calculation is nested too deeply.');
    let left = this.term(depth + 1);
    for (;;) {
      const token = this.peek();
      if (token?.kind !== 'op' || (token.value !== '+' && token.value !== '-')) break;
      this.pos += 1;
      const right = this.term(depth + 1);
      left = token.value === '+' ? left + right : left - right;
    }
    return left;
  }

  private term(depth: number): number {
    if (depth > MAX_DEPTH) throw new CalcError('This calculation is nested too deeply.');
    let left = this.unary(depth + 1);
    for (;;) {
      const token = this.peek();
      if (token?.kind !== 'op' || (token.value !== '*' && token.value !== '/')) break;
      this.pos += 1;
      const right = this.unary(depth + 1);
      if (token.value === '*') {
        left = left * right;
      } else {
        // Dividing by nothing has no answer. NaN propagates and the caller
        // stores null, so the field renders blank rather than "Infinity".
        if (right === 0) return Number.NaN;
        left = left / right;
      }
    }
    return left;
  }

  private unary(depth: number): number {
    const token = this.peek();
    if (token?.kind === 'op' && token.value === '-') {
      this.pos += 1;
      return -this.unary(depth + 1);
    }
    if (token?.kind === 'op' && token.value === '+') {
      this.pos += 1;
      return this.unary(depth + 1);
    }
    return this.primary(depth + 1);
  }

  private primary(depth: number): number {
    if (depth > MAX_DEPTH) throw new CalcError('This calculation is nested too deeply.');
    const token = this.peek();
    if (!token) throw new CalcError('This calculation stops before it finishes.');

    if (token.kind === 'number') {
      this.pos += 1;
      const n = Number(token.value);
      if (!Number.isFinite(n)) throw new CalcError(`"${token.value}" is not a number.`);
      return n;
    }

    if (token.kind === 'ident') {
      this.pos += 1;
      const next = this.peek();
      // A name followed by "(" is a function call; anything else is a field.
      if (next?.kind === 'paren' && next.value === '(') {
        if (!FUNCTIONS.has(token.value)) {
          throw new CalcError(`There is no "${token.value}" function.`);
        }
        this.pos += 1;
        const args: number[] = [this.expression(depth + 1)];
        for (;;) {
          const sep = this.peek();
          if (sep?.kind !== 'comma') break;
          this.pos += 1;
          args.push(this.expression(depth + 1));
        }
        const close = this.peek();
        if (close?.kind !== 'paren' || close.value !== ')') {
          throw new CalcError('A bracket was opened and never closed.');
        }
        this.pos += 1;
        return applyFunction(token.value, args);
      }
      return resolve(token.value, this.values);
    }

    if (token.kind === 'paren' && token.value === '(') {
      this.pos += 1;
      const inner = this.expression(depth + 1);
      const close = this.peek();
      if (close?.kind !== 'paren' || close.value !== ')') {
        throw new CalcError('A bracket was opened and never closed.');
      }
      this.pos += 1;
      return inner;
    }

    throw new CalcError(`"${token.value}" is not valid here.`);
  }
}

function applyFunction(name: string, args: number[]): number {
  switch (name) {
    case 'round': {
      const [value = 0, places = 0] = args;
      const factor = 10 ** Math.max(0, Math.min(6, Math.trunc(places)));
      return Math.round(value * factor) / factor;
    }
    case 'abs':
      return Math.abs(args[0] ?? 0);
    case 'min':
      return args.length > 0 ? Math.min(...args) : 0;
    case 'max':
      return args.length > 0 ? Math.max(...args) : 0;
    default:
      throw new CalcError(`There is no "${name}" function.`);
  }
}

/**
 * Work out ONE expression against a bag of sibling values.
 *
 * Returns null when the expression cannot produce a number — a syntax error, or
 * a division by nothing. Never throws: a broken calculation must leave the rest
 * of the record perfectly saveable, and the author sees the problem when they
 * check the expression (`checkExpression`), not when a colleague tries to save
 * an unrelated field.
 */
export function evaluateExpression(
  expression: string,
  values: Record<string, unknown>
): number | null {
  try {
    const result = new Parser(tokenize(expression), values).parse();
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/**
 * Validate an expression at AUTHORING time, so the person writing it is told
 * what is wrong while they are looking at it. Returns null when it is fine.
 */
export function checkExpression(expression: string, knownKeys: string[]): string | null {
  let tokens: Token[];
  try {
    tokens = tokenize(expression);
  } catch (error) {
    return error instanceof CalcError ? error.message : 'This calculation cannot be read.';
  }

  // Name every identifier that is neither a function nor a field on this record
  // — a typo'd key silently resolves to 0 at run time, which is the worst
  // possible failure: a confidently wrong number.
  const known = new Set(knownKeys);
  const unknown: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token.kind !== 'ident') continue;
    const next = tokens[i + 1];
    const isCall = next?.kind === 'paren' && next.value === '(';
    if (isCall) {
      if (!FUNCTIONS.has(token.value)) unknown.push(`${token.value}()`);
      continue;
    }
    if (!known.has(token.value) && !unknown.includes(token.value)) unknown.push(token.value);
  }
  if (unknown.length > 0) {
    return `This calculation mentions ${unknown.join(', ')}, which ${
      unknown.length === 1 ? 'is not a field' : 'are not fields'
    } on this record.`;
  }

  try {
    // Parse against zeros — this catches structure (brackets, stray operators)
    // without needing a real record.
    const zeros: Record<string, number> = {};
    for (const key of knownKeys) zeros[key] = 0;
    new Parser(tokens, zeros).parse();
  } catch (error) {
    return error instanceof CalcError ? error.message : 'This calculation cannot be read.';
  }
  return null;
}

/**
 * Overwrite every calculated field in a bag with its freshly computed value.
 *
 * Called on every write, AFTER validation, so a stored calculated value is
 * always the server's own arithmetic and never something a client sent.
 * Calculated fields are resolved against the record's other values only — one
 * calculated field cannot read another, which keeps the whole pass single-shot
 * and free of ordering questions or cycles.
 */
export function applyCalculatedFields(
  schema: FieldSchema,
  values: Record<string, unknown>
): Record<string, unknown> {
  const calculated = schema.fields.filter(
    (field): field is Extract<FieldDef, { type: 'calculated' }> => field.type === 'calculated'
  );
  if (calculated.length === 0) return values;

  // Snapshot the inputs first so evaluation order cannot matter.
  const inputs: Record<string, unknown> = { ...values };
  for (const field of calculated) delete inputs[field.key];

  const next = { ...values };
  for (const field of calculated) {
    const raw = evaluateExpression(field.expression, inputs);
    if (raw === null) {
      next[field.key] = null;
      continue;
    }
    const rounded =
      field.precision === undefined
        ? raw
        : Math.round(raw * 10 ** field.precision) / 10 ** field.precision;
    next[field.key] =
      field.resultType === 'currency'
        ? { amount: rounded, currency: field.currency ?? 'USD' }
        : rounded;
  }
  return next;
}
