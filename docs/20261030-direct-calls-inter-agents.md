# Appels directs et agences internationales — 30 octobre 2026

Les appels audio/vidéo utilisent désormais un identifiant conservé lors du décrochage, une salle privée WebRTC et une interface plein écran. Un participant peut être invité ; seul l'initiateur ouvre l'accès par lien. Les conférences sont limitées à dix participants. Les médias passent par WebRTC ; WebSocket transporte la signalisation, pas le flux audio brut.

Les comptes nommés agents internationaux accèdent à `/inter-agent`. La nomination, la supervision et le journal sont accessibles dans `/super-agent/inter-agents`. Les capacités sont distinctes du rôle financier existant. La file masque les coordonnées et références avant autorisation : devis exact, PIN, contrôle du solde et réservation atomique du montant net. À 3 %, pour 100 USD reçus extérieurement, le portefeuille agent finance 97 USD au client ; les 3 USD restent dans les fonds externes de l'agent. Aucun crédit supplémentaire de commission n'est créé dans CashPay.

Le paiement exige une attestation de récupération externe et une référence de reçu. Un rejet non encaissé restitue la réservation ; un dossier encaissé contesté conserve les fonds réservés. Les opérations sont journalisées et les notifications internes sont transactionnelles. Les résultats des tentatives de livraison SMS/mail/WhatsApp sont consignés ; leur réception effective dépend des services configurés. Les anciens faux suivis et fausses références Western Union/MoneyGram/Ria sont supprimés : sans intégration fournisseur configurée, le traitement reste une déclaration et une vérification manuelles.

## Déploiement à valider

Aucune migration ni intervention en production n'a été exécutée. Vérifier/sauvegarder le schéma réel avant exécution dans Adminer. Appliquer d'abord `migrations/20261030_onchat_meeting_schema_compatibility.sql` si nécessaire, puis `migrations/20261030_onchat_direct_calls.sql` et `migrations/20261030_inter_agent_claims.sql`. Ces scripts dépendent des tables existantes `users`, `transactions`, `international_transfer_claims`, `call_logs` et réunions ; ils ne remplacent pas le schéma initial.

Mettre à jour ensemble le serveur web et le serveur WebSocket. Leur secret JWT doit correspondre ; l'URL WebSocket publique doit être accessible en WSS et correspondre à la configuration Android. Configurer STUN/TURN pour les réseaux mobiles et NAT restrictifs. Le ticket WebSocket navigateur est limité à 30 secondes et à un usage ; il n'est pas un jeton de session HTTP. Installer Android 5.2 des deux côtés et conserver un WebView à jour.

## Vérifications et limites

Build Next.js exécuté ; diagnostics TypeScript des fichiers modifiés : zéro. Le dépôt conserve des problèmes de typage et avertissements de build préexistants, dont des exports absents hors périmètre. Vérifications temporaires hors dépôt avec PostgreSQL WASM : migrations, réservation/paiement/rejet, double paiement, insuffisance, changement de taux, cloisonnement, échecs PIN persistants, absence d'acquisition imbriquée du pool. Appels : identifiant stable, autorisations, invitation, admission, fin idempotente, ticket à usage unique et véritables handshakes WebSocket locaux.

Ces vérifications isolent la session et les fournisseurs externes. Elles ne constituent pas un test de production : caméra/micro entre appareils physiques, traversée NAT/TURN, notifications téléphone et encaissement réel Western Union/MoneyGram restent à valider avec les services et comptes autorisés. Aucun jeu de données simulé ni fichier de test n'est livré dans l'application.
