"""Projection du seul journal courant ; aucune écriture, aucun accès réseau."""
import datetime as dt
import glob
import json
import os
import re
import sys
import time
from collections import deque
from zoneinfo import ZoneInfo

PARIS = ZoneInfo('Europe/Paris')
OUTILS = {'mcp__fil__montrer', 'mcp__montrer__image'}
# Provenances qui ne sont pas l'utilisateur. Liste d'exclusion : la transcription a son propre vocabulaire
# (un message tapé y est `origin.kind: human`, `promptSource: typed`), différent de l'API des mods.
NON_HUMAINS = {'system', 'task-notification', 'scheduled-trigger', 'peer', 'peer-send-message',
               'projects-relay', 'channel', 'coordinator', 'observer', 'observer-activity',
               'auto-continuation'}
# Ce qui réveille l'agent sans que l'utilisateur écrive (fin d'une tâche de fond, tâche planifiée) :
# la réponse qui suit est un nouveau tour, son ESSENTIEL ne doit pas effacer le précédent.
REVEILS = {'task-notification', 'scheduled-trigger'}
CADRE = re.compile(r'^\s*[═─=]{3,}')
OUVERTURE = re.compile(r'[═=]{3}')
BRUIT = re.compile(
    r'<(?:system-reminder|task-notification|local-command-caveat|command-name|'
    r'local-command-stdout|command-message)\b|^Caveat:|'
    r'^\[Request interrupted by user|^This session is being continued from a previous conversation',
    re.I,
)


def texte(contenu):
    if isinstance(contenu, str):
        return contenu
    if isinstance(contenu, list):
        return '\n'.join(b.get('text', '') for b in contenu
                         if isinstance(b, dict) and b.get('type') == 'text')
    return ''


def essentiel(reponse):
    dernier = None
    corps = None
    for ligne in reponse.splitlines():
        if 'ESSENTIEL' in ligne and OUVERTURE.search(ligne):
            if corps is not None and '\n'.join(corps).strip():
                dernier = '\n'.join(corps).strip()
            corps = []
        elif corps is not None:
            if CADRE.search(ligne):
                if '\n'.join(corps).strip():
                    dernier = '\n'.join(corps).strip()
                corps = None
            else:
                corps.append(ligne)
    if corps is not None and '\n'.join(corps).strip():
        dernier = '\n'.join(corps).strip()
    return dernier


def debut(reponse):
    para = re.split(r'\n\s*\n', reponse.strip())[0]
    return para if len(para) <= 300 else para[:299] + '…'


def heure(timestamp):
    try:
        date = dt.datetime.fromisoformat(timestamp.replace('Z', '+00:00')).astimezone(PARIS)
        aujourd_hui = dt.datetime.now(PARIS).date()
        return date.strftime('%H:%M' if date.date() == aujourd_hui else '%d/%m/%Y %H:%M')
    except (ValueError, AttributeError):
        return 'heure inconnue'


def fiche(contenu):
    try:
        m = json.loads(texte(contenu))
        if (isinstance(m, dict) and isinstance(m.get('chemin'), str)
                and isinstance(m.get('legende', ''), str)
                and all(isinstance(m.get(k), (int, float)) and m[k] > 0
                        for k in ('largeur', 'hauteur'))):
            return {k: m.get(k, '') for k in ('chemin', 'legende', 'largeur', 'hauteur')}
    except (ValueError, TypeError):
        pass
    return None


