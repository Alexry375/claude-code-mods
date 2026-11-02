import type { Entree } from '../types'

export function texteFil(liste: Entree[]): string {
  return liste.map(x => {
    if (x.type === 'image') return `[image ${x.heure}] ${x.legende}\n${x.chemin} · ${x.largeur}×${x.hauteur}`
    return `[${x.type === 'moi' ? 'toi' : 'agent'} ${x.heure}]${x.type === 'agent' && !x.essentiel ? ' (sans ESSENTIEL)' : ''} ${x.texte}`
  }).join('\n\n') || 'Rien encore.'
}

