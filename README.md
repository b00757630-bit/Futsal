# Session Futsal — Inscriptions & Équipes

Site web pour gérer les inscriptions à une session de futsal et constituer des équipes équilibrées en temps réel selon le niveau des joueurs.

## Fonctionnalités

- **Inscription à la session** : ajout de joueurs avec nom et niveau (S, A, B, C, D).
- **Niveaux** : S (le plus fort) → A → B → C → D (le plus faible).
- **Base de joueurs récurrents** : les joueurs sont mémorisés (en local ou partagés via Supabase) ; inutile de ressaisir le niveau à chaque session.
- **Équipes en temps réel** : répartition automatique et équilibrée des inscrits en deux équipes selon le niveau.
- **Réinitialiser les inscrits** : bouton pour vider la liste des inscrits de la session courante (sans effacer la base de joueurs récurrents).

## Utilisation

1. Ouvrir `index.html` dans un navigateur (aucune installation requise).
2. Saisir le **nom** d’un joueur et choisir son **niveau**, puis cliquer sur **Ajouter** (ou appuyer sur Entrée).
3. Pour un joueur déjà connu, le niveau se remplit automatiquement ; il suffit de cliquer sur **Ajouter**.
4. Depuis la liste « Joueurs récurrents », utiliser **Inscrire** pour ajouter un joueur en un clic.
5. Les deux équipes se mettent à jour automatiquement à chaque modification.
6. En fin de session, utiliser **Réinitialiser les inscrits** pour repartir sur une liste vide à la prochaine session.

## Stockage des données

Deux modes au choix :

- **Sans configuration** : joueurs récurrents dans le `localStorage` du navigateur, inscrits en mémoire. Les données ne sont pas partagées entre utilisateurs.
- **Avec Supabase** : en renseignant `config.js` (voir ci‑dessous), joueurs récurrents et liste des inscrits sont stockés en ligne et **partagés par toutes les personnes accédant au site**.

## Technique

- Une seule page HTML avec CSS et JavaScript intégrés.
- Algorithme d’équilibrage : tri des joueurs du plus fort au plus faible (S→D), puis attribution alternée pour rapprocher la somme des niveaux (S=5, A=4, B=3, C=2, D=1) entre les deux équipes.

## Fichiers

```
futsal-session/
  index.html       # Structure de la page
  styles.css       # Styles (thème, mise en page, composants)
  script.js        # Logique (inscriptions, équipes, local ou Supabase)
  config.js        # Configuration Supabase (optionnel)
  config.example.js
  assets/          # Logo et éventuelles images
  README.md        # Ce fichier
```

## Partager les données (Supabase)

Pour que joueurs récurrents et inscrits soient **partagés par tous les visiteurs** du site :

1. **Créer un projet** sur [supabase.com](https://supabase.com/) (gratuit).
2. **Créer les tables** : dans le projet Supabase, ouvre **SQL Editor** et exécute le script suivant :

```sql
-- Joueurs récurrents (nom unique, niveau)
create table if not exists public.players (
  name text primary key,
  level text not null check (level in ('S','A','B','C','D'))
);

-- Session courante (une seule ligne : id = 'current', inscrits = tableau JSON)
create table if not exists public.session (
  id text primary key default 'current',
  inscrits jsonb not null default '[]'::jsonb
);

-- Règles d'accès : lecture/écriture pour tous (anon)
alter table public.players enable row level security;
alter table public.session enable row level security;

create policy "Allow all on players" on public.players for all using (true) with check (true);
create policy "Allow all on session" on public.session for all using (true) with check (true);

-- Ligne initiale pour la session
insert into public.session (id, inscrits) values ('current', '[]'::jsonb) on conflict (id) do nothing;
```

3. **Récupérer l’URL et la clé anon** : dans le projet, **Settings** → **API** : note **Project URL** et **anon public** key.
4. **Configurer le site** : copie `config.example.js` en `config.js` (ou édite `config.js`) et remplace les valeurs :

```js
window.FUTSAL_SUPABASE_URL = 'https://TON_PROJET.supabase.co';
window.FUTSAL_SUPABASE_ANON_KEY = 'ta_cle_anon_publique';
```

5. Redéploie le site (ou recharge la page). Les données sont alors lues et enregistrées dans Supabase et partagées entre tous les utilisateurs.

## Déploiement

Le site est **100 % statique** : il suffit d’héberger les fichiers tels quels. Aucun serveur ni base de données n’est requis.

### Option 1 : GitHub Pages (gratuit)

1. Crée un dépôt GitHub et pousse le contenu du dossier `futsal-session` (la racine du site doit contenir `index.html`).
2. Dans le dépôt : **Settings** → **Pages** → **Source** : « Deploy from a branch ».
3. Choisis la branche (ex. `main`) et le dossier **/ (root)**.
4. Le site sera en ligne à `https://<ton-username>.github.io/<nom-du-repo>/`.

**Important** : si le dépôt s’appelle `futsal-session`, l’URL aura un préfixe `/futsal-session/`. Les chemins du type `assets/logo.png` et `styles.css` fonctionnent car ils sont relatifs. Pour une URL à la racine (`https://<username>.github.io/`), nomme le dépôt `<username>.github.io`.

### Option 2 : Netlify (gratuit)

1. Va sur [netlify.com](https://www.netlify.com/) et crée un compte.
2. **Drag & drop** : glisse le dossier `futsal-session` dans la zone « Deploy manually » sur le tableau de bord. Le site est en ligne en quelques secondes.
3. Ou **déploiement par Git** : connecte ton dépôt GitHub ; Netlify détectera un site statique et déploiera à chaque push.

Tu obtiendras une URL du type `https://nom-aleatoire.netlify.app`. Tu peux personnaliser le nom dans les paramètres.

### Option 3 : Vercel (gratuit)

1. Va sur [vercel.com](https://vercel.com/) et connecte ton compte GitHub.
2. Importe le dépôt contenant `futsal-session` (ou mets les fichiers à la racine du dépôt).
3. Vercel détecte un site statique ; valide le déploiement. Une URL du type `https://ton-projet.vercel.app` est créée.

### À savoir

- **Données** : sans Supabase, tout reste en local (localStorage + mémoire). Avec Supabase (voir section « Partager les données »), les données sont partagées par tous les visiteurs.
- Pour servir le site en **HTTPS** (recommandé), GitHub Pages, Netlify et Vercel le font automatiquement.
