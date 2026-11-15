# OnChat 5.5 — lectures, présence, vidéos et réunions

## Comportement livré

- `POST /api/v1/chat/conversations/{conversationId}/read` utilise exclusivement l’identité authentifiée. REST, actions web et événement WebSocket `chat.read` appellent la même fonction PostgreSQL `onchat_mark_read`. Les messages de toutes catégories deviennent lus en base ; les groupes ont un repère de lecture par membre actif. `chat.message.read` avertit les participants après la transaction. Android recharge les états persistés, y compris les messages déjà en cache.
- `presence.snapshot`, `presence.online` et `presence.offline` portent les identifiants utilisateur et wallet. La présence est fondée sur les connexions authentifiées actives ; posséder un token valide sans connexion ne signifie pas être en ligne. La fermeture du dernier appareil passe le compte hors ligne, et le démarrage du serveur nettoie les anciennes présences `online`. Seuls les correspondants reçoivent la présence.
- Les abonnements sont confirmés après réponse du serveur. Le fil par défaut présente ses propres vidéos, celles des profils suivis et celles des auteurs dont on a réutilisé un son. `publisherId` permet de paginer toutes les vidéos publiques d’un profil indépendamment de ce filtre. Les vidéos privées et expirées restent exclues ; une expiration NULL est autorisée.
- Les commentaires ont un formulaire visible sur Android et web. Publications et commentaires émettent des événements réels ; les nouvelles vidéos créent des notifications durables pour les abonnés. Les liens `/onchat/videos/{id}` ouvrent un lecteur web public avec défilement vertical, avatar, lecture, son, commentaires, abonnement et partage. Une entrée Vidéos existe dans OnChat web.
- Android utilise le même endpoint WebSocket configuré que Wallet Best. Les notifications affichent le logo OnChat et chargent l’avatar réel. La réponse directe passe par un BroadcastReceiver non exporté, contrôle le compte actif et attend la confirmation API avant de retirer la notification.
- La WebView des réunions dispose du pont audio natif et de la même adresse WebSocket. L’acquisition des médias et l’admission ont des délais bornés ; les erreurs et déconnexions arrêtent les pistes et ferment les connexions.

## Mise à jour PostgreSQL manuelle

Exécuter dans Adminer, sur une sauvegarde et après contrôle du schéma :

1. Les migrations de réunions et de temps réel déjà livrées, si elles ne sont pas appliquées : `20261030_onchat_meeting_schema_compatibility.sql`, `20261030_onchat_direct_calls.sql`, `20261101_meeting_timestamps.sql`, `20261101_shared_realtime.sql`.
2. `20261029_onchat_video_sounds.sql`.
3. `20261101_onchat_reads_social.sql`.

La dernière migration crée ou complète `user_followers`, `media_comments`, `media_likes`, ajoute `onchat_group_reads`, la fonction de lecture et les triggers sociaux. Elle ne supprime aucune relation ni historique. Elle s’applique en une transaction et peut être réexécutée. Des identités historiques manquantes ou des relations dupliquées provoquent un échec et un rollback ; elles doivent être réconciliées explicitement. Les anciennes dates absentes ne sont pas inventées. Les tables métier `users`, `media`, `groups`, `group_members`, `messages`, `conversation_participants` et `notifications` sont requises. Aucune migration n’a été exécutée en production par cette mission.

Après livraison et migration, redémarrer le service WebSocket existant pour charger les nouveaux abonnements LISTEN. Ce serveur garde les sessions et salles en mémoire : un seul processus doit servir ce point d’entrée tant qu’il n’y a pas de coordination entre instances. L’URL publique doit réellement router `/ws` vers ce processus. Les médias WebRTC utilisent ICE/STUN/TURN ; ils ne transitent pas comme des messages audio par WebSocket.

## Vérifications

- PostgreSQL isolé (PGlite), migration appliquée deux fois : persistance des lectures texte/photo/audio/partage, refus des tiers et membres retirés, lecture des groupes, abonnement idempotent, filtre du fil, profil public, commentaires et notifications des abonnés. Aucune donnée de démonstration ajoutée au dépôt.
- Serveur WebSocket réel contre cette base isolée : réception REST et socket des accusés de lecture, présence sur plusieurs appareils, instantané à la connexion et refus de diffusion aux tiers.
- Code navigateur réel : handshake socket déjà ouverte ou différée, admission de réunion, sortie de l’attente après accusé des participants, délai média et arrêt des captures autorisées trop tard.
- Build Next.js réussi. La vérification TypeScript ciblée conserve une erreur préexistante : `processMaxiCashPayout` importé par `group.actions.ts` n’est pas exporté par le service MaxiCash. Le build existant ignore les types/lint ; cela ne constitue pas une validation globale sans erreur.
- Android : compilation debug et release, version 5.5 / code 10. APK release non signé, signature de distribution nécessaire.

## Limites de validation

Pas de déploiement, fusion ou modification de base de production. Pas de test de bout en bout sur deux téléphones, de réponse système Android, de véritable caméra distante, de TURN de production ou de livraison push. Une WebSocket et un service actif permettent les notifications en arrière-plan lorsque le processus reste vivant ; réveiller une application arrêtée par Android exige un service push configuré. Les autorisations de notification, les restrictions batterie, le proxy public et TURN doivent être validés sur les appareils de destination.
