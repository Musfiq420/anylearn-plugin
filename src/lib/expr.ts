/**
 * A tiny, safe formula language for simulation cards. The AI writes formulas
 * like `25 * (1 - exp(-light / 25))` or `light >= 70`; this parses them into a
 * tree and evaluates them. No eval, no property access, no function calls
 * beyond the math functions listed below.
 *
 * Grammar (lowest to highest precedence):
 *   or      := and ("||" and)*
 *   and     := cmp ("&&" cmp)*
 *   cmp     := sum (("<" | "<=" | ">" | ">=" | "==" | "!=") sum)?
 *   sum     := term (("+" | "-") term)*
 *   term    := unary (("*" | "/" | "%") unary)*
 *   unary   := ("-" | "+" | "!") unary | power
 *   power   := atom ("^" unary)?          (right-associative)
 *   atom    := number | name | name "(" args ")" | "(" or ")"
 */

export type Node =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "call"; fn: string; args: Node[] }
  | { k: "un"; op: "-" | "+" | "!"; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node };

const FUNCTIONS: Record<string, { min: number; max: number; f: (...a: number[]) => number }> = {
  sin: { min: 1, max: 1, f: Math.sin },
  cos: { min: 1, max: 1, f: Math.cos },
  tan: { min: 1, max: 1, f: Math.tan },
  asin: { min: 1, max: 1, f: Math.asin },
  acos: { min: 1, max: 1, f: Math.acos },
  atan: { min: 1, max: 1, f: Math.atan },
  atan2: { min: 2, max: 2, f: Math.atan2 },
  sqrt: { min: 1, max: 1, f: Math.sqrt },
  abs: { min: 1, max: 1, f: Math.abs },
  exp: { min: 1, max: 1, f: Math.exp },
  ln: { min: 1, max: 1, f: Math.log },
  log: { min: 1, max: 1, f: Math.log10 },
  log10: { min: 1, max: 1, f: Math.log10 },
  log2: { min: 1, max: 1, f: Math.log2 },
  pow: { min: 2, max: 2, f: Math.pow },
  min: { min: 1, max: 10, f: Math.min },
  max: { min: 1, max: 10, f: Math.max },
  round: { min: 1, max: 1, f: Math.round },
  floor: { min: 1, max: 1, f: Math.floor },
  ceil: { min: 1, max: 1, f: Math.ceil },
  sign: { min: 1, max: 1, f: Math.sign },
  clamp: { min: 3, max: 3, f: (x, lo, hi) => Math.min(Math.max(x, lo), hi) },
  if: { min: 3, max: 3, f: (c, a, b) => (c ? a : b) },
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

export class ExprError extends Error {}

type Tok = { t: "num"; v: number } | { t: "name"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (name) {
      out.push({ t: "name", v: name[0] });
      i += name[0].length;
      continue;
    }
    const op = /^(<=|>=|==|!=|&&|\|\||[-+*/%^()<>!,])/.exec(src.slice(i));
    if (op) {
      out.push({ t: "op", v: op[0] });
      i += op[0].length;
      continue;
    }
    throw new ExprError(`unexpected character "${ch}"`);
  }
  return out;
}

