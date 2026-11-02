// LaTeX → Unicode pour le terminal : formules en ligne sur une ligne (xᵢ, λ₁, Σᵢ₌₁ⁿ), formules en
// bloc dessinées en 2D (fractions empilées, sommes avec leurs bornes, grandes parenthèses).
// Rien d'inconnu n'est perdu : une commande non reconnue reste écrite telle quelle.

// ── Tables ──────────────────────────────────────────────────────────────────

const GREC: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'φ',
  varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
  Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
}

// Relations : entourées d'espaces (hors indices).
const REL: Record<string, string> = {
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', sim: '∼',
  simeq: '≃', cong: '≅', propto: '∝', to: '→', rightarrow: '→', leftarrow: '←', gets: '←',
  Rightarrow: '⇒', implies: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', iff: '⇔',
  leftrightarrow: '↔', longrightarrow: '⟶', Longrightarrow: '⟹', mapsto: '↦', in: '∈',
  notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇', ll: '≪', gg: '≫',
  perp: '⊥', parallel: '∥', mid: '|', coloneqq: '≔', vdash: '⊢', models: '⊨',
}

// Opérateurs binaires : entourés d'espaces sauf en tête (signe).
const BIN: Record<string, string> = {
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', cup: '∪', cap: '∩', setminus: '∖',
  oplus: '⊕', otimes: '⊗', circ: '∘', ast: '∗', star: '⋆', land: '∧', wedge: '∧', lor: '∨', vee: '∨',
}

const SYM: Record<string, string> = {
  infty: '∞', emptyset: '∅', varnothing: '∅', forall: '∀', exists: '∃', nexists: '∄', neg: '¬',
  lnot: '¬', partial: '∂', nabla: '∇', ldots: '…', dots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱',
  prime: '′', angle: '∠', ell: 'ℓ', hbar: 'ℏ', Re: 'ℜ', Im: 'ℑ', aleph: 'ℵ', langle: '⟨', rangle: '⟩',
  lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', vert: '|', Vert: '‖', lvert: '|', rvert: '|',
  lVert: '‖', rVert: '‖', triangle: '△', square: '□', checkmark: '✓', dagger: '†', top: '⊤',
  bot: '⊥', colon: ':', degree: '°', lbrace: '{', rbrace: '}', backslash: '\\', S: '§', P: '¶',
  quad: '  ', qquad: '    ', ',': ' ', ':': ' ', ';': ' ', '>': ' ', '!': '', ' ': ' ',
  '{': '{', '}': '}', '|': '‖', '%': '%', '$': '$', '#': '#', '_': '_', '&': '&',
}

// Grands opérateurs : bornes dessous/dessus en bloc (« lim » et cie aussi).
const GRAND: Record<string, string> = {
  sum: 'Σ', prod: '∏', coprod: '∐', bigcup: '⋃', bigcap: '⋂', bigoplus: '⨁', bigotimes: '⨂',
  bigvee: '⋁', bigwedge: '⋀',
}
const INTEGRALES: Record<string, string> = { int: '∫', iint: '∬', iiint: '∭', oint: '∮' }
const FONCTIONS = new Set(['ln', 'log', 'lg', 'exp', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin',
  'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'det', 'arg', 'deg', 'dim', 'ker', 'hom', 'gcd', 'Pr',
  'Var', 'Cov', 'E'])
const FONCTIONS_A_BORNES: Record<string, string> = { lim: 'lim', limsup: 'lim sup', liminf: 'lim inf',
  max: 'max', min: 'min', sup: 'sup', inf: 'inf', argmax: 'argmax', argmin: 'argmin' }

const ACCENTS: Record<string, string> = { hat: '̂', widehat: '̂', bar: '̄',
  overline: '̅', tilde: '̃', widetilde: '̃', vec: '⃗', dot: '̇', ddot: '̈',
  underline: '̲' }

