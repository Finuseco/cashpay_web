# OnChat 5.8 — scène, partage d’écran et réunions SFU

## Comportement livré

Le logo existant est conservé. La réunion utilise les couleurs violettes OnChat, une scène principale et des vignettes. Toucher une vignette la place sur la scène ; l’ancienne scène rejoint les autres vignettes. Les présentations prennent la scène par défaut, mais un participant peut épingler une autre vidéo. Une vue grille et une pagination permettent de parcourir les grandes réunions sans monter cent lecteurs vidéo simultanés.

Les contrôles réels couvrent micro, caméra, partage d’écran, participants, discussion, son reçu/sortie audio, invitation par lien, main levée, changement de caméra, sélection grille/scène et sortie. Le navigateur propose aussi le plein écran. L’organisateur garde la gestion des tarifs/revenus, l’approbation/retrait de parole, le retrait d’un participant et la fin pour tous. Les photos viennent des comptes et les initiales remplacent une photo absente ou défaillante. Les états micro/caméra et les participants viennent des transports et des API, sans participants de démonstration.

La discussion de réunion est persistée dans PostgreSQL, réservée aux participants admis, et rafraîchie par le WebSocket partagé avec un secours HTTP. Les champs de saisie envoient réellement leurs messages et attendent leur confirmation.

L’enregistrement des réunions n’est pas implémenté dans cette livraison ; aucun bouton ne prétend démarrer un enregistrement fictif.

## Architecture pour dépasser huit personnes

L’ancien maillage WebRTC est conservé pour compatibilité et reste limité à **huit** participants. Il n’a pas été artificiellement présenté comme capable de cent caméras.

Un transport **LiveKit SFU** est ajouté pour les réunions plus grandes. Chaque client publie vers le serveur média et s’abonne aux flux nécessaires. La limite d’admission configurée est de **250 comptes** par défaut, ajustable via `ONCHAT_MEET_MAX_PARTICIPANTS` (2 à 1 000). Ce paramètre est une limite logicielle, pas une garantie de capacité réseau ou matérielle. Les admissions sont sérialisées par le verrou de réunion et la capacité est contrôlée avant PIN ou débit.

Le navigateur utilise `livekit-client` avec abonnements vidéo explicites : scène en qualité haute, vignettes en qualité basse, vidéos hors de la page non souscrites. L’audio est indépendant des tuiles visibles. La capture d’écran passe par `getDisplayMedia`, avec consentement du navigateur et publication d’une vraie piste distincte de la caméra en SFU.

Android utilise `livekit-android` et un rendu WebRTC natif pour les réunions SFU. Le parcours web existant reste responsable de l’admission, des billets et du PIN ; après admission, le pont de la WebView transmet un ticket média limité à cette réunion. La capture du téléphone utilise **MediaProjection**, le consentement Android et un service au premier plan avec notification OnChat. Elle peut présenter une autre application du téléphone, sans relais de captures JPEG ni faux aperçu local. Les permissions caméra/micro restent demandées à l’utilisateur ; un spectateur n’est pas forcé de publier. Les droits accordés ne forcent pas l’activation de sa caméra.

Le WebSocket Wallet Best/OnChat `/ws` conserve chat, notifications et événements de réunion. Les médias passent par WebRTC/SFU, pas sous forme de messages WebSocket financiers. Une identité média correspond à un compte : une nouvelle connexion du même compte remplace sa précédente connexion média. Les départs SFU sont rapprochés avec leur SID pour qu’un ancien appareil ne marque pas la nouvelle session comme partie.

## Routes et base

- `POST /api/v1/meetings/{meetCode}/connection` : session authentifiée et admission active exigées ; retourne le transport et, en SFU, un JWT court limité à la salle et aux permissions du membre. Aucune clé API secrète n’est envoyée à l’application. Sans SFU configuré, retourne le maillage à huit personnes.
- `GET/POST /api/v1/meetings/{meetCode}/messages` : cent derniers messages de réunion, insertion authentifiée, 2 000 caractères maximum, identité de l’auteur déterminée par la session. Les comptes retirés n’ont plus accès.
- `POST /api/onchat/media/webhook` : événements LiveKit signés ; vérification de signature avant toute écriture. Rapproche SID/admission/départ et rejette une connexion non admise ou retirée.
- Les commandes de parole, retrait, silence global et fin synchronisent le serveur média. Les révocations et arrêts média précèdent la confirmation en base ; les autorisations de publication ne sont accordées qu’après autorisation en base. Une panne de contrôle reste une erreur, pas un faux succès.

Migration manuelle : `migrations/20261102_onchat_meeting_media.sql`.

