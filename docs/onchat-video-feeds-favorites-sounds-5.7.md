# OnChat 5.7 — fils vidéo distincts, favoris, sons et positions

Cette livraison remplace explicitement le filtre combiné de 5.5/5.6 par la définition demandée :

- **Pour toi** : uniquement les vidéos du compte connecté (`feed=mine`).
- **Suivis** : uniquement celles des comptes suivis (`feed=following`).
- **Explorer** : vidéos publiques récentes de tous les diffuseurs (`feed=explore`), accessible également sans session.
- **Favoris** : vidéos enregistrées par le compte connecté (`feed=favorites`).

`GET /api/v1/media/videos` accepte ce paramètre ; la pagination et le filtrage sont exécutés par PostgreSQL. `publisherId` conserve le profil média public complet, indépendant des abonnements. Les publications privées ou expirées restent exclues. Les requêtes concurrentes de changements d’onglet Android ne peuvent pas remplacer le fil sélectionné avec un ancien résultat. Le bouton Profil du lecteur Android ouvre maintenant le profil média, avec grille de ses publications et chargement des suivantes, au lieu du profil financier.

## Favoris persistants

La migration additive `20261101_onchat_video_favorites.sql` crée `onchat_video_favorites(user_id,media_id,created_at)`, clé unique utilisateur/vidéo. Les routes `PUT` et `DELETE /api/v1/media/videos/{id}/favorite` utilisent la session courante, sont idempotentes et ne modifient jamais les favoris d’un autre compte. L’API vidéo retourne `interactions.isFavorite` et `interactions.favorites`. Android et web attendent l’accusé API ; aucun favori n’est simulé par un simple basculement local.

## Sons et auteur original

La table existante `onchat_video_sounds` lie la vidéo publiée à son auteur sonore et à `source_media_id`. Les listes et détails vidéo retournent maintenant cet auteur, sa photo, le titre et l’autorisation. Le disque et le libellé Android affichent l’auteur du son réutilisé ; l’avatar du créateur de la vidéo reste distinct.

`GET /api/v1/media/videos/{id}/sound` est public pour une vidéo publique ; la réutilisation et la publication restent contrôlées côté serveur. `PATCH` sur cette route permet au propriétaire d’une vidéo originale d’autoriser la réutilisation après confirmation de ses droits, ou de retirer cette autorisation. Un utilisateur ayant réutilisé un son ne peut pas s’en déclarer l’auteur ni modifier les droits du son racine. Le panneau Son Android propose cette autorisation à l’auteur. Une ancienne vidéo sans déclaration de droits n’est pas automatiquement considérée comme libre.

La réutilisation passe le vrai fichier source à Media3 : capture ou import, montage puis publication avec le `soundSourceId` racine vérifié dans la transaction. La capture peut jouer le son choisi pendant l’enregistrement ; le montage d’une réutilisation coupe le son d’origine par défaut et place la piste de l’auteur sélectionné. Le crédit persiste après publication. Aucun fichier audio fictif n’est créé et aucune autorisation n’est déduite arbitrairement.

## Position réellement partagée

Les coordonnées et les lieux fixes de Kinshasa ont été supprimés du parcours de position. L’utilisateur autorise le GPS/position approximative, demande un relevé récent, voit ses coordonnées et la précision, puis confirme l’envoi. Un refus, un délai ou une position trop ancienne n’envoie rien. Ce partage est ponctuel, sans faux suivi continu.

Les routes directes et de groupe conservent désormais `latitude`, `longitude`, titre et précision dans les métadonnées. La validation commune refuse les valeurs absentes, vides, non finies ou hors limites. Les bulles Android/web ouvrent ces coordonnées exactes et ne substituent aucune ville aux anciens messages sans coordonnées.

## Appels et avatars

Le contrôle périodique de contexte d’appel ne raccroche plus lors d’une perte réseau ou d’un HTTP 503. L’API distingue une panne temporaire d’un appel terminé (410), d’une session absente (401) et d’un refus d’accès (403). Seule une fin/refus confirmé ferme la surface ; les délais d’absence de réponse restent applicables.

Les événements de salle transmettent les photos réelles et noms aux participants autorisés. Les tuiles de réunion, conférences et appels utilisent les initiales du nom/prénom si la photo manque ou échoue. Le profil local emploie le vrai champ `profile_photo`.

## Liens et lecteur web public

Les liens restent `https://app.cashpay-all.com/onchat/videos/{id}`. Le lecteur public et la page `/onchat/videos?publisherId=...` affichent créateur, auteur sonore, contrôles, commentaires, abonnement et favoris. La connexion n’est requise que pour les actions authentifiées. Les anciens liens de connexion vers une page feedback inexistante sont remplacés par `/login` avec retour au lecteur.

Android reçoit les liens HTTPS et `onchat://videos/{id}`, valide strictement domaine/chemin, et ouvre la vidéo demandée. Un compte non connecté conserve le lien pendant la connexion. Le navigateur présente aussi un bouton explicite d’ouverture OnChat.

**Vérification de domaine à configurer** : `/.well-known/assetlinks.json` expose uniquement les empreintes SHA-256 réelles de la clé de distribution fournies dans `ONCHAT_ANDROID_SHA256_CERT_FINGERPRINTS` (séparées par des virgules). Sans cette configuration, le site reste lisible mais Android peut ouvrir le navigateur ou demander le choix d’application. Aucune empreinte de production n’a été inventée et la clé debug n’a pas été autorisée sur le domaine.

## Validation et mise en service

Tests locaux sur PostgreSQL : quatre fils disjoints selon leur définition, pagination, favoris persistants/idempotents et isolés par compte, droit d’auteur original et révocation, détail public d’une réutilisation et attribution racine, transmission des coordonnées directes/groupes, et erreurs d’appel différenciées. Le composant d’appel réel a été exercé contre des réponses 503/perte de transport/410. Les vérifications WebSocket de deux participants, compteurs et signalisation restent valides. Tests JVM sur les modèles et liens Android compilés, compilation web et assemblages Android debug/release.

La première tentative web a détecté une directive déplacée, corrigée avant livraison. Un premier daemon Gradle a été interrompu lors des builds simultanés ; les builds finaux sont exécutés séparément. Les erreurs TypeScript globales historiques restent documentées dans la livraison 5.5 ; le build Next du projet ignore types/lint.

Appliquer manuellement les migrations précédentes, puis celle des favoris (ou le bundle Adminer 5.7 livré), livrer ensemble backend/serveur WebSocket et APK 5.7, configurer les empreintes de signature réelles pour App Links. Rien n’est exécuté automatiquement sur la base de production. Pas de merge/main ni déploiement par cette mission. Le projet backend est Next.js/PostgreSQL : les routes existantes sont réutilisées sans créer un second serveur Laravel.

Restent à vérifier sur appareils : position GPS et autorisations réelles, montage avec son importé/capturé, App Links avec l’APK signé, lecture entre réseaux avec TURN et appels/caméras de deux téléphones. Une correction de gestion d’erreur n’est pas une preuve d’appel média en production.
