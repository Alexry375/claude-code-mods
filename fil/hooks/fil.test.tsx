import { describe, expect, test, mock } from 'claude-code/testing'
import { cases, ficheLimites, lignesSaisie, lireFiche, placeFil, taillePng } from './register'
import { texteFil } from './reprise'

const ICI = '/essai' // chemins simulés : fs.read est remplacé plus bas
const OUTIL = 'mcp__fil__montrer'
// Un vrai PNG 320×160 (rouge uni).
const PNG = Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAUAAAACgCAIAAADywSLLAAAB7ElEQVR4nO3TMQ0AIADAMEAX/oMsPPCQJa2CPZtn7wE0rd8BwDsDQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCLsTEAoDgEi4gAAAAAElFTkSuQmCC')
const FICHIERS: Record<string, string> = { [`${ICI}/essai.png`]: PNG.toBase64() }

function moteur(on: any, panes: string[] = []) {
  on('session.start', async () => ({ cwd: ICI }) as any)
  on('session.id', async () => ({ value: 'session-test' }) as any)
  on('clock.now', async () => ({ value: Date.UTC(2026, 9, 6, 12, 5) }) as any)
  on('tool.register', async () => ({ value: undefined }) as any)
  on('command.register', async () => ({ value: undefined }) as any)
  on('ui.open', async (_$: any, e: any) => {
    if (!panes.includes(e.id)) panes.push(e.id)
    return { value: { isPlaced: true } } as any
  })
  on('ui.close', async (_$: any, e: any) => {
    panes.splice(panes.indexOf(e.id), 1)
    return { value: undefined } as any
  })
  on('ui.panes', async () => ({ value: panes.map(id => ({ id, title: 'Fil', isShown: true, isFocused: false, isPlaced: true })) }) as any)
  on('fs.read', async (_$: any, e: any) => {
    const b = FICHIERS[e.path]
    if (b === undefined) throw new Error(`ENOENT: ${e.path}`)
    return { value: { base64: b } } as any
  })
  return panes
}

