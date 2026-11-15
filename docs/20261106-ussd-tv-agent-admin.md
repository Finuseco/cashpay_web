# USSD : TV, devises de réclamation, abonnement Agent et PIN

Les routes USSD existantes continuent d’appeler le même routeur. Les autres services sont conservés.

## Abonnements TV

Le catalogue affiche le prix et la devise avec le même ordre de priorité que le paiement : `base_price/base_currency`, puis `metadata.price/metadata.currency`, puis `price_usd/USD`. Un prix absent/invalide n’est pas remplacé par un abonnement gratuit. Canal+, StarTimes, DSTV, EasyTV et Bleusat disposent de leur sélection ; les forfaits sont paginés par quatre, avec 9 Suivant et 8 Précédent.

Après le décodeur, USSD affiche le prix source et **le montant réellement à débiter dans la devise choisie**. La conversion utilise le taux du pays existant. Un taux manquant bloque l’opération. La confirmation puis le PIN sont requis ; une hausse par rapport au montant confirmé refuse le paiement. Le moteur TV existant n’ajoute pas de frais de transaction supplémentaires.

La demande porte une clé UUID persistée dans la session USSD. Le débit et la ligne `subscriptions` en état `pending` sont atomiques ; reprendre la même demande ne débite pas à nouveau, même si le solde disponible a diminué. Une clé déjà utilisée pour d’autres données est refusée. Les notifications indiquent l’attente de traitement ; aucune activation fournisseur automatique n’est prétendue.

L’Admin traite les demandes dans le back-office séparé. `POST /api/v1/admin/tv-subscriptions` appelle le moteur existant `processTvSubscription` : activation après paiement confirmé et référence réelle du fournisseur, ou rejet avec remboursement atomique du paiement initial, frais éventuels compris, sans double remboursement. L’historique identifie l’opérateur qui a activé ou rejeté. Le client reçoit une notification interne de décision.

## Réclamations internationales

L’utilisateur choisit numériquement la devise du transfert puis la devise de réception : USD, EUR ou CDF. Les codes fournisseurs enregistrés sont `western_union`, `moneygram`, `ria`, comme le Web et les agents inter. La pièce d’identité du titulaire est associée à la demande ; son absence bloque la soumission. Les doublons non rejetés sont refusés sous verrou par utilisateur.

`GET /api/v1/admin/international-claims` fournit aux Admins les dossiers, l’agent chargé et le journal `inter_claim_audit`, avec acteur/ID Wallet, date, action et détails. `POST` appelle l’approbation administrative existante : seulement un dossier en attente non pris en charge, avec PIN, audit et notification atomiques. Cette approbation autorise le traitement et **ne crédite pas le client**. Les réservations de fonds, vérifications KYC, crédits réels et rejets des dossiers déjà pris en charge restent dans le moteur inter-agent. Les consultations et mouvements de ce moteur apparaissent dans le journal.

## Abonnement Agent

USSD lit les vrais tarifs `AGENT_SUB_PROMO` et `AGENT_SUB_NORMAL`, comme l’application Web. Le forfait, le prix USD et les 30 jours sont montrés avant confirmation/PIN. Le paiement utilise `AGENT_SUB`, crée l’abonnement actif et applique le rôle enum `Agent` dans la même transaction. Aucun débit supplémentaire si un abonnement est déjà actif ; un tarif modifié exige une nouvelle confirmation. Le renouvellement automatique n’est pas activé par cette inscription USSD.

## PIN

L’ancien appel à une fonction non importée est remplacé par un parcours opérationnel : PIN actuel, nouveau PIN de quatre chiffres, confirmation. La session ne conserve pas les PIN en clair : empreinte du hash actuel et nouveau hash bcrypt. La confirmation verrouille le compte et vérifie qu’il n’a pas changé depuis le début. Une notification est enregistrée atomiquement. Cinq PIN actuels incorrects bloquent ces réglages pendant quinze minutes dans le processus USSD. Une session ne peut pas être réutilisée avec un autre MSISDN.

## Schéma et déploiement

Aucune nouvelle table/colonne pour cette correction. Si elles ne sont pas installées, exécuter dans Adminer les migrations existantes :

1. `migrations/20261104_tv_catalog_currency_compatibility.sql` : colonnes de tarif TV, sans prix inventé.
2. `migrations/20261104_service_subscriptions.sql` : table de demandes payées et clé de reprise.
3. `migrations/20261030_inter_agent_claims.sql`, puis `migrations/20261101_inter_agent_provinces.sql` : moteur et audit inter-agent.

Ces scripts ne remplacent pas le catalogue commercial réel. Vérifier les droits SQL du service sur les tables et séquences. Déployer d’abord CashPay Web depuis `codex/super-agent-operations`, puis CashPay Admin depuis `codex/admin-dashboard`. Le portail utilise `CASH_PAY_APP_URL` (origine HTTPS ou loopback privée) et `JWT_SECRET` du même backend pour des appels serveur authentifiés ; aucun secret ou jeton backend n’est fourni au navigateur. Ne pas remplacer `ADMIN_SESSION_SECRET`, qui reste indépendant.

## Vérification

Les parcours réels du routeur, les SQL et moteurs de règlement ont été exécutés sur PostgreSQL isolé : prix des métadonnées, pagination, conversion, hausse de tarif refusée, paiement en attente, reprise, remboursement unique, activation manuelle, choix des devises, pièce et doublons, approbation/audit, abonnement Agent et PIN haché. Les tests Admin couvrent API et navigateur desktop/mobile, droits, PIN/CSRF, jeton serveur bref et affichage sûr des journaux. Transports, passerelle GSM et authentification de test interceptés hors du dépôt ; aucun débit réel, SMS, fournisseur ou base de production utilisé. Aucun essai de bout en bout chez l’opérateur télécom annoncé.

Le contrôle a également corrigé trois appels USSD de cartes qui omettaient l’ID du titulaire, le type de notification interne et la lecture de l’ID client pour l’OTP de retrait. Les signatures ont été vérifiées sans appel fournisseur. Les fichiers modifiés ne présentent plus de diagnostic TypeScript dans le contrôle ciblé. Le contrôle global reste bloqué par des erreurs de syntaxe préexistantes dans `paypal.ts`, `src/components/crypto/bitcoin-balance-card.tsx` et `src/components/events/layout.tsx` ; aucune compilation globale réussie n’est annoncée.
