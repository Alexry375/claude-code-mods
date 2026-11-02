import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import { texteFil } from './reprise'
import type { Entree } from '../types'

// Le « fil » : un panneau à droite de la session qui garde l'essentiel de la
// conversation (les messages de l'utilisateur, les blocs ESSENTIEL des réponses, une ligne par
// image montrée), et l'outil « montrer » qui dessine un PNG sous son appel. Les images
// ne sont dessinées que dans la conversation : dans le panneau, elles ralentissaient l'affichage.
// Le lecteur de la transcription courante alimente un seul état, partagé par
// le panneau et /fil texte. Un seul fichier est écrit, et seulement s'il existe déjà : les
// limites de l'abonnement (voir `ecrireLimites`).

const source = atom({ plugin: 'fil', key: 'source' } as const, null)
type Source = { id: string; chemin: string }

const PANE = 'fil'
const OUTIL = 'mcp__fil__montrer'
const MAX_PNG = 2 * 1024 * 1024 // ce qu'Image accepte en octets décodés

export type Montre = { chemin: string; legende: string; largeur: number; hauteur: number }

const entrees = atom({ plugin: 'fil', key: 'entrees' } as const, [])

// Hors plein écran, le panneau est posé au-dessus de la saisie, et le moteur donne au
// cadre et à la saisie ensemble au plus la moitié de la hauteur du terminal, le cadre
// servi d'abord : une saisie longue était coupée par le bas. Le fil compte donc les
// lignes de la saisie et se réduit pour lui laisser la place.
const saisie = atom({ plugin: 'fil', key: 'saisie' } as const, 1)
const MARGE = 7 // les deux bords du cadre, la ligne d'aide, les deux bords de la saisie, la ligne d'état, une de sûreté

export function lignesSaisie(texte: string, colonnes: number): number {
  const large = Math.max(10, colonnes - 4)
  return texte.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / large)), 0)
}

// Les lignes que le corps du cadre peut prendre, en ligne, sans couper la saisie.
export function placeFil(rangs: number, lignes: number): number {
  return Math.floor(rangs / 2) - lignes - MARGE
}

// Sous 3 lignes, même réduit, le cadre coupe encore la saisie : on le ferme, et il
// revient au prochain envoi (une ouverture pendant l'envoi est « demandée » et se place).
const PLACE_MIN = 3
let replie = false

// Les frappes arrivent par rafales : le compte se décide ici, sans attente, et l'écriture
// recompte toujours le dernier texte, pour qu'un appel en retard n'écrase pas un plus récent.
let texteSaisie = ''
let compte = 1

async function compterSaisie($: EngineInterface, texte: string) {
  texteSaisie = texte
  const n = lignesSaisie(texte, vue.colonnes)
  if (n === compte) return
  compte = n
  await update($, saisie, () => lignesSaisie(texteSaisie, vue.colonnes))
  if (vue.placement === 'inline' && !replie && placeFil(vue.rangs, n) < PLACE_MIN) {
    if ((await $.ui.panes()).some(p => p.id === PANE)) {
      replie = true
      await $.ui.close({ id: PANE })
    }
  }
}

// Les octets restent ici, hors du résultat : le modèle ne lit que la petite fiche.
const images = new Map<string, string>()

export function taillePng(octets: Uint8Array): { largeur: number; hauteur: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (octets.length < 24 || signature.some((o, i) => octets[i] !== o)) return null
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength)
  return { largeur: v.getUint32(16), hauteur: v.getUint32(20) }
}

// Le résultat d'un outil de mod doit être un texte (ou des blocs) : la fiche part
// en JSON, que le modèle lit et que le dessin relit (aussi après une reprise).
export function lireFiche(sortie: unknown): Montre | null {
  let texte = sortie
  if (Array.isArray(sortie)) texte = (sortie.find(b => b?.type === 'text') as { text?: string } | undefined)?.text
  if (typeof texte !== 'string') return null
  try {
    const m = JSON.parse(texte) as Montre
    return typeof m?.chemin === 'string' && m.largeur > 0 && m.hauteur > 0 ? m : null
  } catch {
    return null
  }
}