describe('calculs', () => {
  test('saisie longue : le fil en ligne lui laisse la place', () => {
    expect(lignesSaisie('', 75)).toBe(1)
    expect(lignesSaisie('a\nb\n\nc', 75)).toBe(4)
    expect(lignesSaisie('x'.repeat(150), 75)).toBe(3)
    expect(placeFil(45, 1)).toBe(14)
    expect(placeFil(45, 9)).toBe(6)
    expect(placeFil(25, 7)).toBeLessThan(1)
  })
  test('PNG, fiche et cases', () => {
    expect(taillePng(PNG)).toEqual({ largeur: 320, hauteur: 160 })
    const f = { chemin: '/a.png', legende: 'x', largeur: 8, hauteur: 4 }
    expect(lireFiche(JSON.stringify(f))).toEqual(f)
    expect(lireFiche(f)).toBe(null)
    expect(cases({ chemin: 'a', legende: '', largeur: 320, hauteur: 160 }, 120)).toEqual({ columns: 40, rows: 10 })
    expect(cases({ chemin: 'a', legende: '', largeur: 400, hauteur: 4000 }, 60, 20).rows).toBe(20)
  })
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`panneau et appel dessinent la projection (${surface})`, async ($, on) => {
    moteur(on)
    const liste = [
      { type: 'moi', heure: '14:05', texte: 'Montre-moi le carré' },
      { type: 'image', heure: '14:05', chemin: `${ICI}/essai.png`, legende: 'Carré rouge', largeur: 320, hauteur: 160 },
      { type: 'agent', heure: '14:05', texte: '**Le fil marche.** Il garde tes messages.', essentiel: true },
    ]
    on('state.get', { plugin: 'fil', key: 'entrees' }, async () => ({ value: { value: liste, version: 1 } }) as any)
    await $.session.start({ source: 'startup', cwd: ICI } as any)
    const r: any = await $.tool.call({ tool: OUTIL, tool_use_id: 'toolu_1', chemin: `${ICI}/essai.png`, legende: 'Carré rouge' } as any)
    expect(typeof r.result).toBe('string')
    // Le dessin utilise la projection du lecteur ; le lecteur et les vrais
    // événements sont couverts par test_transcript.py et les sessions -p.
    expect(texteFil(liste as any)).toContain('[image 14:05] Carré rouge')
    const appel = await $.ui.mount({ plugin: 'fil', surface, component: 'ToolResult', requestId: 'toolu_1',
      props: { tool: OUTIL, output: r.result, isErrored: false } } as any)
    expect((await appel.find({ text: /Carré rouge/ })) !== undefined, 'légende sous appel').toBe(true)

    const ui = await $.ui.mount({
      plugin: 'fil', surface, component: 'Pane', requestId: 'fil',
      props: { title: 'Fil', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
    } as any)
    expect((await ui.find({ text: /Montre-moi le carré/ })) !== undefined, 'message panneau').toBe(true)
    expect((await ui.find({ text: /Carré rouge/ })) !== undefined).toBe(true)
    const md: any = await ui.find({ type: 'Markdown' })
    expect(md?.props.text).toBe('**Le fil marche.** Il garde tes messages.')
    // L'image n'est dessinée que dans la conversation ; le panneau garde sa ligne.
    expect(await ui.find({ type: 'Image' }), 'aucune image dans le panneau').toBeUndefined()
  })
}

test('/fil ouvre puis ferme le panneau', async ($, on) => {
  const panes = moteur(on)
  await $.session.start({ source: 'startup', cwd: ICI } as any)
  expect(panes).toEqual([])
  const a: any = await $.command.run({ command: 'fil', args: '' } as any)
  expect(String(a.text)).toContain('ouvert')
  expect(panes).toEqual(['fil'])
  const b: any = await $.command.run({ command: 'fil', args: '' } as any)
  expect(String(b.text)).toContain('fermé')
  expect(panes).toEqual([])
})

// Le défilement lui-même (ouverture en bas, clic vers la conversation) se vérifie en
// session interactive : le kit de test ne simule pas $.ui.scroll vers la conversation.
test('↗ seulement sur les entrées qui connaissent leur message', async ($, on) => {
  moteur(on)
  const liste = [
    { type: 'moi', heure: '14:05', id: 'uuid-moi', texte: 'Question' },
    { type: 'agent', heure: '14:06', texte: 'Ancienne entrée sans id', essentiel: true },
  ]
  on('state.get', { plugin: 'fil', key: 'entrees' }, async () => ({ value: { value: liste, version: 1 } }) as any)
  await $.session.start({ source: 'startup', cwd: ICI } as any)
  const props = { title: 'Fil', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 40 } }
  const ui = await $.ui.mount({ plugin: 'fil', surface: 'terminal', component: 'Pane', requestId: 'fil', props: { ...props, view: {} } } as any)
  const boutons: any[] = await ui.findAll({ type: 'Button' })
  expect(boutons.map(b => b.key)).toEqual(['aller-0'])
  await ui.unmount()
  // Vue d'un sous-agent : la conversation affichée n'est pas celle du fil.
  const agent = await $.ui.mount({ plugin: 'fil', surface: 'terminal', component: 'Pane', requestId: 'fil', props: { ...props, view: { agentId: 'a1' } } } as any)
  expect(await agent.findAll({ type: 'Button' })).toHaveLength(0)
})

