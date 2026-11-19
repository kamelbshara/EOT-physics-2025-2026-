// Math answer equivalence (teacher request 2026-11-16: "all possible ways of answers are corrected correct, specially
// in terms of expressions"). Accepts both LaTeX (from the MathLive writing tool) and plain typed math, parses it into a
// tree and compares by value at several sample points, so every algebraically equal form is accepted:
//   2w = w·2 = 2*w · x/4-2 = 0.25x-2 = \frac{x-8}{4} · (2b-5)(2b+5) = 4b^2-25 · 3\sqrt{2} = \sqrt{18}
//   y=2x+3 for the box after "y =" · x=5 for 5 · lists and ± in any order (2,-3 = -3,2 = 2 or -3 = -0.5±2.5)
//   equations up to a non-zero factor (2x-y+3=0 = y=2x+3) · inequalities (x>3 = 3<x) · intervals and points.
// Decimals: a correctly rounded decimal with at least 2 decimal places is accepted for a value whose exact form is a
// fraction or a surd (1/3 → 0.33, √2 → 1.41). Trigonometric functions use degrees (school geometry).

const FUNCS = new Set(['sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'abs', 'exp']);
const UNITS = /^(cm|mm|m|km|in|ft|units?|sq|square|cubic|degrees?|deg|kg|g|l|ml|s|sec|seconds?|min|minutes?|hours?|hrs?|aed|dhs?|dirhams?|dollars?|meters?|metres?|centimeters?|feet|inches?|grams?|liters?|litres?)$/i;

// ---------------------------------------------------------------- tokenizer
function tokenize(src) {
  let s = String(src ?? '')
    .replace(/[−–—]/g, '-').replace(/[×·∙⋅]/g, '*').replace(/÷/g, '/').replace(/≤|⩽/g, '<=').replace(/≥|⩾/g, '>=').replace(/≠/g, '!=')
    .replace(/π/g, '\\pi ').replace(/∞/g, '\\infty ').replace(/√/g, '\\sqrt ').replace(/±/g, '\\pm ').replace(/∪/g, '\\cup ').replace(/ℝ/g, 'R')
    .replace(/²/g, '^2').replace(/³/g, '^3').replace(/°/g, '\\circ ').replace(/​| /g, ' ')
    .replace(/\\placeholder(\[[^\]]*\])?\{[^}]*\}/g, '').replace(/\\(?:displaystyle|textstyle|scriptstyle|mathstrut|left\.|right\.)/g, '')
    .replace(/\\(?:,|;|:|!|quad|qquad| )/g, ' ').replace(/~/g, ' ');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|\{|\}|\||[^A-Za-z])/.exec(s.slice(i)); if (!m) { i++; continue; }
      let cmd = m[1]; i += m[0].length;
      if (cmd === 'left' || cmd === 'right' || cmd === 'big' || cmd === 'Big' || cmd === 'bigl' || cmd === 'bigr' || cmd === 'Bigl' || cmd === 'Bigr') continue; // the delimiter follows
      if (cmd === 'boxed' || cmd === 'underline' || cmd === 'color' && false) continue; // \boxed{x} → x
      if (cmd === '{') { out.push({t: '{', lit: true}); continue; }
      if (cmd === '}') { out.push({t: '}', lit: true}); continue; }
      if (cmd === '|' || cmd === 'vert' || cmd === 'lvert' || cmd === 'rvert' || cmd === 'mid') { out.push({t: '|'}); continue; }
      if (cmd === 'lbrace') { out.push({t: '{', lit: true}); continue; }
      if (cmd === 'rbrace') { out.push({t: '}', lit: true}); continue; }
      if (cmd === 'langle' || cmd === 'lparen') { out.push({t: '('}); continue; }
      if (cmd === 'rangle' || cmd === 'rparen') { out.push({t: ')'}); continue; }
      if (cmd === 'lbrack') { out.push({t: '['}); continue; }
      if (cmd === 'rbrack') { out.push({t: ']'}); continue; }
      if (/^(cdot|times|ast)$/.test(cmd)) { out.push({t: '*'}); continue; }
      if (cmd === 'div') { out.push({t: '/'}); continue; }
      if (/^(le|leq|leqslant)$/.test(cmd)) { out.push({t: 'rel', v: '<='}); continue; }
      if (/^(ge|geq|geqslant)$/.test(cmd)) { out.push({t: 'rel', v: '>='}); continue; }
      if (/^(ne|neq)$/.test(cmd)) { out.push({t: 'rel', v: '!='}); continue; }
      if (cmd === 'lt') { out.push({t: 'rel', v: '<'}); continue; }
      if (cmd === 'gt') { out.push({t: 'rel', v: '>'}); continue; }
      if (cmd === 'pm') { out.push({t: 'pm'}); continue; }
      if (cmd === 'mp') { out.push({t: 'pm'}); continue; }
      if (cmd === 'cup') { out.push({t: 'cup'}); continue; }
      if (cmd === 'circ' || cmd === 'degree') { out.push({t: 'deg'}); continue; }
      if (cmd === 'pi') { out.push({t: 'num', v: Math.PI, pi: true}); continue; }
      if (cmd === 'infty' || cmd === 'infin') { out.push({t: 'num', v: Infinity, inf: true}); continue; }
      if (cmd === 'percent' || cmd === '%') { out.push({t: '%'}); continue; }
      if (/^(frac|dfrac|tfrac|cfrac)$/.test(cmd)) { out.push({t: 'frac'}); continue; }
      if (cmd === 'sqrt') { out.push({t: 'sqrt'}); continue; }
      if (/^(sin|cos|tan|log|ln|exp)$/.test(cmd)) { out.push({t: 'fn', v: cmd}); continue; }
      if (/^(text|textrm|mathrm|mathit|operatorname|textit|textbf|mathbf|mbox)$/.test(cmd)) {
        // \text{...}: a unit or a word → dropped; a function name → function; a single letter → variable
        const g = /^\s*\{([^{}]*)\}/.exec(s.slice(i)); if (!g) continue; i += g[0].length;
        const w = g[1].trim();
        if (FUNCS.has(w.toLowerCase())) out.push({t: w.toLowerCase() === 'sqrt' ? 'sqrt' : 'fn', v: w.toLowerCase()});
        else if (/^[A-Za-z]$/.test(w)) out.push({t: 'id', v: w});
        else if (/^(or|and|و|أو)$/i.test(w)) out.push({t: ','});
        else if (/\d/.test(w)) out.push(...tokenize(w));
        else if (w) out.push({t: 'unit', v: w});
        continue;
      }
      if (cmd === 'mathbb') { const g = /^\s*\{([^{}]*)\}/.exec(s.slice(i)); if (g) { i += g[0].length; out.push({t: 'id', v: 'ℝ' + g[1]}); } continue; }
      if (cmd === 'emptyset' || cmd === 'varnothing') { out.push({t: 'empty'}); continue; }
      if (cmd === 'Rightarrow' || cmd === 'implies' || cmd === 'to' || cmd === 'rightarrow') { out.push({t: 'arrow'}); continue; }
      if (/^[A-Za-z]$/.test(cmd)) { out.push({t: 'id', v: cmd}); continue; }
      // unknown command (Greek letters etc.) → a named variable
      out.push({t: 'id', v: '\\' + cmd}); continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+(?:\.\d*)?|\.\d+)/.exec(s.slice(i)); i += m[0].length;
      out.push({t: 'num', v: Number(m[0]), text: m[0]}); continue;
    }
    if (/[A-Za-z]/.test(c)) {
      const m = /^[A-Za-z]+/.exec(s.slice(i))[0];
      // ascii words: functions, pi, inf, or/and; everything else is a run of single-letter variables (lw = l·w)
      let w = m, j = 0;
      while (j < w.length) {
        const rest = w.slice(j).toLowerCase();
        const fn = ['sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'abs', 'exp'].find(f => rest.startsWith(f) && (rest.length === f.length || !/^[a-z]/.test(rest.slice(f.length)) || f === 'sqrt' || f === 'abs'));
        if (fn && (rest === fn || j === 0)) { out.push(fn === 'sqrt' ? {t: 'sqrt'} : fn === 'abs' ? {t: 'fn', v: 'abs'} : {t: 'fn', v: fn}); j += fn.length; continue; }
        if (rest.startsWith('pi') && (j === 0 || rest === 'pi')) { out.push({t: 'num', v: Math.PI, pi: true}); j += 2; continue; }
        if (/^(inf|infinity)$/.test(rest)) { out.push({t: 'num', v: Infinity, inf: true}); j = w.length; continue; }
        if (/^(or|and)$/.test(rest) && j === 0) { out.push({t: ','}); j = w.length; continue; }
        if (j === 0 && rest.length > 1 && UNITS.test(rest)) { out.push({t: 'unit', v: rest}); j = w.length; continue; }
        out.push({t: 'id', v: w[j]}); j++;
      }
      i += m.length; continue;
    }
    if (c === '<' || c === '>' || c === '=' || c === '!') {
      const two = s.slice(i, i + 2);
      if (two === '<=' || two === '>=' || two === '!=' || two === '=<' || two === '=>') { out.push({t: 'rel', v: two === '=<' ? '<=' : two === '=>' ? '>=' : two}); i += 2; continue; }
      if (c === '!') { out.push({t: '!'}); i++; continue; }
      out.push({t: 'rel', v: c}); i++; continue;
    }
    if ('+-*/^_()[]{}|,;%'.includes(c)) { out.push({t: c === ';' ? ',' : c}); i++; continue; }
    if (c === "'") { out.push({t: 'prime'}); i++; continue; }
    out.push({t: 'bad', v: c}); i++;
  }
  return out;
}