class Fil:
    def __init__(self, session):
        self.session = session
        self.noeuds = {}
        self.outils = {}
        self.tete = None
        self.vus = deque(maxlen=512)

    def ajouter(self, ligne):
        if ligne.get('sessionId') != self.session or ligne.get('isSidechain') or ligne.get('agentId'):
            return
        ident = ligne.get('uuid')
        if not ident:
            # Le moteur enregistre aussi sa tête à la fermeture/reprise.
            if ligne.get('type') == 'last-prompt' and ligne.get('leafUuid') in self.noeuds:
                self.tete = ligne['leafUuid']
            return
        self.vus.append(ident)
        parent = ligne.get('parentUuid')
        if ligne.get('subtype') == 'compact_boundary':
            parent = ligne.get('logicalParentUuid') or parent
        contenu = ligne.get('message', {}).get('content', [])
        blocs = contenu if isinstance(contenu, list) else []
        type_ = ligne.get('type')
        actions = []
        date = ligne.get('timestamp')
        for b in blocs:
            if b.get('type') == 'tool_use' and type_ == 'assistant':
                self.outils[b.get('id')] = b.get('name')
            elif (b.get('type') == 'tool_result' and not b.get('is_error')
                  and self.outils.get(b.get('tool_use_id')) in OUTILS):
                m = fiche(b.get('content'))
                if m:
                    # La ligne de l'outil dans la conversation porte son tool_use_id.
                    actions.append({'type': 'image', 'timestamp': date, 'id': b.get('tool_use_id'), **m})
        t = texte(contenu).strip()
        propre = not (ligne.get('isMeta') or ligne.get('isCompactSummary')
                      or ligne.get('isVisibleInTranscriptOnly') or BRUIT.search(t))
        origine = ligne.get('origin', {})
        if isinstance(origine, dict):
            origine = origine.get('kind')
        humain = origine not in NON_HUMAINS and ligne.get('promptSource') not in NON_HUMAINS
        commande = t.startswith('/') or '<command-name>' in t
        if type_ == 'user' and humain and not ligne.get('isMeta') and commande:
            # Masquer une commande n'efface pas la frontière entre deux tours.
            actions.append({'type': 'frontiere'})
        elif type_ == 'user' and not ligne.get('isMeta') and origine in REVEILS:
            actions.append({'type': 'frontiere'})
        elif type_ == 'user' and propre and humain and t:
            # L'uuid de la ligne est aussi l'identifiant du message affiché : le clic y mène.
            actions.append({'type': 'moi', 'timestamp': date, 'id': ident, 'texte': t})
        elif type_ == 'assistant' and propre and t:
            bloc = essentiel(t)
            actions.append({'type': 'agent', 'timestamp': date, 'id': ident,
                            'texte': bloc if bloc is not None else debut(t),
                            'essentiel': bloc is not None})
        # Un UUID rejoué reste une seule ligne. Les parents d'origine permettent
        # de traverser le passé même si le compactage conserve certaines lignes.
        if ident not in self.noeuds:
            self.noeuds[ident] = (parent, actions)
        self.tete = ident

    def entrees(self):
        # Parcours inverse : le dernier ESSENTIEL du tour gagne, sinon son
        # dernier texte. Les images restent à leur place parmi les textes.
        envers, tour, selection, visites = [], [], None, set()
        ident = self.tete
        while ident in self.noeuds and ident not in visites:
            visites.add(ident)
            parent, actions = self.noeuds[ident]
            for a in reversed(actions):
                if a['type'] == 'agent':
                    if selection is None:
                        selection = a
                        tour.append(a)
                    elif not selection['essentiel'] and a['essentiel']:
                        tour.remove(selection)
                        selection = a
                        tour.append(a)
                elif a['type'] in ('moi', 'frontiere'):
                    envers.extend(tour)
                    if a['type'] == 'moi':
                        envers.append(a)
                    tour, selection = [], None
                else:
                    tour.append(a)
            if len(envers) >= 300:
                break
            ident = parent
        envers.extend(tour)
        return [{**{k: v for k, v in a.items() if k != 'timestamp'},
                 'heure': heure(a['timestamp'])} for a in reversed(envers[:300])]


IDENTIFIANT = re.compile(r'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')


def trouver(session):
    """Le journal de la session, retrouvé par son identifiant (`-` à la place du chemin).

    Depuis Claude Code 2.1.300, le module de sécurité intégré saute le `classic.SessionStart`
    des mods : le chemin n'arrive plus. L'identifiant (un UUID, le nom du fichier) désigne un
    seul journal ; on refuse s'il y en a plusieurs plutôt que d'en choisir un."""
    if not IDENTIFIANT.match(session):
        raise ValueError('identifiant de session invalide')
    base = os.environ.get('CLAUDE_CONFIG_DIR') or os.path.expanduser('~/.claude')
    trouves = glob.glob(os.path.join(glob.escape(base), 'projects', '*', session + '.jsonl'))
    if len(trouves) > 1:
        raise ValueError('plusieurs journaux pour cette session')
    return trouves[0] if trouves else None


def suivre(chemin, session, veille):
    # Le chemin vient d'un hook de la session, ou de son identifiant (`-`, voir trouver).
    cherche = chemin == '-'
    if cherche:
        chemin = trouver(session)
    elif os.path.basename(os.path.realpath(chemin)) != session + '.jsonl':
        raise ValueError('le fichier ne correspond pas à la session courante')
    fil, position, fichier, publie = Fil(session), 0, None, False
    parent = os.getppid()
    while True:
        if veille and os.getppid() != parent:
            break  # Claude Code tué sans prévenir (kill -9) : pas de lecteur orphelin
        change = False
        if chemin is None:
            chemin = trouver(session)  # une nouvelle session n'a pas encore de fichier
        try:
            if chemin is None:
                raise FileNotFoundError
            with open(chemin, 'rb') as flux:
                stat = os.fstat(flux.fileno())
                signature = (stat.st_dev, stat.st_ino)
                if signature != fichier or stat.st_size < position:
                    fil, position, fichier = Fil(session), 0, signature
                    change = True
                flux.seek(position)
                while True:
                    ligne = flux.readline()
                    if not ligne or not ligne.endswith(b'\n'):
                        break  # une écriture en cours sera relue entière
                    position = flux.tell()
                    try:
                        fil.ajouter(json.loads(ligne))
                    except (ValueError, TypeError, AttributeError, KeyError):
                        continue  # une ligne abîmée ou d'une forme inconnue ne condamne pas tout le fil
                    change = True
        except FileNotFoundError:
            pass  # une nouvelle session n'a pas encore de fichier
        if change or not publie:
            print(json.dumps({'entrees': fil.entrees(), 'vus': list(fil.vus)},
                             ensure_ascii=False), flush=True)
            publie = True
        if not veille:
            break
        time.sleep(0.1)


if __name__ == '__main__':
    suivre(sys.argv[1], sys.argv[2], '--suivre' in sys.argv[3:])
