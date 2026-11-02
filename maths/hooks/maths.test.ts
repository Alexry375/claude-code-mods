import { describe, expect, test } from 'claude-code/testing'
import { convertir, enBloc, enLigne } from './latex'
import { dessiner } from './register'

describe('en ligne', () => {
  test('indices, exposants, grec', () => {
    expect(enLigne(String.raw`\sum_{i=1}^n x_i`)).toBe('Σᵢ₌₁ⁿ xᵢ')
    expect(enLigne(String.raw`\lambda_1^{2} - \lambda_0`)).toBe('λ₁² − λ₀')
    expect(enLigne(String.raw`F^{-1}(1-\alpha)`)).toBe('F⁻¹(1 − α)')
  })
  test('ce qui n’a pas d’Unicode reste lisible', () => {
    expect(enLigne(String.raw`P_{H_0}(T_n > S)`)).toBe('P_(H₀)(Tₙ > S)')
    expect(enLigne(String.raw`\frac{n(n+1)}{2}`)).toBe('n(n + 1)/2')
    expect(enLigne(String.raw`\foo{x}`)).toBe('\\foox')
  })
  test('espaces : « xᵢ ln », « (a) Σ », \\, et \; deviennent des espaces', () => {
    expect(enLigne(String.raw`x_i\ln(i\lambda_1)`)).toBe('xᵢ ln(iλ₁)')
    expect(enLigne(String.raw`(\lambda_1-\lambda_0)\,\sum_i i`)).toBe('(λ₁ − λ₀) Σᵢ i')
  })
})

describe('en bloc', () => {
  test('fraction empilée et somme avec ses bornes', () => {
    expect(enBloc(String.raw`\ln\frac{L_1}{L_0} = \sum_{i=1}^n x_i`)).toBe([
      '```',
      '    L₁     n',
      'ln ──── =  Σ  xᵢ',   // Σ centré sur « i=1 » : la colonne garde sa largeur
      '    L₀    i=1',
      '```'].join('\n'))
  })
  test('une formule d’une seule ligne n’est pas mise en bloc de code', () => {
    expect(enBloc('x^2 + y^2')).toBe('\nx² + y²\n')
  })
  test('trop large pour l’écran : repli sur une ligne', () => {
    expect(enBloc(String.raw`\frac{a}{b}`, 6)).toBe('\na/b\n')
  })
})

describe('dans le Markdown', () => {
  test('les montants en dollars et le code restent intacts', () => {
    const t = 'Ça coûte 5 $ ou $80.89 puis $4.20. `$x_1$` reste.'
    expect(convertir(t)).toBe(t)
    expect(convertir('```\n$$x^2$$\n```')).toBe('```\n$$x^2$$\n```')
  })
  test('formules en ligne converties et échappées pour le Markdown', () => {
    expect(convertir('Seuil $S_1$, risque $\\alpha$, et $a<b$.')).toBe('Seuil S₁, risque α, et a \\< b.')
    expect(convertir('Estimateur \\(\\hat\\theta_n\\).')).toBe('Estimateur θ̂ₙ.')
  })
  test('bloc $$…$$ au milieu d’un paragraphe : sur ses propres lignes', () => {
    expect(convertir('Donc $$\\frac{1}{2}$$ fin.')).toBe('Donc \n```\n 1\n───\n 2\n```\nfin.')
  })
  test('LaTeX cassé : rien ne plante', () => {
    expect(() => convertir('$$\\frac{a}{$$ et $\\left( x$')).not.toThrow()
  })
})

test('le hook réécrit le dessin d’une réponse du terminal, pas les autres surfaces', async ($, on) => {
  // Le dessin du moteur, sous le mod : un Markdown du texte reçu.
  on('ui.render', async (_$: any, e: any) => ({ type: 'Markdown', props: { text: e.props.text } }) as any)
  const props = { text: 'On a $\\lambda_1$.', isFirstOfReply: true }
  const terminal = await $.ui.mount({ plugin: 'maths', surface: 'terminal', component: 'AssistantMessage', props, viewport: { columns: 100, rows: 40 } })
  expect(JSON.stringify(await terminal.drawn())).toContain('On a λ₁.')
  const bureau = await $.ui.mount({ plugin: 'maths', surface: 'desktop', component: 'AssistantMessage', props })
  expect(JSON.stringify(await bureau.drawn())).toContain('\\\\lambda_1')
})

test('mémoire : même texte, même résultat', () => {
  expect(dessiner('$x_1$', 80)).toBe('x₁')
  expect(dessiner('$x_1$', 80)).toBe('x₁')
})