// ---------------------------------------------------------------- parser → tree
// nodes: {k:'n', v} {k:'v', v} {k:'+', a, b} {k:'-', a, b} {k:'*', a, b} {k:'/', a, b} {k:'^', a, b} {k:'neg', a}
//        {k:'f', f, a} {k:'root', n, a} {k:'pm', a, b}  (a ± b)
class P {
  constructor(t) { this.t = t; this.i = 0; }
  peek(o = 0) { return this.t[this.i + o]; }
  next() { return this.t[this.i++]; }
  is(type, o = 0) { const x = this.peek(o); return x && x.t === type; }
  eat(type) { if (this.is(type)) return this.next(); throw Error(`expected ${type}`); }
  startsPrimary() {
    const x = this.peek(); if (!x) return false;
    return ['num', 'id', '(', '[', 'frac', 'sqrt', 'fn'].includes(x.t) || (x.t === '{' && !x.lit) || (x.t === '|' && !this.absClose);
  }
  expr() {
    let a = this.term();
    for (;;) {
      if (this.is('+')) { this.next(); a = {k: '+', a, b: this.term()}; }
      else if (this.is('-')) { this.next(); a = {k: '-', a, b: this.term()}; }
      else if (this.is('pm')) { this.next(); a = {k: 'pm', a, b: this.term()}; }
      else return a;
    }
  }
  term() {
    let a = this.unary();
    for (;;) {
      if (this.is('*')) { this.next(); a = {k: '*', a, b: this.unary()}; }
      else if (this.is('/')) { this.next(); a = {k: '/', a, b: this.unary()}; }
      else if (this.startsPrimary()) a = {k: '*', a, b: this.power()};
      else return a;
    }
  }
  unary() {
    if (this.is('-')) { this.next(); return {k: 'neg', a: this.unary()}; }
    if (this.is('+')) { this.next(); return this.unary(); }
    if (this.is('pm')) { this.next(); return {k: 'pm', a: {k: 'n', v: 0}, b: this.unary()}; }
    return this.power();
  }
  power() {
    let a = this.postfix(this.primary());
    if (this.is('^')) {
      this.next();
      let b;
      if (this.is('{') && this.is('deg', 1) && this.is('}', 2)) { this.i += 3; return a; } // 40^{\circ}
      if (this.is('{')) { this.next(); b = this.expr(); this.eat('}'); }
      else if (this.is('-')) { this.next(); b = {k: 'neg', a: this.postfix(this.primary())}; }
      else if (this.is('deg')) { this.next(); return a; } // x^{\circ}
      else b = this.postfix(this.primary());
      if (b && b.k === 'deg') return a;
      // right-associative
      if (this.is('^')) { const t = {k: '^', a: b, b: null}; this.next(); t.b = this.is('{') ? (this.next(), (() => { const e = this.expr(); this.eat('}'); return e; })()) : this.postfix(this.primary()); b = t; }
      a = {k: '^', a, b};
    }
    return a;
  }
  postfix(a) {
    for (;;) {
      if (this.is('deg')) { this.next(); continue; }
      if (this.is('%')) { this.next(); a = {k: '/', a, b: {k: 'n', v: 100}}; continue; }
      if (this.is('!')) { this.next(); a = {k: 'f', f: 'fact', a}; continue; }
      if (this.is('unit')) { this.next(); continue; }
      if (this.is('prime')) { this.next(); if (a.k === 'v') a = {k: 'v', v: a.v + "'"}; continue; }
      if (this.is('_') && a.k === 'v') {
        this.next(); let sub = '';
        if (this.is('{')) { this.next(); while (this.peek() && !this.is('}')) { const x = this.next(); sub += x.text ?? x.v ?? x.t; } this.eat('}'); }
        else { const x = this.next(); sub = String(x?.text ?? x?.v ?? ''); }
        a = {k: 'v', v: `${a.v}_${sub}`}; continue;
      }
      return a;
    }
  }
  group(open, close) { this.eat(open); const e = this.expr(); this.eat(close); return e; }
  arg() { // argument of \frac / \sqrt: {…} or a single token
    if (this.is('{')) return this.group('{', '}');
    const x = this.next(); if (!x) throw Error('missing argument');
    if (x.t === 'num') {
      // \frac12 → 1, 2 (one digit each)
      if (x.text && x.text.length > 1 && /^\d+$/.test(x.text)) { this.t.splice(this.i, 0, {t: 'num', v: Number(x.text.slice(1)), text: x.text.slice(1)}); return {k: 'n', v: Number(x.text[0])}; }
      return {k: 'n', v: x.v};
    }
    if (x.t === 'id') return {k: 'v', v: x.v};
    this.i--; return this.primary();
  }
  primary() {
    const x = this.next(); if (!x) throw Error('unexpected end');
    switch (x.t) {
      case 'num': return {k: 'n', v: x.v, inf: x.inf};
      case 'id': return {k: 'v', v: x.v};
      case '(': { const e = this.expr(); if (this.is(',')) throw Error('tuple'); this.eat(')'); return e; }
      case '[': { const e = this.expr(); this.eat(']'); return e; }
      case '{': { const e = this.expr(); this.eat('}'); return e; }
      case 'frac': { const a = this.arg(); const b = this.arg(); return {k: '/', a, b}; }
      case 'sqrt': {
        if (this.is('[')) { this.next(); const n = this.expr(); this.eat(']'); return {k: 'root', n, a: this.arg()}; }
        if (this.is('(')) return {k: 'f', f: 'sqrt', a: this.group('(', ')')};
        return {k: 'f', f: 'sqrt', a: this.arg()};
      }
      case 'fn': {
        let p = null; if (this.is('^')) { this.next(); p = this.is('{') ? this.group('{', '}') : this.postfix(this.primary()); } // sin^2 x
        const a = this.is('(') ? this.group('(', ')') : this.is('{') ? this.group('{', '}') : this.power();
        const f = {k: 'f', f: x.v, a}; return p ? {k: '^', a: f, b: p} : f;
      }
      case '|': { const was = this.absClose; this.absClose = true; const e = this.expr(); this.absClose = was; this.eat('|'); return {k: 'f', f: 'abs', a: e}; }
      default: throw Error(`unexpected ${x.t}`);
    }
  }
}

