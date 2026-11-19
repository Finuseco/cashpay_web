# Main : publications, newsletters et suivi des demandes

La vitrine `cashpay-main` reste statique. Toutes ses nouvelles requêtes utilisent
`https://app.cashpay-all.com/api/main`, dans le processus Next.js existant de
`cashpay_web`. Aucun service Main supplémentaire n'est nécessaire.

## Installation

Déployer Web avant la nouvelle vitrine. Appliquer la migration PostgreSQL sur la
base déjà utilisée par Web, avec un compte autorisé à créer les nouvelles tables :

```bash
cd /var/www/cashpay-all/wallet
psql -v ON_ERROR_STOP=1 -f migrations/20261118_main_editorial.sql
npm ci
npm run build && pm2 restart cashpay-wallet --update-env
```

`psql` doit être configuré avec votre connexion habituelle à cette base
(PGHOST/PGPORT/PGDATABASE/PGUSER et fichier `.pgpass` protégé, par exemple).
Le fichier SQL ne modifie pas les comptes, rôles, soldes ou tables du wallet.
Toutes les nouvelles tables sont regroupées dans ce fichier SQL unique.

Dans l'environnement serveur Web déjà protégé, conserver les paramètres DB et
SMTP qui fonctionnent. Ajouter :

- `MAIN_SITE_URL=https://cashpay-all.com` : origine publique des liens d'articles.
- `MAIN_NEWSLETTER_TOKEN_SECRET` : valeur aléatoire de 32 caractères minimum,
  stable, réservée aux liens de désinscription. Une rotation invalide les anciens
  liens ; conserver cette valeur dans les sauvegardes de configuration.
- `INTERNAL_JOB_SECRET` : autre valeur aléatoire de 32 caractères minimum,
  authentification des tâches planifiées par en-tête Bearer.
- `MAIN_TRUST_PROXY=1` seulement si Nginx remplace `X-Forwarded-For` par
  `$remote_addr` et que le port Next n'est pas accessible directement depuis Internet.
  Sans cette option, les quotas IP utilisent un groupe commun plutôt que des IP
  fournies par le navigateur.

Générer chaque nouvelle valeur sur le serveur avec `openssl rand -hex 32` et
l'enregistrer uniquement dans l'environnement protégé. Ne pas mettre les valeurs
réelles dans Git, dans Main, dans une URL ou dans les journaux.

L'expéditeur utilise `SMTP_HOST`, `SMTP_PORT` (587 par défaut), `SMTP_USER`,
`SMTP_PASSWORD` (ou `SMTP_PASS`), `MAIL_FROM` (ou SMTP_USER) et `MAIL_REPLY_TO`
facultatif. Port 465 : TLS direct ; autres ports : STARTTLS obligatoire ; certificat
vérifié. Aucun succès simulé si la configuration manque. Une réponse SMTP doit
accepter le destinataire demandé avant que l'envoi soit marqué envoyé. Ce statut
ne garantit pas l'arrivée dans la boîte principale du destinataire.

L'accès OTP réutilise les fournisseurs de livraison existants (SMTP, SMS Dream
Digital ou WhatsApp). Il échoue explicitement si le fournisseur choisi n'est pas
configuré ; aucun OTP de démonstration n'est accepté.

## Exécution des tâches programmées

Installer une seule entrée cron dans le serveur Web. Le script charge les mêmes
fichiers d'environnement Next, appelle exclusivement le domaine `app`, et ne
journalise ni secret ni destinataire :

```cron
* * * * * flock -n /tmp/cashpay-main-jobs.lock /usr/bin/node /var/www/cashpay-all/wallet/scripts/run-main-jobs.cjs >> /var/log/cashpay-main-jobs.log 2>&1
```

Test manuel du mécanisme (traite réellement les publications/réponses arrivées à
échéance) : `node scripts/run-main-jobs.cjs`.
La route `POST /api/main/internal/dispatch` exige `Authorization: Bearer …`.
Elle publie les articles dus, traite une quantité limitée de réponses puis de
newsletters. Les envois restent attendus dans la requête ; aucun travail détaché
après une réponse HTTP. Sans cron, les réponses/newsletters restent en attente.
Prévoir un délai proxy de 90 secondes pour cette route si la configuration
actuelle est plus courte. Les services ont des budgets de traitement bornés.

## Administration

Ouvrir `https://cashpay-all.com/dashboard.html`. Connexion : Wallet ID existant,
OTP reçu via le canal choisi, puis PIN du même portefeuille. Le compte doit être
`Admin` et `Active` en base. Aucun écran ne permet de s'attribuer le rôle Admin.
Le parcours utilise des défis à usage unique et des sessions propres à Main,
stockés hachés en base, sans accepter les JWT wallet en substitution.
Cookies de production `__Host-…`, Secure, HttpOnly, SameSite=Strict. L'OTP expire
après 10 minutes, les essais sont limités ; une session dure au maximum 8 heures.
Le rôle et le statut sont revérifiés à chaque requête protégée.

L'éditeur propose mise en forme, titres, listes, citation, liens, images HTTPS,
vidéo YouTube, tableaux, sections, code HTML et aperçu. Le serveur nettoie de
nouveau tout HTML ; scripts, attributs actifs et URL dangereuses sont retirés ou
refusés. Les images sont référencées par URL ; aucun téléversement de fichier
éditorial n'a été ajouté.

