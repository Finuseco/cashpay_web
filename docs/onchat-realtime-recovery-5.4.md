# OnChat 5.4 — messages, partages et appels en temps réel

Le serveur et les clients utilisent toujours le WebSocket partagé `wss://app.cashpay-all.com/ws`. Le service public doit être routé vers `server/onchat/ws-server.js`, avec les mêmes base et JWT_SECRET que le backend.

## Corrections

- Reconnexion après fermeture ou erreur du client PostgreSQL LISTEN ; la santé passe à 503 pendant l'interruption puis à 200 après réabonnement. Les clients sont invités à recharger leurs données et l'état des réunions est republié.
- À la connexion et après reprise de LISTEN, le serveur relit les 100 derniers messages directs non lus des dernières 24 heures, limités aux conversations du compte connecté. L'historique complet reste accessible par REST. Aucun message annulé par transaction n'est diffusé.
- Les appels encore en attente sont relus pour le seul destinataire ou invité autorisé, dans leur fenêtre initiale de 25 secondes. Le rattrapage n'allonge pas la sonnerie.
- Une réponse d'acceptation/refus est aussi envoyée aux appareils du compte qui répond. Un ancien timeout MISSED ne peut plus interrompre un appel déjà accepté ; une deuxième acceptation est idempotente.
- L'API de lecture des groupes transforme les métadonnées JSON stockées en objet avant de les retourner à Android, avec le véritable identifiant de conversation. Cela corrige les partages visibles sur le web mais non décodables sur mobile.
- Android déduplique les événements, conserve les métadonnées structurées des partages et ne vide plus sa liste de conversations pendant la synchronisation. Les réponses d'une ancienne session sont refusées lors de cette synchronisation. Les groupes entrants sont identifiés comme groupes.
- Les notifications de photo/audio/vidéo/document portent un libellé exploitable même si le contenu texte est vide. La gestion en arrière-plan arrête la sonnerie sur acceptation, refus ou fin et limite sa durée.

## Validation et limites

Les tests locaux PostgreSQL + vrais WebSockets vérifient les messages/audio, image hors connexion et rattrapage, exclusion des messages déjà lus, partage de groupe réservé aux membres actifs, reprise LISTEN avec santé 503/200, compteurs/participants et signalisation WebRTC, refus des tiers et transactions annulées. Les fonctions d'appel réelles vérifient la réponse sur les appareils concernés et le refus d'un timeout après acceptation.

Les classes Android compilées sont vérifiées sur JVM : déduplication, expiration et isolation après remise à zéro, événements de fin d'appel et identifiants, métadonnées mixtes et médias de groupe. Le build web conserve ses avertissements existants ; son contrôle global types/lint n'est pas déclaré propre.

Aucune nouvelle colonne/table. Les prérequis restent les migrations OnChat déjà livrées, notamment `20261101_shared_realtime.sql` pour les insertions de messages et partages et `20261030_onchat_direct_calls.sql` pour les appels. Voir aussi `docs/onchat-shared-realtime-20261101.md` pour le routage, l'instance unique et TURN. Le code ne lance pas de migration en production.

Le WebSocket transporte la signalisation ; WebRTC transporte les médias. Les essais physiques caméra/micro et la passerelle de production ne sont pas déclarés vérifiés. Android peut arrêter le service ; le réveil d'une application arrêtée de force nécessite un push système configuré. Aucun faux fournisseur ni faux succès n'est ajouté.