test('clear invalide une reconstruction pendant son CAS, démarrage non bloqué', async ($, on) => {
  const clock = mock.clock(on)
  let sessionId = 'ancienne'
  const etat = new Map<string, { value: unknown; version: number }>([
    ['source', { value: { id: 'ancienne', chemin: '/essai/ancienne.jsonl' }, version: 1 }],
    ['entrees', { value: [], version: 1 }],
  ])
  let spawnAppele = false
  let casSuspendu = false
  let casRefuses = 0
  let demarrageFini = false
  on('session.id', async () => ({ value: sessionId }))
  on('session.start', async () => ({ cwd: '/essai' }))
  on('session.end', async (_$, e) => ({ sessionId: e.sessionId }))
  on('command.register', async () => ({ value: undefined }))
  on('tool.register', async () => ({ value: undefined }))
  on('state.get', { plugin: 'fil' }, async (_$, e) => ({
    value: etat.get(e.key) ?? { value: undefined, version: 0 },
  }))
  on('state.set', { plugin: 'fil' }, async (_$, e) => {
    if (e.key === 'entrees' && Array.isArray(e.value) && e.value.length > 0 && !casSuspendu) {
      casSuspendu = true
      await clock.sleep(100)
    }
    const avant = etat.get(e.key) ?? { value: undefined, version: 0 }
    if (e.ifVersion !== undefined && e.ifVersion !== avant.version) {
      casRefuses++
      return { value: { isSet: false, version: avant.version } }
    }
    const version = avant.version + 1
    etat.set(e.key, { value: e.value, version })
    return { value: { isSet: true, version } }
  })
  on('process.spawn', async function* (_$, e) {
    if (spawnAppele) {
      // Après clear, /fil relit la nouvelle session, retrouvée par son identifiant.
      expect(e.argv.slice(-3)).toEqual(['-', 'nouvelle', '--suivre'])
      yield { stream: 'stdout', text: JSON.stringify({ entrees: [], vus: [] }) + '\n' }
      await clock.sleep(10000)
      return { value: { code: 0, signal: null } }
    }
    spawnAppele = true
    expect(e.argv.slice(-3)).toEqual(['/essai/ancienne.jsonl', 'ancienne', '--suivre'])
    await clock.sleep(100)
    yield { stream: 'stdout', text: JSON.stringify({
      entrees: [{ type: 'moi', heure: '14:05', texte: 'Ancien fil' }], vus: [],
    }) + '\n' }
    await clock.sleep(10000)
    return { value: { code: 0, signal: null } }
  })
  const demarrage = $.session.start({ cwd: '/essai', surface: null, isInteractive: false })
    .then(() => { demarrageFini = true })
  await clock.settle()
  expect(spawnAppele).toBe(true)
  expect(demarrageFini).toBe(true)
  expect(casSuspendu).toBe(false)
  await demarrage
  await clock.advance(100)
  expect(casSuspendu).toBe(true)
  await $.session.end({ reason: 'clear', sessionId: 'ancienne', resume: { id: 'ancienne' } } as any)
  sessionId = 'nouvelle'
  expect(etat.get('entrees')?.value).toEqual([])
  await clock.advance(100)
  expect(casRefuses).toBe(1)
  expect(etat.get('entrees')?.value).toEqual([])
  expect(etat.get('source')?.value).toBe(null)
  const reponse: any = await $.command.run({ command: 'fil', args: 'texte' } as any)
  expect(reponse.text).not.toContain('Ancien fil')
  expect(etat.get('source')?.value).toEqual({ id: 'nouvelle', chemin: '-' })
})

test('--continue attend que l’identifiant annoncé soit réellement courant', async ($, on) => {
  const clock = mock.clock(on)
  let id = 'provisoire'
  let lancements = 0
  on('session.id', async () => ({ value: id }))
  on('classic.SessionStart', async () => ({}))
  on('session.start', async () => ({ cwd: '/essai' }))
  on('command.register', async () => ({ value: undefined }))
  on('tool.register', async () => ({ value: undefined }))
  on('process.spawn', async function* (_$, e) {
    lancements++
    expect(e.argv.slice(-3)).toEqual(['/essai/repris.jsonl', 'repris', '--suivre'])
    await clock.sleep(10000)
    return { value: { code: 0, signal: null } }
  })
  await $.classic.SessionStart({ source: 'resume', session_id: 'repris', transcript_path: '/essai/repris.jsonl' })
  expect(lancements).toBe(0)
  id = 'repris'
  await $.session.start({ cwd: '/essai', surface: null, isInteractive: false })
  await clock.settle()
  expect(lancements).toBe(1)
})

test('limites de l’abonnement écrites quand le fichier existe, une fois par minute si rien ne bouge', async ($, on) => {
  let maintenant = Date.UTC(2026, 9, 23, 12, 0)
  const ecrits: { path: string; text: string }[] = []
  on('clock.now', async () => ({ value: maintenant }) as any)
  on('env.get', async () => ({ value: '/home/essai' }) as any)
  on('fs.read', async () => ({ value: '{}' }) as any)
  on('fs.write', async (_$: any, e: any) => { ecrits.push({ path: e.path, text: e.text }); return { value: undefined } as any })
  on('session.measure', async (_$: any, e: any) => ({ changed: e.changed }) as any)
  const journal: string[] = []
  on('ui.log', async (_$: any, e: any) => { journal.push(String(e.text ?? e.message ?? JSON.stringify(e))); return { value: undefined } as any })
  const limites = [
    { kind: 'five_hour', percentUsed: 42, resetsAt: '2026-10-23T15:00:00Z' },
    { kind: 'seven_day', percentUsed: 31.5 },
  ]
  const mesure = (changed: string[]) => $.session.measure({ context: {} as any, rateLimits: limites, changed } as any)
  await mesure(['context', 'rateLimits'])
  await mesure(['context'])
  maintenant += 61_000
  await mesure(['context'])
  await mesure(['rateLimits'])
  await $.session.measure({ context: {} as any, rateLimits: [], changed: ['context'] } as any) // laisse finir les écritures
  expect(journal).toEqual([])
  expect(ecrits.map(e => e.path)).toEqual(Array(3).fill('/home/essai/.local/state/abonnements/claude.json'))
  expect(JSON.parse(ecrits[0]!.text)).toEqual({
    mesure: '2026-10-23T12:00:00.000Z',
    fenetres: [
      { kind: 'five_hour', percentUsed: 42, resetsAt: '2026-10-23T15:00:00Z' },
      { kind: 'seven_day', percentUsed: 31.5, resetsAt: null },
    ],
  })
  expect(ficheLimites([], maintenant)).toBe(null)
})