const BB: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ', E: '𝔼', H: 'ℍ', '1': '𝟙' }
const CAL: Record<string, string> = { A: '𝒜', B: 'ℬ', C: '𝒞', D: '𝒟', E: 'ℰ', F: 'ℱ', G: '𝒢', H: 'ℋ',
  I: 'ℐ', L: 'ℒ', M: 'ℳ', N: '𝒩', O: '𝒪', P: '𝒫', R: 'ℛ', S: '𝒮', T: '𝒯', U: '𝒰', X: '𝒳' }

const EXPOSANTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '−': '⁻', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ',
  f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ',
  s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ', A: 'ᴬ', B: 'ᴮ', D: 'ᴰ', E: 'ᴱ',
  G: 'ᴳ', H: 'ᴴ', I: 'ᴵ', J: 'ᴶ', K: 'ᴷ', L: 'ᴸ', M: 'ᴹ', N: 'ᴺ', O: 'ᴼ', P: 'ᴾ', R: 'ᴿ', T: 'ᵀ',
  U: 'ᵁ', V: 'ⱽ', W: 'ᵂ', β: 'ᵝ', γ: 'ᵞ', δ: 'ᵟ', θ: 'ᶿ', φ: 'ᵠ', χ: 'ᵡ', '′': '′', '∗': '*',
}
const INDICES: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '−': '₋', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ',
  k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
  β: 'ᵦ', γ: 'ᵧ', ρ: 'ᵨ', φ: 'ᵩ', χ: 'ᵪ',
}

// ── Arbre ───────────────────────────────────────────────────────────────────

type Classe = 'ord' | 'rel' | 'bin' | 'ouv' | 'ferm' | 'ponct'
export type N =
  | { t: 'sym'; v: string; c: Classe }
  | { t: 'grp'; e: N[] }
  | { t: 'frac'; n: N; d: N }
  | { t: 'racine'; x: N; i?: N }
  | { t: 'scr'; base: N; sup?: N; sub?: N }
  | { t: 'grand'; v: string; bornes: boolean }   // Σ, ∏, ∫, lim… ; bornes : dessous/dessus en bloc
  | { t: 'fn'; v: string }
  | { t: 'delim'; g: string; d: string; x: N }
  | { t: 'acc'; a: string; x: N }
  | { t: 'texte'; v: string }
  | { t: 'grille'; genre: string; lignes: N[][] }

class Lecteur {
  i = 0
  readonly s: string
  constructor(s: string) { this.s = s }
  fin() { return this.i >= this.s.length }
  voir() { return this.s[this.i] }
  blancs() { while (!this.fin() && /\s/.test(this.s[this.i]!)) this.i++ }
  // Nom de commande après « \ » : lettres, ou un seul caractère.
  commande(): string {
    const m = /^[A-Za-z]+\*?/.exec(this.s.slice(this.i))
    if (m) { this.i += m[0].length; return m[0] }
    return this.s[this.i++] ?? ''
  }
  // Contenu brut d'un argument {…} (accolades équilibrées), ou un seul caractère.
  brut(): string {
    this.blancs()
    if (this.voir() !== '{') return this.s[this.i++] ?? ''
    let p = 0, debut = ++this.i
    for (; !this.fin(); this.i++) {
      const c = this.s[this.i]
      if (c === '\\') { this.i++; continue }
      if (c === '{') p++
      else if (c === '}') { if (p === 0) break; p-- }
    }
    return this.s.slice(debut, this.i++)
  }
}

const groupe = (e: N[]): N => e.length === 1 ? e[0]! : { t: 'grp', e }
const sym = (v: string, c: Classe = 'ord'): N => ({ t: 'sym', v, c })