// Une case de terminal est à peu près deux fois plus haute que large.
export function cases(m: Montre, colonnesDispo: number, rangsMax = 50): { columns: number; rows: number } {
  const columns = Math.max(10, Math.min(100, colonnesDispo - 6, Math.round(m.largeur / 8)))
  const rows = Math.max(3, Math.min(rangsMax, Math.round((columns * m.hauteur) / m.largeur / 2)))
  return { columns, rows }
}

async function lire($: EngineInterface, chemin: string): Promise<string> {
  const { base64 } = await $.fs.read(chemin, { as: 'bytes' })
  return base64
}

// Le panneau s'ouvre sur les derniers échanges. Juste après `open` il n'est pas encore
// dessiné (`not this plugin's site`) : on descend au tour suivant de l'horloge.
// `end` suit ensuite les nouvelles entrées, jusqu'à ce que l'utilisateur remonte lui-même.
async function ouvrir($: EngineInterface) {
  const r = await $.ui.open({ id: PANE, title: 'Fil' })
  replie = false
  suitLaFin = true
  descendre($)
  return r
}

function descendre($: EngineInterface) {
  $.clock.after(0, () => { void $.ui.scroll({ in: PANE, to: 'end' }).catch(() => undefined) })
}

// Quand la fenêtre change de taille (moitié d'écran puis plein écran), le moteur replace
// le panneau (côte à côte ↔ par-dessus la conversation) et le repart en haut sans
// passer par `ui.scroll`. On le redescend si l'utilisateur lisait la fin, pas s'il était remonté.
let suitLaFin = true
let gabarit = ''
// Ce que le dernier dessin du panneau a vu du terminal.
const vue = { colonnes: 80, rangs: 24, placement: 'inline' as 'dock' | 'inline' }

// Un clic sur ↗ fait défiler la conversation jusqu'au message (plein écran seulement).
// Refusé quand la ligne n'est plus dessinée, par exemple avant un compactage.
async function allerA($: EngineInterface, id: string) {
  const r = await $.ui.scroll({ to: { requestId: id }, block: 'start' })
  if (r.deny) $.ui.toast('Message plus affiché dans la conversation (compactée ou trop ancienne).')
}

// Un lecteur mort laissait le fil figé sans un mot (constaté le 02/11/2026 : le panneau
// arrêté depuis des heures). Désormais toute fin du lecteur est dite en
// tête du panneau, notée dans ~/.local/state/fil/incidents.log (heure, session, raison :
// aucun texte de la conversation) et suivie d'une relance, 2 s puis jusqu'à 1 min d'écart.
const incident = atom({ plugin: 'fil', key: 'incident' } as const, '')
const INCIDENTS = '/.local/state/fil/incidents.log'
let relance: { cancel(): void } | undefined
let echecs = 0

async function noterIncident($: EngineInterface, id: string, raison: string) {
  try {
    const home = await $.env.get('HOME')
    if (home === undefined) return
    const quand = new Date(await $.clock.now()).toISOString()
    let avant = ''
    try { avant = await $.fs.read(home + INCIDENTS) } catch { /* premier incident */ }
    const lignes = (avant + `${quand} ${id} ${raison}\n`).split('\n').filter(Boolean).slice(-200)
    await $.fs.write(home + INCIDENTS, lignes.join('\n') + '\n')
  } catch (err) {
    $.ui.log(`fil : incident non noté (${String(err).slice(0, 120)})`, { to: 'debug' })
  }
}