test('lecteur mort : bandeau, incident noté, relance, puis le fil repart', async ($, on) => {
  // 02/11/2026 : un lecteur arrêté figeait le fil sans un mot, et /fil ne le relançait pas.
  const clock = mock.clock(on)
  const etat = new Map<string, { value: unknown; version: number }>()
  const ecrits: Record<string, string> = {}
  let lancements = 0
  on('session.id', async () => ({ value: 'session-essai' }))
  on('session.start', async () => ({ cwd: '/essai' }))
  on('command.register', async () => ({ value: undefined }))
  on('tool.register', async () => ({ value: undefined }))
  on('env.get', async () => ({ value: '/maison' }))
  on('fs.read', async (_$, e) => {
    if (ecrits[e.path] === undefined) throw new Error('ENOENT')
    return { value: ecrits[e.path] }
  })
  on('fs.write', async (_$, e) => { ecrits[e.path] = e.text; return { value: undefined } })
  on('state.get', { plugin: 'fil' }, async (_$, e) => ({ value: etat.get(e.key) ?? { value: undefined, version: 0 } }))
  on('state.set', { plugin: 'fil' }, async (_$, e) => {
    const version = (etat.get(e.key)?.version ?? 0) + 1
    etat.set(e.key, { value: e.value, version })
    return { value: { isSet: true, version } }
  })
  on('process.spawn', async function* () {
    lancements++
    const n = lancements
    yield { stream: 'stdout', text: JSON.stringify({ entrees: [{ type: 'moi', heure: '08:2' + n, texte: `lecture ${n}` }], vus: [] }) + '\n' }
    if (n === 1) {
      yield { stream: 'stderr', text: 'Traceback…\nAttributeError: boum\n' }
      return { value: { code: 1, signal: null } }
    }
    await clock.sleep(60_000)
    return { value: { code: 0, signal: null } }
  })
  await $.session.start({ cwd: '/essai', surface: null, isInteractive: false })
  await clock.settle()
  expect(lancements).toBe(1)
  expect(etat.get('incident')?.value).toContain('AttributeError: boum')
  expect(ecrits['/maison/.local/state/fil/incidents.log']).toContain('session-essai fin du lecteur : AttributeError: boum')
  await clock.advance(2000)
  await clock.settle()
  expect(lancements).toBe(2)
  expect(etat.get('incident')?.value).toBe('')
  expect((etat.get('entrees')?.value as any[])[0].texte).toBe('lecture 2')
})

test('limites : rien n’est écrit tant que le fichier n’existe pas', async ($, on) => {
  const ecrits: string[] = []
  on('clock.now', async () => ({ value: Date.UTC(2026, 9, 23, 12, 0) }) as any)
  on('env.get', async () => ({ value: '/home/autre' }) as any)
  on('fs.read', async () => { throw new Error('ENOENT') })
  on('fs.write', async (_$: any, e: any) => { ecrits.push(e.path); return { value: undefined } as any })
  on('session.measure', async (_$: any, e: any) => ({ changed: e.changed }) as any)
  const limites = [{ kind: 'five_hour', percentUsed: 42 }]
  await $.session.measure({ context: {} as any, rateLimits: limites, changed: ['rateLimits'] } as any)
  await $.session.measure({ context: {} as any, rateLimits: [], changed: ['context'] } as any)
  expect(ecrits).toEqual([])
})