// Lit une suite jusqu'à `}`, `\right`, `\end`, ou la fin. `&` et `\\` coupent les cellules d'une grille.
function suite(L: Lecteur): N[][][] {
  const lignes: N[][][] = [[[]]]
  const cellule = () => lignes[lignes.length - 1]![lignes[lignes.length - 1]!.length - 1]!
  while (!L.fin()) {
    L.blancs()
    if (L.fin()) break
    const c = L.voir()!
    if (c === '}') break
    if (c === '\\') {
      const sauve = L.i
      L.i++
      const nom = L.commande()
      if (nom === 'right' || nom === 'end') { L.i = sauve; break }
      if (nom === '\\') { lignes.push([[]]); L.blancs(); if (L.voir() === '[') { while (!L.fin() && L.voir() !== ']') L.i++; L.i++ } continue }
      L.i = sauve
    }
    if (c === '&') { L.i++; lignes[lignes.length - 1]!.push([]); continue }
    if (c === '^' || c === '_') {
      L.i++
      const arg = atome(L) ?? sym('')
      const cel = cellule()
      let base = cel.pop() ?? sym('')
      if (base.t !== 'scr' || (c === '^' ? base.sup : base.sub)) base = { t: 'scr', base }
      if (c === '^') base.sup = arg; else base.sub = arg
      cel.push(base)
      continue
    }
    if (c === "'") { L.i++; const cel = cellule(); const b = cel.pop() ?? sym(''); cel.push({ t: 'grp', e: [b, sym('′')] }); continue }
    const n = atome(L)
    if (n) cellule().push(n)
  }
  return lignes
}

function contenu(L: Lecteur): N {
  const l = suite(L)
  if (l.length === 1 && l[0]!.length === 1) return groupe(l[0]![0]!)
  return { t: 'grille', genre: 'aligned', lignes: l.map(r => r.map(groupe)) }
}

function argument(L: Lecteur): N {
  L.blancs()
  if (L.voir() === '{') { L.i++; const n = contenu(L); L.i++; return n }
  return atome(L) ?? sym('')
}

function delimiteur(L: Lecteur): string {
  L.blancs()
  if (L.voir() === '\\') {
    L.i++
    const nom = L.commande()
    return SYM[nom] ?? REL[nom] ?? (nom === '|' ? '‖' : nom)
  }
  return L.s[L.i++] ?? '.'
}