// Le lecteur de la génération `g` s'est arrêté sans qu'on le lui demande.
function relancerPlusTard($: EngineInterface, g: number, id: string, raison: string) {
  if (g !== generation) return
  actif = null
  pret = false
  const delai = Math.min(60_000, 2000 * 2 ** Math.min(echecs, 5))
  echecs++
  $.ui.log(`fil : lecteur arrêté (${raison}), relance dans ${delai / 1000} s`, { to: 'debug' })
  void noterIncident($, id, raison)
  void update($, incident, () => `lecteur arrêté (${raison}) ; relance automatique…`).catch(() => undefined)
  planifier($, delai)
}

function planifier($: EngineInterface, delai: number) {
  relance?.cancel()
  relance = $.clock.after(delai, () => {
    relance = undefined
    void suivreSession($).catch(err => $.ui.log(`fil : relance impossible (${String(err).slice(0, 120)})`, { to: 'debug' }))
  })
}

let generation = 0
let actif: Source | null = null
let annoncee: Source | null = null
let lecteur: AsyncGenerator<any, any, any> | undefined
let pret = false
let erreur = ''
let dernier = ''
let prevenir: (() => void)[] = []
const reveiller = () => { const liste = prevenir; prevenir = []; liste.forEach(f => f()) }

function arreter() {
  generation++
  actif = null
  pret = false
  dernier = ''
  void lecteur?.return(undefined).catch(() => undefined)
  lecteur = undefined
  reveiller()
}

function lancer($: EngineInterface, s: Source) {
  if (actif?.id === s.id && actif.chemin === s.chemin) return
  arreter()
  relance?.cancel()
  relance = undefined
  actif = s
  erreur = ''
  const g = generation
  void (async () => {
    let fin_ = 'fin du lecteur'
    let stderr = ''
    try {
      const flux = $.process.spawn({ argv: ['python3', '-I', '-B', `${$.plugin.root}/hooks/transcript.py`, s.chemin, s.id, '--suivre'] })
      lecteur = flux
      let tampon = ''
      for await (const morceau of flux) {
        if (g !== generation) break
        if (morceau.stream !== 'stdout') {
          stderr = (stderr + morceau.text).slice(-300)
          continue
        }
        tampon += morceau.text
        let fin: number
        while ((fin = tampon.indexOf('\n')) >= 0) {
          const ligne = tampon.slice(0, fin)
          tampon = tampon.slice(fin + 1)
          const r = JSON.parse(ligne) as { entrees: Entree[]; vus: string[] }
          if (g !== generation) return
          // Une autre session est devenue courante (/resume, --continue tardif) : quitter la
          // boucle tue ce lecteur, et la relance suit la nouvelle.
          if (await $.session.id() !== s.id) throw new Error('session changée')
          await update($, entrees, courant => g === generation ? r.entrees : courant)
          if (g !== generation) return
          if (!pret || echecs > 0) {
            echecs = 0
            void update($, incident, () => '').catch(() => undefined)
          }
          pret = true
          if (r.vus.includes(dernier)) dernier = ''
          reveiller()
        }
      }
      if (g !== generation) return
      // La dernière ligne d'erreur de Python dit pourquoi (traceback) ; sinon le lecteur a été tué.
      const derniere = stderr.trim().split('\n').pop()?.slice(0, 160)
      if (derniere) fin_ = `fin du lecteur : ${derniere}`
    } catch (err) {
      if (g !== generation) return
      fin_ = String(err instanceof Error ? err.message : err).slice(0, 160)
    }
    erreur = 'Fil indisponible : lecture de la transcription interrompue.'
    reveiller()
    relancerPlusTard($, g, s.id, fin_)
  })()
}

// Seule la commande texte attend la publication, jamais le démarrage ni la saisie.
const attendre = async ($: EngineInterface): Promise<string | undefined> => {
  let expire = false
  const limite = $.clock.after(5000, () => { expire = true; reveiller() })
  try {
    while ((!pret || dernier) && !erreur && !expire) {
      await new Promise<void>(resolve => prevenir.push(resolve))
    }
    return erreur || (expire ? 'Fil en cours de reconstruction ; réessaie /fil texte.' : undefined)
  } finally {
    limite.cancel()
  }
}