export function parse(src: string): Node {
  if (src.length > 500) throw new ExprError("formula is too long (max 500 characters)");
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new ExprError(`expected "${v}"`);
    p++;
  };

  const or = (): Node => {
    let a = and();
    while (isOp("||")) {
      p++;
      a = { k: "bin", op: "||", a, b: and() };
    }
    return a;
  };
  const and = (): Node => {
    let a = cmp();
    while (isOp("&&")) {
      p++;
      a = { k: "bin", op: "&&", a, b: cmp() };
    }
    return a;
  };
  const cmp = (): Node => {
    const a = sum();
    for (const op of ["<=", ">=", "==", "!=", "<", ">"]) {
      if (isOp(op)) {
        p++;
        return { k: "bin", op, a, b: sum() };
      }
    }
    return a;
  };
  const sum = (): Node => {
    let a = term();
    while (isOp("+") || isOp("-")) {
      const op = toks[p++].v as string;
      a = { k: "bin", op, a, b: term() };
    }
    return a;
  };
  const term = (): Node => {
    let a = unary();
    while (isOp("*") || isOp("/") || isOp("%")) {
      const op = toks[p++].v as string;
      a = { k: "bin", op, a, b: unary() };
    }
    return a;
  };
  const unary = (): Node => {
    if (isOp("-") || isOp("+") || isOp("!")) {
      const op = toks[p++].v as "-" | "+" | "!";
      return { k: "un", op, a: unary() };
    }
    return power();
  };
  const power = (): Node => {
    const a = atom();
    if (isOp("^")) {
      p++;
      return { k: "bin", op: "^", a, b: unary() };
    }
    return a;
  };
  const atom = (): Node => {
    const tok = peek();
    if (!tok) throw new ExprError("formula ended unexpectedly");
    if (tok.t === "num") {
      p++;
      return { k: "num", v: tok.v };
    }
    if (tok.t === "name") {
      p++;
      if (isOp("(")) {
        p++;
        const fn = tok.v;
        const spec = FUNCTIONS[fn];
        if (!spec) throw new ExprError(`unknown function "${fn}" (allowed: ${FUNCTION_NAMES.join(", ")})`);
        const args: Node[] = [];
        if (!isOp(")")) {
          args.push(or());
          while (isOp(",")) {
            p++;
            args.push(or());
          }
        }
        expect(")");
        if (args.length < spec.min || args.length > spec.max) throw new ExprError(`"${fn}" takes ${spec.min === spec.max ? spec.min : `${spec.min}–${spec.max}`} argument(s)`);
        return { k: "call", fn, args };
      }
      if (tok.v in CONSTANTS) return { k: "num", v: CONSTANTS[tok.v] };
      return { k: "var", name: tok.v };
    }
    if (tok.v === "(") {
      p++;
      const inner = or();
      expect(")");
      return inner;
    }
    throw new ExprError(`unexpected "${tok.v}"`);
  };

  const tree = or();
  if (p < toks.length) throw new ExprError(`unexpected "${String(toks[p].v)}"`);
  return tree;
}

/** Variable names a formula uses. */
export function variablesOf(node: Node, out = new Set<string>()): Set<string> {
  if (node.k === "var") out.add(node.name);
  else if (node.k === "call") node.args.forEach((a) => variablesOf(a, out));
  else if (node.k === "un") variablesOf(node.a, out);
  else if (node.k === "bin") {
    variablesOf(node.a, out);
    variablesOf(node.b, out);
  }
  return out;
}

export function evaluate(node: Node, vars: Record<string, number>): number {
  switch (node.k) {
    case "num":
      return node.v;
    case "var": {
      const v = vars[node.name];
      if (v === undefined) throw new ExprError(`unknown variable "${node.name}"`);
      return v;
    }
    case "call":
      return FUNCTIONS[node.fn].f(...node.args.map((a) => evaluate(a, vars)));
    case "un": {
      const a = evaluate(node.a, vars);
      return node.op === "-" ? -a : node.op === "!" ? (a ? 0 : 1) : a;
    }
    case "bin": {
      if (node.op === "&&") return evaluate(node.a, vars) && evaluate(node.b, vars) ? 1 : 0;
      if (node.op === "||") return evaluate(node.a, vars) || evaluate(node.b, vars) ? 1 : 0;
      const a = evaluate(node.a, vars);
      const b = evaluate(node.b, vars);
      switch (node.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "%": return a % b;
        case "^": return Math.pow(a, b);
        case "<": return a < b ? 1 : 0;
        case "<=": return a <= b ? 1 : 0;
        case ">": return a > b ? 1 : 0;
        case ">=": return a >= b ? 1 : 0;
        case "==": return Math.abs(a - b) < 1e-9 ? 1 : 0;
        case "!=": return Math.abs(a - b) >= 1e-9 ? 1 : 0;
      }
      throw new ExprError(`unknown operator "${node.op}"`);
    }
  }
}

const cache = new Map<string, Node>();

/** Parses (with a cache) and evaluates a formula. Returns NaN if it can't. */
export function calc(src: string, vars: Record<string, number>): number {
  try {
    let node = cache.get(src);
    if (!node) {
      node = parse(src);
      if (cache.size > 500) cache.clear();
      cache.set(src, node);
    }
    return evaluate(node, vars);
  } catch {
    return NaN;
  }
}

/** Checks a formula against the declared variables. Returns an error message or null. */
export function checkFormula(src: string, declared: string[]): string | null {
  try {
    const node = parse(src);
    const unknown = [...variablesOf(node)].filter((v) => !declared.includes(v));
    if (unknown.length) return `uses undeclared variable(s) ${unknown.map((u) => `"${u}"`).join(", ")}; declared: ${declared.join(", ")}`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "can't be read";
  }
}