const ENVIRONNEMENTS = new Set(['aligned', 'align', 'align*', 'gathered', 'gather', 'gather*', 'split',
  'cases', 'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'array', 'eqnarray', 'eqnarray*'])

function atome(L: Lecteur): N | null {
  L.blancs()
  const c = L.s[L.i++]
  if (c === undefined) return null
  if (c === '{') { const n = contenu(L); L.i++; return n }
  if (c === '-') return sym('−', 'bin')
  if (c === '+' || c === '*') return sym(c === '*' ? '∗' : '+', 'bin')
  if (c === '=' || c === '<' || c === '>') return sym(c, 'rel')
  if (c === '(' || c === '[') return sym(c, 'ouv')
  if (c === ')' || c === ']') return sym(c, 'ferm')
  if (c === ',' || c === ';') return sym(c, 'ponct')
  if (c === '~') return sym(' ')
  if (c !== '\\') return sym(c)
  const nom = L.commande()
  if (nom === 'frac' || nom === 'dfrac' || nom === 'tfrac' || nom === 'cfrac') return { t: 'frac', n: argument(L), d: argument(L) }
  if (nom === 'binom' || nom === 'dbinom' || nom === 'tbinom') {
    return { t: 'delim', g: '(', d: ')', x: { t: 'grille', genre: 'binom', lignes: [[argument(L)], [argument(L)]] } }
  }
  if (nom === 'sqrt') {
    L.blancs()
    let i: N | undefined
    if (L.voir() === '[') {
      L.i++
      const debut = L.i
      while (!L.fin() && L.voir() !== ']') L.i++
      i = contenu(new Lecteur(L.s.slice(debut, L.i++)))
    }
    return { t: 'racine', x: argument(L), i }
  }
  if (nom === 'left') {
    const g = delimiteur(L)
    const x = contenu(L)
    let d = '.'
    if (L.s.startsWith('\\right', L.i)) { L.i += 6; d = delimiteur(L) }
    return { t: 'delim', g, d, x }
  }
  if (/^(big|Big|bigg|Bigg)[lrm]?$/.test(nom)) return atome(L)
  if (nom === 'begin') {
    const env = L.brut()
    if (env === 'array') L.brut()
    const l = suite(L)
    if (L.s.startsWith('\\end', L.i)) { L.i += 4; L.brut() }
    return { t: 'grille', genre: ENVIRONNEMENTS.has(env) ? env.replace('*', '') : 'aligned', lignes: l.map(r => r.map(groupe)) }
  }
  if (nom === 'text' || nom === 'textrm' || nom === 'mbox' || nom === 'textit' || nom === 'textbf') {
    return { t: 'texte', v: L.brut().replace(/\\([{}%$&#_ ])/g, '$1') }
  }
  if (nom === 'mathrm' || nom === 'mathbf' || nom === 'mathit' || nom === 'boldsymbol' || nom === 'bm' || nom === 'mathsf' || nom === 'mathtt') return argument(L)
  if (nom === 'operatorname' || nom === 'operatorname*') {
    const v = L.brut()
    return nom.endsWith('*') || v in FONCTIONS_A_BORNES ? { t: 'grand', v, bornes: true } : { t: 'fn', v }
  }
  if (nom === 'mathbb' || nom === 'mathcal' || nom === 'mathscr' || nom === 'mathfrak') {
    const v = L.brut().trim()
    const table = nom === 'mathbb' ? BB : nom === 'mathfrak' ? {} : CAL
    return sym([...v].map(x => table[x] ?? x).join(''))
  }
  if (nom in ACCENTS) return { t: 'acc', a: ACCENTS[nom]!, x: argument(L) }
  if (nom === 'not') { const n = atome(L); return n && n.t === 'sym' ? sym(n.v === '=' ? '≠' : n.v === '∈' ? '∉' : n.v + '̸', n.c) : sym('¬') }
  if (nom in GREC) return sym(GREC[nom]!)
  if (nom in REL) return sym(REL[nom]!, 'rel')
  if (nom in BIN) return sym(BIN[nom]!, 'bin')
  if (nom in GRAND) return { t: 'grand', v: GRAND[nom]!, bornes: true }
  if (nom in INTEGRALES) return { t: 'grand', v: INTEGRALES[nom]!, bornes: false }
  if (nom in FONCTIONS_A_BORNES) return { t: 'grand', v: FONCTIONS_A_BORNES[nom]!, bornes: true }
  if (FONCTIONS.has(nom)) return { t: 'fn', v: nom }
  if (nom === 'langle' || nom === 'lfloor' || nom === 'lceil' || nom === '{') return sym(SYM[nom]!, 'ouv')
  if (nom === 'rangle' || nom === 'rfloor' || nom === 'rceil' || nom === '}') return sym(SYM[nom]!, 'ferm')
  if (nom in SYM) return sym(SYM[nom]!)
  if (nom === 'displaystyle' || nom === 'textstyle' || nom === 'limits' || nom === 'nolimits' || nom === 'nonumber' || nom === 'notag') return sym('')
  if (nom === 'label' || nom === 'tag') { L.brut(); return sym('') }
  return sym('\\' + nom)
}

export function analyser(s: string): N {
  const L = new Lecteur(s)
  const n = contenu(L)
  // Reste non lu (accolade fermante orpheline…) : on le garde tel quel.
  if (!L.fin()) return { t: 'grp', e: [n, sym(s.slice(L.i))] }
  return n
}

// ── Rendu sur une ligne ────────────────────────────────────────────────────

function enScript(s: string, table: Record<string, string>): string | null {
  let r = ''
  for (const c of s) {
    if (c === ' ') continue
    const v = table[c]
    if (v === undefined) return null
    r += v
  }
  return r
}

function atomique(s: string): boolean {
  let p = 0, dehors = ''
  for (const c of s) { if (c === '(') p++; else if (c === ')') p--; else if (p === 0) dehors += c }
  return !/[\s+−=<>±×·/,;]/.test(dehors)
}
const parenthese = (s: string) => atomique(s) ? s : `(${s})`

// Une fonction (ln) ou un grand opérateur (Σ, même avec ses bornes) se détache de ce qui suit.
function detache(prec: N | undefined, n: N, compact: boolean): boolean {
  if (!prec) return false
  const p = prec.t === 'scr' ? prec.base : prec, q = n.t === 'scr' ? n.base : n
  const separe = (x: N) => x.t === 'sym' && (x.c === 'ouv' || x.c === 'ponct' || x.c === 'rel' || x.c === 'bin')
  // Avant : « xᵢ ln », « (λ₁ − λ₀) Σ ».
  if ((q.t === 'fn' || (q.t === 'grand' && !compact)) && !separe(prec)) return true
  if (!(p.t === 'fn' || (p.t === 'grand' && !compact))) return false
  return !(n.t === 'delim' || separe(n))
}

function espacer(e: N[], compact: boolean, rendre: (n: N) => string): string {
  let r = ''
  e.forEach((n, k) => {
    const v = rendre(n)
    const prec = e[k - 1]
    if (n.t === 'sym' && !compact && n.v) {
      const unaire = n.c === 'bin' && (!prec || (prec.t === 'sym' && (prec.c === 'rel' || prec.c === 'bin' || prec.c === 'ouv' || prec.c === 'ponct')))
      if (n.c === 'rel' || (n.c === 'bin' && !unaire)) { r = r.replace(/ $/, '') + ` ${v} `; return }
      if (n.c === 'ponct') { r += v + ' '; return }
    }
    if (detache(prec, n, compact) && !r.endsWith(' ')) r += ' '
    r += v
  })
  return r
}

export function ligne(n: N, compact = false): string {
  const L = (x: N) => ligne(x, compact)
  switch (n.t) {
    case 'sym': return n.v
    case 'texte': return n.v
    case 'fn': return n.v
    case 'grp': return espacer(n.e, compact, L)
    case 'frac': return `${parenthese(L(n.n))}/${parenthese(L(n.d))}`
    case 'racine': {
      const x = parenthese(L(n.x))
      if (!n.i) return '√' + x
      const i = ligne(n.i, true)
      return i === '3' ? '∛' + x : i === '4' ? '∜' + x : (enScript(i, EXPOSANTS) ?? `(${i})`) + '√' + x
    }
    case 'scr': {
      let r = L(n.base)
      if (n.sub) { const s = ligne(n.sub, true); r += enScript(s, INDICES) ?? `_(${s})` }
      if (n.sup) { const s = ligne(n.sup, true); r += enScript(s, EXPOSANTS) ?? (atomique(s) ? `^${s}` : `^(${s})`) }
      return r
    }
    case 'grand': return n.v
    case 'delim': return `${n.g === '.' ? '' : n.g}${L(n.x)}${n.d === '.' ? '' : n.d}`
    case 'acc': {
      const x = L(n.x)
      return [...x].length === 1 ? x + n.a : n.a === '̅' || n.a === '̲' ? [...x].map(c => c + n.a).join('') : x + n.a
    }
    case 'grille': {
      const r = n.lignes.map(l => l.map(L).join(n.genre === 'aligned' || n.genre === 'align' || n.genre === 'split' ? '' : ', ')).join(' ; ')
      const autour: Record<string, string> = { pmatrix: '()', bmatrix: '[]', Bmatrix: '{}', vmatrix: '||', Vmatrix: '‖‖' }
      if (n.genre === 'binom') return n.lignes.map(l => L(l[0]!)).join(' ¦ ')
      if (n.genre === 'cases') return `{ ${r}`
      const a = autour[n.genre]
      return a ? `${[...a][0]}${r}${[...a][1]}` : r
    }
  }
}

// ── Rendu en 2D ────────────────────────────────────────────────────────────

const COMBINANTS = /[̀-ͯ⃐-⃿̸]/u
export const largeur = (s: string) => [...s].filter(c => !COMBINANTS.test(c)).length
const blanc = (k: number) => ' '.repeat(Math.max(0, k))

// Boîte : lignes de même largeur, `b` = indice de la ligne de base.
export type Boite = { l: string[]; b: number; w: number }

const boite = (s: string): Boite => ({ l: [s], b: 0, w: largeur(s) })
const haut = (x: Boite) => x.b
const bas = (x: Boite) => x.l.length - 1 - x.b

function cadrer(x: Boite, w: number, aligne: 'g' | 'c' | 'd' = 'g'): string[] {
  const libre = w - x.w
  const g = aligne === 'g' ? 0 : aligne === 'd' ? libre : Math.floor(libre / 2)
  return x.l.map(s => blanc(g) + s + blanc(libre - g - (largeur(s) - x.w)))
}

function concat(bs: Boite[]): Boite {
  bs = bs.filter(x => x.w > 0 || x.l.length > 1)
  if (!bs.length) return boite('')
  const h = Math.max(...bs.map(haut)), d = Math.max(...bs.map(bas))
  const l = Array.from({ length: h + d + 1 }, () => '')
  for (const x of bs) {
    const lignes = cadrer(x, x.w)
    for (let r = 0; r < l.length; r++) l[r] += lignes[r - (h - x.b)] ?? blanc(x.w)
  }
  return { l, b: h, w: bs.reduce((a, x) => a + x.w, 0) }
}

// Empile au centre : `b` = ligne de base de la boîte du milieu.
function empiler(dessus: Boite | null, milieu: Boite, dessous: Boite | null, aligne: 'g' | 'c' = 'c'): Boite {
  const w = Math.max(milieu.w, dessus?.w ?? 0, dessous?.w ?? 0)
  const l = [...(dessus ? cadrer(dessus, w, aligne) : []), ...cadrer(milieu, w, aligne), ...(dessous ? cadrer(dessous, w, aligne) : [])]
  return { l, b: (dessus?.l.length ?? 0) + milieu.b, w }
}

const GRANDS_DELIMS: Record<string, [string, string, string, string]> = {
  '(': ['⎛', '⎜', '⎝', '⎜'], ')': ['⎞', '⎟', '⎠', '⎟'], '[': ['⎡', '⎢', '⎣', '⎢'], ']': ['⎤', '⎥', '⎦', '⎥'],
  '{': ['⎧', '⎪', '⎩', '⎨'], '}': ['⎫', '⎪', '⎭', '⎬'], '|': ['│', '│', '│', '│'], '‖': ['‖', '‖', '‖', '‖'],
  '⌊': ['│', '│', '└', '│'], '⌋': ['│', '│', '┘', '│'], '⌈': ['┌', '│', '│', '│'], '⌉': ['┐', '│', '│', '│'],
}

function delim(g: string, x: Boite): Boite {
  if (g === '.' || g === '') return boite('')
  const h = x.l.length
  if (h === 1) return { l: [g], b: 0, w: largeur(g) }
  const t = GRANDS_DELIMS[g]
  if (!t) return { l: x.l.map((_, r) => r === x.b ? g : blanc(largeur(g))), b: x.b, w: largeur(g) }
  if (h === 2 && (g === '{' || g === '}')) return { l: g === '{' ? ['⎰', '⎱'] : ['⎱', '⎰'], b: x.b, w: 1 }
  const milieu = Math.floor(h / 2)
  return { l: x.l.map((_, r) => r === 0 ? t[0] : r === h - 1 ? t[2] : (g === '{' || g === '}') && r === milieu ? t[3] : t[1]), b: x.b, w: 1 }
}

function espacer2d(e: N[], compact: boolean): Boite {
  const bs: Boite[] = []
  e.forEach((n, k) => {
    const prec = e[k - 1]
    const x = dessin(n, compact)
    if (n.t === 'sym' && n.v && !compact) {
      const unaire = n.c === 'bin' && (!prec || (prec.t === 'sym' && (prec.c === 'rel' || prec.c === 'bin' || prec.c === 'ouv' || prec.c === 'ponct')))
      if (n.c === 'rel' || (n.c === 'bin' && !unaire)) { bs.push(boite(' '), x, boite(' ')); return }
      if (n.c === 'ponct') { bs.push(x, boite(' ')); return }
    }
    if (detache(prec, n, compact)) bs.push(boite(' '))
    bs.push(x)
  })
  return concat(bs)
}

export function dessin(n: N, compact = false): Boite {
  const D = (x: N) => dessin(x, compact)
  switch (n.t) {
    case 'sym': case 'texte': case 'fn': return boite(ligne(n, compact))
    case 'grp': return espacer2d(n.e, compact)
    case 'frac': {
      const a = D(n.n), b = D(n.d)
      const w = Math.max(a.w, b.w) + 2
      return empiler(a, boite('─'.repeat(w)), b)
    }
    case 'racine': {
      const x = D(n.x)
      const i = n.i ? ligne(n.i, true) : ''
      const signe = i === '3' ? '∛' : i === '4' ? '∜' : (i ? (enScript(i, EXPOSANTS) ?? `(${i})`) : '') + '√'
      if (x.l.length === 1) return boite(signe + parenthese(x.l[0]!))
      return concat([{ l: x.l.map((_, r) => r === x.l.length - 1 ? signe : blanc(largeur(signe))), b: x.b, w: largeur(signe) }, delim('(', x), x, delim(')', x)])
    }
    case 'scr': {
      // Bornes au-dessus et au-dessous d'un grand opérateur.
      if (n.base.t === 'grand' && n.base.bornes) {
        return empiler(n.sup ? dessin(n.sup, true) : null, boite(n.base.v), n.sub ? dessin(n.sub, true) : null)
      }
      const base = D(n.base)
      const sub = n.sub ? ligne(n.sub, true) : null, sup = n.sup ? ligne(n.sup, true) : null
      const subU = sub === null ? '' : enScript(sub, INDICES), supU = sup === null ? '' : enScript(sup, EXPOSANTS)
      if (base.l.length === 1 && subU !== null && supU !== null) return boite(base.l[0] + subU + supU)
      // Une moitié s'écrit en Unicode (λ₁) : elle rejoint la base, l'autre se dessine en 2D.
      if (base.l.length === 1 && (subU || supU)) {
        const b2: N = { t: 'texte', v: base.l[0] + (subU ?? '') + (supU ?? '') }
        return dessin({ t: 'scr', base: b2, sub: subU === null ? n.sub : undefined, sup: supU === null ? n.sup : undefined }, compact)
      }
      // Sinon : exposant levé d'une ligne, indice baissé d'une ligne, à droite de la base.
      const hs = n.sup ? dessin(n.sup, true) : null, hi = n.sub ? dessin(n.sub, true) : null
      const w = Math.max(hs?.w ?? 0, hi?.w ?? 0)
      const h = base.l.length
      const hautSup = hs ? hs.l.length : 0, basSub = hi ? hi.l.length : 0
      const dessus = h > 1 ? Math.max(0, hautSup - 1) : hautSup
      const dessous = h > 1 ? Math.max(0, basSub - 1) : basSub
      const total = dessus + h + dessous
      const l: string[] = []
      for (let r = 0; r < total; r++) {
        const rb = r - dessus
        // L'exposant commence en haut ; l'indice sous la base (sur sa dernière ligne si elle est haute).
        const g = rb >= 0 && rb < h ? base.l[rb]! : blanc(base.w)
        let d = blanc(w)
        if (hs && r < hautSup) d = cadrer(hs, w)[r]!
        if (hi) { const k = r - (h > 1 ? dessus + h - 1 : dessus + 1); if (k >= 0 && k < basSub) d = cadrer(hi, w)[k]! }
        l.push(g + d)
      }
      return { l, b: dessus + base.b, w: base.w + w }
    }
    case 'grand': return boite(n.v)
    case 'delim': {
      const x = D(n.x)
      return concat([delim(n.g, x), x, delim(n.d, x)])
    }
    case 'acc': {
      const x = D(n.x)
      if (x.l.length === 1) return boite(ligne(n))
      return empiler(boite('─'.repeat(x.w)), x, null)
    }
    case 'grille': return grille(n)
  }
}

function grille(n: Extract<N, { t: 'grille' }>): Boite {
  const cel = n.lignes.map(l => l.map(x => dessin(x)))
  const cols = Math.max(...cel.map(l => l.length))
  const aligne = n.genre === 'aligned' || n.genre === 'align' || n.genre === 'split' || n.genre === 'eqnarray'
  const largeurs = Array.from({ length: cols }, (_, j) => Math.max(0, ...cel.map(l => l[j]?.w ?? 0)))
  const ecart = aligne ? 0 : 2
  const lignes = cel.map(l => {
    const bs: Boite[] = []
    for (let j = 0; j < cols; j++) {
      const x = l[j] ?? boite('')
      const sens = aligne ? (j % 2 === 0 ? 'd' : 'g') : n.genre === 'cases' ? 'g' : 'c'
      bs.push({ l: cadrer(x, largeurs[j]!, sens), b: x.b, w: largeurs[j]! })
      if (j < cols - 1 && ecart) bs.push(boite(blanc(ecart)))
    }
    return concat(bs)
  })
  // Lignes empilées sans interligne ; la ligne de base au milieu.
  const l = lignes.flatMap(x => x.l)
  const w = Math.max(...lignes.map(x => x.w))
  const corps: Boite = { l: l.map(s => s + blanc(w - largeur(s))), b: Math.floor((l.length - 1) / 2), w }
  const autour: Record<string, [string, string]> = { pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'],
    vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'], cases: ['{', '.'] }
  const a = autour[n.genre]
  if (!a) return corps
  const pad = n.genre === 'cases' ? [delim(a[0], corps), boite(' '), corps] : [delim(a[0], corps), boite(' '), corps, boite(' '), delim(a[1], corps)]
  return concat(pad)
}

// ── Dans le Markdown ───────────────────────────────────────────────────────

// Échappe ce que le Markdown lirait (emphase, tableau, HTML…).
const echapper = (s: string) => s.replace(/[\\*_|`[\]<>~#]/g, m => '\\' + m)

const ressembleMaths = (s: string) =>
  /[\\^_{}=<>]/.test(s) || /^[A-Za-z]{1,2}$|^[A-Za-z]?\d{0,2}$/.test(s.trim())

export function enLigne(tex: string): string {
  return ligne(analyser(tex)).replace(/\s+/g, ' ').trim()
}

// Bloc : dessin 2D dans un bloc de code (les espaces y restent), ou une ligne s'il est trop large.
export function enBloc(tex: string, colonnes = 100): string {
  const n = analyser(tex)
  const x = dessin(n)
  let lignes = x.w <= colonnes - 6 ? x.l.map(s => s.replace(/\s+$/, '')) : [ligne(n).replace(/\s+/g, ' ').trim()]
  const marge = Math.min(...lignes.filter(s => s.trim()).map(s => s.length - s.trimStart().length))
  lignes = lignes.map(s => s.slice(marge))
  if (lignes.length === 1) return '\n' + echapper(lignes[0]!) + '\n'
  return '```\n' + lignes.join('\n') + '\n```'
}

// Remplace les formules d'un texte Markdown, hors blocs de code et `code`.
export function convertir(md: string, colonnes = 100): string {
  if (!/\$|\\\(|\\\[/.test(md)) return md
  const morceaux = md.split(/(^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)[ \t]*$)/m)
  return morceaux.map((m, k) => k % 2 === 1 ? m : convertirTexte(m, colonnes)).join('')
}

function convertirTexte(t: string, colonnes: number): string {
  const blocs = t.split(/(`+[^`\n]*`+)/)
  return blocs.map((b, k) => k % 2 === 1 ? b : convertirMorceau(b, colonnes)).join('')
}

function convertirMorceau(t: string, colonnes: number): string {
  const bloc = (tex: string, avant: string) => {
    try {
      // Un bloc au milieu d'une ligne doit commencer une nouvelle ligne pour le Markdown.
      return (avant && !avant.endsWith('\n') ? '\n' : '') + enBloc(tex.trim(), colonnes) + '\n'
    } catch { return null }
  }
  t = t.replace(/\$\$([\s\S]+?)\$\$[ \t]*\n?|\\\[([\s\S]+?)\\\][ \t]*\n?/g, (m, a, b, i, s) => bloc(a ?? b, s.slice(0, i)) ?? m)
  t = t.replace(/\\\((.+?)\\\)/g, (m, a) => { try { return echapper(enLigne(a)) } catch { return m } })
  t = t.replace(/(^|[^\\$\w])\$(?=\S)([^$\n]{1,300}?)(?<=\S)\$(?!\d)/g, (m, avant, a) => {
    if (!ressembleMaths(a)) return m
    try { return avant + echapper(enLigne(a)) } catch { return m }
  })
  return t
}