// Le chemin du journal vient de `classic.SessionStart` quand ce hook passe ; depuis 2.1.300
// le module de sécurité intégré le saute pour les mods, et le lecteur retrouve alors le
// journal par l'identifiant (`-`). Appelé au démarrage, à chaque message et à /fil : après
// --continue ou /resume, $.session.id() bascule sur la session reprise après session.start.
async function suivreSession($: EngineInterface) {
  const id = await $.session.id()
  if (actif?.id === id) return
  const s = annoncee?.id === id ? annoncee : { id, chemin: '-' }
  const avant = await read($, source)
  if (avant?.id !== s.id) await update($, entrees, () => [])
  await update($, source, () => s)
  lancer($, s)
}

// Les fenêtres de l'abonnement (5 h, 7 jours) que rapporte chaque réponse, pour un outil
// externe (un volet de multiplexeur, une barre d'état) : ~/.local/state/abonnements/claude.json.
// Facultatif : rien n'est écrit tant que ce fichier n'existe pas (le créer, même vide, l'active).
// Pas de texte de la conversation. Réécrit quand une fenêtre bouge d'un point, sinon au plus
// une fois par minute.
const LIMITES = '/.local/state/abonnements/claude.json'
let limitesEcrites = 0
let limitesActives: boolean | undefined

export function ficheLimites(limites: SessionRateLimit[], maintenant: number): string | null {
  if (limites.length === 0) return null
  const fenetres = limites.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt ?? null }))
  return JSON.stringify({ mesure: new Date(maintenant).toISOString(), fenetres }) + '\n'
}

async function ecrireLimites($: EngineInterface, limites: SessionRateLimit[], bouge: boolean) {
  const maintenant = await $.clock.now()
  if (!bouge && maintenant - limitesEcrites < 60_000) return
  const fiche = ficheLimites(limites, maintenant)
  if (fiche === null) return
  // Retenu avant toute attente : une mesure arrivée entre-temps ne réécrit pas.
  limitesEcrites = maintenant
  const home = await $.env.get('HOME')
  if (home === undefined) return
  if (limitesActives === undefined) {
    try { await $.fs.read(home + LIMITES); limitesActives = true } catch { limitesActives = false }
  }
  if (!limitesActives) return
  await $.fs.write(home + LIMITES, fiche)
}

