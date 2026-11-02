"""Oracles déclaratifs : réduction, branches, bruit et lectures fractionnées."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('transcript', Path(__file__).with_name('transcript.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Projection(unittest.TestCase):
    def setUp(self):
        self.fil = module.Fil('essai')
        self.parent = None
        self.numero = 0

    def ligne(self, type_, contenu='', **plus):
        self.numero += 1
        r = {'sessionId': 'essai', 'uuid': str(self.numero), 'parentUuid': self.parent,
             'timestamp': '2020-07-10T12:34:00Z', 'type': type_,
             'message': {'content': contenu}, **plus}
        self.parent = r['uuid']
        self.fil.ajouter(r)
        return r

    def test_dernier_bloc_du_tour_et_pas_seulement_final(self):
        self.ligne('user', 'Question')
        self.ligne('assistant', '=== ESSENTIEL ===\nancien\n===\n=== ESSENTIEL ===\nretenu\n===\ndétail')
        self.ligne('assistant', 'Conclusion sans cadre.')
        self.assertEqual([x['texte'] for x in self.fil.entrees()], ['Question', 'retenu'])
        self.ligne('user', 'Suite')
        self.ligne('assistant', 'début\n\nfin')
        self.ligne('assistant', 'z' * 400 + '\n\nautre paragraphe')
        final = self.fil.entrees()[-1]
        self.assertEqual(final['texte'], 'z' * 299 + '…')
        self.assertFalse(final['essentiel'])
        self.assertEqual(final['heure'], '10/07/2020 14:34')

    def test_bruit_origines_et_repetition_legitime(self):
        self.ligne('user', 'Bonjour')
        for extra in ({'isMeta': True}, {'isCompactSummary': True}, {'promptSource': 'system'},
                      {'isSidechain': True}, {'agentId': 'enfant'}):
            parent = self.parent
            self.ligne('user', 'injecté', **extra)
            if extra.get('isSidechain') or extra.get('agentId'):
                self.parent = parent
        for bruit in ('<system-reminder>secret</system-reminder>', '<task-notification>fin</task-notification>',
                      '<command-name>/usage</command-name>', '<local-command-stdout>usage</local-command-stdout>',
                      'Caveat: commande', '[Request interrupted by user]', '/fil texte'):
            self.ligne('user', bruit)
        self.ligne('user', 'Bonjour')
        self.assertEqual([x['texte'] for x in self.fil.entrees()], ['Bonjour', 'Bonjour'])

    def test_message_tape_en_session_interactive(self):
        # Forme réelle relevée le 06/10 dans une session interactive (claude 2.1.291).
        tape = {'origin': {'kind': 'human'}, 'promptSource': 'typed'}
        self.ligne('user', 'Tapé au clavier', **tape)
        self.ligne('assistant', 'Réponse')
        self.ligne('user', '/usage', **tape)
        self.ligne('user', 'Notification', origin={'kind': 'task-notification'})
        self.ligne('assistant', 'Autre réponse')
        self.assertEqual([x['texte'] for x in self.fil.entrees()], ['Tapé au clavier', 'Réponse', 'Autre réponse'])

    def test_compact_rejoue_et_branche(self):
        debut = self.ligne('user', 'gardé')
        reponse = self.ligne('assistant', 'réponse')
        self.ligne('user', 'abandonné')
        self.ligne('assistant', 'abandonné aussi')
        self.ligne('user', 'réédité', parentUuid=reponse['uuid'])
        frontiere = self.ligne('system', parentUuid=None, subtype='compact_boundary', logicalParentUuid=self.parent)
        self.ligne('user', 'résumé', isCompactSummary=True)
        self.ligne('user', 'suite')
        self.assertEqual([x['texte'] for x in self.fil.entrees()], ['gardé', 'réponse', 'réédité', 'suite'])
        # Un même UUID, conservé par le moteur, ne devient pas deux entrées.
        self.fil.ajouter(debut)
        self.assertEqual([x['texte'] for x in self.fil.entrees()], ['gardé'])

    def test_commande_masquee_separe_les_tours(self):
        self.ligne('user', 'Question')
        self.ligne('assistant', '=== ESSENTIEL ===\nréponse initiale\n===')
        self.ligne('user', '<command-name>/ma-skill</command-name>')
        self.ligne('user', 'corps injecté', isMeta=True)
        self.ligne('assistant', '=== ESSENTIEL ===\nréponse skill\n===')
        self.assertEqual([x['texte'] for x in self.fil.entrees()],
                         ['Question', 'réponse initiale', 'réponse skill'])

    def test_images_des_deux_outils_et_limite(self):
        for i in range(155):
            self.ligne('user', f'q{i}')
            self.ligne('assistant', f'r{i}')
        self.assertEqual(len(self.fil.entrees()), 300)
        self.assertEqual(self.fil.entrees()[0]['texte'], 'q5')
        for i, nom in enumerate(['mcp__fil__montrer', 'mcp__montrer__image']):
            self.ligne('assistant', [{'type': 'tool_use', 'id': str(i), 'name': nom}])
            self.ligne('user', [{'type': 'tool_result', 'tool_use_id': str(i), 'content':
                                [{'type': 'text', 'text': json.dumps({'chemin': '/x.png', 'legende': 'carré', 'largeur': 320, 'hauteur': 160})}]}])
        self.assertEqual(len([x for x in self.fil.entrees() if x['type'] == 'image']), 2)

    def test_image_a_sa_place_et_resultat_en_erreur(self):
        self.ligne('user', 'montre')
        self.ligne('assistant', '=== ESSENTIEL ===\nretenu\n===')
        self.ligne('assistant', [{'type': 'tool_use', 'id': 'image', 'name': 'mcp__fil__montrer'}])
        contenu = json.dumps({'chemin': '/carre.png', 'legende': 'carré', 'largeur': 320, 'hauteur': 160})
        self.ligne('user', [{'type': 'tool_result', 'tool_use_id': 'image', 'content': contenu}])
        self.ligne('assistant', 'fin sans cadre')
        self.assertEqual([x['type'] for x in self.fil.entrees()], ['moi', 'agent', 'image'])
        # Chaque entrée garde l'identifiant de sa ligne dans la conversation, pour y défiler.
        self.assertEqual([x['id'] for x in self.fil.entrees()], ['1', '2', 'image'])
        self.ligne('user', [{'type': 'tool_result', 'tool_use_id': 'image', 'content': contenu, 'is_error': True}])
        self.assertEqual(len(self.fil.entrees()), 3)

    def test_fichier_mauvaise_session_et_ligne_incomplete(self):
        with tempfile.TemporaryDirectory(prefix='fil-unitaire-') as dossier:
            chemin = Path(dossier) / 'essai.jsonl'
            ligne = self.ligne('user', 'entier')
            chemin.write_text(json.dumps(ligne) + '\n' + '{"incomplet":')
            sortie = subprocess.check_output([sys.executable, '-I', '-B', module.__file__, str(chemin), 'essai'], text=True)
            self.assertEqual(json.loads(sortie)['entrees'][0]['texte'], 'entier')
            refus = subprocess.run([sys.executable, '-I', '-B', module.__file__, str(chemin), 'autre'], capture_output=True)
            self.assertNotEqual(refus.returncode, 0)

    def test_reveil_par_tache_garde_les_deux_essentiels(self):
        # 02/11/2026 : l'ESSENTIEL d'avant un réveil (tâche de fond) disparaissait du fil.
        self.ligne('user', 'Lance le calcul')
        self.ligne('assistant', '=== ESSENTIEL ===\ncalcul lancé\n===')
        self.ligne('user', '<task-notification>fini</task-notification>', origin={'kind': 'task-notification'},
                   promptSource='system')
        self.ligne('assistant', '=== ESSENTIEL ===\nrésultat prêt\n===')
        textes = [e['texte'] for e in self.fil.entrees()]
        self.assertEqual(textes, ['Lance le calcul', 'calcul lancé', 'résultat prêt'])

    def test_ligne_de_forme_inconnue_ignoree(self):
        # 02/11/2026 : une forme inattendue ne doit pas tuer le lecteur (le fil se figeait).
        with tempfile.TemporaryDirectory(prefix='fil-unitaire-') as dossier:
            chemin = Path(dossier) / 'essai.jsonl'
            avant, apres = self.ligne('user', 'avant'), self.ligne('user', 'après')
            bizarres = [{'type': 'assistant', 'uuid': 'x1', 'sessionId': 'essai', 'message': None},
                        {'type': 'assistant', 'uuid': 'x2', 'sessionId': 'essai', 'message': {'content': ['brut']}},
                        [1, 2]]
            chemin.write_text('\n'.join(json.dumps(x) for x in [avant, *bizarres, apres]) + '\n')
            sortie = subprocess.check_output([sys.executable, '-I', '-B', module.__file__, str(chemin), 'essai'], text=True)
            self.assertIn('après', [e['texte'] for e in json.loads(sortie)['entrees']])


if __name__ == '__main__':
    unittest.main()
