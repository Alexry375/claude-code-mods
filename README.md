# claude-code-mods

Des mods pour [Claude Code](https://claude.com/claude-code) en terminal : des modules de hooks qui
changent l'interface elle-même (panneaux, rendu des réponses, outils).

*Mods for the Claude Code CLI: **fil** keeps a side pane with your messages and the key summary of
each answer; **maths** draws the LaTeX in answers as Unicode, in 2D for display formulas.
Install lines below. Code comments and texts are in French.*

| Mod | Ce qu'il fait |
|---|---|
| [**fil**](fil) | Un panneau (`/fil`) qui garde l'essentiel de la conversation : tes messages, le bloc « ESSENTIEL » de chaque réponse, une ligne par image montrée. ↗ ramène au message. `/fil texte` le donne en texte brut. Ajoute aussi l'outil `montrer`, avec lequel l'agent affiche un PNG dans la conversation. |
| [**maths**](maths) | Dessine le LaTeX des réponses en Unicode : `$\lambda_1 \le \frac{a}{b}$` en ligne, et les blocs `$$…$$` en 2D (fractions, racines, sommes, matrices, `cases`, `aligned`). Ne touche qu'à l'affichage : le message enregistré garde son LaTeX (ctrl+o). |

## Installer

Dans une session Claude Code en terminal :

```
/plugin install fil --marketplace Alexry375/claude-code-mods
/plugin install maths --marketplace Alexry375/claude-code-mods
```

Réponds `y` pour ajouter la marketplace, puis choisis la portée (Entrée : utilisateur).

Depuis un shell :

```
claude plugin install fil --marketplace Alexry375/claude-code-mods
```

Dans l'application de bureau, où `/plugin` ne marche pas : bouton + à côté de la saisie, Plugins,
Add marketplace avec `Alexry375/claude-code-mods`, puis Add plugin.

Ces mods demandent une version récente de Claude Code, avec l'API des mods (`hooks.json` avec des
`modules`). `fil` a besoin de `python3` : son lecteur de transcription est en Python, sans
dépendance.

## fil en détail

- Le bloc retenu pour chaque réponse va d'une ligne qui contient `ESSENTIEL` et `═══` (ou `===`),
  par exemple `════ ESSENTIEL ════`, jusqu'à la ligne de cadre suivante (`────`, `═══`…). S'il y en
  a plusieurs, c'est le dernier. Sans ce bloc, le fil montre le début de la réponse, en gris.
  Demande à l'agent (dans ton `CLAUDE.md`, par exemple) d'ouvrir ses réponses par un tel bloc.
- Un réveil par une tâche de fond ou planifiée compte comme une nouvelle réponse.
- Si le lecteur de transcription s'arrête, le panneau l'affiche (« ⚠ fil : … ») et le relance
  seul. Chaque arrêt est noté dans `~/.local/state/fil/incidents.log` : heure, session et raison,
  jamais de texte de conversation.
- Facultatif : si `~/.local/state/abonnements/claude.json` existe, `fil` y écrit les fenêtres de
  l'abonnement (5 h, 7 jours, en %) que rapporte chaque réponse, pour une barre d'état ou un
  multiplexeur. `touch` ce fichier pour activer la fonction.

## Développer

```
claude --plugin-dir ./fil --plugin-dir ./maths   # charger les mods depuis ce dossier
claude plugin validate ./fil                      # ce que le moteur refuserait
claude plugin test ./fil                          # tests du mod
python3 fil/hooks/test_transcript.py              # tests du lecteur
```

Licence MIT.