const parseExpr = tokens => { const p = new P(tokens); const e = p.expr(); if (p.i !== tokens.length) throw Error('trailing'); return e; };

// Split a token list at top-level separators (commas, "or"), respecting brackets.
function splitTop(tokens, sep = ',') {
  const parts = [[]]; let depth = 0, abs = false;
  for (const x of tokens) {
    if (['(', '[', '{'].includes(x.t)) depth++;
    else if ([')', ']', '}'].includes(x.t)) depth--;
    else if (x.t === '|') abs = !abs;
    if (x.t === sep && depth === 0 && !abs) parts.push([]); else parts.at(-1).push(x);
  }
  return parts;
}

// An answer: {kind:'expr', e} | {kind:'rel', parts:[e,..], ops:[..]} | {kind:'list', items} | {kind:'tuple', items}
//            | {kind:'interval', lo, hi, lc, rc} | {kind:'union', items} | {kind:'empty'}
export function parseAnswer(src) {
  let tokens = tokenize(src).filter(x => x.t !== 'bad' || !/[?'"`]/.test(x.v));
  if (tokens.some(x => x.t === 'bad')) return null;
  // trailing units / words ("12 cm", "40 degrees")
  while (tokens.length && (tokens.at(-1).t === 'unit' || tokens.at(-1).t === 'deg')) tokens = tokens.slice(0, -1);
  if (!tokens.length) return null;
  if (tokens.length === 1 && tokens[0].t === 'empty') return {kind: 'empty'};
  try {
    const unions = splitTop(tokens, 'cup');
    if (unions.length > 1) { const items = unions.map(u => parseAnswer.fromTokens(u)); return items.every(Boolean) ? {kind: 'union', items} : null; }
    return parseAnswer.fromTokens(tokens);
  } catch { return null; }
}
parseAnswer.fromTokens = function (tokens) {
  // whole answer in brackets with a top-level comma: interval or point
  const first = tokens[0], last = tokens.at(-1);
  if (first && last && ['(', '['].includes(first.t) && [')', ']'].includes(last.t)) {
    let depth = 0, closesAtEnd = true;
    for (let k = 0; k < tokens.length; k++) { const x = tokens[k]; if (['(', '[', '{'].includes(x.t)) depth++; else if ([')', ']', '}'].includes(x.t)) { depth--; if (depth === 0 && k < tokens.length - 1) { closesAtEnd = false; break; } } }
    const inner = tokens.slice(1, -1), parts = splitTop(inner);
    if (closesAtEnd && parts.length >= 2) {
      const items = parts.map(parseExpr);
      if (parts.length === 2) return {kind: 'pair', items, lc: first.t === '[', rc: last.t === ']'};
      return {kind: 'tuple', items};
    }
  }
  const parts = splitTop(tokens);
  if (parts.length > 1) return {kind: 'list', items: parts.map(p => parseAnswer.fromTokens(p))};
  // relations: a = b, a < b <= c, …
  const segs = [[]], ops = [];
  let depth = 0;
  for (const x of tokens) { if (['(', '[', '{'].includes(x.t)) depth++; else if ([')', ']', '}'].includes(x.t)) depth--;
    if (x.t === 'rel' && depth === 0) { ops.push(x.v); segs.push([]); } else segs.at(-1).push(x); }
  if (ops.length) return {kind: 'rel', parts: segs.map(parseExpr), ops};
  return {kind: 'expr', e: parseExpr(tokens)};
};

// ---------------------------------------------------------------- evaluation
const DEG = Math.PI / 180;
function fact(n) { if (!Number.isInteger(n) || n < 0 || n > 170) return NaN; let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; }
function evalNode(e, V, pmSign = 1) {
  switch (e.k) {
    case 'n': return e.v;
    case 'v': return e.v in V ? V[e.v] : NaN;
    case '+': return evalNode(e.a, V, pmSign) + evalNode(e.b, V, pmSign);
    case '-': return evalNode(e.a, V, pmSign) - evalNode(e.b, V, pmSign);
    case 'pm': return evalNode(e.a, V, pmSign) + pmSign * evalNode(e.b, V, pmSign);
    case '*': return evalNode(e.a, V, pmSign) * evalNode(e.b, V, pmSign);
    case '/': return evalNode(e.a, V, pmSign) / evalNode(e.b, V, pmSign);
    case '^': { const b = evalNode(e.a, V, pmSign), p = evalNode(e.b, V, pmSign);
      if (b < 0 && !Number.isInteger(p)) { const q = 1 / p; if (Number.isInteger(Math.round(q)) && Math.abs(q - Math.round(q)) < 1e-9 && Math.round(q) % 2) return -Math.pow(-b, p); }
      return Math.pow(b, p); }
    case 'neg': return -evalNode(e.a, V, pmSign);
    case 'root': { const n = evalNode(e.n, V, pmSign), a = evalNode(e.a, V, pmSign); return a < 0 && Math.round(n) % 2 ? -Math.pow(-a, 1 / n) : Math.pow(a, 1 / n); }
    case 'f': { const a = evalNode(e.a, V, pmSign);
      switch (e.f) { case 'sqrt': return Math.sqrt(a); case 'abs': return Math.abs(a); case 'sin': return Math.sin(a * DEG); case 'cos': return Math.cos(a * DEG);
        case 'tan': return Math.tan(a * DEG); case 'log': return Math.log10(a); case 'ln': return Math.log(a); case 'exp': return Math.exp(a); case 'fact': return fact(a); default: return NaN; } }
    default: return NaN;
  }
}
const varsOf = (e, s = new Set()) => { if (!e) return s; if (e.k === 'v') s.add(e.v); for (const k of ['a', 'b', 'n']) if (e[k]) varsOf(e[k], s); return s; };
const hasPm = e => !!e && (e.k === 'pm' || ['a', 'b', 'n'].some(k => hasPm(e[k])));
const SAMPLE = [1.37, 2.71, 0.53, 3.19, 1.91, 0.77, 2.29, 1.13, -1.29, -2.43, -0.61];
function points(vars) {
  const vs = [...vars].sort();
  return SAMPLE.map((_, k) => Object.fromEntries(vs.map((v, j) => [v, SAMPLE[(k + j * 3) % SAMPLE.length] + j * 0.071])));
}
const close = (a, b, tol = 0) => {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (tol) return Math.abs(a - b) <= tol + 1e-12;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
};
// value lists for an expression with ±: [a+b, a-b]
const values = (e, V) => hasPm(e) ? [evalNode(e, V, 1), evalNode(e, V, -1)] : [evalNode(e, V)];

// a typed plain decimal (for "correctly rounded" acceptance)
const DEC = /^\s*-?\s*\d*\.(\d+)\s*$/;
function roundedOk(studentSrc, s, x) {
  const m = DEC.exec(String(studentSrc).replace(/[−–]/g, '-')); if (!m) return false;
  const d = m[1].length; if (d < 2 || !Number.isFinite(x)) return false;
  // the exact value has more decimals than the student wrote (a fraction or a surd)
  if (Math.abs(x * 10 ** d - Math.round(x * 10 ** d)) < 1e-9) return false;
  return Math.abs(s - x) <= 0.5 * 10 ** -d + 1e-12 || Math.abs(s - Math.trunc(x * 10 ** d) / 10 ** d) < 1e-12;
}

// expression vs expression at shared sample points
function sameExpr(a, b, {tol = 0, srcA = ''} = {}) {
  const vars = new Set([...varsOf(a), ...varsOf(b)]);
  if (!vars.size) {
    const va = values(a, {}), vb = values(b, {});
    if (va.length !== vb.length) return false;
    const sa = [...va].sort((x, y) => x - y), sb = [...vb].sort((x, y) => x - y);
    if (sa.every((x, k) => close(x, sb[k], tol))) return true;
    return va.length === 1 && roundedOk(srcA, va[0], vb[0]);
  }
  let ok = 0;
  for (const V of points(vars)) {
    const va = values(a, V), vb = values(b, V);
    if (va.length !== vb.length) return false;
    const fa = va.every(Number.isFinite), fb = vb.every(Number.isFinite);
    if (!fa && !fb) continue;
    if (fa !== fb) return false;
    const sa = [...va].sort((x, y) => x - y), sb = [...vb].sort((x, y) => x - y);
    if (!sa.every((x, k) => close(x, sb[k], tol))) return false;
    ok++;
  }
  return ok >= 3;
}
// f ≡ c·g for a non-zero constant c (equations); sign > 0 also required for inequalities
function proportional(f, g, {positive = false} = {}) {
  const vars = new Set([...varsOf(f), ...varsOf(g)]);
  let ratio = null, ok = 0;
  for (const V of points(vars)) {
    const x = evalNode(f, V), y = evalNode(g, V);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (Math.abs(y) < 1e-12) { if (Math.abs(x) > 1e-9) return false; continue; }
    const r = x / y; if (ratio === null) ratio = r; else if (!close(r, ratio)) return false;
    ok++;
  }
  return ok >= 3 && ratio !== null && Math.abs(ratio) > 1e-12 && (!positive || ratio > 0);
}
const diff = (l, r) => ({k: '-', a: l, b: r});
const FLIP = {'<': '>', '>': '<', '<=': '>=', '>=': '<=', '=': '=', '!=': '!='};
const singleVar = e => e && e.k === 'v' ? e.v : null;

// a ± b → the list [a + b, a − b] (also x = ±3 → x = 3, x = −3)
const signed = (e, sg) => !e ? e : e.k === 'pm' ? {k: sg > 0 ? '+' : '-', a: signed(e.a, sg), b: signed(e.b, sg)} : {...e, ...Object.fromEntries(['a', 'b', 'n'].filter(k => e[k]).map(k => [k, signed(e[k], sg)]))};
function expandPm(ans) {
  if (!ans) return ans;
  if (ans.kind === 'expr' && hasPm(ans.e)) return {kind: 'list', items: [1, -1].map(sg => ({kind: 'expr', e: signed(ans.e, sg)}))};
  if (ans.kind === 'rel' && ans.ops.length === 1 && ans.parts.some(hasPm)) return {kind: 'list', items: [1, -1].map(sg => ({kind: 'rel', ops: ans.ops, parts: ans.parts.map(p => signed(p, sg))}))};
  if (ans.kind === 'list') return {kind: 'list', items: ans.items.flatMap(i => { const x = expandPm(i); return x.kind === 'list' ? x.items : [x]; })};
  return ans;
}

function same(s, x, opt) {
  if (!s || !x) return false;
  s = expandPm(s); x = expandPm(x);
  // expected is a plain expression
  if (x.kind === 'expr') {
    if (s.kind === 'expr') return sameExpr(s.e, x.e, opt);
    // "y = 2x+3" (or "x = 5") for an answer box that already follows "y =": accept the right side
    if (s.kind === 'rel' && s.ops.length === 1 && s.ops[0] === '=') {
      const [l, r] = s.parts;
      if (singleVar(l) && !varsOf(r).has(singleVar(l))) return sameExpr(r, x.e, opt);
      if (singleVar(r) && !varsOf(l).has(singleVar(r))) return sameExpr(l, x.e, opt);
    }
    if (s.kind === 'list' && s.items.length === 1) return same(s.items[0], x, opt);
    return false;
  }
  if (x.kind === 'rel') {
    if (s.kind === 'expr' && x.ops.length === 1 && x.ops[0] === '=' && singleVar(x.parts[0])) return sameExpr(s.e, x.parts[1], opt); // "2x+3" for "y=2x+3"
    if (s.kind !== 'rel' || s.parts.length !== x.parts.length) return false;
    if (x.ops.length === 1) {
      let so = s.ops[0], [sl, sr] = s.parts; const xo = x.ops[0], [xl, xr] = x.parts;
      if (so !== xo && FLIP[so] === xo) { [sl, sr] = [sr, sl]; so = xo; }
      if (so !== xo) return false;
      // same sides directly (also accepts y = 2x+3 against y = 3+2x)
      if (sameExpr(sl, xl, opt) && sameExpr(sr, xr, opt)) return true;
      if (xo === '=' || xo === '!=') return proportional(diff(sl, sr), diff(xl, xr));
      return proportional(diff(sl, sr), diff(xl, xr), {positive: true});
    }
    return s.ops.join() === x.ops.join() && s.parts.every((p, k) => sameExpr(p, x.parts[k], opt));
  }
  if (x.kind === 'list') {
    const items = s.kind === 'list' ? s.items : [s];
    if (items.length !== x.items.length) return false;
    const used = new Set();
    return x.items.every(xi => { const k = items.findIndex((si, j) => !used.has(j) && same(si, xi, opt)); if (k < 0) return false; used.add(k); return true; });
  }
  if (x.kind === 'pair' || x.kind === 'tuple') {
    if (s.kind !== x.kind || s.items.length !== x.items.length) return false;
    if (x.kind === 'pair' && (s.lc !== x.lc || s.rc !== x.rc)) return false;
    return s.items.every((e, k) => sameExpr(e, x.items[k], opt));
  }
  if (x.kind === 'union') {
    if (s.kind !== 'union' || s.items.length !== x.items.length) return false;
    const used = new Set();
    return x.items.every(xi => { const k = s.items.findIndex((si, j) => !used.has(j) && same(si, xi, opt)); if (k < 0) return false; used.add(k); return true; });
  }
  if (x.kind === 'empty') return s.kind === 'empty';
  return false;
}

const plain = t => String(t ?? '').toLowerCase().replace(/\\(?:text|mathrm)\{([^}]*)\}/g, '$1').replace(/[\s{}\\]/g, '').replace(/[−–—]/g, '-');

// Is the student's answer equivalent to the expected one? {exact: text must match, tol: absolute tolerance}
export function equivalent(student, expected, {exact = false, tol = 0} = {}) {
  const st = String(student ?? '').trim(); if (!st) return false;
  if (plain(st) === plain(expected)) return true;
  if (exact) return false;
  const s = parseAnswer(st), x = parseAnswer(expected);
  if (!s || !x) return false;
  return same(s, x, {tol, srcA: st});
}

// Plain-text and LaTeX views of a student answer (for the LMS record and the teacher)
export function asciiOf(latex) {
  return String(latex ?? '').replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)').replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)').replace(/\\left|\\right/g, '')
    .replace(/\\cdot|\\times/g, '*').replace(/\\div/g, '/').replace(/\\pi/g, 'pi').replace(/\\le(q)?/g, '<=').replace(/\\ge(q)?/g, '>=').replace(/\\pm/g, '±').replace(/\\infty/g, 'inf')
    .replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/[{}]/g, '').replace(/\\,|\\ /g, ' ').replace(/\s+/g, ' ').trim();
}

// Numeric physics blanks have a separate unit selector and must contain a finite scalar.
export function numericValue(input) {
  const source=String(input).trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/٫/g,'.')
    .replace(/(\d(?:\.\d*)?)[eE]([+-]?\d+)/g,'$1*10^($2)').replace(/\bpi\b/g,'π')
  if(!source || source.length>240 || /\\(?:text|mathrm)|[?!'"`=<>±%°]/.test(source))return NaN
  if (/[a-zA-Z]/.test(source.replace(/\\(?:sin|cos|tan|sqrt|frac|dfrac|tfrac|pi|cdot|times|left|right|div|ln|log)\b/g,'')))return NaN
  const parsed=parseAnswer(source)
  if(parsed?.kind!=='expr'||hasPm(parsed.e)||varsOf(parsed.e).size)return NaN
  const value=evalNode(parsed.e,{})
  return Number.isFinite(value)?value:NaN
}