export const register: Register = on => {
  on('session.measure', async ($, e, next) => {
    const r = await next(e)
    // Depuis 2.1.300 le module de sécurité intégré saute `session.append` pour les mods :
    // la mesure de chaque réponse sert de point de resynchronisation à sa place.
    void suivreSession($).catch(() => undefined)
    void ecrireLimites($, e.rateLimits, e.changed.includes('rateLimits')).catch(err => {
      $.ui.log(`fil : limites non écrites (${String(err).slice(0, 120)})`, { to: 'debug' })
    })
    return r
  })

  on('classic.SessionStart', async ($, e, next) => {
    const r = await next(e)
    if (e.agent_id) return r
    // --continue annonce l'id repris avant que $.session.id() ne bascule.
    // On retient le chemin, sans le lire tant que cet id n'est pas courant.
    annoncee = { id: e.session_id, chemin: e.transcript_path }
    if (e.session_id === await $.session.id()) {
      const s = annoncee
      const avant = await read($, source)
      if (avant?.id !== s.id) await update($, entrees, () => [])
      await update($, source, () => s)
      lancer($, s)
    }
    return r
  })

  on('session.append', async ($, e, next) => {
    const r = await next(e)
    if (!e.agentId && ['prompt', 'response', 'tool-result'].includes(e.door)) dernier = e.uuid
    if (!e.agentId) await suivreSession($)
    return r
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') {
      arreter()
      annoncee = null
      await update($, source, () => null)
      await update($, entrees, () => [])
      // La nouvelle session n'est courante qu'après : on la rejoint un peu plus tard.
      planifier($, 2000)
    }
    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    const r = await next(e)
    void compterSaisie($, r.text)
    return r
  })

  on('prompt.change', async ($, e, next) => {
    void compterSaisie($, e.text)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (replie) {
      replie = false
      // /fil décide lui-même : le rouvrir ici le ferait aussitôt refermer.
      if (!/^\/fil\b/.test(e.text.trim())) await ouvrir($).catch(() => undefined)
    }
    void suivreSession($).catch(() => undefined)
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'fil', description: 'Ouvre ou ferme le fil ; /fil texte le donne en texte brut' })
    await $.tool.register({
      name: 'montrer',
      description:
        "Montre une image à l'utilisateur, dessinée dans la conversation sous cet appel et dans son fil. " +
        "Donne le chemin d'un fichier PNG (2 Mio au plus) ; pour un graphique ou un schéma, " +
        "produis d'abord le PNG. À utiliser quand voir vaut mieux qu'une description.",
      inputSchema: {
        type: 'object',
        properties: {
          chemin: { type: 'string', description: 'Chemin du fichier PNG, absolu ou relatif au dossier de la session' },
          legende: { type: 'string', description: 'Une ligne qui dit ce que montre l’image' },
        },
        required: ['chemin'],
      },
    })
    // Pas d'ouverture d'office : en rendu classique le panneau prend un tiers de
    // l'écran au-dessus de la saisie. /fil l'ouvre quand l'utilisateur le veut.
    const r = await next(e)
    // Au rechargement, le chemin reste en mémoire de session.
    if (annoncee === null) annoncee = await read($, source)
    await suivreSession($)
    return r
  })

  on('command.run', { command: 'fil' }, async ($, e) => {
    await suivreSession($)
    if (e.args.trim() === 'texte') {
      const erreur = await attendre($)
      return { text: erreur ?? texteFil(await read($, entrees)) }
    }
    if ((await $.ui.panes()).some(p => p.id === PANE)) {
      await $.ui.close({ id: PANE })
      return { text: 'Fil fermé (/fil pour le rouvrir).' }
    }
    const r = await ouvrir($)
    return { text: r.isPlaced ? 'Fil ouvert (/fil ou ctrl+x x pour le fermer).' : `Fil ouvert mais pas encore placé : ${r.reason}` }
  })

  on('tool.call', { tool: OUTIL }, async ($, e) => {
    const chemin = String((e as Record<string, unknown>).chemin ?? '')
    const legende = String((e as Record<string, unknown>).legende ?? '')
    let base64: string
    try {
      base64 = await lire($, chemin)
    } catch (err) {
      return { deny: `montrer : lecture impossible de ${chemin} (${String(err).slice(0, 120)})` }
    }
    const octets = Uint8Array.fromBase64(base64)
    const taille = taillePng(octets)
    if (taille === null) return { deny: `montrer : ${chemin} n'est pas un PNG ; convertis-le d'abord.` }
    if (octets.length > MAX_PNG) return { deny: `montrer : ${chemin} dépasse 2 Mio ; réduis-le d'abord.` }
    images.set(e.tool_use_id, base64)
    images.set(chemin, base64)
    const fiche: Montre = { chemin, legende, ...taille }
    return { result: JSON.stringify(fiche) }
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'montrer : le mod a échoué.' }))

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (![OUTIL, 'mcp__montrer__image'].includes(e.props.tool) || e.props.isErrored) return next(e)
    const m = lireFiche(e.props.output)
    if (m === null) return next(e)
    const titre = m.legende !== '' ? m.legende : m.chemin
    if (e.surface !== 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>image : {titre}</Text>
    }
    const { Box, Text, Image } = $.ui.resolve(e)
    // Après une reprise de session, la mémoire du mod est vide : on relit le fichier.
    let base64 = images.get(e.requestId)
    if (base64 === undefined) {
      try {
        base64 = await lire($, m.chemin)
        images.set(e.requestId, base64)
      } catch {
        return <Text dimColor>image : {titre} (fichier disparu)</Text>
      }
    }
    const { columns, rows } = cases(m, e.viewport?.columns ?? 80)
    return (
      <Box flexDirection="column">
        <Image source={{ png: base64 }} columns={columns} rows={rows} alt={`[image] ${titre}`} />
        <Text dimColor>{titre} · {m.largeur}×{m.hauteur}</Text>
      </Box>
    )
  })

  on('ui.scroll', { requestId: PANE }, async ($, e, next) => {
    suitLaFin = e.offset >= e.contentRows - e.bodyRows
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Markdown, Button } = $.ui.resolve(e)
    const g = `${e.props.placement} ${e.props.bodyColumns}x${e.props.scroll.bodyRows}`
    if (g !== gabarit) {
      if (gabarit !== '' && suitLaFin) descendre($)
      gabarit = g
    }
    vue.colonnes = e.viewport?.columns ?? vue.colonnes
    vue.rangs = e.viewport?.rows ?? vue.rangs
    vue.placement = e.props.placement
    let place = Infinity
    if (e.props.placement === 'inline' && e.viewport !== undefined) {
      place = placeFil(e.viewport.rows, await read($, saisie))
      if (place < PLACE_MIN) return <Text dimColor wrap="truncate">fil replié le temps de la saisie</Text>
    }
    const liste = await read($, entrees)
    const alerte = await read($, incident)
    const bandeau = alerte !== '' ? <Text color="yellow" wrap="truncate">⚠ fil : {alerte}</Text> : null
    if (liste.length === 0) {
      return (
        <Box flexDirection="column">
          {bandeau}
          <Text dimColor>Rien encore. Tes messages, les blocs ESSENTIEL et les images s'ajouteront ici.</Text>
        </Box>
      )
    }
    // L'en-tête coloré, suivi du lien vers le message quand l'entrée connaît son id.
    const entete = (x: Entree, i: number, couleur: string, titre: string) => (
      <Box flexDirection="row">
        <Text color={couleur} bold>{x.heure}  {titre}</Text>
        {x.id !== undefined && e.props.view.agentId === undefined
          ? <Button plain dimColor key={`aller-${i}`} label="  ↗" onPress={() => allerA($, x.id!)} />
          : null}
      </Box>
    )
    const blocs = await Promise.all(
      liste.map(async (x, i) => {
        if (x.type === 'moi') {
          return (
            <Box flexDirection="column" marginBottom={1}>
              {entete(x, i, 'cyan', 'toi')}
              <Text>{x.texte}</Text>
            </Box>
          )
        }
        if (x.type === 'agent') {
          return (
            <Box flexDirection="column" marginBottom={1}>
              {entete(x, i, 'yellow', `agent${x.essentiel ? '' : ' (sans ESSENTIEL)'}`)}
              <Markdown text={x.texte} dimColor={!x.essentiel} />
            </Box>
          )
        }
        const titre = x.legende !== '' ? x.legende : x.chemin
        // Une ligne seulement : l'image elle-même reste dans la conversation (↗ y mène).
        return <Box flexDirection="column" marginBottom={1}>{entete(x, i, 'magenta', `image · ${titre}`)}</Box>
      }),
    )
    if (place < e.props.scroll.bodyRows) {
      // Cadre réduit : la dernière entrée seulement, depuis son en-tête.
      return (
        <Box flexDirection="column" height={place} overflow="hidden">
          {bandeau}
          {blocs.slice(-1)}
        </Box>
      )
    }
    return <Box flexDirection="column">{blocs}{bandeau}</Box>
  })
}