Enregistrer un brouillon, publier ou choisir une date. Activer « Notifier les
abonnés » pour créer la newsletter avec le contenu de l'article. Une publication
ne crée qu'une campagne : modifier un article déjà publié ne renvoie pas la même
newsletter. Modifier un brouillon ou une publication programmée met à jour la
campagne qui n'a pas encore commencé. Le tableau Newsletters suit les envois ;
il n'annonce pas de statistiques d'ouverture ou de réception en boîte mail.

## Consentement et données

Une inscription demande un consentement explicite puis un lien de confirmation
valable 24 heures. Une popup visible invite à consulter la boîte mail après
l’envoi du formulaire. Les mails affichent le logo CashPay en tête via une image
incorporée au message (CID). Les abonnés non confirmés ne reçoivent pas de publications.
Chaque mail contient le contenu publié, le lien du site et la désinscription.
Les jetons des liens sont dans le fragment URL, puis retirés de la barre d'adresse.
Après ouverture du lien de confirmation, la page visible valide l’inscription par
POST et affiche une popup de succès après réponse positive du serveur. Un
prérendu ou une page masquée attend sa mise au premier plan avant cette requête.
La désinscription conserve un bouton de validation explicite. L'audience est constituée au démarrage de
l'envoi, puis son consentement est revérifié avant chaque soumission SMTP.

Les candidatures et projets conservent leur circuit mail existant. Après une
livraison interne confirmée, seules les données suivantes sont enregistrées :
référence, type, adresse e-mail, statut, horodatages. **Ni CV, ni photo, ni document,
ni chemin de fichier, ni profil complet ne sont enregistrés dans ces tables.**
Une panne de ce registre ne transforme jamais une candidature déjà envoyée en
échec. Les références de demandes antérieures au déploiement ne sont pas importées
automatiquement. Consulter les boîtes mail pour les dossiers correspondants.
Un candidat n'est jamais inscrit automatiquement à la newsletter.

Les réponses du dashboard conservent leur objet, leur texte et leur date pour
l'envoi programmé. La file utilise des verrous/leases et cinq essais maximum
avec temporisation. Les tentatives en cours expirées peuvent être reprises.
SMTP et PostgreSQL ne forment pas une transaction unique : une panne entre
acceptation SMTP et confirmation SQL peut entraîner un doublon à la reprise.
Des Message-ID stables et l'unicité des campagnes réduisent ce risque ; aucune
garantie « exactement une fois » n'est annoncée. Les erreurs persistées ne
contiennent que des codes génériques.

## API

Public : GET `/articles`, GET `/articles/{slug}` ; POST
`/newsletter/subscribe`, `/newsletter/confirm`, `/newsletter/unsubscribe`.
Authentification : POST `/auth/start`, `/auth/otp`, `/auth/pin`, `/auth/logout` ;
GET `/auth/session`.
Admin : GET/POST `/admin/articles`, GET/PATCH `/admin/articles/{id}` ;
GET `/admin/campaigns`, `/admin/contacts`, `/admin/replies` ;
PATCH `/admin/contacts/{id}`, POST `/admin/replies`,
PATCH `/admin/replies/{id}` pour annuler une réponse en attente.
Toutes les routes admin contrôlent la session côté serveur.
CORS autorise uniquement `https://cashpay-all.com`,
`https://www.cashpay-all.com`, `https://app.cashpay-all.com`.
Les mutations exigent une origine autorisée, sauf la tâche interne authentifiée
par son en-tête secret. Les erreurs ne renvoient pas les détails SMTP/SQL.

## Vérification

Les tests de services utilisent des bases et transports injectés sans envoyer
aucun message réel :

```bash
node --test tests/main-*.test.* tests/careers.test.js tests/projects.test.js
```

Avant activation, exécuter aussi le build complet sur le serveur ou en CI,
appliquer la migration sur une base de validation et vérifier le parcours dans
un navigateur avec un administrateur et une adresse de test appartenant à l'équipe.

## Fusion Git Carrières bloquée sur le serveur

Pour le conflit historique add/add des quatre fichiers Carrières, le script
`scripts/resolve-careers-merge.sh` vérifie le dépôt, la branche, les fichiers
indexés et les logos avant intervention. Il sauvegarde les commits locaux dans
une branche et les fichiers/index dans un dossier privé de `.git`.
Il prend la version `origin/main` pour les quatre fichiers Carrières actifs,
valide leur syntaxe et les tests de mail simulés, termine la fusion puis intègre
le main récupéré. Les anciennes variantes restent dans la sauvegarde/historique.
Exécuter sans autre modification simultanée du dépôt. Un conflit différent ou
un échec de validation arrête le script ; les conflits ultérieurs nécessitent
un examen. Les fichiers `.env` et les médias téléversés restent hors de cette
opération. Le script n'exécute aucun build ni redémarrage.

Même si `git pull` est bloqué par la fusion, le script peut être récupéré ainsi :

```bash
cd /var/www/cashpay-all/wallet &&
git fetch origin main &&
careers_fix="$(mktemp /tmp/cashpay-merge.XXXXXX)" &&
git show origin/main:scripts/resolve-careers-merge.sh > "$careers_fix" &&
bash "$careers_fix"
```

Après succès : `npm run build && pm2 restart cashpay-wallet --update-env`.