Elle ajoute `meeting_participants.media_session_id TEXT`, `meeting_participants.removed_at TIMESTAMPTZ` et la table `onchat_meeting_messages(id,meeting_id,user_id,content,created_at)`. Aucune donnée, aucun solde et aucun historique ne sont supprimés. Les migrations précédentes de compatibilité réunions/appels restent requises. Le code n’exécute pas ces migrations automatiquement en production.

## Configuration nécessaire avant production

Le backend doit recevoir les valeurs réelles suivantes, hors Git :

| Variable | Usage |
| --- | --- |
| `LIVEKIT_URL` | URL **WSS publique** du SFU, avec certificat valide |
| `LIVEKIT_API_KEY` | Clé du projet/serveur média |
| `LIVEKIT_API_SECRET` | Secret correspondant, exclusivement côté serveur |
| `LIVEKIT_API_URL` | URL interne HTTP(S) de contrôle, optionnelle ; sinon l’URL publique est utilisée |
| `ONCHAT_MEET_MAX_PARTICIPANTS` | Limite logique, 250 par défaut |

Deux possibilités : un projet LiveKit géré existant, ou le serveur compatible fourni dans `server/onchat/media/compose.yaml`. Le modèle Compose exige aussi le vrai `LIVEKIT_NODE_IP` public et `ONCHAT_MEDIA_WEBHOOK_URL`. Il ne contient ni clé inventée ni fichier `.env` prérempli.

Le webhook doit pointer sur `https://app.cashpay-all.com/api/onchat/media/webhook`, avec la même clé de projet. Il est indispensable pour le rapprochement des départs et le contrôle des sessions. Le proxy HTTPS média peut être préparé à partir de `server/onchat/media/nginx.conf.example`, dans un hôte TLS réel ; ce modèle n’écrase aucune configuration existante. Le serveur HTTP de contrôle écoute sur le loopback 7880, les ports média sont UDP 7882 et TCP 7881. Un relais TURN adapté est nécessaire pour les réseaux qui bloquent ces transports. Le dimensionnement réseau, les règles de pare-feu et TLS sont à valider sur le serveur choisi.

Ordre de mise en service : sauvegarde/contrôle du schéma ; application volontaire du SQL ; configuration du serveur SFU et du webhook signé ; livraison du backend et du processus WebSocket partagé ; installation de l’APK signé ; essais avec des comptes distincts. Le serveur SFU, le proxy et les secrets de production n’ont pas été configurés par cette mission. Aucun merge/main ni déploiement n’a été réalisé.

## Vérifications effectuées

1. Serveur LiveKit **réel** local en conteneur, clés éphémères, PostgreSQL/PGlite isolé et SDK RTC natif Node : **105 sessions connectées simultanément**, compteur confirmé par l’API du serveur, JWT/admissions et webhooks signés vérifiés. Un flux vidéo encodé de vérification a traversé le SFU jusqu’à un autre client. Les 105 sessions ne constituent pas un test de 105 caméras physiques.
2. Essai réel complémentaire à trois sessions après les changements de modération : autorisation/retrait de publication, expulsion, rejet de réadmission et fin de salle, discussion persistée et départ par SID.
3. Fonction d’admission réelle sur base isolée : limite de huit en maillage, admission supplémentaire en SFU, limite de 250 vérifiée avant PIN/débit et refus des membres retirés. Un départ HTTP ancien ne modifie pas une session SFU plus récente.
4. Composant web réel dans un banc de test temporaire : permutation scène/vignette, conservation de l’ancienne scène, grille de six tuiles paginée et priorité de présentation. Hook SFU : audio indépendant, vidéo limitée à la fenêtre visible, qualité scène/vignettes. Ces bancs utilisent des doublures hors Git ; ils ne sont pas des captures d’écran sur appareil physique.
5. Configuration Compose validée, syntaxe du serveur WS vérifiée, compilation Next.js et builds Android debug/release. Les contrôles TypeScript sont ciblés sur les fichiers changés ; les erreurs globales historiques et le fait que le build Next ignore types/lint restent ceux documentés dans les livraisons précédentes.

Les essais, clés locales et données de vérification sont hors des dépôts. Aucun mock, test, APK ou secret n’est poussé. Les premières tentatives ont identifié une dépendance SDK audio à résoudre via le dépôt JitPack restreint à son groupe et un peer Emoji Mart à déclarer explicitement ; les artefacts de livraison sont produits après correction.

## Limites restant à valider

Pas d’essai sur deux téléphones physiques, de consentement MediaProjection réel, d’audio Bluetooth, de rotation/capture du téléphone ni d’appel caméra sur réseaux mobiles. Pas de mesure WAN de cent caméras simultanées ni de garantie de charge de production. L’architecture, les contrôles et les sessions SFU locales ont été testés ; l’infrastructure publique et les appareils doivent être validés avant d’annoncer une capacité opérationnelle en production. Sans SFU configuré, la limite reste huit et le partage d’écran Android natif n’est pas activé.
