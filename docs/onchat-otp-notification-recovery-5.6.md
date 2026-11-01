# OnChat 5.6 — OTP, notifications récupérables et galerie récente

## Résultat

La saisie OTP affiche six chiffres sur six traits. La saisie, le collage et l’autofill passent par un seul champ numérique ; le sixième chiffre déclenche une unique vérification serveur. Le passage au PIN attend la réponse API positive. Un code rejeté est effacé pour permettre une nouvelle saisie. Le bouton de validation manuelle et l’ancien champ encadré sont supprimés.

Sur un appareil avec Google Play Services, SMS User Consent propose de lire le seul SMS de vérification reçu pendant l’étape SMS, avec accord Android, sans permission générale de lecture des SMS. Cela accepte les messages existants des fournisseurs CashPay/OnChat sans imposer de changer leur format pour un hash de signature APK. Les six chiffres peuvent aussi être collés ou saisis manuellement. La disponibilité réelle de la suggestion dépend du fournisseur SMS, de Google Play Services et de l’appareil ; aucune réception SMS physique n’a été simulée comme réussie.

`GET /api/v1/onchat/notifications?cursor=...` constitue une récupération authentifiée des événements persistés, en complément du point d’entrée partagé `wss://app.cashpay-all.com/ws`, identique à celui de Wallet Best. L’endpoint retourne les mêmes enveloppes `chat.message.created` et `call.offer` : identifiant serveur, métadonnées réelles, auteur et avatar. Il vérifie l’appartenance aux conversations/groupes, écarte les activités déjà lues, et ne retourne que les appels/invitations encore en attente et datant de moins de 25 secondes selon le contrat existant (`MISSED`, sans acceptation ni fin, ou invitation `pending`).

La pagination utilise un curseur date à la microseconde + identité stable, 100 activités par page, historique initial de 24 heures. Le client ne fait avancer son curseur qu’après une réponse positive et utilise sa déduplication WebSocket existante. La récupération tourne toutes les 15 secondes pendant une session active, et parcourt immédiatement les pages supplémentaires. Une déconnexion de compte annule la récupération et efface son curseur. Le navigateur récupère également les messages manqués tant qu’une vue s’abonne au temps réel. Le WebSocket reste le transport immédiat, ce secours HTTP ne remplace pas la signalisation WebRTC.

Les paramètres Android proposent l’état réel de l’autorisation de notifications et un accès aux réglages système. Le retour au premier plan relance le service si la session est authentifiée. Une application forcée à l’arrêt ne peut pas être réveillée durablement par une simple WebSocket ; un fournisseur push mobile configuré reste nécessaire pour cette garantie. Aucun fournisseur ni secret n’a été inventé.

La publication et la capture utilisent maintenant le gestionnaire de médias récents OnChat : filtres photos/vidéos, tri par date, miniatures vidéo via Coil VideoFrameDecoder, accès Android limité aux médias sélectionnés pris en charge, et sélecteur système de secours. La musique du montage ouvre une liste audio dédiée ; l’ajout de plusieurs photos utilise le Photo Picker. Les autorisations sont demandées à la demande, et un refus laisse le sélecteur système disponible.

## Base et exploitation

Pas de nouvelle table en 5.6. La migration `20261101_onchat_reads_social.sql` de 5.5 reste requise pour le repère de lecture des groupes, ainsi que les migrations de réunions et `20261101_shared_realtime.sql` pour les événements instantanés. Le bundle Adminer de 5.5 et les migrations précédentes sont livrés séparément. Aucune requête n’a été exécutée en production. Le nouveau backend doit être livré avant l’APK 5.6 pour que la récupération REST soit disponible. Le serveur WebSocket doit charger les corrections 5.5. Un proxy public correct et un serveur TURN sont nécessaires pour les appels entre réseaux qui les exigent.

## Validation et limites

- Vérifications locales sur PostgreSQL isolé et routes réelles : authentification, refus de curseur invalide, 201 messages paginés sans doublon, isolement des groupes, métadonnées audio/photo, invitation d’appel autorisée, exclusion d’un appel accepté.
- Serveur WebSocket réel : deux participants, compteur et échange de signalisation réservés à la salle ; notification Wallet brute conservée pour compatibilité.
- Contrôles navigateur : ouverture précoce/différée de socket, confirmation d’admission, délai média et libération des pistes tardives.
- Build Next.js et compilation Android debug/release. Les tests de contrat JVM portent sur les classes Android compilées.
- Aucun test de réception SMS, d’autofill système, de permissions de galerie, de réponse depuis la barre Android, de son/caméra distante ou de réveil push sur téléphone physique. Le build Next existant ignore types/lint ; les erreurs historiques globales restent documentées dans le rapport 5.5. Les tests locaux sont hors des dépôts ; aucun exemple, mock, APK ou secret n’est poussé.

## Contrôle public sans identifiants

Le 1er novembre 2026, une demande Upgrade WebSocket HTTP/1.1 sans token sur `https://app.cashpay-all.com/ws` a retourné **401 Unauthorized**, ce qui est attendu pour un accès non authentifié. Cela confirme un refus de session, pas la version du processus derrière le proxy, la santé LISTEN ou un appel média réussi. Le contrôle initial en HTTP/2 retournait 404 : la vérification Upgrade doit être effectuée en HTTP/1.1. Aucun token réel ni commande de déploiement n’a été utilisé.
