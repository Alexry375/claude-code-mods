// `id` : l'identifiant de la ligne dans la conversation (absent dans un fil d'avant la v0.4.0).
export type Entree =
  | { type: 'moi'; heure: string; id?: string; texte: string }
  | { type: 'agent'; heure: string; id?: string; texte: string; essentiel: boolean }
  | { type: 'image'; heure: string; id?: string; chemin: string; legende: string; largeur: number; hauteur: number }

declare module 'claude-code' {
  interface PluginState {
    // `incident` : vide quand le lecteur va bien, sinon une ligne affichée en tête du panneau.
    fil: { entrees: Entree[]; source: { id: string; chemin: string } | null; saisie: number; incident: string }
  }
}
