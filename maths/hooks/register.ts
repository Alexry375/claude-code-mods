// Mod « maths » : les formules LaTeX des réponses ($…$, $$…$$, \(…\), \[…\]) dessinées en Unicode
// dans le terminal. Seul le dessin change : la réponse enregistrée garde son LaTeX (ctrl+o).
import type { Register } from 'claude-code'
import { convertir } from './latex'

// Le dessin d'un bloc est redemandé au défilement : on garde les derniers résultats.
const memoire = new Map<string, string>()
const MEMOIRE = 300

export function dessiner(texte: string, colonnes: number): string {
  const cle = colonnes + '\u0000' + texte
  let r = memoire.get(cle)
  if (r === undefined) {
    try { r = convertir(texte, colonnes) } catch { r = texte }
    if (memoire.size >= MEMOIRE) memoire.delete(memoire.keys().next().value!)
    memoire.set(cle, r)
  }
  return r
}

export const register: Register = (on) => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const text = dessiner(e.props.text, e.viewport?.columns ?? 100)
    return text === e.props.text ? next(e) : next({ ...e, props: { ...e.props, text } })
  })
}
